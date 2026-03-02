import { randomUUID } from 'crypto';
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Paths ──────────────────────────────────────────────────────────────────────
const BUCKET_DIR = join(__dirname, '..', '..', 'bucket');
const DATA_FILE = join(BUCKET_DIR, 'data.json');
const CONFIG_FILE = join(BUCKET_DIR, 'config.json');

// ── In-memory storage ──────────────────────────────────────────────────────────
// Map<collectionPath, Map<id, object>>
const storage = new Map();

// Numeric auto-increment counters per collection
const counters = new Map();

// ── Ensure bucket directory exists ─────────────────────────────────────────────
function ensureBucketDir() {
  if (!existsSync(BUCKET_DIR)) {
    mkdirSync(BUCKET_DIR, { recursive: true });
  }
}

// ── Debounced atomic write ─────────────────────────────────────────────────────
let saveTimer = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => flushData(), 100);
}

function flushData() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
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

function saveConfig(collections) {
  try {
    ensureBucketDir();
    const tmp = CONFIG_FILE + '.tmp';
    writeFileSync(tmp, JSON.stringify({ collections }, null, 2), 'utf8');
    renameSync(tmp, CONFIG_FILE);
  } catch (err) {
    console.error('🪣 Bucket: Failed to persist config:', err.message);
  }
}

// ── Load persisted data on import ──────────────────────────────────────────────
function loadData() {
  try {
    if (existsSync(DATA_FILE)) {
      const raw = readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      for (const [path, items] of Object.entries(parsed)) {
        const map = new Map(Object.entries(items));
        storage.set(path, map);
      }
      console.log(`🪣 Bucket: Loaded ${storage.size} collection(s) from data.json`);
    }
  } catch (err) {
    console.error('🪣 Bucket: Failed to load data:', err.message);
  }
}

function loadConfig() {
  try {
    if (existsSync(CONFIG_FILE)) {
      const raw = readFileSync(CONFIG_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      console.log(`🪣 Bucket: Loaded config with ${(parsed.collections || []).length} collection(s)`);
      return parsed;
    }
  } catch (err) {
    console.error('🪣 Bucket: Failed to load config:', err.message);
  }
  return { collections: [] };
}

// Reconstruct numeric counters from persisted data
function rebuildCounters() {
  for (const [path, items] of storage.entries()) {
    let max = 0;
    for (const id of items.keys()) {
      const num = parseInt(id, 10);
      if (!isNaN(num) && num > max) max = num;
    }
    if (max > 0) counters.set(path, max);
  }
}

// Initialize on module load
loadData();
rebuildCounters();

// ── ID generators ──────────────────────────────────────────────────────────────
const ALPHANUMERIC_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateAlphanumeric(length = 8) {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += ALPHANUMERIC_CHARS.charAt(Math.floor(Math.random() * ALPHANUMERIC_CHARS.length));
  }
  return result;
}

/**
 * Generate a unique ID for a collection.
 * @param {string} pattern - 'uuid' | 'numeric' | 'alphanumeric' | custom regexp string
 * @param {string} collectionPath - collection path (for numeric counter tracking)
 * @param {Map} existingItems - existing items map to check uniqueness
 * @returns {{ id: string|null, error: string|null }}
 */
