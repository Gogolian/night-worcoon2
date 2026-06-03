import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { col, isDbConnected } from '../db.js';
import { applyTemplate, generateFromPattern } from '../templateResolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

// ── File paths (used when MongoDB is not available) ────────────────────────────
const BUCKET_DIR  = join(__dirname, '..', '..', 'bucket');
const DATA_FILE   = join(BUCKET_DIR, 'data.json');
const CONFIG_FILE = join(BUCKET_DIR, 'config.json');

// ── In-memory storage ──────────────────────────────────────────────────────────
const storage  = new Map();
const counters = new Map();

// In-memory config cache — always kept in sync regardless of backend
let bucketConfig = { collections: [] };

// ── Helpers ────────────────────────────────────────────────────────────────────
function ensureBucketDir() {
  if (!existsSync(BUCKET_DIR)) mkdirSync(BUCKET_DIR, { recursive: true });
}

function rebuildCounters() {
  for (const [path, items] of storage.entries()) {
    let max = 0;
    for (const id of items.keys()) {
      if (/^\d+$/.test(id)) {
        const num = Number(id);
        if (num > max) max = num;
      }
    }
    if (max > 0) counters.set(path, max);
  }
}

// ── Debounced write-through ────────────────────────────────────────────────────
let saveTimer = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => flushData(), 100);
}

async function flushData() {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }

  if (isDbConnected()) {
    // ── MongoDB path ─────────────────────────────────────────────────────
    try {
      const currentPaths = Array.from(storage.keys());
      const ops = currentPaths.map(path => ({
        replaceOne: {
          filter: { _id: path },
          replacement: { _id: path, items: Object.fromEntries(storage.get(path)) },
          upsert: true
        }
      }));
      if (ops.length > 0) await col('bucket_data').bulkWrite(ops);
      await col('bucket_data').deleteMany({ _id: { $nin: currentPaths } });
    } catch (err) {
      console.error('🪣 Bucket: Failed to persist data to MongoDB:', err.message);
    }
  } else {
    // ── File path ────────────────────────────────────────────────────────
    try {
      ensureBucketDir();
      const serialized = {};
      for (const [path, items] of storage.entries()) {
        serialized[path] = Object.fromEntries(items);
      }
      const tmp = DATA_FILE + '.tmp';
      writeFileSync(tmp, JSON.stringify(serialized, null, 2), 'utf8');
      renameSync(tmp, DATA_FILE);
    } catch (err) {
      console.error('🪣 Bucket: Failed to persist data:', err.message);
    }
  }
}

// ── Config API (synchronous cache + async/sync write-through) ──────────────────
function loadConfig() {
  return bucketConfig;
}

function saveConfig(collections) {
  bucketConfig = { collections };

  if (isDbConnected()) {
    col('bucket_collections')
      .updateOne({ _id: 'config' }, { $set: { collections } }, { upsert: true })
      .catch(err => console.error('🪣 Bucket: Failed to persist config to MongoDB:', err.message));
  } else {
    try {
      ensureBucketDir();
      const tmp = CONFIG_FILE + '.tmp';
      writeFileSync(tmp, JSON.stringify({ collections }, null, 2), 'utf8');
      renameSync(tmp, CONFIG_FILE);
    } catch (err) {
      console.error('🪣 Bucket: Failed to persist config:', err.message);
    }
  }
}

function getBucketConfig() {
  return bucketConfig;
}

// ── Bootstrap: load persisted data into memory ─────────────────────────────────
export async function initBucket() {
  if (isDbConnected()) {
    // ── MongoDB path ─────────────────────────────────────────────────────
    try {
      const configDoc = await col('bucket_collections').findOne({ _id: 'config' });
      if (configDoc) {
        bucketConfig = { collections: configDoc.collections || [] };
        console.log(`🪣 Bucket: Loaded config with ${bucketConfig.collections.length} collection(s) from MongoDB`);
      }

      const dataDocs = await col('bucket_data').find({}).toArray();
      for (const doc of dataDocs) {
        storage.set(doc._id, new Map(Object.entries(doc.items || {})));
      }
      console.log(`🪣 Bucket: Loaded ${storage.size} collection(s) of data from MongoDB`);
    } catch (err) {
      console.error('🪣 Bucket: Failed to initialise from MongoDB:', err.message);
    }
  } else {
    // ── File path ────────────────────────────────────────────────────────
    try {
      if (existsSync(CONFIG_FILE)) {
        const raw = readFileSync(CONFIG_FILE, 'utf8');
        bucketConfig = JSON.parse(raw);
        console.log(`🪣 Bucket: Loaded config with ${(bucketConfig.collections || []).length} collection(s) from disk`);
      }
    } catch (err) {
      console.error('🪣 Bucket: Failed to load config:', err.message);
    }

    try {
      if (existsSync(DATA_FILE)) {
        const raw    = readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        for (const [path, items] of Object.entries(parsed)) {
          storage.set(path, new Map(Object.entries(items)));
        }
        console.log(`🪣 Bucket: Loaded ${storage.size} collection(s) from data.json`);
      }
    } catch (err) {
      console.error('🪣 Bucket: Failed to load data:', err.message);
    }
  }

  rebuildCounters();
}

