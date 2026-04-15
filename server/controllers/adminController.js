const db = require('../config/db');
const logger = require('../config/logger');
const { suspensionUntil, SUSPENSION_LABELS } = require('./authController');

// ── DASHBOARD STATS ───────────────────────────
const getDashboardStats = async (req, res, next) => {
  try {
    const [[totalRides]]    = await db.execute(`SELECT COUNT(*) as count FROM rides`);
    const [[activeRides]]   = await db.execute(`SELECT COUNT(*) as count FROM rides WHERE status = 'in_progress'`);
    const [[totalRevenue]]  = await db.execute(`SELECT COALESCE(SUM(total_amount),0) as total FROM payments WHERE payment_status = 'completed'`);
    const [[totalRiders]]   = await db.execute(`SELECT COUNT(*) as count FROM users WHERE role = 'rider'`);
    const [[totalDrivers]]  = await db.execute(`SELECT COUNT(*) as count FROM users WHERE role = 'driver'`);
    // Task 4: Available Drivers = online + not suspended
    const [[availDrivers]]  = await db.execute(
      `SELECT COUNT(*) as count
       FROM driver_profiles dp
       JOIN users u ON u.user_id = dp.driver_id
       WHERE dp.is_available = TRUE
         AND u.is_active = TRUE`
    );
    const [[todayRevenue]]  = await db.execute(`SELECT COALESCE(SUM(total_amount),0) as total FROM payments WHERE payment_status = 'completed' AND DATE(paid_at) = CURDATE()`);
    const [[todayRides]]    = await db.execute(`SELECT COUNT(*) as count FROM rides WHERE DATE(created_at) = CURDATE()`);
    const [[cancelledRides]]= await db.execute(`SELECT COUNT(*) as count FROM rides WHERE status = 'cancelled'`);
    const [[avgRating]]     = await db.execute(`SELECT ROUND(AVG(avg_rating),2) as avg FROM driver_profiles WHERE total_rating_count > 0`);

    res.json({
      stats: {
        total_rides:       totalRides.count,
        active_rides:      activeRides.count,
        total_revenue:     totalRevenue.total,
        today_revenue:     todayRevenue.total,
        today_rides:       todayRides.count,
        total_riders:      totalRiders.count,
        total_drivers:     totalDrivers.count,
        available_drivers: availDrivers.count,
        cancelled_rides:   cancelledRides.count,
        avg_driver_rating: avgRating.avg,
      }
    });
  } catch (err) {
    logger.error('getDashboardStats error', { message: err.message });
    next(err);
  }
};

