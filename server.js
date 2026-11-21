import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');
const DB_FILE = path.join(__dirname, 'data', 'fleetgate-db.json');

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// ==============================================================================
// 1. PERSISTENT DATABASE ENGINE
// ==============================================================================
let db = {
  version: 1,
  updated_at: new Date().toISOString(),
  staff: [
    {
      id: "usr_admin_master",
      email: "admin@gmail.com",
      password: "Admin@123",
      full_name: "System Administrator",
      role: "admin",
      is_active: true,
      created_at: new Date().toISOString()
    },
    {
      id: "usr_staff_gate",
      email: "staff@fleetgate.com",
      password: "Staff@123",
      full_name: "Gate Security Staff",
      role: "staff",
      is_active: true,
      created_at: new Date().toISOString()
    }
  ],
  movements: []
};

// Load database from disk on startup
try {
  if (fs.existsSync(DB_FILE)) {
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    db = JSON.parse(raw);
    console.log(`[DB] Loaded ${db.movements.length} movements and ${db.staff.length} staff records from disk.`);
  } else {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    console.log(`[DB] Created initial database at ${DB_FILE}`);
  }
} catch (err) {
  console.error('[DB] Failed to load database file, using defaults:', err);
}

// Save database to disk
function saveDb() {
  db.version = (db.version || 1) + 1;
  db.updated_at = new Date().toISOString();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    notifyClients();
  } catch (err) {
    console.error('[DB] Error saving to disk:', err);
  }
}

// Active Server-Sent Events (SSE) connections for real-time cross-device sync
const sseClients = new Set();

function notifyClients() {
  const payload = JSON.stringify({
    type: 'SYNC',
    version: db.version,
    updated_at: db.updated_at,
    movements_count: db.movements.length
  });

  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch (_) {
      sseClients.delete(client);
    }
  }
}

// Helper: Normalize lorry plate string for clean comparison (e.g. "TN 21 BV 1234" -> "TN21BV1234")
function compactPlate(p) {
  return (p || '').toUpperCase().replace(/\s+/g, '');
}

// Helper: Format Tamil Nadu & Indian commercial vehicle plate
function formatPlate(input) {
  if (!input) return '';
  const clean = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length === 0) return '';
  let res = clean.slice(0, 2);
  if (clean.length > 2) {
    const p2 = clean.slice(2, 4);
    res += ' ' + p2;
  }
  if (clean.length > 4) {
    const p3Match = clean.slice(4).match(/^[A-Z]{1,3}/);
    if (p3Match) {
      const p3 = p3Match[0];
      res += ' ' + p3;
      const rest = clean.slice(4 + p3.length);
      if (rest) res += ' ' + rest.slice(0, 4);
    } else {
      res += ' ' + clean.slice(4, 8);
    }
  }
  return res;
}

// Helper: Is ISO date string today?
function isDateToday(isoString) {
  if (!isoString) return false;
  try {
    const d = new Date(isoString);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth() === now.getMonth() &&
           d.getDate() === now.getDate();
  } catch {
    return false;
  }
}

