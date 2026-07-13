// memory.js — hotel queue + bookings state (bilingual EN/HI/JA).
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, 'memory.json');
function load() { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return { queue: [], bookings: [], notifications: [], cfg: { surgeThreshold: 10, locale: 'en' } }; } }
let state = load();
function save() { fs.writeFileSync(FILE, JSON.stringify(state, null, 2)); }

function joinQueue(guest, channel) {
  const pos = state.queue.length + 1;
  const e = { id: 'HQ' + String(pos).padStart(3, '0'), guest, channel, joinedAt: Date.now(), status: 'waiting', phone: guest.match(/[\d\-+]{7,}/)?.[0] || '+910000000000' };
  state.queue.push(e); save(); return e;
}
function position(id) { const i = state.queue.findIndex(q => q.id === id); return i < 0 ? null : { pos: i + 1, total: state.queue.length, etaMin: (i + 1) * 5 }; }
function book(guest, roomType, checkin, nights, channel) {
  const phone = guest.match(/[\d\-+]{7,}/)?.[0] || '+910000000000';
  const b = { id: 'BK' + String(state.bookings.length + 1).padStart(3, '0'), guest, roomType, checkin, nights, channel, phone, status: 'confirmed', ts: new Date().toISOString() };
  state.bookings.push(b); save(); return b;
}
function checkSurge() { const waiting = state.queue.filter(q => q.status === 'waiting').length; const surge = waiting >= state.cfg.surgeThreshold; return { surge, waiting, threshold: state.cfg.surgeThreshold }; }
function addNotification(n) { state.notifications.unshift({ ts: new Date().toISOString(), ...n }); if (state.notifications.length > 100) state.notifications = state.notifications.slice(0, 100); save(); }
function getState() { return state; }
module.exports = { joinQueue, position, book, checkSurge, addNotification, getState };
