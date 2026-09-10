import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB  = process.env.MONGODB_DB  || 'night_worcoon';

let client    = null;
let db        = null;
let connected = false;

export async function connectDb() {
  if (db) return db;
  try {
    client = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
    await client.connect();
    // Verify the connection is actually usable
    await client.db(MONGODB_DB).command({ ping: 1 });
    db = client.db(MONGODB_DB);
    connected = true;
    console.log(`✓ Connected to MongoDB (${MONGODB_DB})`);
    return db;
  } catch (err) {
    console.warn(`⚠  MongoDB unavailable: ${err.message}`);
    console.warn('   Running in local file mode (state/rules/bucket persisted to disk).');
    if (client) {
      try { await client.close(); } catch (_) { /* ignore */ }
      client = null;
    }
    return null;
  }
}

export function isDbConnected() {
  return connected;
}

export function getDb() {
  if (!db) throw new Error('MongoDB not connected — call connectDb() first');
  return db;
}

export async function closeDb() {
  if (client) {
    await client.close();
    client    = null;
    db        = null;
    connected = false;
  }
}

export function col(name) {
  return getDb().collection(name);
}
