import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.join(__dirname, 'dist');

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

function requestHandler(req, res) {
  const clientIp = req.socket.remoteAddress || 'unknown';
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url} from ${clientIp}`);

  // Security and CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let reqPath = '/index.html';
  try {
    reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/' || !reqPath) reqPath = '/index.html';
  } catch (e) {
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
        'Connection': 'keep-alive'
      });
      res.end(content);
    });
  });
}

// Create and listen on primary port 5173
const server5173 = http.createServer(requestHandler);
server5173.listen(5173, '0.0.0.0', () => {
  console.log(`[FLEET GATE] Running on:`);
  console.log(`➜ Port 5173: http://192.168.1.55:5173/`);
});

// Also create and listen on alternative port 3000 for maximum router/mobile compatibility
const server3000 = http.createServer(requestHandler);
server3000.listen(3000, '0.0.0.0', () => {
  console.log(`➜ Port 3000: http://192.168.1.55:3000/`);
});

// Also create and listen on alternative port 8080
const server8080 = http.createServer(requestHandler);
server8080.listen(8080, '0.0.0.0', () => {
  console.log(`➜ Port 8080: http://192.168.1.55:8080/`);
});
