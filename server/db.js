import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB  = process.env.MONGODB_DB  || 'night_worcoon';

let client = null;
let db     = null;

export async function connectDb() {
  if (db) return db;
  try {
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(MONGODB_DB);
    console.log(`✓ Connected to MongoDB (${MONGODB_DB})`);
    return db;
  } catch (err) {
    console.error(`✗ MongoDB connection failed: ${err.message}`);
    process.exit(1);
  }
}

export function getDb() {
  if (!db) throw new Error('MongoDB not connected — call connectDb() first');
  return db;
}

export async function closeDb() {
  if (client) {
    await client.close();
    client = null;
    db     = null;
  }
}

export function col(name) {
  return getDb().collection(name);
}
