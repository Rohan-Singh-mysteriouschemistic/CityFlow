const express = require('express');
const router = express.Router();
const db = require('../db');
const { protect, authorize } = require('../middleware/auth');

// ─── 1. REQUEST A RIDE (Rider only) ───────────────────────────────────────────
router.post('/request', protect, authorize('rider'), async (req, res) => {
  const { pickup_zone_id, dropoff_zone_id, vehicle_type, promo_code } = req.body;

  if (!pickup_zone_id || !dropoff_zone_id || !vehicle_type) {
    return res.status(400).json({ success: false, message: 'pickup_zone_id, dropoff_zone_id and vehicle_type are required' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Get rider profile
    const [[rider]] = await conn.query(
      'SELECT id FROM rider_profiles WHERE user_id = ?', [req.user.id]
    );
    if (!rider) return res.status(404).json({ success: false, message: 'Rider profile not found' });

    // Validate zones
    const [[pickup]] = await conn.query('SELECT * FROM zones WHERE id = ?', [pickup_zone_id]);
    const [[dropoff]] = await conn.query('SELECT * FROM zones WHERE id = ?', [dropoff_zone_id]);
    if (!pickup || !dropoff) return res.status(404).json({ success: false, message: 'Invalid zone(s)' });

    // Fare calculation
    const BASE_FARES = { auto: 25, mini: 40, sedan: 55, suv: 75, xl: 90 };
    const baseFare = BASE_FARES[vehicle_type] || 40;
    const surgeFactor = pickup.surge_multiplier || 1.0;
    const distanceKm = Math.abs(dropoff_zone_id - pickup_zone_id) * 2 + 3; // Simplified estimate
    const estimatedFare = parseFloat((baseFare + distanceKm * 12 * surgeFactor).toFixed(2));

    // Promo code check
    let discount = 0;
    let promoId = null;
    if (promo_code) {
      const [[promo]] = await conn.query(
        `SELECT * FROM promo_codes WHERE code = ? AND is_active = 1
         AND (valid_from IS NULL OR valid_from <= NOW())
         AND (valid_until IS NULL OR valid_until >= NOW())
         AND (usage_limit IS NULL OR used_count < usage_limit)`,
        [promo_code]
      );
      if (promo) {
        discount = promo.discount_type === 'percent'
          ? parseFloat((estimatedFare * promo.discount_value / 100).toFixed(2))
          : promo.discount_value;
        discount = Math.min(discount, estimatedFare);
        promoId = promo.id;
      }
    }

    const finalFare = parseFloat((estimatedFare - discount).toFixed(2));

    // Insert ride request
    const [result] = await conn.query(
      `INSERT INTO ride_requests
        (rider_id, pickup_zone_id, dropoff_zone_id, vehicle_type, estimated_fare, promo_code_id, status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [rider.id, pickup_zone_id, dropoff_zone_id, vehicle_type, finalFare, promoId]
    );

    await conn.commit();
    res.status(201).json({
      success: true,
      message: 'Ride requested successfully',
      data: {
        ride_request_id: result.insertId,
        pickup_zone: pickup.name,
        dropoff_zone: dropoff.name,
        vehicle_type,
        estimated_fare: finalFare,
        surge_multiplier: surgeFactor,
        discount_applied: discount,
        status: 'pending'
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  } finally {
    conn.release();
  }
});

// ─── 2. ASSIGN DRIVER (System/Driver auto-match) ─────────────────────────────
router.post('/assign/:requestId', protect, authorize('driver'), async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { requestId } = req.params;

    // Get driver profile
    const [[driver]] = await conn.query(
      `SELECT dp.*, v.id as vehicle_id, v.vehicle_type
       FROM driver_profiles dp
       LEFT JOIN vehicles v ON v.driver_id = dp.id AND v.is_active = 1
       WHERE dp.user_id = ? AND dp.is_online = 1`,
      [req.user.id]
    );
    if (!driver) return res.status(403).json({ success: false, message: 'Driver not online or profile not found' });

    // Get ride request
    const [[rideReq]] = await conn.query(
      'SELECT * FROM ride_requests WHERE id = ? AND status = ?',
      [requestId, 'pending']
    );
    if (!rideReq) return res.status(404).json({ success: false, message: 'Ride request not found or already assigned' });

    // Vehicle type match
    if (driver.vehicle_type && driver.vehicle_type !== rideReq.vehicle_type) {
      return res.status(400).json({ success: false, message: `Your vehicle type (${driver.vehicle_type}) does not match request (${rideReq.vehicle_type})` });
    }

    // Check driver has no active ride
    const [[activeRide]] = await conn.query(
      `SELECT id FROM rides WHERE driver_id = ? AND status IN ('assigned','started')`,
      [driver.id]
    );
    if (activeRide) return res.status(400).json({ success: false, message: 'You already have an active ride' });

    // Update ride request
    await conn.query('UPDATE ride_requests SET status = ? WHERE id = ?', ['assigned', requestId]);

    // Create assignment record
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const [assign] = await conn.query(
      `INSERT INTO ride_assignments (request_id, driver_id, otp, status) VALUES (?, ?, ?, 'assigned')`,
      [requestId, driver.id, otp]
    );

    // Create ride record
    const [ride] = await conn.query(
      `INSERT INTO rides
        (request_id, rider_id, driver_id, vehicle_id, pickup_zone_id, dropoff_zone_id,
         fare_amount, status, otp)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'assigned', ?)`,
      [requestId, rideReq.rider_id, driver.id, driver.vehicle_id,
       rideReq.pickup_zone_id, rideReq.dropoff_zone_id, rideReq.estimated_fare, otp]
    );

    await conn.commit();
    res.status(200).json({
      success: true,
      message: 'Ride assigned successfully',
      data: { ride_id: ride.insertId, otp, fare: rideReq.estimated_fare }
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  } finally {
    conn.release();
  }
});

// ─── 3. START RIDE (Driver — OTP verified) ───────────────────────────────────
router.post('/start/:rideId', protect, authorize('driver'), async (req, res) => {
  const { otp } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[driver]] = await conn.query(
      'SELECT id FROM driver_profiles WHERE user_id = ?', [req.user.id]
    );

    const [[ride]] = await conn.query(
      `SELECT * FROM rides WHERE id = ? AND driver_id = ? AND status = 'assigned'`,
      [req.params.rideId, driver.id]
    );
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found or not in assigned state' });

    if (ride.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }

    await conn.query(
      `UPDATE rides SET status = 'started', started_at = NOW() WHERE id = ?`,
      [ride.id]
    );
    await conn.query(
      `UPDATE ride_assignments SET status = 'started' WHERE request_id = ?`,
      [ride.request_id]
    );

    await conn.commit();
    res.json({ success: true, message: 'Ride started', data: { ride_id: ride.id, status: 'started' } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  } finally {
    conn.release();
  }
});

// ─── 4. COMPLETE RIDE (Driver) ────────────────────────────────────────────────
router.post('/complete/:rideId', protect, authorize('driver'), async (req, res) => {
  const { payment_method } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[driver]] = await conn.query(
      'SELECT id FROM driver_profiles WHERE user_id = ?', [req.user.id]
    );

    const [[ride]] = await conn.query(
      `SELECT * FROM rides WHERE id = ? AND driver_id = ? AND status = 'started'`,
      [req.params.rideId, driver.id]
    );
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found or not in started state' });

    // Complete the ride
    await conn.query(
      `UPDATE rides SET status = 'completed', completed_at = NOW() WHERE id = ?`,
      [ride.id]
    );

    // Create payment record
    const method = payment_method || 'cash';
    await conn.query(
      `INSERT INTO payments (ride_id, amount, payment_method, status)
       VALUES (?, ?, ?, 'completed')`,
      [ride.id, ride.fare_amount, method]
    );

    // Update assignment
    await conn.query(
      `UPDATE ride_assignments SET status = 'completed' WHERE request_id = ?`,
      [ride.request_id]
    );

    await conn.commit();
    res.json({
      success: true,
      message: 'Ride completed',
      data: { ride_id: ride.id, fare: ride.fare_amount, payment_method: method, status: 'completed' }
    });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  } finally {
    conn.release();
  }
});

// ─── 5. CANCEL RIDE ──────────────────────────────────────────────────────────
router.post('/cancel/:rideId', protect, async (req, res) => {
  const { reason } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Get user profile based on role
    let profileQuery, profileParam;
    if (req.user.role === 'rider') {
      profileQuery = 'SELECT id FROM rider_profiles WHERE user_id = ?';
      profileParam = req.user.id;
    } else {
      profileQuery = 'SELECT id FROM driver_profiles WHERE user_id = ?';
      profileParam = req.user.id;
    }
    const [[profile]] = await conn.query(profileQuery, [profileParam]);

    const condition = req.user.role === 'rider'
      ? `rider_id = ${profile.id}` : `driver_id = ${profile.id}`;

    const [[ride]] = await conn.query(
      `SELECT * FROM rides WHERE id = ? AND ${condition} AND status IN ('assigned','started')`,
      [req.params.rideId]
    );
    if (!ride) return res.status(404).json({ success: false, message: 'Active ride not found' });

    await conn.query(
      `UPDATE rides SET status = 'cancelled' WHERE id = ?`, [ride.id]
    );
    await conn.query(
      `UPDATE ride_requests SET status = 'cancelled' WHERE id = ?`, [ride.request_id]
    );
    await conn.query(
      `INSERT INTO cancellations (ride_id, cancelled_by, reason) VALUES (?, ?, ?)`,
      [ride.id, req.user.role, reason || 'No reason provided']
    );

    await conn.commit();
    res.json({ success: true, message: 'Ride cancelled', data: { ride_id: ride.id } });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  } finally {
    conn.release();
  }
});

// ─── 6. GET RIDE DETAILS ──────────────────────────────────────────────────────
router.get('/:rideId', protect, async (req, res) => {
  try {
    const [[ride]] = await db.query(
      `SELECT r.*,
         uz.name AS pickup_zone, dz.name AS dropoff_zone,
         u_rider.name AS rider_name, u_rider.phone AS rider_phone,
         u_driver.name AS driver_name, u_driver.phone AS driver_phone,
         p.payment_method, p.status AS payment_status
       FROM rides r
       LEFT JOIN zones uz ON uz.id = r.pickup_zone_id
       LEFT JOIN zones dz ON dz.id = r.dropoff_zone_id
       LEFT JOIN rider_profiles rp ON rp.id = r.rider_id
       LEFT JOIN users u_rider ON u_rider.id = rp.user_id
       LEFT JOIN driver_profiles dp ON dp.id = r.driver_id
       LEFT JOIN users u_driver ON u_driver.id = dp.user_id
       LEFT JOIN payments p ON p.ride_id = r.id
       WHERE r.id = ?`,
      [req.params.rideId]
    );
    if (!ride) return res.status(404).json({ success: false, message: 'Ride not found' });
    res.json({ success: true, data: ride });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ─── 7. GET MY RIDES (Rider or Driver) ────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    let whereClause;
    if (req.user.role === 'rider') {
      const [[rp]] = await db.query('SELECT id FROM rider_profiles WHERE user_id = ?', [req.user.id]);
      whereClause = `r.rider_id = ${rp.id}`;
    } else if (req.user.role === 'driver') {
      const [[dp]] = await db.query('SELECT id FROM driver_profiles WHERE user_id = ?', [req.user.id]);
      whereClause = `r.driver_id = ${dp.id}`;
    } else {
      whereClause = '1=1';
    }

    const [rides] = await db.query(
      `SELECT r.id, r.status, r.fare_amount, r.created_at,
         uz.name AS pickup_zone, dz.name AS dropoff_zone,
         u_rider.name AS rider_name, u_driver.name AS driver_name
       FROM rides r
       LEFT JOIN zones uz ON uz.id = r.pickup_zone_id
       LEFT JOIN zones dz ON dz.id = r.dropoff_zone_id
       LEFT JOIN rider_profiles rp ON rp.id = r.rider_id
       LEFT JOIN users u_rider ON u_rider.id = rp.user_id
       LEFT JOIN driver_profiles dp ON dp.id = r.driver_id
       LEFT JOIN users u_driver ON u_driver.id = dp.user_id
       WHERE ${whereClause}
       ORDER BY r.created_at DESC LIMIT 50`,
      []
    );
    res.json({ success: true, count: rides.length, data: rides });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

// ─── 8. GET PENDING RIDE REQUESTS (Driver browsing) ──────────────────────────
router.get('/requests/pending', protect, authorize('driver'), async (req, res) => {
  try {
    const [[driver]] = await db.query(
      `SELECT dp.*, v.vehicle_type FROM driver_profiles dp
       LEFT JOIN vehicles v ON v.driver_id = dp.id AND v.is_active = 1
       WHERE dp.user_id = ?`,
      [req.user.id]
    );

    const [requests] = await db.query(
      `SELECT rr.id, rr.vehicle_type, rr.estimated_fare, rr.created_at,
         pz.name AS pickup_zone, dz.name AS dropoff_zone,
         u.name AS rider_name
       FROM ride_requests rr
       LEFT JOIN zones pz ON pz.id = rr.pickup_zone_id
       LEFT JOIN zones dz ON dz.id = rr.dropoff_zone_id
       LEFT JOIN rider_profiles rp ON rp.id = rr.rider_id
       LEFT JOIN users u ON u.id = rp.user_id
       WHERE rr.status = 'pending' AND rr.vehicle_type = ?
       ORDER BY rr.created_at ASC`,
      [driver.vehicle_type || 'mini']
    );
    res.json({ success: true, count: requests.length, data: requests });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
});

module.exports = router;