const db        = require('../config/db');
const RideModel = require('../models/rideModel');
const { RIDE_STATUS, CANCELLATION_PENALTY, VEHICLE_BASE_FARES, PER_KM_RATE } = require('../config/constants');

// ── REQUEST A RIDE ────────────────────────────────────────────────────────────
// NEW FLOW: Creates a pending request only. Does NOT auto-assign a driver.
// Drivers poll /rides/available and accept themselves (first-accept-wins).
const requestRide = async (req, res) => {
  const {
    pickup_address, pickup_lat, pickup_lng,
    drop_address,   drop_lat,   drop_lng,
    zone_id, vehicle_type, estimated_km
  } = req.body;

  if (!pickup_address || !drop_address || !zone_id || !vehicle_type || !estimated_km) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    // Prevent a rider from having more than one active/pending request at a time
    const [existing] = await db.execute(
      `SELECT rq.request_id FROM ride_requests rq
       LEFT JOIN ride_assignments ra ON ra.request_id = rq.request_id
       LEFT JOIN rides r ON r.assignment_id = ra.assignment_id
       WHERE rq.rider_id = ?
         AND (
           rq.status = 'pending'
           OR r.status IN ('accepted', 'otp_pending', 'in_progress')
         )
       LIMIT 1`,
      [req.user.user_id]
    );
    if (existing.length > 0) {
      return res.status(400).json({
        message: 'You already have an active or pending ride request'
      });
    }

    const [zones] = await db.execute(
      'SELECT * FROM zones WHERE zone_id = ?', [zone_id]
    );
    if (zones.length === 0) {
      return res.status(404).json({ message: 'Zone not found' });
    }

    const zone         = zones[0];
    const base         = VEHICLE_BASE_FARES[vehicle_type] || VEHICLE_BASE_FARES['sedan'];
    const perKm        = PER_KM_RATE;
    const zoneMulti    = parseFloat(zone.surge_multiplier || 1);
    const surgeAdmin   = parseFloat(zone.surge_multiplier_admin || 1);
    
    // Exact requested logic: fare = (vehicle_base_fare + distance_fare) * zoneMulti * surgeAdmin
    const distance_fare  = parseFloat(estimated_km) * perKm;
    const combined_mult  = zoneMulti * surgeAdmin;
    const estimated_fare = parseFloat(((base + distance_fare) * combined_mult).toFixed(2));

    // Create the request in 'pending' status — no driver assigned yet
    const request_id = await RideModel.createRequest({
      rider_id: req.user.user_id,
      pickup_address, pickup_lat, pickup_lng,
      drop_address,   drop_lat,   drop_lng,
      zone_id, vehicle_type, estimated_fare, estimated_km
    });

    res.status(201).json({
      message:        'Ride requested! Waiting for a driver to accept.',
      request_id,
      estimated_fare,
      driver_found:   false   // driver hasn't accepted yet
    });

  } catch (err) {
    console.error('requestRide error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET AVAILABLE REQUESTS (for driver) ──────────────────────────────────────
// Returns pending requests in the driver's zone that match their vehicle type.
// No assignment row exists yet for these requests.
const getAvailableRequests = async (req, res) => {
  try {
    const requests = await RideModel.getPendingRequestsForDriver(req.user.user_id);
    res.json({ requests });
  } catch (err) {
    console.error('getAvailableRequests error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── ACCEPT A REQUEST (first-accept-wins) ─────────────────────────────────────
// Uses a DB transaction with INSERT IGNORE on ride_assignments (UNIQUE request_id)
// so only ONE driver can ever create the assignment row.
// Any concurrent accept for the same request_id gets a 409.
const acceptRequest = async (req, res) => {
  const { request_id } = req.params;
  const driver_id      = req.user.user_id;

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 0. Verify driver is verified by admin — HARD BLOCK
    const [driverProfile] = await conn.execute(
      `SELECT is_verified FROM driver_profiles WHERE driver_id = ?`,
      [driver_id]
    );
    if (!driverProfile.length || !driverProfile[0].is_verified) {
      await conn.rollback();
      return res.status(403).json({
        code:    'DRIVER_NOT_VERIFIED',
        message: 'Your account is pending verification by admin. You cannot accept rides until approved.'
      });
    }

    // 1. Check the driver has no active ride
    const [activeRide] = await conn.execute(
      `SELECT r.ride_id FROM ride_assignments ra
       JOIN rides r ON r.assignment_id = ra.assignment_id
       WHERE ra.driver_id = ?
         AND r.status IN ('accepted', 'otp_pending', 'in_progress')
       LIMIT 1`,
      [driver_id]
    );
    if (activeRide.length > 0) {
      await conn.rollback();
      return res.status(400).json({
        message: 'Complete your current ride before accepting a new one'
      });
    }


    // 2. Lock the request row and verify it's still pending
    const [requests] = await conn.execute(
      `SELECT * FROM ride_requests WHERE request_id = ? AND status = 'pending'
       AND expires_at > NOW() FOR UPDATE`,
      [request_id]
    );
    if (requests.length === 0) {
      await conn.rollback();
      return res.status(409).json({
        message: 'Ride request is no longer available'
      });
    }

    // 3. Check no assignment exists yet (catches race conditions the lock may miss)
    const [existing] = await conn.execute(
      `SELECT assignment_id FROM ride_assignments WHERE request_id = ?`,
      [request_id]
    );
    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        message: 'Ride was already accepted by another driver'
      });
    }

    // 4. Create assignment
    const [assignResult] = await conn.execute(
      `INSERT INTO ride_assignments (request_id, driver_id, status, response_at)
       VALUES (?, ?, 'accepted', NOW())`,
      [request_id, driver_id]
    );
    const assignment_id = assignResult.insertId;

    // 5. Create ride with OTP
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const [rideResult] = await conn.execute(
      `INSERT INTO rides (assignment_id, otp, status) VALUES (?, ?, 'accepted')`,
      [assignment_id, otp]
    );
    const ride_id = rideResult.insertId;

    // 6. Mark request as matched
    await conn.execute(
      `UPDATE ride_requests SET status = 'matched' WHERE request_id = ?`,
      [request_id]
    );

    // 7. Mark driver unavailable
    await conn.execute(
      `UPDATE driver_profiles SET is_available = FALSE WHERE driver_id = ?`,
      [driver_id]
    );

    await conn.commit();

    // Return OTP so driver sees it immediately after accepting
    res.status(201).json({
      message:  'Ride accepted!',
      ride_id,
      otp,
      request_id
    });

  } catch (err) {
    await conn.rollback();
    // MySQL duplicate key error on the UNIQUE request_id in ride_assignments
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        message: 'Ride was already accepted by another driver'
      });
    }
    console.error('acceptRequest error:', err.message);
    res.status(500).json({ message: 'Server error' });
  } finally {
    conn.release();
  }
};

