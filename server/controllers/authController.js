const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');
require('dotenv').config();

const signToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

// ── REGISTER ──────────────────────────────────
const register = async (req, res) => {
  const { full_name, email, phone, password, role, license_no, vehicle } = req.body;

  if (!full_name || !email || !phone || !password || !role) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (!['rider', 'driver'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role' });
  }

  if (role === 'driver' && (!license_no || !vehicle)) {
    return res.status(400).json({ message: 'Driver must provide license and vehicle details' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Check duplicate
    const [existing] = await conn.execute(
      'SELECT user_id FROM users WHERE email = ? OR phone = ?',
      [email, phone]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({ message: 'Email or phone already registered' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Insert user
    const [userResult] = await conn.execute(
      `INSERT INTO users (full_name, email, phone, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`,
      [full_name, email, phone, password_hash, role]
    );
    const user_id = userResult.insertId;

    // Create role profile
    if (role === 'rider') {
      await conn.execute(
        'INSERT INTO rider_profiles (rider_id) VALUES (?)',
        [user_id]
      );
    } else if (role === 'driver') {
      await conn.execute(
        'INSERT INTO driver_profiles (driver_id, license_no) VALUES (?, ?)',
        [user_id, license_no]
      );
      await conn.execute(
        `INSERT INTO vehicles (driver_id, registration_no, vehicle_type, make, model, color, year)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [user_id, vehicle.registration_no, vehicle.vehicle_type,
         vehicle.make, vehicle.model, vehicle.color, vehicle.year]
      );
    }

    await conn.commit();

    const token = signToken({ user_id, role, email });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: { user_id, full_name, email, phone, role }
    });

  } catch (err) {
    await conn.rollback();
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Server error during registration' });
  } finally {
    conn.release();
  }
};

// ── LOGIN ─────────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE email = ? AND is_active = TRUE',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = signToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        user_id:   user.user_id,
        full_name: user.full_name,
        email:     user.email,
        phone:     user.phone,
        role:      user.role,
      }
    });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error during login' });
  }
};

// ── GET ME ────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.user_id, u.full_name, u.email, u.phone, u.role, u.created_at,
              rp.total_rides, rp.total_spent, rp.rating as rider_rating,
              dp.avg_rating, dp.total_earned, dp.is_available, dp.is_verified
       FROM users u
       LEFT JOIN rider_profiles rp ON rp.rider_id = u.user_id
       LEFT JOIN driver_profiles dp ON dp.driver_id = u.user_id
       WHERE u.user_id = ?`,
      [req.user.user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: rows[0] });

  } catch (err) {
    console.error('GetMe error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { register, login, getMe };