function generateId(pattern, collectionPath, existingItems) {
  const MAX_RETRIES = 10;

  if (pattern === 'uuid') {
    for (let i = 0; i < MAX_RETRIES; i++) {
      const id = randomUUID();
      if (!existingItems.has(id)) return { id, error: null };
    }
    return { id: null, error: 'UUID collision limit reached' };
  }

  if (pattern === 'numeric') {
    const current = counters.get(collectionPath) || 0;
    const next = current + 1;
    counters.set(collectionPath, next);
    const id = String(next);
    // Numeric is guaranteed unique via monotonic counter
    return { id, error: null };
  }

  if (pattern === 'alphanumeric') {
    for (let i = 0; i < MAX_RETRIES; i++) {
      const id = generateAlphanumeric(8);
      if (!existingItems.has(id)) return { id, error: null };
    }
    return { id: null, error: 'Alphanumeric collision limit reached' };
  }

  // Custom regexp pattern — generate a random string and validate against it
  // For simple patterns we use a basic generator; for complex ones, fall back to alphanumeric
  try {
    const regex = new RegExp(`^${pattern}$`);
    for (let i = 0; i < MAX_RETRIES; i++) {
      // Try generating candidates of varying lengths
      const candidate = generateAlphanumeric(12);
      if (regex.test(candidate) && !existingItems.has(candidate)) {
        return { id: candidate, error: null };
      }
    }
    // Fallback: use UUID and hope it matches (or just use it anyway for custom)
    const fallback = randomUUID();
    if (!existingItems.has(fallback)) return { id: fallback, error: null };
    return { id: null, error: `Could not generate ID matching pattern: ${pattern}` };
  } catch (err) {
    return { id: null, error: `Invalid ID pattern regexp: ${err.message}` };
  }
}

// ── Helper: get or create collection map ───────────────────────────────────────
function getCollection(path) {
  if (!storage.has(path)) {
    storage.set(path, new Map());
  }
  return storage.get(path);
}

// ── Helper: match request path to a configured collection ──────────────────────
/**
 * @param {string} pathname - e.g. /api/users or /api/users/abc-123
 * @param {Array} collections - configured collections
 * @returns {{ collection: object, resourceId: string|null } | null}
 */
function matchCollection(pathname, collections) {
  // Normalize: ensure leading slash, remove trailing slash
  const normalized = (pathname.startsWith('/') ? pathname : '/' + pathname).replace(/\/+$/, '');

  for (const col of collections) {
    const colPath = (col.path.startsWith('/') ? col.path : '/' + col.path).replace(/\/+$/, '');

    if (normalized === colPath) {
      // Exact match — collection-level request
      return { collection: col, resourceId: null };
    }

    if (normalized.startsWith(colPath + '/')) {
      // Check if there's exactly one more segment (the ID)
      const remainder = normalized.slice(colPath.length + 1);
      if (remainder && !remainder.includes('/')) {
        return { collection: col, resourceId: remainder };
      }
    }
  }
  return null;
}

// ── Exported helpers for API routes ────────────────────────────────────────────
export { storage, counters, loadConfig, saveConfig, getCollection, flushData, ensureBucketDir, scheduleSave, generateId };

// ── Plugin definition ──────────────────────────────────────────────────────────
/**
 * Bucket plugin — CRUD storage bucket
 * Stores and serves resources created via POST.
 * Falls through to mock/proxy when a resource is not found.
 */
