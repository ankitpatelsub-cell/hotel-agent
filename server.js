// server.js — Hotel: public room booking site + DB + staff dashboard (gated).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { intake, reserve, getMemory, checkSurge } = require('./agent-core');
const DB = require('./db');

const PUBLIC = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json' };
const { limited } = require('./ratelimit');
const dash = require('./dashauth');
try { const ep = path.join(__dirname, '.env'); if (fs.existsSync(ep)) for (const line of fs.readFileSync(ep, 'utf8').split('\n')) { const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ''); } } catch {}
function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type });
  if (Buffer.isBuffer(body)) return res.end(body);
  if (typeof body === 'string') return res.end(body);
  res.end(JSON.stringify(body));
}
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && limited(req.socket.remoteAddress)) return send(res, 429, { error: 'rate limit' });
  async function body() { let b = ''; for await (const c of req) b += c; try { return JSON.parse(b || '{}'); } catch { return {}; } }
  const authed = () => dash.checkToken(req.headers['x-auth-token'] || (req.headers['cookie'] || '').match(/dash=([^;]+)/)?.[1] || '');

  // ---- Public data ----
  if (req.method === 'GET' && url.pathname === '/api/rooms') return send(res, 200, DB.rooms());
  if (req.method === 'GET' && url.pathname === '/api/stats') return send(res, 200, DB.stats());

  // ---- Public booking / enquiry ----
  if (req.method === 'POST' && url.pathname === '/api/book') {
    const b = await body();
    if (!b.guest || !b.phone || !b.room_id) return send(res, 400, { error: 'guest + phone + room required' });
    const id = DB.book(b);
    return send(res, 200, { ok: true, id, message: `Room confirmed for ${b.guest}. See you soon!` });
  }
  if (req.method === 'POST' && url.pathname === '/api/enquire') {
    const b = await body();
    if (!b.name || !b.phone) return send(res, 400, { error: 'name + phone required' });
    DB.enquiry(b);
    return send(res, 200, { ok: true, message: 'Thank you — we will call you back shortly.' });
  }
  if (req.method === 'POST' && url.pathname === '/api/checkin') {
    const b = await body();
    if (!b.guest) return send(res, 400, { error: 'no guest' });
    return send(res, 200, intake(b.guest, b.channel || 'site', b.locale || 'en'));
  }

  // ---- Auth ----
  if (req.method === 'POST' && url.pathname === '/api/dash-login') {
    const b = await body();
    if (dash.checkPass(b.password)) return send(res, 200, { token: dash.makeToken() });
    return send(res, 401, { error: 'unauthorized' });
  }

  // ---- Staff-only ----
  if (req.method === 'GET' && url.pathname === '/api/bookings') {
    if (!authed()) return send(res, 401, { error: 'unauthorized' });
    return send(res, 200, DB.bookings());
  }
  if (req.method === 'GET' && url.pathname === '/api/enquiries') {
    if (!authed()) return send(res, 401, { error: 'unauthorized' });
    return send(res, 200, DB.enquiries());
  }
  if (req.method === 'POST' && url.pathname === '/api/booking/status') {
    if (!authed()) return send(res, 401, { error: 'unauthorized' });
    const b = await body(); DB.setBookingStatus(b.id, b.status); return send(res, 200, { ok: true });
  }
  if (req.method === 'GET' && url.pathname === '/api/state') {
    if (!authed()) return send(res, 401, { error: 'unauthorized' });
    return send(res, 200, getMemory());
  }

  // ---- Pages: / public, /admin gated ----
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  if (p === '/admin' || p === '/admin.html') {
    if (!authed()) return send(res, 200, dash.LOGIN_HTML, 'text/html');
    p = '/admin.html';
  }
  const fp = path.join(PUBLIC, p);
  if (fs.existsSync(fp) && fs.statSync(fp).isFile()) return send(res, 200, fs.readFileSync(fp), MIME[path.extname(fp)] || 'text/plain');
  return send(res, 404, { error: 'not found' });
});
const PORT = 8096;
server.listen(PORT, '0.0.0.0', () => console.log('Hotel Agent on ' + PORT));