// ── GET ACTIVE RIDE (rider) ───────────────────────────────────────────────────
// Always returns the OTP from DB — this is the fix for OTP being lost on refresh.
const getActiveRideRider = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT r.ride_id, r.status, r.otp, r.start_time,
              rq.pickup_address, rq.drop_address,
              rq.estimated_fare, rq.estimated_km,
              z.zone_name, z.surge_multiplier,
              u.full_name   AS driver_name,
              u.phone       AS driver_phone,
              dp.avg_rating AS driver_avg_rating,
              v.make, v.model, v.color, v.registration_no
       FROM rides r
       JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
       JOIN ride_requests    rq ON rq.request_id    = ra.request_id
       JOIN zones z             ON z.zone_id        = rq.zone_id
       JOIN users u             ON u.user_id         = ra.driver_id
       JOIN driver_profiles dp  ON dp.driver_id      = ra.driver_id
       JOIN vehicles v          ON v.driver_id        = ra.driver_id
       WHERE rq.rider_id = ?
         AND r.status IN ('accepted', 'otp_pending', 'in_progress')
       ORDER BY r.created_at DESC
       LIMIT 1`,
      [req.user.user_id]
    );

    if (rows.length === 0) {
      // Also check if they have a pending (unmatched) request
      const [pending] = await db.execute(
        `SELECT request_id, pickup_address, drop_address,
                estimated_fare, estimated_km, vehicle_type, status
         FROM ride_requests
         WHERE rider_id = ? AND status = 'pending' AND expires_at > NOW()
         LIMIT 1`,
        [req.user.user_id]
      );
      if (pending.length > 0) {
        return res.json({
          ride: null,
          pending_request: pending[0]   // rider is waiting for a driver to accept
        });
      }
      return res.json({ ride: null, pending_request: null });
    }

    res.json({ ride: rows[0] });
  } catch (err) {
    console.error('getActiveRideRider error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET ACTIVE RIDE (driver) ──────────────────────────────────────────────────
// OTP is intentionally excluded — the rider shares it verbally with the driver.
const getActiveRideDriver = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT r.ride_id, r.status, r.start_time,
              rq.pickup_address, rq.drop_address,
              rq.estimated_fare, rq.estimated_km,
              u.full_name AS rider_name,
              u.phone     AS rider_phone
       FROM rides r
       JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
       JOIN ride_requests    rq ON rq.request_id    = ra.request_id
       JOIN users u             ON u.user_id         = rq.rider_id
       WHERE ra.driver_id = ?
         AND r.status IN ('accepted', 'otp_pending', 'in_progress')
       ORDER BY r.created_at DESC
       LIMIT 1`,
      [req.user.user_id]
    );

    if (rows.length === 0) return res.json({ ride: null });
    res.json({ ride: rows[0] });
  } catch (err) {
    console.error('getActiveRideDriver error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── START RIDE (verify OTP) ───────────────────────────────────────────────────
const startRide = async (req, res) => {
  const { ride_id } = req.params;
  const { otp }     = req.body;

  try {
    const [rows] = await db.execute(
      `SELECT r.*, ra.driver_id FROM rides r
       JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
       WHERE r.ride_id = ?`,
      [ride_id]
    );

    if (rows.length === 0) return res.status(404).json({ message: 'Ride not found' });

    const ride = rows[0];

    if (ride.driver_id !== req.user.user_id) {
      return res.status(403).json({ message: 'Not your ride' });
    }
    if (ride.status !== 'accepted') {
      return res.status(400).json({ message: 'Ride cannot be started' });
    }
    if (ride.otp !== otp) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    await db.execute(
      `UPDATE rides SET status = 'in_progress', start_time = NOW() WHERE ride_id = ?`,
      [ride_id]
    );

    res.json({ message: 'Ride started successfully', ride_id });

  } catch (err) {
    console.error('startRide error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── COMPLETE RIDE ─────────────────────────────────────────────────────────────
const completeRide = async (req, res) => {
  const { ride_id }                    = req.params;
  const { actual_km, payment_method }  = req.body;

  try {
    const ride = await RideModel.getRideById(ride_id);

    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (ride.driver_id !== req.user.user_id) {
      return res.status(403).json({ message: 'Not your ride' });
    }
    if (ride.status !== 'in_progress') {
      return res.status(400).json({ message: 'Ride is not in progress' });
    }

    const km             = parseFloat(actual_km || ride.estimated_km);
    const vehicleType    = ride.vehicle_type_actual || ride.vehicle_type;
    const base           = VEHICLE_BASE_FARES[vehicleType] || VEHICLE_BASE_FARES['sedan'];
    const perKm          = PER_KM_RATE;
    const zoneMulti      = parseFloat(ride.zone_multiplier || 1);
    const surgeAdmin     = parseFloat(ride.surge_multiplier_admin || 1);
    
    const distance_fare  = parseFloat((km * perKm).toFixed(2));
    const combined_mult  = zoneMulti * surgeAdmin;
    const surge_amount   = parseFloat(((base + distance_fare) * (combined_mult - 1)).toFixed(2));
    const total_amount   = parseFloat(((base + distance_fare) * combined_mult).toFixed(2));

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        `UPDATE rides SET status = 'completed', end_time = NOW(), actual_km = ?
         WHERE ride_id = ?`,
        [km, ride_id]
      );

      await conn.execute(
        `INSERT INTO payments
         (ride_id, rider_id, base_fare, fare_per_km, distance_fare,
          surge_multiplier, surge_amount, total_amount,
          payment_method, payment_status, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', NOW())`,
        [
          ride_id, ride.rider_id,
          base, perKm, distance_fare,
          combined_mult, surge_amount, total_amount,
          payment_method || 'cash'
        ]
      );

      // Explicitly update both profiles inside the same transaction.
      // The DB trigger reads payments inside the ride UPDATE handler, but at
      // that point the payment row didn't exist yet — so total_spent stayed 0.
      // Doing it here, after the payment INSERT, guarantees correct values.
      await conn.execute(
        `UPDATE rider_profiles
         SET total_rides = total_rides + 1,
             total_spent = total_spent + ?
         WHERE rider_id = ?`,
        [total_amount, ride.rider_id]
      );

      await conn.execute(
        `UPDATE driver_profiles
         SET total_rides  = total_rides + 1,
             total_earned = total_earned + ?,
             is_available = TRUE
         WHERE driver_id = ?`,
        [total_amount, ride.driver_id]
      );

      await conn.commit();

      res.json({
        message:        'Ride completed',
        ride_id,
        total_amount,
        payment_method: payment_method || 'cash'
      });

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

  } catch (err) {
    console.error('completeRide error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── CANCEL RIDE ───────────────────────────────────────────────────────────────
const cancelRide = async (req, res) => {
  const { ride_id } = req.params;
  const { reason }  = req.body;

  try {
    const ride = await RideModel.getRideById(ride_id);

    if (!ride) return res.status(404).json({ message: 'Ride not found' });

    const isRider  = ride.rider_id  === req.user.user_id;
    const isDriver = ride.driver_id === req.user.user_id;

    if (!isRider && !isDriver) {
      return res.status(403).json({ message: 'Not your ride' });
    }
    if (!['accepted', 'otp_pending', 'in_progress'].includes(ride.status)) {
      return res.status(400).json({ message: 'Ride cannot be cancelled' });
    }

    const cancelled_by   = isRider ? 'rider' : 'driver';
    const penalty_amount = ride.status === 'in_progress' ? CANCELLATION_PENALTY : 0;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        `UPDATE rides SET status = 'cancelled', end_time = NOW() WHERE ride_id = ?`,
        [ride_id]
      );

      await conn.execute(
        `INSERT INTO cancellations (ride_id, cancelled_by, reason, penalty_amount)
         VALUES (?, ?, ?, ?)`,
        [ride_id, cancelled_by, reason || 'No reason provided', penalty_amount]
      );

      // Free up the driver
      await conn.execute(
        `UPDATE driver_profiles SET is_available = TRUE WHERE driver_id = ?`,
        [ride.driver_id]
      );

      await conn.commit();

      res.json({ message: 'Ride cancelled', cancelled_by, penalty_amount });

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

  } catch (err) {
    console.error('cancelRide error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET RIDE DETAILS ──────────────────────────────────────────────────────────
const getRide = async (req, res) => {
  try {
    const ride = await RideModel.getRideById(req.params.ride_id);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    res.json({ ride });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── RATE RIDE ─────────────────────────────────────────────────────────────────
const rateRide = async (req, res) => {
  const { ride_id }          = req.params;
  const { rating, feedback } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ message: 'Rating must be between 1 and 5' });
  }

  try {
    const ride = await RideModel.getRideById(ride_id);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (ride.status !== 'completed') {
      return res.status(400).json({ message: 'Can only rate completed rides' });
    }

    const isRider = ride.rider_id === req.user.user_id;

    if (isRider) {
      await db.execute(
        `UPDATE rides SET rider_rating = ?, rider_feedback = ? WHERE ride_id = ?`,
        [rating, feedback || null, ride_id]
      );
    } else {
      await db.execute(
        `UPDATE rides SET driver_rating = ?, driver_feedback = ? WHERE ride_id = ?`,
        [rating, feedback || null, ride_id]
      );
    }

    res.json({ message: 'Rating submitted. Thank you!' });

  } catch (err) {
    console.error('rateRide error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── CANCEL PENDING REQUEST (before any driver has accepted) ─────────────────
const cancelPendingRequest = async (req, res) => {
  const { request_id } = req.params;
  try {
    const [rows] = await db.execute(
      `SELECT request_id, rider_id, status FROM ride_requests WHERE request_id = ?`,
      [request_id]
    );
    if (rows.length === 0) return res.status(404).json({ message: 'Request not found' });
    const rq = rows[0];
    if (rq.rider_id !== req.user.user_id) {
      return res.status(403).json({ message: 'Not your request' });
    }
    if (rq.status !== 'pending') {
      return res.status(400).json({ message: 'Request is no longer pending and cannot be cancelled' });
    }
    await db.execute(
      `UPDATE ride_requests SET status = 'cancelled' WHERE request_id = ?`,
      [request_id]
    );
    res.json({ message: 'Ride request cancelled successfully' });
  } catch (err) {
    console.error('cancelPendingRequest error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET UNRATED COMPLETED RIDE (rider) ───────────────────────────────────────────
// Returns the most recent ride that the rider completed but hasn't rated yet.
// The client polls this to know when to show the post-ride rating overlay.
const getUnratedRide = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT r.ride_id, r.status, r.end_time,
              rq.pickup_address, rq.drop_address,
              p.total_amount,
              u.full_name  AS driver_name,
              dp.avg_rating AS driver_avg_rating,
              v.make, v.model, v.color
       FROM rides r
       JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
       JOIN ride_requests    rq ON rq.request_id    = ra.request_id
       JOIN users u             ON u.user_id         = ra.driver_id
       JOIN driver_profiles dp  ON dp.driver_id      = ra.driver_id
       JOIN vehicles v          ON v.driver_id        = ra.driver_id
       LEFT JOIN payments p     ON p.ride_id          = r.ride_id
       WHERE rq.rider_id = ?
         AND r.status = 'completed'
         AND r.rider_rating IS NULL
       ORDER BY r.end_time DESC
       LIMIT 1`,
      [req.user.user_id]
    );
    if (rows.length === 0) return res.json({ ride: null });
    res.json({ ride: rows[0] });
  } catch (err) {
    console.error('getUnratedRide error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── HISTORY ───────────────────────────────────────────────────────────────────
const getRiderHistory = async (req, res) => {
  try {
    const rides = await RideModel.getRiderHistory(req.user.user_id);
    res.json({ rides });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

const getDriverHistory = async (req, res) => {
  try {
    const rides = await RideModel.getDriverHistory(req.user.user_id);
    res.json({ rides });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET ALL ZONES ─────────────────────────────────────────────────────────────
const getZones = async (req, res) => {
  try {
    const [zones] = await db.execute('SELECT * FROM zones ORDER BY zone_name');
    res.json({ zones });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  requestRide,
  getAvailableRequests,
  acceptRequest,
  getActiveRideRider,
  getActiveRideDriver,
  startRide,
  completeRide,
  cancelRide,
  cancelPendingRequest,
  getUnratedRide,
  getRide,
  rateRide,
  getRiderHistory,
  getDriverHistory,
  getZones
};