export default {
  name: 'bucket',
  description: 'CRUD storage bucket — stores and serves resources created via POST',
  enabled: false,
  options: {},
  handler: async ({ req, requestBody, config, decision }) => {
    const { collections = [] } = config;

    if (collections.length === 0) {
      return {};
    }

    // Parse request URL
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method.toUpperCase();

    // Try to match against configured collections
    const match = matchCollection(pathname, collections);

    if (!match) {
      // No collection matched — don't interfere with pipeline
      return {};
    }

    const { collection, resourceId } = match;
    const colPath = collection.path;
    const items = getCollection(colPath);

    // ── POST on collection: create resource ────────────────────────────────
    if (!resourceId && method === 'POST') {
      let body = {};
      try {
        if (requestBody && requestBody.length > 0) {
          body = JSON.parse(requestBody.toString('utf8'));
        }
      } catch {
        return {
          action: 'mock',
          stopProcessing: true,
          mock: {
            statusCode: 400,
            headers: { 'Content-Type': 'application/json', 'X-Bucket-Source': 'bucket' },
            body: JSON.stringify({ error: 'Invalid JSON body' })
          },
          metadata: { bucketMatched: true, bucketAction: 'error' }
        };
      }

      const { id, error } = generateId(collection.idPattern || 'uuid', colPath, items);
      if (error) {
        return {
          action: 'mock',
          stopProcessing: true,
          mock: {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json', 'X-Bucket-Source': 'bucket' },
            body: JSON.stringify({ error })
          },
          metadata: { bucketMatched: true, bucketAction: 'error' }
        };
      }

      const resource = { id, ...body };
      items.set(id, resource);
      scheduleSave();

      console.log(`🪣 Bucket: Created resource ${id} in ${colPath}`);
      return {
        action: 'mock',
        stopProcessing: true,
        mock: {
          statusCode: 201,
          headers: { 'Content-Type': 'application/json', 'X-Bucket-Source': 'bucket' },
          body: JSON.stringify(resource)
        },
        metadata: { bucketMatched: true, bucketAction: 'created' }
      };
    }

    // ── GET on collection: list all resources ──────────────────────────────
    if (!resourceId && method === 'GET') {
      const list = Array.from(items.values());
      console.log(`🪣 Bucket: Listed ${list.length} resource(s) from ${colPath}`);
      return {
        action: 'mock',
        stopProcessing: true,
        mock: {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json', 'X-Bucket-Source': 'bucket' },
          body: JSON.stringify(list)
        },
        metadata: { bucketMatched: true, bucketAction: 'listed' }
      };
    }

    // ── GET on resource: retrieve by ID ────────────────────────────────────
    if (resourceId && method === 'GET') {
      if (items.has(resourceId)) {
        const resource = items.get(resourceId);
        console.log(`🪣 Bucket: Retrieved resource ${resourceId} from ${colPath}`);
        return {
          action: 'mock',
          stopProcessing: true,
          mock: {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'X-Bucket-Source': 'bucket' },
            body: JSON.stringify(resource)
          },
          metadata: { bucketMatched: true, bucketAction: 'retrieved' }
        };
      }
      // Not found — fall through with metadata
      console.log(`🪣 Bucket: Miss for GET ${resourceId} in ${colPath}, falling through`);
      return { metadata: { bucketMatched: true, bucketAction: 'miss' } };
    }

    // ── PATCH on resource: full override ───────────────────────────────────
    if (resourceId && method === 'PATCH') {
      if (items.has(resourceId)) {
        let body = {};
        try {
          if (requestBody && requestBody.length > 0) {
            body = JSON.parse(requestBody.toString('utf8'));
          }
        } catch {
          return {
            action: 'mock',
            stopProcessing: true,
            mock: {
              statusCode: 400,
              headers: { 'Content-Type': 'application/json', 'X-Bucket-Source': 'bucket' },
              body: JSON.stringify({ error: 'Invalid JSON body' })
            },
            metadata: { bucketMatched: true, bucketAction: 'error' }
          };
        }

        const resource = { id: resourceId, ...body };
        items.set(resourceId, resource);
        scheduleSave();

        console.log(`🪣 Bucket: Updated resource ${resourceId} in ${colPath}`);
        return {
          action: 'mock',
          stopProcessing: true,
          mock: {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json', 'X-Bucket-Source': 'bucket' },
            body: JSON.stringify(resource)
          },
          metadata: { bucketMatched: true, bucketAction: 'updated' }
        };
      }
      // Not found — fall through with metadata
      console.log(`🪣 Bucket: Miss for PATCH ${resourceId} in ${colPath}, falling through`);
      return { metadata: { bucketMatched: true, bucketAction: 'miss' } };
    }

    // ── DELETE on resource: remove ─────────────────────────────────────────
    if (resourceId && method === 'DELETE') {
      if (items.has(resourceId)) {
        items.delete(resourceId);
        scheduleSave();

        console.log(`🪣 Bucket: Deleted resource ${resourceId} from ${colPath}`);
        return {
          action: 'mock',
          stopProcessing: true,
          mock: {
            statusCode: 204,
            headers: { 'X-Bucket-Source': 'bucket' },
            body: ''
          },
          metadata: { bucketMatched: true, bucketAction: 'deleted' }
        };
      }
      // Not found — fall through with metadata
      console.log(`🪣 Bucket: Miss for DELETE ${resourceId} in ${colPath}, falling through`);
      return { metadata: { bucketMatched: true, bucketAction: 'miss' } };
    }

    // Unhandled method on a matched collection — fall through
    return { metadata: { bucketMatched: true, bucketAction: 'miss' } };
  }
};
