// db.js — SQLite layer for the Hotel: rooms, bookings, enquiries.
const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'hotel.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'Standard',
  price INTEGER DEFAULT 2000,
  capacity INTEGER DEFAULT 2,
  available INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest TEXT NOT NULL,
  phone TEXT NOT NULL,
  room_id INTEGER,
  checkin TEXT DEFAULT '',
  checkout TEXT DEFAULT '',
  guests INTEGER DEFAULT 2,
  status TEXT DEFAULT 'confirmed',
  created TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT DEFAULT '',
  created TEXT DEFAULT (datetime('now'))
);
`);

const DB = {
  rooms: () => db.prepare('SELECT * FROM rooms WHERE available=1 ORDER BY price').all(),
  allRooms: () => db.prepare('SELECT * FROM rooms ORDER BY price').all(),
  bookings: () => db.prepare(`SELECT b.*, r.name AS room, r.type FROM bookings b LEFT JOIN rooms r ON r.id=b.room_id ORDER BY b.id DESC`).all(),
  enquiries: () => db.prepare('SELECT * FROM enquiries ORDER BY id DESC').all(),
  book: (b) => db.prepare('INSERT INTO bookings (guest,phone,room_id,checkin,checkout,guests) VALUES (?,?,?,?,?,?)')
    .run(b.guest, b.phone, b.room_id || null, b.checkin || '', b.checkout || '', b.guests || 2).lastInsertRowid,
  enquiry: (b) => db.prepare('INSERT INTO enquiries (name,phone,message) VALUES (?,?,?)').run(b.name, b.phone, b.message || ''),
  setBookingStatus: (id, s) => db.prepare('UPDATE bookings SET status=? WHERE id=?').run(s, id),
  stats: () => ({
    rooms: db.prepare('SELECT COUNT(*) c FROM rooms').get().c,
    bookings: db.prepare("SELECT COUNT(*) c FROM bookings WHERE date(created)=date('now')").get().c,
    enquiries: db.prepare("SELECT COUNT(*) c FROM enquiries WHERE date(created)=date('now')").get().c,
  }),
};

if (DB.rooms().length === 0) {
  const rooms = [
    ['Deluxe King', 'Deluxe', 3200, 2], ['Deluxe Twin', 'Deluxe', 3000, 2],
    ['Executive Suite', 'Suite', 5500, 3], ['Family Room', 'Family', 4200, 4],
    ['Standard Single', 'Standard', 1800, 1], ['Premium King', 'Premium', 4500, 2],
  ];
  rooms.forEach(r => db.prepare('INSERT INTO rooms (name,type,price,capacity) VALUES (?,?,?,?)').run(...r));
  console.log('[hotel db] seeded 6 rooms');
}
module.exports = DB;
