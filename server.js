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
let weeklySummariesCol;
let teamsCol;
let lastMaintenanceTime = null;

async function connectDB() {
  console.log('🔗 Connecting to MongoDB Atlas...');
  mongoClient = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  await mongoClient.connect();
  db = mongoClient.db(DB_NAME);
  movementsCol       = db.collection('movements');
  staffCol           = db.collection('staff');
  weeklySummariesCol = db.collection('weekly_summaries');
  teamsCol           = db.collection('teams');

  // Create indexes
  await movementsCol.createIndex({ vehicle_number: 1 });
  await movementsCol.createIndex({ status: 1 });
  await movementsCol.createIndex({ entry_time: -1 });
  await staffCol.createIndex({ email: 1 }, { unique: true });
  await weeklySummariesCol.createIndex({ week_id: 1 }, { unique: true });
  await weeklySummariesCol.createIndex({ week_start: -1 });
  await teamsCol.createIndex({ id: 1 }, { unique: true });

  // Seed admin if not exists
  const adminExists = await staffCol.findOne({ email: ADMIN_EMAIL });
  if (!adminExists) {
    await staffCol.insertOne({
      id: randomUUID(),
      name: 'Admin',
      full_name: 'Admin',
      email: ADMIN_EMAIL,
      password: ADMIN_PASS,
      role: 'admin',
      is_active: true,
      created_at: new Date(),
    });
    console.log('✅ Admin account seeded');
  }

  // Seed default gate staff if not exists
  const staffExists = await staffCol.findOne({ email: 'staff@fleetgate.com' });
  if (!staffExists) {
    await staffCol.insertOne({
      id: randomUUID(),
      name: 'Gate Security Staff',
      full_name: 'Gate Security Staff',
      email: 'staff@fleetgate.com',
      password: 'Staff@123',
      role: 'staff',
      is_active: true,
      created_at: new Date(),
    });
    console.log('✅ Default Gate Security account seeded');
  }

  // Seed default teams if not exists
  const teamsCount = await teamsCol.countDocuments();
  if (teamsCount === 0) {
    const initialTeams = [
      {
        id: 'team-1',
        name: 'Team 1',
        members: 'Saravanan & Muthuraj',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'team-2',
        name: 'Team 2',
        members: 'Murugan & Tamil',
        is_active: true,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'team-3',
        name: 'Team 3',
        members: 'Unassigned',
        is_active: false,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: 'team-4',
        name: 'Team 4',
        members: 'Unassigned',
        is_active: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];
    await teamsCol.insertMany(initialTeams);
    console.log('✅ Default Teams (Team 1 to Team 4) seeded');
  }
    await staffCol.insertOne({
      id: randomUUID(),
      name: 'Gate Security Staff',
      full_name: 'Gate Security Staff',
      email: 'staff@fleetgate.com',
      password: 'Staff@123',
      role: 'staff',
      is_active: true,
      created_at: new Date(),
    });
    console.log('✅ Default Gate Security account seeded');
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

// ── IST Date & Report Helpers ─────────────────────────────────────────────────
function getISTDateStr(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

function formatISTDisplay(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(d);
}

function computeWeeklySummaryData(weekStartStr, weekEndStr, rawMovements) {
  const weekMovements = (rawMovements || []).filter(m => {
    const dStr = getISTDateStr(m.entry_time || m.in_time || m.created_at);
    return dStr && dStr >= weekStartStr && dStr <= weekEndStr;
  });

  // 7 Days breakdown
  const dailyBreakdown = [];
  const startObj = new Date(weekStartStr + 'T00:00:00+05:30');
  for (let i = 0; i < 7; i++) {
    const cur = new Date(startObj);
    cur.setDate(startObj.getDate() + i);
    const curStr = getISTDateStr(cur);
    const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(cur);

    const dayMovs = weekMovements.filter(m => getISTDateStr(m.entry_time || m.in_time || m.created_at) === curStr);
    const vMap = {};
    let totalIn = 0;
    let totalOut = 0;
    let pendingOut = 0;

    dayMovs.forEach(m => {
      totalIn++;
      const hasExited = (m.exit_time || m.out_time) && m.status !== 'inside' && m.status !== 'IN' && !m.is_active_inside;
      if (hasExited) totalOut++;
      else pendingOut++;

      const norm = normalizeVehicle(m.plate_number || m.vehicle_number || '');
      if (norm) vMap[norm] = (vMap[norm] || 0) + 1;
    });

    let t1 = 0, t2 = 0, t3 = 0, t4 = 0, t5 = 0;
    Object.values(vMap).forEach(cnt => {
      if (cnt === 1) t1++;
      else if (cnt === 2) t2++;
      else if (cnt === 3) t3++;
      else if (cnt === 4) t4++;
      else if (cnt >= 5) t5++;
    });

    dailyBreakdown.push({
      date: curStr,
      dayName,
      displayDate: formatISTDisplay(cur),
      uniqueVehicles: Object.keys(vMap).length,
      totalTrips: dayMovs.length,
      totalIn,
      totalOut,
      pendingOut,
      tripCategories: { trips1: t1, trips2: t2, trips3: t3, trips4: t4, trips5Plus: t5 }
    });
  }

  // Vehicle-wise weekly breakdown
  const vehicleMap = {};
  weekMovements.forEach(m => {
    const rawPlate = m.plate_number || m.vehicle_number || '';
    const norm = normalizeVehicle(rawPlate);
    if (!norm) return;
    if (!vehicleMap[norm]) {
      vehicleMap[norm] = {
        plate_number: rawPlate.trim() || norm,
        compact: norm,
        total_trips: 0,
        day_counts: {},
        records: []
      };
    }
    const dStr = getISTDateStr(m.entry_time || m.in_time || m.created_at);
    vehicleMap[norm].day_counts[dStr] = (vehicleMap[norm].day_counts[dStr] || 0) + 1;
    vehicleMap[norm].total_trips++;
    vehicleMap[norm].records.push({
      entry_time: m.entry_time,
      exit_time: m.exit_time,
      remarks: m.remarks || ''
    });
  });

  const vehicleSummaries = Object.values(vehicleMap).sort((a, b) => b.total_trips - a.total_trips);

  let trips1 = 0, trips2 = 0, trips3 = 0, trips4 = 0, trips5Plus = 0;
  vehicleSummaries.forEach(v => {
    if (v.total_trips === 1) trips1++;
    else if (v.total_trips === 2) trips2++;
    else if (v.total_trips === 3) trips3++;
    else if (v.total_trips === 4) trips4++;
    else if (v.total_trips >= 5) trips5Plus++;
  });

  return {
    week_id: `WEEK_${weekStartStr}_${weekEndStr}`,
    week_start: weekStartStr,
    week_end: weekEndStr,
    display_start: formatISTDisplay(weekStartStr),
    display_end: formatISTDisplay(weekEndStr),
    total_unique_vehicles: vehicleSummaries.length,
    total_trips: weekMovements.length,
    trip_categories: { trips1, trips2, trips3, trips4, trips5Plus },
    daily_breakdown: dailyBreakdown,
    vehicle_summaries: vehicleSummaries,
    archived_at: new Date().toISOString()
  };
}

// ── Automated Server-side Weekly Data Archival & 7-Day Cleanup ────────────────
async function runWeeklyMaintenance() {
  try {
    lastMaintenanceTime = new Date().toISOString();
    console.log(`[Maintenance] Starting Weekly Storage & Retention Maintenance at ${lastMaintenanceTime}...`);

    const now = new Date();
    const todayIST = getISTDateStr(now);
    // 7-day retention cutoff in IST
    const cutoffDateObj = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const cutoffIST = getISTDateStr(cutoffDateObj);

    const allMovements = await movementsCol.find({}).toArray();

    // Group movements by ISO week (Monday-Sunday)
    const weeksToArchive = new Map();
    for (const m of allMovements) {
      const dStr = getISTDateStr(m.entry_time || m.in_time || m.created_at);
      if (!dStr) continue;

      const d = new Date(dStr + 'T00:00:00+05:30');
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d);
      monday.setDate(diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const wStart = getISTDateStr(monday);
      const wEnd = getISTDateStr(sunday);
      const wId = `WEEK_${wStart}_${wEnd}`;

      // If this week is already completed (wEnd < todayIST), check if it needs archival
      if (wEnd < todayIST && !weeksToArchive.has(wId)) {
        weeksToArchive.set(wId, { start: wStart, end: wEnd });
      }
    }

    let archivedCount = 0;
    for (const [weekId, range] of weeksToArchive.entries()) {
      const existing = await weeklySummariesCol.findOne({ week_id: weekId });
      if (!existing) {
        const summary = computeWeeklySummaryData(range.start, range.end, allMovements);
        if (summary.total_trips > 0) {
          await weeklySummariesCol.updateOne(
            { week_id: weekId },
            { $set: summary },
            { upsert: true }
          );
          archivedCount++;
          console.log(`[Maintenance] Archived weekly summary ${weekId} (${summary.total_trips} trips, ${summary.total_unique_vehicles} vehicles).`);
        }
      }
    }

    // ── Safe Cleanup of Expired Daily Records (> 7 days) ──
    // STRICT SAFETY CONDITIONS:
    // 1. NEVER delete records with pending OUT status (status == 'inside' || status == 'IN')
    // 2. NEVER delete records where is_active_inside is true
    // 3. NEVER delete incomplete transactions (exit_time == null)
    // 4. NEVER delete weekly summary reports (stored in separate collection)
    const deletionFilter = {
      entry_time: { $lt: new Date(cutoffIST + 'T00:00:00+05:30') },
      status: { $nin: ['inside', 'IN'] },
      is_active_inside: { $ne: true },
      exit_time: { $ne: null }
    };

    const protectedPendingCount = await movementsCol.countDocuments({
      entry_time: { $lt: new Date(cutoffIST + 'T00:00:00+05:30') },
      $or: [
        { status: { $in: ['inside', 'IN'] } },
        { is_active_inside: true },
        { exit_time: null }
      ]
    });

    const deleteResult = await movementsCol.deleteMany(deletionFilter);
    console.log(`[Maintenance] Maintenance complete. Archived ${archivedCount} weeks. Deleted ${deleteResult.deletedCount} expired completed records. Protected ${protectedPendingCount} pending OUT records.`);

    return {
      success: true,
      cutoffDate: cutoffIST,
      archivedWeeksCount: archivedCount,
      deletedCount: deleteResult.deletedCount,
      protectedPendingCount,
      lastMaintenanceTime
    };
  } catch (err) {
    console.error('[Maintenance] Weekly maintenance error:', err);
    return { success: false, error: err.message };
  }
}

function serializeDoc(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  const entryTime = rest.entry_time || rest.in_time;
  const exitTime = rest.exit_time || rest.out_time;
  const isInside = rest.status === 'inside' || rest.status === 'IN' || rest.is_active_inside || !exitTime;
  const rawPlate = rest.plate_number || rest.vehicle_number || '';
  return {
    ...rest,
    _id: _id?.toString(),
    entry_time: entryTime ? new Date(entryTime).toISOString() : null,
    in_time: entryTime ? new Date(entryTime).toISOString() : null,
    exit_time: exitTime ? new Date(exitTime).toISOString() : null,
    out_time: exitTime ? new Date(exitTime).toISOString() : null,
    plate_number: rawPlate,
    vehicle_number: rawPlate,
    is_active_inside: Boolean(isInside),
    status: isInside ? 'inside' : 'exited',
  };
}

function serializeStaffDoc(doc) {
  if (!doc) return null;
  const { _id, password, ...rest } = doc;
  const fullName = rest.full_name || rest.name || 'Gate Staff';
  return {
    ...rest,
    _id: _id?.toString(),
    id: rest.id || _id?.toString(),
    name: fullName,
    full_name: fullName,
    email: rest.email || '',
    role: rest.role || 'staff',
    is_active: rest.is_active !== false,
    created_at: rest.created_at ? new Date(rest.created_at).toISOString() : new Date().toISOString()
  };
}

function serializeTeamDoc(doc) {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return {
    ...rest,
    _id: _id?.toString(),
    id: rest.id || _id?.toString(),
    name: rest.name || '',
    members: rest.members || '',
    is_active: rest.is_active !== false,
    created_at: rest.created_at ? new Date(rest.created_at).toISOString() : new Date().toISOString(),
    updated_at: rest.updated_at ? new Date(rest.updated_at).toISOString() : new Date().toISOString()
  };
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
    const cleanEmail = email?.toLowerCase?.().trim();
    const cleanPass = password?.trim();
    const user = await staffCol.findOne({ email: cleanEmail });
    if (!user || user.password !== cleanPass) {
      return json(res, 401, { success: false, error: 'Invalid email or password' });
    }
    const { password: _, ...safeUser } = user;
    safeUser.is_active = true;
    safeUser.role = safeUser.role || 'admin';
    const token = `fg_tok_${randomUUID()}`;
    return json(res, 200, { success: true, user: safeUser, token });
  }

  // ── Staff List (admin only — returns live list from MongoDB Atlas)
  if (path_ === '/api/staff' && method === 'GET') {
    const staff = await staffCol.find({}).sort({ created_at: -1 }).toArray();
    return json(res, 200, {
      success: true,
      staff: staff.map(serializeStaffDoc),
    });
  }

  // ── Add Staff Member
  if (path_ === '/api/staff' && method === 'POST') {
    const body = await readBody(req);
    const name = (body.fullName || body.full_name || body.name || '').trim();
    const email = (body.email || '').toLowerCase().trim();
    const password = (body.password || 'StaffPass@123').trim();
    const role = body.role === 'admin' ? 'admin' : 'staff';
    const is_active = body.isActive !== undefined ? Boolean(body.isActive) : (body.is_active !== undefined ? Boolean(body.is_active) : true);

    if (!name || !email) {
      return json(res, 400, { success: false, error: 'Full name and email are required' });
    }

    const existing = await staffCol.findOne({ email });
    if (existing) {
      return json(res, 409, { success: false, error: 'A staff member with this email already exists' });
    }

    const member = {
      id: randomUUID(),
      name,
      full_name: name,
      email,
      password,
      role,
      is_active,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await staffCol.insertOne(member);
    const safe = serializeStaffDoc(member);
    broadcast('staff_update', { type: 'add', staff: safe });
    broadcast('SYNC', { entity: 'staff' });
    return json(res, 201, { success: true, member: safe });
  }

  // ── Update Staff Member (PUT)
  if (path_.startsWith('/api/staff/') && method === 'PUT') {
    const id = path_.split('/')[3];
    const body = await readBody(req);
    const member = await staffCol.findOne({ id });
    if (!member) {
      return json(res, 404, { success: false, error: 'Staff member not found' });
    }

    const updateData = { updated_at: new Date() };
    const name = (body.fullName || body.full_name || body.name || '').trim();
    if (name) {
      updateData.name = name;
      updateData.full_name = name;
    }
    if (body.email) {
      const email = body.email.toLowerCase().trim();
      const duplicate = await staffCol.findOne({ email, id: { $ne: id } });
      if (duplicate) {
        return json(res, 409, { success: false, error: 'Email already in use by another account' });
      }
      updateData.email = email;
    }
    if (body.password && body.password.trim()) {
      updateData.password = body.password.trim();
    }
    if (body.role) {
      updateData.role = body.role === 'admin' ? 'admin' : 'staff';
    }
    if (body.isActive !== undefined || body.is_active !== undefined) {
      updateData.is_active = body.isActive !== undefined ? Boolean(body.isActive) : Boolean(body.is_active);
    }

    await staffCol.updateOne({ id }, { $set: updateData });
    const updated = await staffCol.findOne({ id });
    const safe = serializeStaffDoc(updated);
    broadcast('staff_update', { type: 'update', staff: safe });
    broadcast('SYNC', { entity: 'staff' });
    return json(res, 200, { success: true, member: safe });
  }

  // ── Delete Staff
  if (path_.startsWith('/api/staff/') && method === 'DELETE') {
    const id = path_.split('/')[3];
    const member = await staffCol.findOne({ id });
    if (!member) return json(res, 404, { success: false, error: 'Staff member not found' });
    if (member.role === 'admin' && member.email === ADMIN_EMAIL) {
      return json(res, 403, { success: false, error: 'Cannot delete primary admin account' });
    }
    await staffCol.deleteOne({ id });
    broadcast('staff_update', { type: 'delete', id });
    broadcast('SYNC', { entity: 'staff' });
    return json(res, 200, { success: true });
  }

  // ── Get All Teams
  if (path_ === '/api/teams' && method === 'GET') {
    const teams = await teamsCol.find({}).sort({ created_at: 1 }).toArray();
    return json(res, 200, { success: true, teams: teams.map(serializeTeamDoc) });
  }

  // ── Create Team (POST)
  if (path_ === '/api/teams' && method === 'POST') {
    const body = await readBody(req);
    const name = (body.name || '').trim();
    if (!name) return json(res, 400, { success: false, error: 'Team name is required' });

    const newTeam = {
      id: body.id || randomUUID(),
      name,
      members: (body.members || '').trim() || 'Unassigned',
      is_active: body.is_active !== undefined ? Boolean(body.is_active) : (body.isActive !== undefined ? Boolean(body.isActive) : true),
      created_at: new Date(),
      updated_at: new Date(),
    };

    await teamsCol.insertOne(newTeam);
    const safe = serializeTeamDoc(newTeam);
    broadcast('teams_update', { type: 'add', team: safe });
    broadcast('SYNC', { entity: 'teams' });
    return json(res, 201, { success: true, team: safe });
  }

  // ── Update Team (PUT)
  if (path_.startsWith('/api/teams/') && method === 'PUT') {
    const id = path_.split('/')[3];
    const body = await readBody(req);
    const team = await teamsCol.findOne({ id });
    if (!team) return json(res, 404, { success: false, error: 'Team not found' });

    const updateData = { updated_at: new Date() };
    if (body.name !== undefined && body.name.trim()) updateData.name = body.name.trim();
    if (body.members !== undefined) updateData.members = body.members.trim();
    if (body.is_active !== undefined || body.isActive !== undefined) {
      updateData.is_active = body.is_active !== undefined ? Boolean(body.is_active) : Boolean(body.isActive);
    }

    await teamsCol.updateOne({ id }, { $set: updateData });
    const updated = await teamsCol.findOne({ id });
    const safe = serializeTeamDoc(updated);
    broadcast('teams_update', { type: 'update', team: safe });
    broadcast('SYNC', { entity: 'teams' });
    return json(res, 200, { success: true, team: safe });
  }

  // ── Delete Team (DELETE)
  if (path_.startsWith('/api/teams/') && method === 'DELETE') {
    const id = path_.split('/')[3];
    const team = await teamsCol.findOne({ id });
    if (!team) return json(res, 404, { success: false, error: 'Team not found' });

    await teamsCol.deleteOne({ id });
    broadcast('teams_update', { type: 'delete', id });
    broadcast('SYNC', { entity: 'teams' });
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
    const rawPlate = body.plate_number || body.plateNumber || body.vehicleNumber || body.vehicle_number || '';
    const compactPlate = normalizeVehicle(rawPlate);
    if (!compactPlate) return json(res, 400, { success: false, error: 'Vehicle number required' });

    // Check for open visit
    const open = await movementsCol.findOne({
      $or: [
        { compact_plate: compactPlate },
        { vehicle_number: compactPlate },
        { plate_number: rawPlate.trim() }
      ],
      status: 'inside'
    });
    if (open) {
      return json(res, 409, {
        success: false,
        error: `${rawPlate.trim()} already inside (since ${new Date(open.entry_time).toLocaleTimeString('en-IN')})`
      });
    }

    const entryTime = body.entryTime || body.entry_time || body.in_time || new Date().toISOString();
    const movement = {
      id: randomUUID(),
      compact_plate: compactPlate,
      vehicle_number: compactPlate,
      plate_number: rawPlate.trim(),
      entry_time: new Date(entryTime),
      exit_time: null,
      remarks: (body.remarks || body.entryNotes || body.entry_notes || '').trim(),
      team_id: body.team_id || body.teamId || null,
      team_name: (body.team_name || body.teamName || body.team || '').trim() || null,
      entry_gate: body.entryGate || 'Main Gate',
      exit_gate: null,
      status: 'inside',
      is_active_inside: true,
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
    const movementId = body.movementId || body.movement_id || body.id;
    if (!movementId) return json(res, 400, { success: false, error: 'movementId required' });

    const movement = await movementsCol.findOne({ id: movementId });
    if (!movement) return json(res, 404, { success: false, error: 'Movement not found' });
    if (movement.status === 'exited' || movement.exit_time) {
      return json(res, 409, { success: false, error: 'Already exited' });
    }

    const exitTime = body.exitTime || body.exit_time || body.out_time || new Date().toISOString();
    const updateData = {
      exit_time: new Date(exitTime),
      exit_gate: body.exitGate || 'Main Gate',
      status: 'exited',
      is_active_inside: false,
      updated_at: new Date(),
    };

    await movementsCol.updateOne({ id: movementId }, { $set: updateData });
    const updated = await movementsCol.findOne({ id: movementId });
    broadcast('movement_update', { type: 'exit', movement: serializeDoc(updated) });
    return json(res, 200, { success: true, movement: serializeDoc(updated) });
  }

  // ── Update Movement (admin)
  if (path_.startsWith('/api/movements/') && method === 'PUT') {
    const id = path_.split('/')[3];
    const body = await readBody(req);
    const mov = await movementsCol.findOne({ id });
    if (!mov) return json(res, 404, { success: false, error: 'Not found' });

    const updateData = { updated_at: new Date() };
    if (body.plate_number || body.vehicle_number) {
      const p = body.plate_number || body.vehicle_number;
      updateData.plate_number = p.trim();
      updateData.compact_plate = normalizeVehicle(p);
      updateData.vehicle_number = normalizeVehicle(p);
    }
    if (body.remarks !== undefined) updateData.remarks = body.remarks.trim();
    if (body.in_time || body.entry_time) updateData.entry_time = new Date(body.in_time || body.entry_time);
    if (body.out_time || body.exit_time) {
      updateData.exit_time = new Date(body.out_time || body.exit_time);
      updateData.status = 'exited';
      updateData.is_active_inside = false;
    }

    await movementsCol.updateOne({ id }, { $set: updateData });
    const updated = await movementsCol.findOne({ id });
    broadcast('movement_update', { type: 'update', movement: serializeDoc(updated) });
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

  // ── Reports: Distinct Available Dates (IST) ───────────────────────────────────
  if (path_ === '/api/reports/dates' && method === 'GET') {
    const movements = await movementsCol.find({}, { projection: { entry_time: 1, in_time: 1, created_at: 1 } }).toArray();
    const dateSet = new Set();
    movements.forEach(m => {
      const dStr = getISTDateStr(m.entry_time || m.in_time || m.created_at);
      if (dStr) dateSet.add(dStr);
    });

    // Also include today's date in IST
    dateSet.add(getISTDateStr(new Date()));

    // Also include dates from archived weekly summaries
    const archivedWeeks = await weeklySummariesCol.find({}, { projection: { daily_breakdown: 1, week_start: 1, week_end: 1 } }).toArray();
    archivedWeeks.forEach(w => {
      (w.daily_breakdown || []).forEach(d => {
        if (d.date) dateSet.add(d.date);
      });
    });

    const dates = Array.from(dateSet).sort().reverse();
    return json(res, 200, { success: true, dates });
  }

  // ── Reports: Get All Saved Weekly Summaries ───────────────────────────────────
  if (path_ === '/api/reports/weekly' && method === 'GET') {
    const summaries = await weeklySummariesCol
      .find({})
      .sort({ week_start: -1 })
      .toArray();
    return json(res, 200, { success: true, summaries: summaries.map(serializeDoc) });
  }

  // ── Reports: Get Specific Weekly Summary ──────────────────────────────────────
  if (path_.startsWith('/api/reports/weekly/') && method === 'GET') {
    const weekId = path_.split('/')[4];
    const summary = await weeklySummariesCol.findOne({ week_id: weekId });
    if (!summary) return json(res, 404, { success: false, error: 'Weekly summary not found' });
    return json(res, 200, { success: true, summary: serializeDoc(summary) });
  }

  // ── Reports: Generate or On-Demand Archive Weekly Summary ─────────────────────
  if (path_ === '/api/reports/weekly/generate' && method === 'POST') {
    const { startDate, endDate, save } = await readBody(req);
    if (!startDate || !endDate) {
      return json(res, 400, { success: false, error: 'startDate and endDate required (YYYY-MM-DD)' });
    }

    const allMovements = await movementsCol.find({}).toArray();
    const summary = computeWeeklySummaryData(startDate, endDate, allMovements);

    if (save) {
      await weeklySummariesCol.updateOne(
        { week_id: summary.week_id },
        { $set: summary },
        { upsert: true }
      );
    }

    return json(res, 200, { success: true, summary });
  }

  // ── Reports: Weekly Storage System Status ────────────────────────────────────
  if (path_ === '/api/reports/storage-status' && method === 'GET') {
    const now = new Date();
    const todayIST = getISTDateStr(now);
    const cutoffDateObj = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const cutoffIST = getISTDateStr(cutoffDateObj);

    const [totalMovements, pendingOutCount, completedCount, archivedWeeksCount] = await Promise.all([
      movementsCol.countDocuments(),
      movementsCol.countDocuments({
        $or: [
          { status: { $in: ['inside', 'IN'] } },
          { is_active_inside: true },
          { exit_time: null }
        ]
      }),
      movementsCol.countDocuments({
        status: { $nin: ['inside', 'IN'] },
        is_active_inside: { $ne: true },
        exit_time: { $ne: null }
      }),
      weeklySummariesCol.countDocuments()
    ]);

    // Find oldest and newest records
    const [oldestMov, newestMov] = await Promise.all([
      movementsCol.find({}).sort({ entry_time: 1 }).limit(1).toArray(),
      movementsCol.find({}).sort({ entry_time: -1 }).limit(1).toArray()
    ]);

    const oldestRecordDate = oldestMov[0] ? getISTDateStr(oldestMov[0].entry_time) : todayIST;
    const newestRecordDate = newestMov[0] ? getISTDateStr(newestMov[0].entry_time) : todayIST;

    return json(res, 200, {
      success: true,
      storageStatus: {
        totalMovements,
        pendingOutCount,
        completedCount,
        archivedWeeksCount,
        retentionDays: 7,
        retentionCutoffDate: cutoffIST,
        oldestRecordDate,
        newestRecordDate,
        lastMaintenanceTime: lastMaintenanceTime || 'Scheduled (Active)',
        serverTimeIST: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
        timezone: 'Asia/Kolkata (IST)'
      }
    });
  }

  // ── Reports: Run Storage Maintenance On Demand ────────────────────────────────
  if (path_ === '/api/reports/maintenance' && method === 'POST') {
    const result = await runWeeklyMaintenance();
    return json(res, 200, { success: true, result });
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

  // Run weekly retention & archival maintenance on boot
  runWeeklyMaintenance().catch(err => {
    console.error('Initial weekly maintenance failed:', err);
  });

  // Schedule automated hourly maintenance (secure server-side background process)
  setInterval(() => {
    runWeeklyMaintenance().catch(err => {
      console.error('Scheduled weekly maintenance failed:', err);
    });
  }, 60 * 60 * 1000); // 1 hour interval

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
