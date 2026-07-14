// agent-core.js — Hotel queue + booking agent (bilingual EN/HI/JA, India-ready).
const mem = require('./memory');
let claudeTask = null;
try { claudeTask = require('./claude_worker').claudeTask; } catch { /* optional */ }

// Parse a free-text guest message into structured fields via local Claude CLI (free).
function understand(guest) {
  if (!claudeTask || !guest || guest.length < 12) return null;
  try {
    const r = claudeTask(`Extract structured fields from this hotel guest message as JSON only: {"name":..., "phone":..., "roomType":..., "checkin":..., "nights":...}. Use "" if missing. Message: ${guest}`);
    if (r.ok) { const m = r.text.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); }
  } catch { /* ignore */ }
  return null;
}

const I18N = {
  en: { joined: 'Check-in number', eta: 'est', surge: 'High lobby load', notify: 'SMS/WhatsApp: long wait, please relax nearby', booked: 'Booking confirmed' },
  hi: { joined: 'चेक-इन नंबर', eta: 'अनुमानित', surge: 'लॉबी में भीड़', notify: 'SMS/WhatsApp: इंतज़ार लंबा है, आसपास आराम करें', booked: 'बुकिंग पुष्ट' },
  ja: { joined: '受付番号', eta: '推定', surge: 'ロビー混雑', notify: 'SMS/WhatsApp: お待たせしています', booked: '予約完了' },
};
function intake(guest, channel, locale='en') {
  const L = I18N[locale] || I18N.en;
  const parsed = understand(guest);
  const display = parsed && parsed.name ? parsed.name : guest;
  const e = mem.joinQueue(guest, channel);
  if (parsed) { try { mem.tagEntry(e.id, parsed); } catch { /* ignore */ } }
  const pos = mem.position(e.id);
  const steps = [
    { tool: 'think', result: '(think) ' + channel + ' check-in: ' + display },
    { tool: 'join', result: L.joined + ' ' + e.id + ' (' + pos.pos + '/' + pos.total + ', ' + pos.etaMin + ' ' + L.eta + ')' },
  ];
  const s = mem.checkSurge();
  if (s.surge) { steps.push({ tool: 'surge', result: L.surge + ': ' + s.waiting }); steps.push({ tool: 'notify', result: L.notify }); mem.addNotification({ type: 'surge', channel: 'whatsapp+sms', waiting: s.waiting, locale }); }
  else steps.push({ tool: 'done', result: 'OK' });
  return { steps, entry: e, pos };
}
function reserve(guest, roomType, checkin, nights, channel, locale='en') {
  const L = I18N[locale] || I18N.en;
  const b = mem.book(guest, roomType, checkin, nights, channel);
  return { steps: [
    { tool: 'think', result: '(think) booking via ' + channel + ': ' + guest },
    { tool: 'book', result: L.booked + ' ' + b.id + ' — ' + roomType + ' ×' + nights + ' (' + checkin + ')' },
    { tool: 'notify', result: L.notify ? 'WhatsApp/SMS confirmation sent to ' + b.phone : 'confirmation sent' },
    { tool: 'done', result: 'OK' },
  ], booking: b };
}
module.exports = { intake, reserve, getMemory: mem.getState, checkSurge: mem.checkSurge };
