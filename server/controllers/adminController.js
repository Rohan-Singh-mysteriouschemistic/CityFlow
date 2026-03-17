const db = require('../config/db');

// ── DASHBOARD STATS ───────────────────────────
const getDashboardStats = async (req, res) => {
  try {
    const [[totalRides]]    = await db.execute(`SELECT COUNT(*) as count FROM rides`);
    const [[activeRides]]   = await db.execute(`SELECT COUNT(*) as count FROM rides WHERE status = 'in_progress'`);
    const [[totalRevenue]]  = await db.execute(`SELECT COALESCE(SUM(total_amount),0) as total FROM payments WHERE payment_status = 'completed'`);
    const [[totalRiders]]   = await db.execute(`SELECT COUNT(*) as count FROM users WHERE role = 'rider'`);
    const [[totalDrivers]]  = await db.execute(`SELECT COUNT(*) as count FROM users WHERE role = 'driver'`);
    const [[availDrivers]]  = await db.execute(`SELECT COUNT(*) as count FROM driver_profiles WHERE is_available = TRUE`);
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
    console.error('getDashboardStats error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── ALL RIDES ─────────────────────────────────
const getAllRides = async (req, res) => {
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
    query += ` ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));

    const [rides] = await db.execute(query, params);
    res.json({ rides });
  } catch (err) {
    console.error('getAllRides error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── ALL DRIVERS ───────────────────────────────
const getAllDrivers = async (req, res) => {
  try {
    const [drivers] = await db.execute(`
      SELECT u.user_id, u.full_name, u.email, u.phone,
             u.is_active, u.created_at,
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
    console.error('getAllDrivers error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── ALL RIDERS ────────────────────────────────
const getAllRiders = async (req, res) => {
  try {
    const [riders] = await db.execute(`
      SELECT u.user_id, u.full_name, u.email, u.phone,
             u.is_active, u.created_at,
             rp.total_rides, rp.total_spent,
             rp.rating, rp.preferred_payment
      FROM users u
      JOIN rider_profiles rp ON rp.rider_id = u.user_id
      WHERE u.role = 'rider'
      ORDER BY rp.total_spent DESC
    `);
    res.json({ riders });
  } catch (err) {
    console.error('getAllRiders error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── VERIFY DRIVER ─────────────────────────────
const verifyDriver = async (req, res) => {
  const { driver_id } = req.params;
  try {
    await db.execute(
      `UPDATE driver_profiles SET is_verified = TRUE WHERE driver_id = ?`,
      [driver_id]
    );
    res.json({ message: 'Driver verified successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── TOGGLE USER STATUS ────────────────────────
const toggleUserStatus = async (req, res) => {
  const { user_id } = req.params;
  try {
    await db.execute(
      `UPDATE users SET is_active = NOT is_active WHERE user_id = ?`,
      [user_id]
    );
    res.json({ message: 'User status updated' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── REVENUE BY ZONE ───────────────────────────
const getRevenueByZone = async (req, res) => {
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
    res.status(500).json({ message: 'Server error' });
  }
};

// ── MANAGE ZONES ──────────────────────────────
const getZones = async (req, res) => {
  try {
    const [zones] = await db.execute(`SELECT * FROM zones ORDER BY zone_name`);
    res.json({ zones });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const updateZoneSurge = async (req, res) => {
  const { zone_id } = req.params;
  const { surge_multiplier, is_surge_active } = req.body;
  try {
    await db.execute(
      `UPDATE zones SET surge_multiplier = ?, is_surge_active = ? WHERE zone_id = ?`,
      [surge_multiplier, is_surge_active, zone_id]
    );
    res.json({ message: 'Zone updated successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getDashboardStats, getAllRides, getAllDrivers,
  getAllRiders, verifyDriver, toggleUserStatus,
  getRevenueByZone, getZones, updateZoneSurge
};