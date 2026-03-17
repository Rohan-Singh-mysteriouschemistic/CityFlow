const db        = require('../config/db');
const RideModel = require('../models/rideModel');
const { RIDE_STATUS, CANCELLATION_PENALTY } = require('../config/constants');

// ── REQUEST A RIDE ────────────────────────────
const requestRide = async (req, res) => {
  const { pickup_address, pickup_lat, pickup_lng,
          drop_address, drop_lat, drop_lng,
          zone_id, vehicle_type, estimated_km } = req.body;

  if (!pickup_address || !drop_address || !zone_id || !vehicle_type || !estimated_km) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    const [zones] = await db.execute(
      'SELECT * FROM zones WHERE zone_id = ?', [zone_id]
    );
    if (zones.length === 0) {
      return res.status(404).json({ message: 'Zone not found' });
    }

    const zone = zones[0];
    const distance_fare  = parseFloat(estimated_km) * parseFloat(zone.fare_per_km);
    const estimated_fare = parseFloat(
      (parseFloat(zone.base_fare) + distance_fare) * parseFloat(zone.surge_multiplier)
    ).toFixed(2);

    const request_id = await RideModel.createRequest({
      rider_id: req.user.user_id,
      pickup_address, pickup_lat, pickup_lng,
      drop_address, drop_lat, drop_lng,
      zone_id, vehicle_type, estimated_fare, estimated_km
    });

    // Find available driver
    const driver = await RideModel.findAvailableDriver(zone_id, vehicle_type);

    if (!driver) {
      return res.status(200).json({
        message:    'Request created. No drivers available right now.',
        request_id, estimated_fare,
        driver_found: false
      });
    }

    // Assign driver
    const assignment_id = await RideModel.createAssignment(request_id, driver.driver_id);

    // Create ride with OTP
    const { ride_id, otp } = await RideModel.createRide(assignment_id);

    // Mark request matched
    await db.execute(
      `UPDATE ride_requests SET status = 'matched' WHERE request_id = ?`,
      [request_id]
    );

    // Mark driver unavailable
    await db.execute(
      `UPDATE driver_profiles SET is_available = FALSE WHERE driver_id = ?`,
      [driver.driver_id]
    );

    res.status(201).json({
      message: 'Driver found! Ride created.',
      ride_id, otp, estimated_fare,
      driver: {
        name:            driver.full_name,
        phone:           driver.phone,
        rating:          driver.avg_rating,
        vehicle_type:    driver.vehicle_type,
        make:            driver.make,
        model:           driver.model,
        color:           driver.color,
        registration_no: driver.registration_no,
      }
    });

  } catch (err) {
    console.error('requestRide error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── START RIDE (verify OTP) ───────────────────
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

// ── COMPLETE RIDE ─────────────────────────────
const completeRide = async (req, res) => {
  const { ride_id }                = req.params;
  const { actual_km, payment_method } = req.body;

  try {
    const ride = await RideModel.getRideById(ride_id);

    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (ride.driver_id !== req.user.user_id) {
      return res.status(403).json({ message: 'Not your ride' });
    }
    if (ride.status !== 'in_progress') {
      return res.status(400).json({ message: 'Ride is not in progress' });
    }

    const distance_fare  = parseFloat(actual_km) * parseFloat(ride.fare_per_km || 12);
    const surge_amount   = (parseFloat(ride.base_fare || ride.estimated_fare) * 
                           (parseFloat(ride.surge_multiplier) - 1)).toFixed(2);
    const total_amount   = parseFloat(
      (parseFloat(ride.estimated_fare) * parseFloat(ride.surge_multiplier || 1))
    ).toFixed(2);

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute(
        `UPDATE rides SET status = 'completed', end_time = NOW(), actual_km = ? WHERE ride_id = ?`,
        [actual_km, ride_id]
      );

      await conn.execute(
        `INSERT INTO payments 
         (ride_id, rider_id, base_fare, fare_per_km, distance_fare,
          surge_multiplier, surge_amount, total_amount, payment_method, payment_status, paid_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', NOW())`,
        [ride_id, ride.rider_id, ride.estimated_fare, 12,
         distance_fare, ride.surge_multiplier || 1,
         surge_amount, total_amount, payment_method || 'cash']
      );

      await conn.commit();

      res.json({
        message: 'Ride completed',
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

// ── CANCEL RIDE ───────────────────────────────
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

// ── GET RIDE DETAILS ──────────────────────────
const getRide = async (req, res) => {
  try {
    const ride = await RideModel.getRideById(req.params.ride_id);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    res.json({ ride });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── RATE RIDE ─────────────────────────────────
const rateRide = async (req, res) => {
  const { ride_id }         = req.params;
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

// ── HISTORY ───────────────────────────────────
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

// ── GET ALL ZONES ─────────────────────────────
const getZones = async (req, res) => {
  try {
    const [zones] = await db.execute('SELECT * FROM zones ORDER BY zone_name');
    res.json({ zones });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  requestRide, startRide, completeRide,
  cancelRide, getRide, rateRide,
  getRiderHistory, getDriverHistory, getZones
};