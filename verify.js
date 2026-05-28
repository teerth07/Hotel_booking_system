const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const TEST_DB_PATH = path.join(__dirname, 'test_database.db');

// Clean up previous test run
if (fs.existsSync(TEST_DB_PATH)) {
  fs.unlinkSync(TEST_DB_PATH);
}

const db = new sqlite3.Database(TEST_DB_PATH);

const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

async function runTests() {
  try {
    console.log('--- INITIALIZING TEST SCHEMA ---');
    await dbRun(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_number TEXT UNIQUE,
        room_type TEXT,
        price_per_night REAL
      )
    `);

    await dbRun(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER,
        check_in_date TEXT,
        check_out_date TEXT,
        status TEXT DEFAULT 'booked'
      )
    `);

    console.log('--- SEEDING TEST ROOM & BOOKING ---');
    // Seed Room 101
    await dbRun('INSERT INTO rooms (room_number, room_type, price_per_night) VALUES (?, ?, ?)', ['101', 'Single Cozy', 80.0]);
    const room = await dbGet('SELECT * FROM rooms WHERE room_number = ?', ['101']);
    const roomId = room.id;

    // Seed booking for Room 101 from 2026-06-01 to 2026-06-05
    await dbRun(
      'INSERT INTO bookings (room_id, check_in_date, check_out_date, status) VALUES (?, ?, ?, ?)',
      [roomId, '2026-06-01', '2026-06-05', 'booked']
    );

    console.log('--- RUNNING OVERLAP VALIDATION TESTS ---');

    // Helper to run availability query
    async function checkAvailability(checkIn, checkOut) {
      const overlap = await dbGet(`
        SELECT 1 FROM bookings 
        WHERE room_id = ? 
          AND status = 'booked'
          AND check_in_date < ? 
          AND check_out_date > ?
      `, [roomId, checkOut, checkIn]);
      return !overlap; // If there's an overlap, room is NOT available
    }

    const testCases = [
      { checkIn: '2026-05-25', checkOut: '2026-06-01', expected: true, desc: 'Before booking (checkout matches checkin)' },
      { checkIn: '2026-06-05', checkOut: '2026-06-10', expected: true, desc: 'After booking (checkin matches checkout)' },
      { checkIn: '2026-06-02', checkOut: '2026-06-04', expected: false, desc: 'Completely inside booked range' },
      { checkIn: '2026-05-30', checkOut: '2026-06-02', expected: false, desc: 'Overlapping start boundary' },
      { checkIn: '2026-06-04', checkOut: '2026-06-06', expected: false, desc: 'Overlapping end boundary' },
      { checkIn: '2026-05-25', checkOut: '2026-06-10', expected: false, desc: 'Completely swallowing booked range' }
    ];

    let allPassed = true;
    for (const tc of testCases) {
      const isAvailable = await checkAvailability(tc.checkIn, tc.checkOut);
      const passed = isAvailable === tc.expected;
      console.log(`[${passed ? 'PASS' : 'FAIL'}] ${tc.desc}: Requested: ${tc.checkIn} to ${tc.checkOut}. Expected available: ${tc.expected}, Got: ${isAvailable}`);
      if (!passed) allPassed = false;
    }

    if (allPassed) {
      console.log('\nSUCCESS: Database overlap verification checks passed!');
      db.close();
      // Clean up test DB
      if (fs.existsSync(TEST_DB_PATH)) {
        fs.unlinkSync(TEST_DB_PATH);
      }
      process.exit(0);
    } else {
      console.error('\nFAILURE: One or more test cases failed.');
      db.close();
      process.exit(1);
    }

  } catch (error) {
    console.error('Test script crashed:', error);
    db.close();
    process.exit(1);
  }
}

runTests();
