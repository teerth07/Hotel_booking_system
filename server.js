const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'hotel-booking-secret-key-12345';
const DB_PATH = path.join(__dirname, 'database.db');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database Connection
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Database connection error:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    initializeDatabase();
  }
});

// Database Promisified Helpers
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

// Initialize Database Tables
async function initializeDatabase() {
  try {
    // Users table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'guest'
      )
    `);

    // Rooms table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_number TEXT UNIQUE NOT NULL,
        room_type TEXT NOT NULL,
        price_per_night REAL NOT NULL,
        description TEXT,
        image_url TEXT
      )
    `);

    // Bookings table
    await dbRun(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        room_id INTEGER NOT NULL,
        guest_name TEXT NOT NULL,
        check_in_date TEXT NOT NULL,
        check_out_date TEXT NOT NULL,
        total_price REAL NOT NULL,
        status TEXT DEFAULT 'booked',
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (room_id) REFERENCES rooms(id)
      )
    `);

    // Seed default admin if empty
    const adminExists = await dbGet("SELECT id FROM users WHERE username = 'admin'");
    if (!adminExists) {
      const adminPasswordHash = await bcrypt.hash('adminpassword', 10);
      await dbRun(
        "INSERT INTO users (username, password, role) VALUES ('admin', ?, 'admin')",
        [adminPasswordHash]
      );
      console.log('Default admin user seeded (admin / adminpassword).');
    }

    // Seed sample rooms if empty
    const roomsCount = await dbGet('SELECT COUNT(*) as count FROM rooms');
    if (roomsCount.count === 0) {
      const sampleRooms = [
        { num: '101', type: 'Single Cozy', price: 80, desc: 'A cozy single bed room perfect for solo travelers. Includes free high-speed Wi-Fi, writing desk, and coffee maker.', img: 'single_cozy' },
        { num: '102', type: 'Single Cozy', price: 80, desc: 'A quiet, elegant single room facing the inner garden. Equipped with a comfortable single bed and modern bathroom.', img: 'single_garden' },
        { num: '103', type: 'Single Cozy', price: 80, desc: 'Charming single bed space with panoramic window and executive work desk.', img: 'single_cozy' },
        { num: '104', type: 'Single Cozy', price: 80, desc: 'Cozy retreat room with memory foam mattress, warm lighting, and designer tea set.', img: 'single_garden' },
        
        { num: '201', type: 'Double Deluxe', price: 130, desc: 'Spacious double bed room featuring a comfortable queen-size bed, smart TV, mini-fridge, and workspace.', img: 'double_deluxe' },
        { num: '202', type: 'Double Deluxe', price: 130, desc: 'Beautifully designed double deluxe room with a private balcony overlooking the city skyline.', img: 'double_balcony' },
        { num: '203', type: 'Double Deluxe', price: 130, desc: 'Modern and vibrant double suite with ocean view, smart amenities, and cozy lounging sofa.', img: 'double_deluxe' },
        { num: '204', type: 'Double Deluxe', price: 130, desc: 'Elegant double bed space with ambient cove lighting, marble bathroom, and walk-in wardrobe.', img: 'double_balcony' },
        
        { num: '301', type: 'Executive Suite', price: 220, desc: 'Premium suite with separate living and sleeping areas, king-size bed, luxury tub, and panoramic views.', img: 'executive_suite' },
        { num: '302', type: 'Executive Suite', price: 220, desc: 'Luxury corner suite offering top-tier amenities, smart automation, dining area, and walk-in shower.', img: 'executive_corner' },
        { num: '303', type: 'Executive Suite', price: 220, desc: 'Vast skyline-facing suite with a private hot tub, fully stocked bar, and high-fidelity sound setup.', img: 'executive_suite' },
        { num: '304', type: 'Executive Suite', price: 220, desc: 'High-floor suite with spectacular sunset sights, separate meeting area, and luxury Egyptian cotton sheets.', img: 'executive_corner' },
        
        { num: '401', type: 'Presidential Penthouse', price: 500, desc: 'The ultimate luxury experience. Full-floor penthouse with private terrace, hot tub, private bar, and premium concierge.', img: 'presidential_penthouse' },
        { num: '402', type: 'Presidential Penthouse', price: 500, desc: 'Grand royal penthouse offering a 360-degree glass dome view, private infinity pool access, and custom butler service.', img: 'presidential_penthouse' }
      ];

      for (const room of sampleRooms) {
        await dbRun(
          'INSERT INTO rooms (room_number, room_type, price_per_night, description, image_url) VALUES (?, ?, ?, ?, ?)',
          [room.num, room.type, room.price, room.desc, room.img]
        );
      }
      console.log('Sample rooms seeded successfully.');
    }
  } catch (error) {
    console.error('Error initializing database:', error);
  }
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// ==================== AUTH ROUTES ====================

// Register Route
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const existingUser = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await dbRun('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hashedPassword, 'guest']);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error during registration' });
  }
});

// Login Route
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Get Current User Profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await dbGet('SELECT id, username, role FROM users WHERE id = ?', [req.user.id]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== ROOMS & AVAILABILITY ROUTES ====================

// Get All Rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await dbAll('SELECT * FROM rooms');
    res.json(rooms);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error fetching rooms' });
  }
});

// Search available rooms on specific dates
app.get('/api/rooms/availability', async (req, res) => {
  const { checkIn, checkOut, type } = req.query;

  if (!checkIn || !checkOut) {
    return res.status(400).json({ error: 'Both checkIn and checkOut dates are required.' });
  }

  // Simple validation that checkIn is before checkOut
  if (new Date(checkIn) >= new Date(checkOut)) {
    return res.status(400).json({ error: 'Check-out date must be after check-in date.' });
  }

  try {
    // A room is NOT available if it has an overlapping active booking.
    // Query retrieves rooms not listed in overlapping active bookings.
    let query = `
      SELECT * FROM rooms 
      WHERE id NOT IN (
        SELECT room_id FROM bookings 
        WHERE status = 'booked'
          AND check_in_date < ? 
          AND check_out_date > ?
      )
    `;
    const params = [checkOut, checkIn]; // Overlap criteria: booking_start < requested_end AND booking_end > requested_start

    if (type && type !== 'All') {
      query += ` AND room_type LIKE ?`;
      params.push(`%${type}%`);
    }

    const rooms = await dbAll(query, params);
    res.json(rooms);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error checking room availability.' });
  }
});

// ==================== BOOKINGS ROUTES ====================

// Get User's Bookings (Admins see all)
app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    let bookings;
    if (req.user.role === 'admin') {
      bookings = await dbAll(`
        SELECT b.*, r.room_number, r.room_type, r.price_per_night, u.username as guest_username
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        JOIN users u ON b.user_id = u.id
        ORDER BY b.check_in_date DESC
      `);
    } else {
      bookings = await dbAll(`
        SELECT b.*, r.room_number, r.room_type, r.price_per_night
        FROM bookings b
        JOIN rooms r ON b.room_id = r.id
        WHERE b.user_id = ?
        ORDER BY b.check_in_date DESC
      `, [req.user.id]);
    }
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching bookings' });
  }
});

// Create a Booking
app.post('/api/bookings', authenticateToken, async (req, res) => {
  const { room_id, guest_name, check_in_date, check_out_date } = req.body;

  if (!room_id || !guest_name || !check_in_date || !check_out_date) {
    return res.status(400).json({ error: 'All fields (room_id, guest_name, check_in_date, check_out_date) are required.' });
  }

  const checkIn = new Date(check_in_date);
  const checkOut = new Date(check_out_date);

  if (checkIn >= checkOut) {
    return res.status(400).json({ error: 'Check-out date must be after check-in date.' });
  }

  // Ensure dates are not in the past (using local date comparison)
  const today = new Date();
  today.setHours(0,0,0,0);
  if (checkIn < today) {
    return res.status(400).json({ error: 'Check-in date cannot be in the past.' });
  }

  try {
    // 1. Verify that the room actually exists
    const room = await dbGet('SELECT * FROM rooms WHERE id = ?', [room_id]);
    if (!room) {
      return res.status(404).json({ error: 'Room not found.' });
    }

    // 2. Double check room availability for these dates to prevent double booking
    const overlap = await dbGet(`
      SELECT 1 FROM bookings 
      WHERE room_id = ? 
        AND status = 'booked'
        AND check_in_date < ? 
        AND check_out_date > ?
    `, [room_id, check_out_date, check_in_date]);

    if (overlap) {
      return res.status(400).json({ error: 'This room is already booked for the selected dates.' });
    }

    // 3. Calculate price based on stay duration
    const diffTime = Math.abs(checkOut - checkIn);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 0) {
      return res.status(400).json({ error: 'Booking must be at least 1 night.' });
    }

    const totalPrice = diffDays * room.price_per_night;

    // 4. Create the booking
    await dbRun(`
      INSERT INTO bookings (user_id, room_id, guest_name, check_in_date, check_out_date, total_price, status)
      VALUES (?, ?, ?, ?, ?, ?, 'booked')
    `, [req.user.id, room_id, guest_name, check_in_date, check_out_date, totalPrice]);

    res.status(201).json({
      message: 'Booking created successfully!',
      nights: diffDays,
      totalPrice
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error booking room.' });
  }
});

// Cancel a Booking
app.put('/api/bookings/:id/cancel', authenticateToken, async (req, res) => {
  const bookingId = req.params.id;

  try {
    // Find booking
    const booking = await dbGet('SELECT * FROM bookings WHERE id = ?', [bookingId]);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found.' });
    }

    // Authorization: User must own the booking OR be an admin
    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to cancel this booking.' });
    }

    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking is already cancelled.' });
    }

    // Cancel booking
    await dbRun('UPDATE bookings SET status = ? WHERE id = ?', ['cancelled', bookingId]);
    res.json({
      message: 'Booking cancelled successfully.',
      refundAmount: booking.total_price,
      refundStatus: 'processed',
      refundReference: 'RFND-' + Math.floor(100000 + Math.random() * 900000)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error cancelling booking.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Hotel Booking System server is running on http://localhost:${PORT}`);
});
