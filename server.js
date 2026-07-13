// server.js — zero-dep server for the Hotel queue + booking Agent.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { intake, reserve, getMemory, checkSurge } = require('./agent-core');
const { limited } = require('./ratelimit');

const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type });
  if (Buffer.isBuffer(body)) return res.end(body);
  if (typeof body === 'string') return res.end(body);
  res.end(JSON.stringify(body));
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  async function body() { let b = ''; for await (const c of req) b += c; try { return JSON.parse(b || '{}'); } catch { return {}; } }
  if (req.method === 'POST' && limited(req.socket.remoteAddress)) return send(res, 429, { error: 'rate limit' });
  if (req.method === 'POST' && url.pathname === '/api/checkin') {
    const b = await body();
    if (!b.guest) return send(res, 400, { error: 'no guest' });
    return send(res, 200, intake(b.guest, b.channel || 'site', b.locale || 'en'));
  }
  if (req.method === 'POST' && url.pathname === '/api/book') {
    const b = await body();
    if (!b.guest || !b.roomType) return send(res, 400, { error: 'need guest + roomType' });
    return send(res, 200, reserve(b.guest, b.roomType, b.checkin || 'today', b.nights || 1, b.channel || 'whatsapp', b.locale || 'en'));
  }
  if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, getMemory());
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  const fp = path.join(PUBLIC, p);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) return send(res, 200, fs.readFileSync(fp), MIME[path.extname(fp)] || 'text/plain');
  return send(res, 404, { error: 'not found' });
});
const PORT = 8096;
server.listen(PORT, '0.0.0.0', () => console.log('Hotel Agent on ' + PORT));
