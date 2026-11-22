// ==============================================================================
// FleetGate Server — MongoDB Atlas Edition
// Works on any network, any device. Always live on Render.com.
// ==============================================================================
import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient } from 'mongodb';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const DIST_DIR   = path.join(__dirname, 'dist');

// ── Config ────────────────────────────────────────────────────────────────────
const MONGODB_URI  = process.env.MONGODB_URI;          // set in .env or Render env
const DB_NAME      = process.env.DB_NAME || 'fleetgate';
const PORT         = parseInt(process.env.PORT || '5173', 10);
const ADMIN_EMAIL  = process.env.ADMIN_EMAIL  || 'admin@gmail.com';
const ADMIN_PASS   = process.env.ADMIN_PASS   || 'Admin@123';

if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI is not set. Please create a .env file or set the env var.');
  process.exit(1);
}

// ── MongoDB Connection ────────────────────────────────────────────────────────
let mongoClient;
let db;
let movementsCol;
let staffCol;

async function connectDB() {
  console.log('🔗 Connecting to MongoDB Atlas...');
  mongoClient = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  await mongoClient.connect();
  db = mongoClient.db(DB_NAME);
  movementsCol = db.collection('movements');
  staffCol     = db.collection('staff');

  // Create indexes
  await movementsCol.createIndex({ vehicle_number: 1 });
  await movementsCol.createIndex({ status: 1 });
  await movementsCol.createIndex({ entry_time: -1 });
  await staffCol.createIndex({ email: 1 }, { unique: true });

  // Seed admin if not exists
  const adminExists = await staffCol.findOne({ email: ADMIN_EMAIL });
  if (!adminExists) {
    await staffCol.insertOne({
      id: randomUUID(),
      name: 'Admin',
      email: ADMIN_EMAIL,
      password: ADMIN_PASS,
      role: 'admin',
      created_at: new Date(),
    });
    console.log('✅ Admin account seeded');
  }

  console.log(`✅ MongoDB connected → database: "${DB_NAME}"`);
}

// ── MIME Types ────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=UTF-8',
  '.js':   'application/javascript; charset=UTF-8',
  '.css':  'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.webmanifest': 'application/manifest+json',
};

// ── SSE Clients ───────────────────────────────────────────────────────────────
const sseClients = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch {}
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function json(res, statusCode, data) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function normalizeVehicle(v) {
  return String(v || '').toUpperCase().replace(/\s+/g, '').trim();
}

function serializeDoc(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { ...rest, _id: _id?.toString() };
}