// ── ID generators ──────────────────────────────────────────────────────────────
const ALPHANUMERIC_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateAlphanumeric(length = 8) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ALPHANUMERIC_CHARS.charAt(Math.floor(Math.random() * ALPHANUMERIC_CHARS.length));
  }
  return result;
}

function generateId(pattern, collectionPath, existingItems, idLength) {
  const MAX_RETRIES = 10;

  if (pattern === 'uuid') {
    for (let i = 0; i < MAX_RETRIES; i++) {
      const id = randomUUID();
      if (!existingItems.has(id)) return { id, error: null };
    }
    return { id: null, error: 'UUID collision limit reached' };
  }

  if (pattern === 'numeric') {
    for (let attempt = 0; attempt < 10000; attempt++) {
      const current = counters.get(collectionPath) || 0;
      const next    = current + 1;
      counters.set(collectionPath, next);
      const id = idLength && idLength > 0 ? String(next).padStart(idLength, '0') : String(next);
      if (!existingItems.has(id)) return { id, error: null };
    }
    return { id: null, error: 'Numeric ID generation failed — counter desynced with existing items' };
  }

  if (pattern === 'alphanumeric') {
    const len = (idLength && idLength > 0) ? idLength : 8;
    for (let i = 0; i < MAX_RETRIES; i++) {
      const id = generateAlphanumeric(len);
      if (!existingItems.has(id)) return { id, error: null };
    }
    return { id: null, error: 'Alphanumeric collision limit reached' };
  }

  try {
    const regex = new RegExp(`^(?:${pattern})$`);
    for (let i = 0; i < MAX_RETRIES; i++) {
      const candidate = generateFromPattern(pattern);
      if (candidate && regex.test(candidate) && !existingItems.has(candidate)) {
        return { id: candidate, error: null };
      }
    }
    return { id: null, error: `Could not generate ID matching pattern /${pattern}/ after ${MAX_RETRIES} attempts.` };
  } catch (err) {
    return { id: null, error: `Invalid ID pattern regexp: ${err.message}` };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function getCollection(path) {
  if (!storage.has(path)) storage.set(path, new Map());
  return storage.get(path);
}

function matchCollection(pathname, collections) {
  const normalized = normalizePath(pathname);

  for (const col of collections) {
    const colPath = normalizePath(col.path);

    if (normalized === colPath) {
      return { collection: col, normalizedColPath: colPath, resourceId: null };
    }

    if (normalized.startsWith(colPath + '/')) {
      const remainder = normalized.slice(colPath.length + 1);
      if (remainder && !remainder.includes('/')) {
        let resourceId;
        try { resourceId = decodeURIComponent(remainder); }
        catch { resourceId = remainder; }
        if (resourceId.includes('/')) continue;
        return { collection: col, normalizedColPath: colPath, resourceId };
      }
    }
  }
  return null;
}

export function normalizePath(p) {
  const raw = p.startsWith('/') ? p : '/' + p;
  return raw.length > 1 ? raw.replace(/\/+$/, '') : raw;
}

export { storage, counters, loadConfig, saveConfig, getBucketConfig, getCollection, flushData, scheduleSave, generateId };

// ── Plugin definition ──────────────────────────────────────────────────────────
export default {
  name: 'bucket',
  description: 'CRUD storage bucket — stores and serves resources created via POST',
  enabled: false,
  options: {},
  handler: async ({ req, requestBody, config, decision }) => {
    const { collections = [] } = config;
    if (collections.length === 0) return {};

    const url      = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method   = req.method.toUpperCase();
    const match    = matchCollection(pathname, collections);

    if (!match) return {};

    const { collection, normalizedColPath, resourceId } = match;
    const colPath = normalizedColPath;
    const items   = getCollection(colPath);

    // ── POST: create ───────────────────────────────────────────────────────
    if (!resourceId && method === 'POST') {
      let body = {};
      try {
        if (requestBody && requestBody.length > 0) body = JSON.parse(requestBody.toString('utf8'));
      } catch {
        return { action: 'mock', stopProcessing: true, mock: { statusCode: 400, headers: { 'Content-Type': 'application/json', 'X-Bucket-Source': 'bucket' }, body: JSON.stringify({ error: 'Invalid JSON body' }) }, metadata: { bucketMatched: true, bucketAction: 'error' } };
      }
      if (body !== null && (typeof body !== 'object' || Array.isArray(body))) {
        return { action: 'mock', stopProcessing: true, mock: { statusCode: 400, headers: { 'Content-Type': 'application/json', 'X-Bucket-Source': 'bucket' }, body: JSON.stringify({ error: 'Request body must be a JSON object' }) }, metadata: { bucketMatched: true, bucketAction: 'error' } };
      }
      if (body === null) body = {};

      const { id, error } = generateId(collection.idPattern || 'uuid', colPath, items, collection.idLength);
      if (error) {
        return { action: 'mock', stopProcessing: true, mock: { statusCode: 500, headers: { 'Content-Type': 'application/json', 'X-Bucket-Source': 'bucket' }, body: JSON.stringify({ error }) }, metadata: { bucketMatched: true, bucketAction: 'error' } };
      }

      let resource;
      if (collection.responseTemplate && typeof collection.responseTemplate === 'object') {
        const resolved = applyTemplate(collection.responseTemplate, { id, req, body });
        const extra = {};
        for (const [k, v] of Object.entries(body)) {
          if (!(k in resolved)) extra[k] = v;
        }
        resource = { ...resolved, ...extra, id };
      } else {
        resource = { ...body, id };
      }
      items.set(id, resource);
      scheduleSave();
      console.log(`🪣 Bucket: Created resource ${id} in ${colPath}`);
      return { action: 'mock', stopProcessing: true, mock: { statusCode: 201, headers: { 'Content-Type': 'application/json', 'X-Bucket-Source': 'bucket' }, body: JSON.stringify(resource) }, metadata: { bucketMatched: true, bucketAction: 'created' } };
    }

    // ── GET collection: list ───────────────────────────────────────────────
    if (!resourceId && method === 'GET') {
      const list = Array.from(items.values());
      console.log(`🪣 Bucket: Listed ${list.length} resource(s) from ${colPath}`);
      return { action: 'mock', stopProcessing: true, mock: { statusCode: 200, headers: { 'Content-Type': 'application/json', 'X-Bucket-Source': 'bucket' }, body: JSON.stringify(list) }, metadata: { bucketMatched: true, bucketAction: 'listed' } };
    }

    // ── GET resource ───────────────────────────────────────────────────────
    if (resourceId && method === 'GET') {
      if (items.has(resourceId)) {
        console.log(`🪣 Bucket: Retrieved resource ${resourceId} from ${colPath}`);
        return { action: 'mock', stopProcessing: true, mock: { statusCode: 200, headers: { 'Content-Type': 'application/json', 'X-Bucket-Source': 'bucket' }, body: JSON.stringify(items.get(resourceId)) }, metadata: { bucketMatched: true, bucketAction: 'retrieved' } };
      }
      console.log(`🪣 Bucket: Miss for GET ${resourceId} in ${colPath}, falling through`);
      return { metadata: { bucketMatched: true, bucketAction: 'miss' } };
    }

    // ── PATCH resource ─────────────────────────────────────────────────────
    if (resourceId && method === 'PATCH') {
      if (items.has(resourceId)) {
        let body = {};
        try {
          if (requestBody && requestBody.length > 0) body = JSON.parse(requestBody.toString('utf8'));
        } catch {
          return { action: 'mock', stopProcessing: true, mock: { statusCode: 400, headers: { 'Content-Type': 'application/json', 'X-Bucket-Source': 'bucket' }, body: JSON.stringify({ error: 'Invalid JSON body' }) }, metadata: { bucketMatched: true, bucketAction: 'error' } };
        }
        if (body !== null && (typeof body !== 'object' || Array.isArray(body))) {
          return { action: 'mock', stopProcessing: true, mock: { statusCode: 400, headers: { 'Content-Type': 'application/json', 'X-Bucket-Source': 'bucket' }, body: JSON.stringify({ error: 'Request body must be a JSON object' }) }, metadata: { bucketMatched: true, bucketAction: 'error' } };
        }
        if (body === null) body = {};

        const resource = { ...body, id: resourceId };
        items.set(resourceId, resource);
        scheduleSave();
        console.log(`🪣 Bucket: Updated resource ${resourceId} in ${colPath}`);
        return { action: 'mock', stopProcessing: true, mock: { statusCode: 200, headers: { 'Content-Type': 'application/json', 'X-Bucket-Source': 'bucket' }, body: JSON.stringify(resource) }, metadata: { bucketMatched: true, bucketAction: 'updated' } };
      }
      console.log(`🪣 Bucket: Miss for PATCH ${resourceId} in ${colPath}, falling through`);
      return { metadata: { bucketMatched: true, bucketAction: 'miss' } };
    }

    // ── DELETE resource ────────────────────────────────────────────────────
    if (resourceId && method === 'DELETE') {
      if (items.has(resourceId)) {
        items.delete(resourceId);
        scheduleSave();
        console.log(`🪣 Bucket: Deleted resource ${resourceId} from ${colPath}`);
        return { action: 'mock', stopProcessing: true, mock: { statusCode: 204, headers: { 'X-Bucket-Source': 'bucket' }, body: '' }, metadata: { bucketMatched: true, bucketAction: 'deleted' } };
      }
      console.log(`🪣 Bucket: Miss for DELETE ${resourceId} in ${colPath}, falling through`);
      return { metadata: { bucketMatched: true, bucketAction: 'miss' } };
    }

    return { metadata: { bucketMatched: true, bucketAction: 'miss' } };
  }
};
