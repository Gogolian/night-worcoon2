/**
 * Jednorazowy skrypt migracji: czyta istniejące pliki JSON i upsertuje dane do MongoDB.
 * Uruchomienie: npm run db:seed  (z katalogu server/)
 * Idempotentny — bezpieczne wielokrotne uruchamianie.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = join(__dirname, '..', '..');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB  = process.env.MONGODB_DB  || 'night_worcoon';

function readJson(path) {
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, 'utf8'));
    }
  } catch (err) {
    console.error(`  ✗ Failed to read ${path}: ${err.message}`);
  }
  return null;
}

async function seed() {
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(MONGODB_DB);
  console.log(`Connected to MongoDB (${MONGODB_DB})\n`);

  // ── app_state ──────────────────────────────────────────────────────────────
  const stateFile = join(ROOT, 'state.json');
  const stateData = readJson(stateFile);
  if (stateData) {
    const { _id, ...stateFields } = stateData;
    await db.collection('app_state').updateOne(
      { _id: 'state' },
      { $set: stateFields },
      { upsert: true }
    );
    console.log('✓ app_state  ← state.json');
  } else {
    console.log('— app_state  (state.json not found, skipping)');
  }

  // ── bucket_collections ─────────────────────────────────────────────────────
  const configFile = join(ROOT, 'bucket', 'config.json');
  const configData = readJson(configFile);
  if (configData) {
    const collections = configData.collections || [];
    await db.collection('bucket_collections').updateOne(
      { _id: 'config' },
      { $set: { collections } },
      { upsert: true }
    );
    console.log(`✓ bucket_collections  ← bucket/config.json (${collections.length} collection(s))`);
  } else {
    console.log('— bucket_collections  (bucket/config.json not found, skipping)');
  }

  // ── bucket_data ────────────────────────────────────────────────────────────
  const dataFile = join(ROOT, 'bucket', 'data.json');
  const dataData = readJson(dataFile);
  if (dataData) {
    const ops = Object.entries(dataData).map(([path, items]) => ({
      replaceOne: {
        filter: { _id: path },
        replacement: { _id: path, items },
        upsert: true
      }
    }));
    if (ops.length > 0) {
      await db.collection('bucket_data').bulkWrite(ops);
    }
    console.log(`✓ bucket_data  ← bucket/data.json (${ops.length} collection(s))`);
  } else {
    console.log('— bucket_data  (bucket/data.json not found, skipping)');
  }

  // ── rules ──────────────────────────────────────────────────────────────────
  const rulesDir = join(ROOT, 'rules');
  if (existsSync(rulesDir)) {
    const files = readdirSync(rulesDir).filter(f => f.endsWith('.json'));
    if (files.length > 0) {
      for (const file of files) {
        const name = file.replace('.json', '');
        const ruleData = readJson(join(rulesDir, file));
        if (ruleData) {
          const { _id, ...ruleFields } = ruleData;
          await db.collection('rules').updateOne(
            { _id: name },
            { $set: ruleFields },
            { upsert: true }
          );
          console.log(`✓ rules/${name}  ← rules/${file}`);
        }
      }
    } else {
      console.log('— rules  (no *.json files in rules/, skipping)');
    }
  } else {
    console.log('— rules  (rules/ directory not found, skipping)');
  }

  await client.close();
  console.log('\nMigration complete.');
}

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