// ── Route Handler ─────────────────────────────────────────────────────────────
async function handleAPI(req, res) {
  const url    = new URL(req.url, `http://localhost`);
  const path_  = url.pathname;
  const method = req.method;

  // ── CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    return res.end();
  }

  // ── Health
  if (path_ === '/api/health' && method === 'GET') {
    const count = await movementsCol.countDocuments();
    return json(res, 200, {
      status: 'ok',
      service: 'FleetGate MongoDB Edition',
      db: DB_NAME,
      movements_count: count,
      server_time: new Date().toISOString(),
    });
  }

  // ── SSE Events
  if (path_ === '/api/events' && method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    });
    res.write(`event: connected\ndata: {"ts":"${new Date().toISOString()}"}\n\n`);
    sseClients.add(res);
    const hb = setInterval(() => {
      try { res.write(': heartbeat\n\n'); } catch {}
    }, 25000);
    req.on('close', () => { sseClients.delete(res); clearInterval(hb); });
    return;
  }

  // ── Auth Login
  if (path_ === '/api/auth/login' && method === 'POST') {
    const { email, password } = await readBody(req);
    const user = await staffCol.findOne({ email: email?.toLowerCase?.().trim() });
    if (!user || user.password !== password) {
      return json(res, 401, { success: false, error: 'Invalid email or password' });
    }
    const { password: _, ...safeUser } = user;
    return json(res, 200, { success: true, user: serializeDoc(safeUser) });
  }

  // ── Staff List (admin only — no auth check here, frontend handles it)
  if (path_ === '/api/staff' && method === 'GET') {
    const staff = await staffCol.find({}).toArray();
    return json(res, 200, {
      success: true,
      staff: staff.map(s => { const { password: _, ...rest } = s; return serializeDoc(rest); }),
    });
  }

  // ── Add Staff Member
  if (path_ === '/api/staff' && method === 'POST') {
    const { name, email, password, role } = await readBody(req);
    if (!name || !email || !password) return json(res, 400, { success: false, error: 'name, email, password required' });
    const existing = await staffCol.findOne({ email: email.toLowerCase().trim() });
    if (existing) return json(res, 409, { success: false, error: 'Email already exists' });
    const member = {
      id: randomUUID(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: role === 'admin' ? 'admin' : 'staff',
      created_at: new Date(),
    };
    await staffCol.insertOne(member);
    const { password: _, ...safe } = member;
    return json(res, 201, { success: true, member: safe });
  }

  // ── Delete Staff
  if (path_.startsWith('/api/staff/') && method === 'DELETE') {
    const id = path_.split('/')[3];
    const member = await staffCol.findOne({ id });
    if (!member) return json(res, 404, { success: false, error: 'Staff member not found' });
    if (member.role === 'admin') return json(res, 403, { success: false, error: 'Cannot delete admin' });
    await staffCol.deleteOne({ id });
    return json(res, 200, { success: true });
  }

  // ── Get All Movements
  if (path_ === '/api/movements' && method === 'GET') {
    const filter = {};
    const statusParam = url.searchParams.get('status');
    if (statusParam) filter.status = statusParam;
    const q = url.searchParams.get('q');
    if (q) filter.vehicle_number = { $regex: q.toUpperCase().replace(/\s+/g, ''), $options: 'i' };
    const movements = await movementsCol
      .find(filter)
      .sort({ entry_time: -1 })
      .limit(500)
      .toArray();
    return json(res, 200, { success: true, movements: movements.map(serializeDoc) });
  }

  // ── Vehicle IN (Entry)
  if (path_ === '/api/movements/in' && method === 'POST') {
    const body = await readBody(req);
    const vehicleNumber = normalizeVehicle(body.vehicleNumber || body.vehicle_number);
    if (!vehicleNumber) return json(res, 400, { success: false, error: 'Vehicle number required' });

    // Check for open visit
    const open = await movementsCol.findOne({ vehicle_number: vehicleNumber, status: 'inside' });
    if (open) return json(res, 409, { success: false, error: `${vehicleNumber} already inside (since ${new Date(open.entry_time).toLocaleTimeString('en-IN')})` });

    const entryTime = body.entryTime || body.entry_time || new Date().toISOString();
    const movement = {
      id: randomUUID(),
      vehicle_number: vehicleNumber,
      entry_time: new Date(entryTime),
      exit_time: null,
      remarks: (body.remarks || body.entryNotes || '').trim(),
      entry_gate: body.entryGate || 'Main Gate',
      exit_gate: null,
      status: 'inside',
      created_at: new Date(),
      updated_at: new Date(),
    };

    await movementsCol.insertOne(movement);
    broadcast('movement_update', { type: 'entry', movement: serializeDoc(movement) });
    return json(res, 201, { success: true, movement: serializeDoc(movement) });
  }

  // ── Vehicle OUT (Exit)
  if (path_ === '/api/movements/out' && method === 'POST') {
    const body = await readBody(req);
    const { movementId } = body;
    if (!movementId) return json(res, 400, { success: false, error: 'movementId required' });

    const movement = await movementsCol.findOne({ id: movementId });
    if (!movement) return json(res, 404, { success: false, error: 'Movement not found' });
    if (movement.status === 'exited') return json(res, 409, { success: false, error: 'Already exited' });

    const exitTime = body.exitTime || body.exit_time || new Date().toISOString();
    const updateData = {
      exit_time: new Date(exitTime),
      exit_gate: body.exitGate || 'Main Gate',
      status: 'exited',
      updated_at: new Date(),
    };

    await movementsCol.updateOne({ id: movementId }, { $set: updateData });
    const updated = await movementsCol.findOne({ id: movementId });
    broadcast('movement_update', { type: 'exit', movement: serializeDoc(updated) });
    return json(res, 200, { success: true, movement: serializeDoc(updated) });
  }

  // ── Delete Movement (admin)
  if (path_.startsWith('/api/movements/') && method === 'DELETE') {
    const id = path_.split('/')[3];
    const mov = await movementsCol.findOne({ id });
    if (!mov) return json(res, 404, { success: false, error: 'Not found' });
    await movementsCol.deleteOne({ id });
    broadcast('movement_update', { type: 'delete', id });
    return json(res, 200, { success: true });
  }

  // ── Stats
  if (path_ === '/api/stats' && method === 'GET') {
    const [total, inside, today_in, today_out] = await Promise.all([
      movementsCol.countDocuments(),
      movementsCol.countDocuments({ status: 'inside' }),
      movementsCol.countDocuments({ entry_time: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
      movementsCol.countDocuments({ exit_time: { $gte: new Date(new Date().setHours(0,0,0,0)) } }),
    ]);
    return json(res, 200, { success: true, stats: { total, inside, today_in, today_out } });
  }

  // ── Reset DB (dev only)
  if (path_ === '/api/reset-all' && method === 'POST') {
    await movementsCol.deleteMany({});
    broadcast('movement_update', { type: 'reset' });
    return json(res, 200, { success: true, message: 'All movements cleared' });
  }

  return json(res, 404, { success: false, error: 'API endpoint not found' });
}

// ── Static File Server ────────────────────────────────────────────────────────
function serveStatic(req, res) {
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);
  // Strip query params
  filePath = filePath.split('?')[0];

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const data = fs.readFileSync(filePath);

  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': data.length,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(data);
}

// ── HTTP Server ───────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      await handleAPI(req, res);
    } else {
      serveStatic(req, res);
    }
  } catch (err) {
    console.error('Server error:', err.message);
    if (!res.headersSent) json(res, 500, { success: false, error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  await connectDB();
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚛 FleetGate Server running on port ${PORT}`);
    console.log(`   Local:   http://localhost:${PORT}`);
    console.log(`   Network: http://0.0.0.0:${PORT}\n`);
  });
}

start().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