// Helper: Parse JSON request body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Request entity too large'));
      }
    });
    req.on('end', () => {
      if (!body.trim()) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Helper: Send JSON response
function sendJson(res, statusCode, data) {
  const payload = Buffer.from(JSON.stringify(data));
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Content-Length': payload.length,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.end(payload);
}

// ==============================================================================
// 2. HTTP REQUEST ROUTER
// ==============================================================================
async function requestHandler(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;
  const method = req.method;

  // Global CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return;
  }

  // ----------------------------------------------------------------------------
  // REAL-TIME SERVER-SENT EVENTS (SSE) STREAM
  // ----------------------------------------------------------------------------
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', version: db.version })}\n\n`);
    sseClients.add(res);

    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  // ----------------------------------------------------------------------------
  // REST API ENDPOINTS
  // ----------------------------------------------------------------------------
  if (pathname.startsWith('/api/')) {
    try {
      // 1. Health & Sync Status
      if (pathname === '/api/health' && method === 'GET') {
        return sendJson(res, 200, {
          status: 'ok',
          service: 'FleetGate Real-Time Shared Database',
          version: db.version,
          updated_at: db.updated_at,
          movements_count: db.movements.length,
          server_time: new Date().toISOString()
        });
      }

      // 2. User Authentication (Login)
      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await parseJsonBody(req);
        const email = (body.email || '').trim().toLowerCase();
        const password = (body.password || '').trim();

        if (!email || !password) {
          return sendJson(res, 400, { success: false, error: 'Email and password are required.' });
        }

        const user = db.staff.find(u => u.email.toLowerCase() === email && u.is_active);
        if (!user || user.password !== password) {
          return sendJson(res, 401, { success: false, error: 'Invalid email or password.' });
        }

        // Issue simple token
        const token = `fg_tok_${Buffer.from(`${user.id}:${user.role}:${Date.now()}`).toString('base64')}`;
        return sendJson(res, 200, {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            role: user.role
          },
          token
        });
      }

      // 3. Staff Database Management (CRUD)
      if (pathname === '/api/staff' && method === 'GET') {
        const safeStaff = db.staff.map(s => ({
          id: s.id,
          email: s.email,
          full_name: s.full_name,
          role: s.role,
          is_active: s.is_active,
          created_at: s.created_at
        }));
        return sendJson(res, 200, { success: true, staff: safeStaff });
      }

      if (pathname === '/api/staff' && method === 'POST') {
        const body = await parseJsonBody(req);
        const email = (body.email || '').trim().toLowerCase();
        const password = (body.password || '').trim();
        const full_name = (body.fullName || body.full_name || '').trim();
        const role = body.role === 'admin' ? 'admin' : 'staff';

        if (!email || !password || !full_name) {
          return sendJson(res, 400, { success: false, error: 'Full name, email, and password are required.' });
        }

        if (db.staff.some(s => s.email.toLowerCase() === email)) {
          return sendJson(res, 409, { success: false, error: 'An account with this email already exists.' });
        }

        const newStaff = {
          id: `usr_${Date.now()}`,
          email,
          password,
          full_name,
          role,
          is_active: true,
          created_at: new Date().toISOString()
        };

        db.staff.push(newStaff);
        saveDb();
        return sendJson(res, 201, { success: true, staff: newStaff });
      }

      if (pathname.startsWith('/api/staff/') && method === 'PUT') {
        const id = pathname.replace('/api/staff/', '');
        const body = await parseJsonBody(req);
        const user = db.staff.find(s => s.id === id);
        if (!user) {
          return sendJson(res, 404, { success: false, error: 'Staff account not found.' });
        }

        if (body.full_name) user.full_name = body.full_name.trim();
        if (body.password) user.password = body.password.trim();
        if (body.role) user.role = body.role === 'admin' ? 'admin' : 'staff';
        if (typeof body.is_active === 'boolean') user.is_active = body.is_active;

        saveDb();
        return sendJson(res, 200, { success: true, staff: user });
      }

      if (pathname.startsWith('/api/staff/') && method === 'DELETE') {
        const id = pathname.replace('/api/staff/', '');
        const idx = db.staff.findIndex(s => s.id === id);
        if (idx === -1) {
          return sendJson(res, 404, { success: false, error: 'Staff account not found.' });
        }
        if (db.staff[idx].email === 'admin@gmail.com') {
          return sendJson(res, 400, { success: false, error: 'Cannot delete master admin account.' });
        }

        db.staff.splice(idx, 1);
        saveDb();
        return sendJson(res, 200, { success: true, message: 'Staff deleted successfully.' });
      }

      // 4. Vehicle Movements: Fetch All / Today
      if (pathname === '/api/movements' && method === 'GET') {
        const filterDay = urlObj.searchParams.get('day');
        let list = [...db.movements];

        if (filterDay === 'today') {
          list = list.filter(m => isDateToday(m.in_time) || m.is_active_inside);
        }

        // Return sorted by in_time descending (newest first)
        list.sort((a, b) => new Date(b.in_time) - new Date(a.in_time));
        return sendJson(res, 200, {
          success: true,
          version: db.version,
          updated_at: db.updated_at,
          movements: list
        });
      }

      // 5. Vehicle Movements: Record IN (Arrival)
      // Fields: Vehicle number, in_time (reliable server timestamp), remarks
      if (pathname === '/api/movements/in' && method === 'POST') {
        const body = await parseJsonBody(req);
        const rawPlate = body.plate_number || body.vehicle_number || '';
        const normPlate = formatPlate(rawPlate);

        if (!normPlate) {
          return sendJson(res, 400, { success: false, error: 'Vehicle number is required.' });
        }

        // PREVENT DUPLICATE OPEN VISITS: Check if this vehicle is currently inside
        const compact = compactPlate(normPlate);
        const openVisit = db.movements.find(m => compactPlate(m.plate_number) === compact && m.is_active_inside);
        if (openVisit) {
          return sendJson(res, 409, {
            success: false,
            error: `DUPLICATE ARRIVAL REJECTED: Vehicle ${normPlate} is ALREADY checked IN and currently inside the premises. Must check OUT before re-entering.`,
            open_movement: openVisit
          });
        }

        // Automatic Reliable Server Timestamp
        const serverInTime = new Date().toISOString();

        // Calculate today's trip sequence for this vehicle
        const todayPastVisits = db.movements.filter(
          m => compactPlate(m.plate_number) === compact && isDateToday(m.in_time)
        );
        const tripNumber = todayPastVisits.length + 1;

        const newMovement = {
          id: `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          plate_number: normPlate,
          vehicle_number: normPlate,
          in_time: serverInTime,
          out_time: null,
          is_active_inside: true,
          status: 'IN',
          remarks: (body.remarks || '').trim(),
          trip_number: tripNumber,
          created_by: body.created_by || 'Staff',
          created_at: serverInTime,
          updated_at: serverInTime
        };

        db.movements.unshift(newMovement);
        saveDb();

        console.log(`[GATE IN] Vehicle ${normPlate} checked IN at ${serverInTime} (Trip #${tripNumber})`);
        return sendJson(res, 201, { success: true, movement: newMovement });
      }

      // 6. Vehicle Movements: Record OUT (Departure)
      // Finds open visit, sets out_time (server timestamp), appends remarks
      if (pathname === '/api/movements/out' && method === 'POST') {
        const body = await parseJsonBody(req);
        const movementId = body.movement_id || body.id;
        const rawPlate = body.plate_number || body.vehicle_number || '';
        const compact = compactPlate(rawPlate);

        let targetMovement = null;

        if (movementId) {
          targetMovement = db.movements.find(m => m.id === movementId);
        } else if (compact) {
          targetMovement = db.movements.find(m => compactPlate(m.plate_number) === compact && m.is_active_inside);
        }

        // PREVENT DEPARTURE WITHOUT MATCHING ARRIVAL
        if (!targetMovement || !targetMovement.is_active_inside) {
          return sendJson(res, 404, {
            success: false,
            error: `DEPARTURE REJECTED: No active open arrival record found for vehicle ${rawPlate || movementId}. A vehicle cannot depart without a matching arrival.`
          });
        }

        // Automatic Reliable Server Timestamp
        const serverOutTime = new Date().toISOString();
        const departureRemarks = (body.remarks || '').trim();

        targetMovement.out_time = serverOutTime;
        targetMovement.is_active_inside = false;
        targetMovement.status = 'OUT';
        targetMovement.updated_at = serverOutTime;

        if (departureRemarks) {
          targetMovement.remarks = targetMovement.remarks
            ? `${targetMovement.remarks} | Out: ${departureRemarks}`
            : departureRemarks;
        }

        saveDb();

        console.log(`[GATE OUT] Vehicle ${targetMovement.plate_number} checked OUT at ${serverOutTime}`);
        return sendJson(res, 200, { success: true, movement: targetMovement });
      }

      // 7. Admin Single Movement Edit & Delete
      if (pathname.startsWith('/api/movements/') && method === 'PUT') {
        const id = pathname.replace('/api/movements/', '');
        const body = await parseJsonBody(req);
        const m = db.movements.find(x => x.id === id);
        if (!m) return sendJson(res, 404, { success: false, error: 'Movement not found.' });

        if (body.plate_number) m.plate_number = formatPlate(body.plate_number);
        if (body.remarks !== undefined) m.remarks = body.remarks.trim();
        if (body.in_time) m.in_time = body.in_time;
        if (body.out_time !== undefined) {
          m.out_time = body.out_time;
          m.is_active_inside = !body.out_time;
          m.status = body.out_time ? 'OUT' : 'IN';
        }
        m.updated_at = new Date().toISOString();
        saveDb();
        return sendJson(res, 200, { success: true, movement: m });
      }

      if (pathname.startsWith('/api/movements/') && method === 'DELETE') {
        const id = pathname.replace('/api/movements/', '');
        const idx = db.movements.findIndex(x => x.id === id);
        if (idx === -1) return sendJson(res, 404, { success: false, error: 'Movement not found.' });

        db.movements.splice(idx, 1);
        saveDb();
        return sendJson(res, 200, { success: true, message: 'Movement deleted.' });
      }

      // 8. Admin Reset & Clear
      if (pathname === '/api/admin/clear-daily' && method === 'POST') {
        // Keep active inside vehicles, clear completed visits from today
        const before = db.movements.length;
        db.movements = db.movements.filter(m => m.is_active_inside || !isDateToday(m.in_time));
        saveDb();
        return sendJson(res, 200, { success: true, cleared: before - db.movements.length });
      }

      if (pathname === '/api/admin/reset-all' && method === 'POST') {
        db.movements = [];
        saveDb();
        return sendJson(res, 200, { success: true, message: 'All movements reset successfully.' });
      }

      // 9. Live Gate Stats
      if (pathname === '/api/stats' && method === 'GET') {
        const activeInside = db.movements.filter(m => m.is_active_inside);
        const todayMovements = db.movements.filter(m => isDateToday(m.in_time));
        
        // Count distinct vehicles today
        const counts = {};
        todayMovements.forEach(m => {
          const c = compactPlate(m.plate_number);
          counts[c] = (counts[c] || 0) + 1;
        });

        const multiTripCount = Object.values(counts).filter(c => c >= 2).length;
        const totalVehiclesToday = Object.keys(counts).length;

        return sendJson(res, 200, {
          success: true,
          inside_now: activeInside.length,
          total_vehicles_today: totalVehiclesToday,
          total_trips_today: todayMovements.length,
          multi_trip_count: multiTripCount,
          total_movements_all_time: db.movements.length
        });
      }

      return sendJson(res, 404, { success: false, error: 'Endpoint not found.' });
    } catch (apiErr) {
      console.error('[API Error]:', apiErr);
      return sendJson(res, 500, { success: false, error: apiErr.message || 'Internal server error' });
    }
  }

  // ----------------------------------------------------------------------------
  // STATIC ASSET SERVING (Single Page App Fallback)
  // ----------------------------------------------------------------------------
  let reqPath = '/index.html';
  try {
    reqPath = decodeURI(pathname);
    if (reqPath === '/' || !reqPath) reqPath = '/index.html';
  } catch {
    reqPath = '/index.html';
  }

  let filePath = path.join(DIST_DIR, reqPath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        const errMsg = Buffer.from('500 Server Error');
        res.writeHead(500, {
          'Content-Type': 'text/plain',
          'Content-Length': errMsg.length
        });
        res.end(errMsg);
        return;
      }

      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': content.length,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive'
      });
      res.end(content);
    });
  });
}

// ==============================================================================
// 3. MULTI-PORT LISTENERS
// ==============================================================================
// Port 5173 (Primary port for Cloudflare tunnel & local dev)
const server5173 = http.createServer(requestHandler);
server5173.listen(5173, '0.0.0.0', () => {
  console.log(`[FLEET GATE SHARED CLOUD SERVER] Active on:`);
  console.log(`➜ Port 5173: http://192.168.1.55:5173/`);
});

// Port 3000 (Universal alternative for mobile Wi-Fi)
const server3000 = http.createServer(requestHandler);
server3000.listen(3000, '0.0.0.0', () => {
  console.log(`➜ Port 3000: http://192.168.1.55:3000/`);
});

// Port 8080 (Universal alternative for mobile Wi-Fi)
const server8080 = http.createServer(requestHandler);
server8080.listen(8080, '0.0.0.0', () => {
  console.log(`➜ Port 8080: http://192.168.1.55:8080/`);
});