// ── ALL RIDES ─────────────────────────────────
const getAllRides = async (req, res, next) => {
  const { status, limit = 20, offset = 0 } = req.query;
  try {
    let query = `
      SELECT r.ride_id, r.status, r.start_time, r.end_time,
             r.rider_rating, r.actual_km, r.created_at,
             rq.pickup_address, rq.drop_address, rq.estimated_fare,
             u_rider.full_name  AS rider_name,
             u_driver.full_name AS driver_name,
             p.total_amount, p.payment_method, p.payment_status,
             z.zone_name
      FROM rides r
      JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
      JOIN ride_requests    rq ON rq.request_id    = ra.request_id
      JOIN users u_rider        ON u_rider.user_id  = rq.rider_id
      JOIN users u_driver       ON u_driver.user_id = ra.driver_id
      JOIN zones z              ON z.zone_id        = rq.zone_id
      LEFT JOIN payments p      ON p.ride_id        = r.ride_id
    `;
    const params = [];
    if (status) {
      query += ` WHERE r.status = ?`;
      params.push(status);
    }
    query += ` ORDER BY r.created_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;

    const [rides] = await db.execute(query, params);
    res.json({ rides });
  } catch (err) {
    logger.error('getAllRides error', { message: err.message });
    next(err);
  }
};

// ── ALL DRIVERS ───────────────────────────────
const getAllDrivers = async (req, res, next) => {
  try {
    const [drivers] = await db.execute(`
      SELECT u.user_id, u.full_name, u.email, u.phone,
             u.is_active, u.suspension_duration, u.suspension_until, u.created_at,
             dp.avg_rating, dp.total_rides, dp.total_earned,
             dp.is_available, dp.is_verified, dp.license_no,
             v.vehicle_type, v.make, v.model,
             v.color, v.registration_no, v.year,
             z.zone_name AS current_zone
      FROM users u
      JOIN driver_profiles dp ON dp.driver_id = u.user_id
      LEFT JOIN vehicles v    ON v.driver_id  = u.user_id
      LEFT JOIN zones z       ON z.zone_id    = dp.current_zone_id
      WHERE u.role = 'driver'
      ORDER BY dp.avg_rating DESC
    `);
    res.json({ drivers });
  } catch (err) {
    logger.error('getAllDrivers error', { message: err.message });
    next(err);
  }
};

// ── ALL RIDERS ────────────────────────────────
const getAllRiders = async (req, res, next) => {
  try {
    const [riders] = await db.execute(`
      SELECT u.user_id, u.full_name, u.email, u.phone,
             u.is_active, u.suspension_duration, u.suspension_until, u.created_at,
             rp.total_rides, rp.total_spent,
             rp.rating, rp.preferred_payment
      FROM users u
      JOIN rider_profiles rp ON rp.rider_id = u.user_id
      WHERE u.role = 'rider'
      ORDER BY rp.total_spent DESC
    `);
    res.json({ riders });
  } catch (err) {
    logger.error('getAllRiders error', { message: err.message });
    next(err);
  }
};

// ── VERIFY DRIVER ─────────────────────────────
const verifyDriver = async (req, res, next) => {
  const { driver_id } = req.params;
  try {
    await db.execute(
      `UPDATE driver_profiles SET is_verified = TRUE WHERE driver_id = ?`,
      [driver_id]
    );
    res.json({ message: 'Driver verified successfully' });
  } catch (err) {
    logger.error('verifyDriver error', { message: err.message });
    next(err);
  }
};
const suspendUser = async (req, res, next) => {
  const { user_id } = req.params;
  const { duration } = req.body;   // '1_day' | '3_days' | '1_week' | 'permanent'
  const validDurations = Object.keys(SUSPENSION_LABELS);
  if (!validDurations.includes(duration)) {
    return res.status(400).json({ message: 'Invalid suspension duration', valid: validDurations });
  }
  try {
    const until = suspensionUntil(duration);
    await db.execute(
      `UPDATE users
          SET is_active           = FALSE,
              suspension_duration = ?,
              suspended_at        = NOW(),
              suspension_until    = ?
       WHERE user_id = ?`,
      [duration, until, user_id]
    );
    const durationLabel = SUSPENSION_LABELS[duration];
    res.json({
      message:   `User suspended for ${durationLabel}`,
      duration,
      durationLabel,
      until,
    });
  } catch (err) {
    logger.error('suspendUser error', { message: err.message });
    next(err);
  }
};

// ── ACTIVATE (un-suspend) USER ─────────────────
const activateUser = async (req, res, next) => {
  const { user_id } = req.params;
  try {
    await db.execute(
      `UPDATE users
          SET is_active           = TRUE,
              suspension_duration = NULL,
              suspended_at        = NULL,
              suspension_until    = NULL
       WHERE user_id = ?`,
      [user_id]
    );
    res.json({ message: 'User reactivated successfully' });
  } catch (err) {
    logger.error('activateUser error', { message: err.message });
    next(err);
  }
};

// ── REVENUE BY ZONE ───────────────────────────
const getRevenueByZone = async (req, res, next) => {
  try {
    const [data] = await db.execute(`
      SELECT z.zone_name, z.area_name,
             COUNT(p.payment_id)          AS total_rides,
             ROUND(SUM(p.total_amount),2) AS total_revenue,
             ROUND(AVG(p.total_amount),2) AS avg_fare
      FROM zones z
      LEFT JOIN ride_requests rq ON rq.zone_id  = z.zone_id
      LEFT JOIN ride_assignments ra ON ra.request_id = rq.request_id
      LEFT JOIN rides r          ON r.assignment_id  = ra.assignment_id
      LEFT JOIN payments p       ON p.ride_id        = r.ride_id
      WHERE p.payment_status = 'completed' OR p.payment_status IS NULL
      GROUP BY z.zone_id, z.zone_name, z.area_name
      ORDER BY total_revenue DESC
    `);
    res.json({ data });
  } catch (err) {
    logger.error('getRevenueByZone error', { message: err.message });
    next(err);
  }
};

// ── MANAGE ZONES (Task 5 — updated query) ─────
const getZones = async (req, res, next) => {
  try {
    // Return zone_multiplier alias for surge_multiplier + new surge_multiplier_admin; omit base_fare/fare_per_km/is_surge_active
    const [zones] = await db.execute(
      `SELECT zone_id, zone_name, area_name,
              surge_multiplier AS zone_multiplier,
              surge_multiplier_admin,
              center_lat, center_lng
       FROM zones
       ORDER BY zone_name`
    );
    res.json({ zones });
  } catch (err) {
    logger.error('getZones(admin) error', { message: err.message });
    next(err);
  }
};

// ── UPDATE ZONE MULTIPLIER (Task 5) ───────────
const updateZoneMultiplier = async (req, res, next) => {
  const { zone_id } = req.params;
  const { zone_multiplier } = req.body;
  
  if (zone_multiplier === undefined) {
    return res.status(400).json({ message: 'zone_multiplier is required' });
  }
  
  const mult = parseFloat(zone_multiplier);
  if (isNaN(mult) || mult < 1 || mult > 5) {
    return res.status(400).json({ message: 'zone_multiplier must be between 1.0 and 5.0' });
  }
  
  try {
    await db.execute(
      `UPDATE zones SET surge_multiplier = ? WHERE zone_id = ?`,
      [mult, zone_id]
    );
    res.json({ message: 'Zone multiplier updated successfully', zone_multiplier: mult });
  } catch (err) {
    logger.error('updateZoneMultiplier error', { message: err.message });
    next(err);
  }
};

// ── UPDATE ADMIN SURGE MULTIPLIER ─────────────
const updateAdminSurgeMultiplier = async (req, res, next) => {
  const { zone_id } = req.params;
  const { surge_multiplier_admin } = req.body;
  
  if (surge_multiplier_admin === undefined) {
    return res.status(400).json({ message: 'surge_multiplier_admin is required' });
  }
  
  const mult = parseFloat(surge_multiplier_admin);
  if (isNaN(mult) || mult < 1 || mult > 10) {
    return res.status(400).json({ message: 'surge_multiplier_admin must be between 1.0 and 10.0' });
  }
  
  try {
    await db.execute(
      `UPDATE zones SET surge_multiplier_admin = ? WHERE zone_id = ?`,
      [mult, zone_id]
    );
    res.json({ message: 'Admin surge multiplier updated successfully', surge_multiplier_admin: mult });
  } catch (err) {
    logger.error('updateAdminSurgeMultiplier error', { message: err.message });
    next(err);
  }
};


module.exports = {
  getDashboardStats, getAllRides, getAllDrivers,
  getAllRiders, verifyDriver,
  suspendUser, activateUser,
  getRevenueByZone, getZones, updateZoneMultiplier, updateAdminSurgeMultiplier
};