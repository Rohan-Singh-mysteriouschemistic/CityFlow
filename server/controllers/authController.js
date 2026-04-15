const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../config/db');
const logger = require('../config/logger');
require('dotenv').config();

const signToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

// ── Suspension duration helpers ────────────────────────────────
const SUSPENSION_LABELS = {
  '1_day':    '1 Day',
  '3_days':   '3 Days',
  '1_week':   '1 Week',
  'permanent':'Permanent',
};

// Convert duration enum to end datetime (null = permanent)
const suspensionUntil = (duration) => {
  const now = new Date();
  if (duration === '1_day')   { now.setDate(now.getDate() + 1);  return now; }
  if (duration === '3_days')  { now.setDate(now.getDate() + 3);  return now; }
  if (duration === '1_week')  { now.setDate(now.getDate() + 7);  return now; }
  return null; // permanent
};

// ── REGISTER ──────────────────────────────────
const register = async (req, res, next) => {
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
    logger.error('Register error', { message: err.message, stack: err.stack });
    next(err);
  } finally {
    conn.release();
  }
};

// ── LOGIN ─────────────────────────────────────
const login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    // Fetch user regardless of is_active (so we can return suspension details)
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE email = ?',
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

    // ── Auto-reactivate if non-permanent suspension has expired ──
    if (!user.is_active && user.suspension_duration !== 'permanent' && user.suspension_until) {
      const now = new Date();
      if (new Date(user.suspension_until) <= now) {
        await db.execute(
          `UPDATE users SET is_active = TRUE,
              suspension_duration = NULL,
              suspended_at        = NULL,
              suspension_until    = NULL
           WHERE user_id = ?`,
          [user.user_id]
        );
        user.is_active = true;
        user.suspension_duration = null;
      }
    }

    // ── Block suspended users with detailed feedback ──────────────
    if (!user.is_active) {
      const durationLabel = SUSPENSION_LABELS[user.suspension_duration] || 'an unknown period';
      const isPermanent   = user.suspension_duration === 'permanent';
      const until         = user.suspension_until
        ? new Date(user.suspension_until).toLocaleDateString('en-IN', {
            day:'numeric', month:'long', year:'numeric'
          })
        : null;

      return res.status(403).json({
        code:               'ACCOUNT_SUSPENDED',
        message:            isPermanent
                              ? `Your account has been permanently suspended. Contact support for assistance.`
                              : `Your account has been suspended for ${durationLabel}.${until ? ` You can log in after ${until}.` : ''}`,
        suspension_duration: user.suspension_duration,
        suspension_label:    durationLabel,
        suspension_until:    user.suspension_until,
        is_permanent:        isPermanent,
      });
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
    logger.error('Login error', { message: err.message, stack: err.stack });
    next(err);
  }
};

// ── GET ME ────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT u.user_id, u.full_name, u.email, u.phone, u.role, u.created_at,
              u.is_active, u.suspension_duration, u.suspension_until,
              rp.total_rides, rp.total_spent, rp.rating as rider_rating,
              dp.avg_rating, dp.total_earned, dp.is_available, dp.is_verified,
              dp.current_zone_id,
              v.vehicle_type, v.make, v.model, v.color, v.registration_no, v.year
       FROM users u
       LEFT JOIN rider_profiles rp  ON rp.rider_id  = u.user_id
       LEFT JOIN driver_profiles dp ON dp.driver_id = u.user_id
       LEFT JOIN vehicles v         ON v.driver_id  = u.user_id
       WHERE u.user_id = ?`,
      [req.user.user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: rows[0] });

  } catch (err) {
    logger.error('GetMe error', { message: err.message, stack: err.stack });
    next(err);
  }
};

module.exports = { register, login, getMe, suspensionUntil, SUSPENSION_LABELS };