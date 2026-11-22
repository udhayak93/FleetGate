// Test script — run after getting MongoDB Atlas URI
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('❌  Set MONGODB_URI env var first');
  process.exit(1);
}

console.log('🔗 Testing MongoDB Atlas connection...');
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });

try {
  await client.connect();
  
  // List existing databases to find correct casing
  const adminDb = client.db('admin');
  const dbs = await adminDb.admin().listDatabases();
  console.log('📋 Existing databases:', dbs.databases.map(d => d.name).join(', '));
  
  // Use the first non-system db or create new one
  const fleetDb = dbs.databases.find(d => d.name.toLowerCase() === 'fleetgate');
  const dbName = fleetDb ? fleetDb.name : 'fleetgate';
  console.log('✅ Will use database:', dbName);
  
  const db = client.db(dbName);
  const col = db.collection('connection_test');
  await col.insertOne({ test: true, at: new Date() });
  await col.deleteOne({ test: true });
  
  console.log('✅  Read/write working!');
  console.log('\n🎉 CONNECTION STRING WORKS! Use DB_NAME=' + dbName);
  
  await client.close();
} catch (err) {
  console.error('❌  Connection failed:', err.message);
  process.exit(1);
}
