const db        = require('../config/db');
const RideModel = require('../models/rideModel');
const logger    = require('../config/logger');
const { RIDE_STATUS, CANCELLATION_PENALTY, VEHICLE_BASE_FARES, PER_KM_RATE } = require('../config/constants');
const { getIO } = require('../config/socket');

// ── Haversine helper (server-side) ───────────────────────────────────────────
// Returns distance in km between two lat/lng pairs.
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R   = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) ** 2
          + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
          * Math.sin(dLng/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// ── Route Corridor Matching for Advanced Pooling ─────────────────────────────
// Validates if the new incoming route lies ALONG the active route corridor linearly.
const isValidPoolRoute = (activeRide, incomingReq) => {
  const parseStops = (s) => (s ? (typeof s === 'string' ? JSON.parse(s) : s) : []);
  
  const activeStops   = parseStops(activeRide.stops);
  const incomingStops = parseStops(incomingReq.stops);

  const activePoints = [
    { lat: parseFloat(activeRide.pickup_lat), lng: parseFloat(activeRide.pickup_lng) },
    ...activeStops.map(s => ({ lat: parseFloat(s.lat), lng: parseFloat(s.lng) })),
    { lat: parseFloat(activeRide.drop_lat),   lng: parseFloat(activeRide.drop_lng) }
  ];

  const incomingPoints = [
    { lat: parseFloat(incomingReq.pickup_lat), lng: parseFloat(incomingReq.pickup_lng) },
    ...incomingStops.map(s => ({ lat: parseFloat(s.lat), lng: parseFloat(s.lng) })),
    { lat: parseFloat(incomingReq.drop_lat),   lng: parseFloat(incomingReq.drop_lng) }
  ];

  const MAX_DEVIATION_KM = 2.0;
  let lastMatchedSegmentIndex = 0;

  // For every point in the incoming ride, it must fall near a segment of the active ride.
  // The matched segments must strictly increase or stay the same (ensures directionality).
  for (const pt of incomingPoints) {
    let matched = false;
    for (let i = lastMatchedSegmentIndex; i < activePoints.length - 1; i++) {
      const A = activePoints[i];
      const B = activePoints[i+1];
      
      const distAP = haversineKm(A.lat, A.lng, pt.lat, pt.lng);
      const distPB = haversineKm(pt.lat, pt.lng, B.lat, B.lng);
      const distAB = haversineKm(A.lat, A.lng, B.lat, B.lng);
      
      // Elliptical boundary constraint stringently locks the route corridor
      if (distAP + distPB - distAB <= MAX_DEVIATION_KM) {
        matched = true;
        
        // Ensure same direction constraint inside same segment. 
        // If pt is pickup and drop is on the same segment, drop must be closer to B than A was.
        // For simplicity, we just mandate segment indices must not go backwards.
        lastMatchedSegmentIndex = i;
        break;
      }
    }
    if (!matched) return false;
  }
  return true;
};

// ── REQUEST A RIDE ────────────────────────────────────────────────────────────
// NEW FLOW: Creates a pending request only. Does NOT auto-assign a driver.
// Drivers poll /rides/available and accept themselves (first-accept-wins).
// Zone is auto-detected via Haversine — rider no longer selects it manually.
const requestRide = async (req, res, next) => {
  const {
    pickup_address, pickup_lat, pickup_lng,
    drop_address,   drop_lat,   drop_lng,
    vehicle_type, estimated_km, payment_method, stops, is_pool
  } = req.body;

  const validPayments = ['cash','card','wallet','upi'];
  if (!pickup_address || !drop_address || !vehicle_type || !estimated_km) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  if (!pickup_lat || !pickup_lng) {
    return res.status(400).json({ message: 'Pickup coordinates are required. Please use the location search.' });
  }
  if (!payment_method || !validPayments.includes(payment_method)) {
    return res.status(400).json({ message: 'Please select a valid payment method (cash, card, wallet, or upi)' });
  }

  try {
    // Prevent a rider from having more than one active/pending request at a time
    const [existing] = await db.execute(
      `SELECT rq.request_id FROM ride_requests rq
       LEFT JOIN ride_assignments ra ON ra.request_id = rq.request_id
       LEFT JOIN rides r ON r.assignment_id = ra.assignment_id
       WHERE rq.rider_id = ?
         AND (
           (rq.status = 'pending' AND rq.expires_at > NOW())
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

    // ── GEOFENCING: Auto-detect zone from pickup coordinates ──────────────
    const ZONE_RADIUS_KM = 1.0; // Apply surge if pickup is within 1km of zone center
    const [allZones] = await db.execute('SELECT * FROM zones');

    let matchedZone    = null;
    let closestDistKm  = Infinity;

    for (const z of allZones) {
      const dist = haversineKm(
        parseFloat(pickup_lat),  parseFloat(pickup_lng),
        parseFloat(z.center_lat), parseFloat(z.center_lng)
      );
      if (dist <= ZONE_RADIUS_KM && dist < closestDistKm) {
        closestDistKm = dist;
        matchedZone   = z;
      }
    }

    // Apply surge from matched zone, or default to 1.0
    const zoneMulti  = matchedZone ? parseFloat(matchedZone.surge_multiplier      || 1) : 1.0;
    const surgeAdmin = matchedZone ? parseFloat(matchedZone.surge_multiplier_admin || 1) : 1.0;
    const zone_id    = matchedZone ? matchedZone.zone_id : null;
    const zone_name  = matchedZone ? matchedZone.zone_name : null;

    const base          = VEHICLE_BASE_FARES[vehicle_type] || VEHICLE_BASE_FARES['sedan'];
    const perKm         = PER_KM_RATE;
    const distance_fare = parseFloat(estimated_km) * perKm;
    const combined_mult = zoneMulti * surgeAdmin;
    let estimated_fare = parseFloat(((base + distance_fare) * combined_mult).toFixed(2));
    if (is_pool) {
      estimated_fare = parseFloat((estimated_fare * 0.8).toFixed(2)); // 20% pooling discount
    }

    // Create the request in 'pending' status — no driver assigned yet
    const request_id = await RideModel.createRequest({
      rider_id: req.user.user_id,
      pickup_address, pickup_lat, pickup_lng,
      drop_address,   drop_lat,   drop_lng,
      zone_id, vehicle_type, estimated_fare, estimated_km, payment_method, stops, is_pool
    });

    try {
      const io = getIO();
      if (zone_id) {
        // Broadcast to drivers in this zone
        io.to(`zone_${zone_id}`).emit('new_ride_request', {
          request_id,
          pickup_address,
          drop_address,
          estimated_fare,
          vehicle_type,
          stops,
          is_pool
        });
      }
    } catch (wsErr) {
      logger.error('Socket emission failed on requestRide', { message: wsErr.message });
    }

    res.status(201).json({
      message:         'Ride requested! Waiting for a driver to accept.',
      request_id,
      estimated_fare,
      zone_detected:   zone_name,             // inform rider which zone was detected
      surge_applied:   combined_mult > 1.0,
      surge_multiplier: combined_mult,
      driver_found:    false
    });

  } catch (err) {
    logger.error('requestRide error', { message: err.message, stack: err.stack });
    next(err);
  }
};


// ── GET AVAILABLE REQUESTS (for driver) ──────────────────────────────────────
// Returns pending requests in the driver's zone that match their vehicle type.
// No assignment row exists yet for these requests.
const getAvailableRequests = async (req, res, next) => {
  try {
    // Only online drivers can see ride requests
    const [driverRows] = await db.execute(
      `SELECT is_available FROM driver_profiles WHERE driver_id = ?`,
      [req.user.user_id]
    );
    if (!driverRows.length || !driverRows[0].is_available) {
      return res.json({ requests: [] });
    }

    let requests = await RideModel.getPendingRequestsForDriver(req.user.user_id);

    // Route-Based Pooling Match: Filter by active rides
    const [activeRides] = await db.execute(
      `SELECT r.ride_id, rq.is_pool, rq.pickup_lat, rq.pickup_lng, rq.drop_lat, rq.drop_lng, rq.stops
       FROM ride_assignments ra
       JOIN rides r ON r.assignment_id = ra.assignment_id
       JOIN ride_requests rq ON rq.request_id = ra.request_id
       WHERE ra.driver_id = ?
         AND r.status IN ('accepted', 'otp_pending', 'in_progress')`,
      [req.user.user_id]
    );

    if (activeRides.length > 0) {
      const isStandardRide = activeRides.some(r => Number(r.is_pool) !== 1);
      if (isStandardRide) {
        // Driver on a non-pool ride: lock out all new requests
        requests = [];
      } else {
        // Driver is on a Pool ride: lock new requests rigorously to the corridor
        requests = requests.filter(reqItem => {
          if (Number(reqItem.is_pool) !== 1) return false;
          
          return activeRides.some(active => isValidPoolRoute(active, reqItem));
        });
      }
    }

    res.json({ requests });
  } catch (err) {
    logger.error('getAvailableRequests error', { message: err.message });
    next(err);
  }
};

// ── ACCEPT A REQUEST (first-accept-wins) ─────────────────────────────────────
// Uses a DB transaction with INSERT IGNORE on ride_assignments (UNIQUE request_id)
// so only ONE driver can ever create the assignment row.
// Any concurrent accept for the same request_id gets a 409.
const acceptRequest = async (req, res, next) => {
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

    // 1. Check active rides and pool limits
    const [activeRides] = await conn.execute(
      `SELECT r.ride_id, rq.is_pool FROM ride_assignments ra
       JOIN rides r ON r.assignment_id = ra.assignment_id
       JOIN ride_requests rq ON rq.request_id = ra.request_id
       WHERE ra.driver_id = ?
         AND r.status IN ('accepted', 'otp_pending', 'in_progress')`,
      [driver_id]
    );

    const [incomingReq] = await conn.execute(
       `SELECT is_pool FROM ride_requests WHERE request_id = ?`,
       [request_id]
    );
    const isIncomingPool = incomingReq[0]?.is_pool === 1;

    if (activeRides.length > 0) {
      const isMix = activeRides.some(r => r.is_pool !== 1);
      if (!isIncomingPool || isMix) {
        await conn.rollback();
        return res.status(400).json({
          message: 'Complete your current ride before accepting a new regular ride.'
        });
      }
      if (activeRides.length >= 4) {
        await conn.rollback();
        return res.status(400).json({
          message: 'Your carpool is full (max 4 passengers).'
        });
      }
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

    // 7. Mark driver unavailable ONLY if it's not a pool OR if the pool is now full
    if (!isIncomingPool || activeRides.length >= 3) {
      await conn.execute(
        `UPDATE driver_profiles SET is_available = FALSE WHERE driver_id = ?`,
        [driver_id]
      );
    }

    await conn.commit();

    // 8. Emit socket event instantly to the rider
    try {
      const io = getIO();
      io.to(`user_${requests[0].rider_id}`).emit('ride_accepted', {
         message: 'A driver is on the way!',
         ride_id,
         driver_id,
         request_id
      });
    } catch(wsErr) {
      logger.error('Socket emission failed on acceptRequest', { message: wsErr.message });
    }

    // Do not return OTP, the driver must get it from the rider verbally.
    res.status(201).json({
      message:  'Ride accepted!',
      ride_id,
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
    logger.error('acceptRequest error', { message: err.message, stack: err.stack });
    next(err);
  } finally {
    conn.release();
  }
};

// ── GET ACTIVE RIDE (rider) ───────────────────────────────────────────────────
// Always returns the OTP from DB — this is the fix for OTP being lost on refresh.
const getActiveRideRider = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT r.ride_id, r.status, r.otp, r.start_time,
              rq.pickup_address, rq.pickup_lat, rq.pickup_lng,
              rq.drop_address, rq.drop_lat, rq.drop_lng,
              rq.estimated_fare, rq.estimated_km,
              z.zone_name, z.surge_multiplier,
              u.full_name   AS driver_name,
              u.phone       AS driver_phone,
              dp.avg_rating AS driver_avg_rating,
              v.make, v.model, v.color, v.registration_no
       FROM rides r
       JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
       JOIN ride_requests    rq ON rq.request_id    = ra.request_id
       LEFT JOIN zones z             ON z.zone_id        = rq.zone_id
       LEFT JOIN users u             ON u.user_id         = ra.driver_id
       LEFT JOIN driver_profiles dp  ON dp.driver_id      = ra.driver_id
       LEFT JOIN vehicles v          ON v.driver_id        = ra.driver_id
       WHERE rq.rider_id = ?
         AND r.status IN ('accepted', 'otp_pending', 'in_progress')
       ORDER BY r.created_at DESC
       LIMIT 1`,
      [req.user.user_id]
    );

    if (rows.length === 0) {
      // Also check if they have a pending (unmatched) request
      const [pending] = await db.execute(
        `SELECT rq.request_id, rq.pickup_address, rq.pickup_lat, rq.pickup_lng,
                rq.drop_address, rq.drop_lat, rq.drop_lng,
                rq.estimated_fare, rq.estimated_km, rq.vehicle_type, rq.status,
                z.zone_name
         FROM ride_requests rq
         LEFT JOIN zones z ON z.zone_id = rq.zone_id
         WHERE rq.rider_id = ? AND rq.status = 'pending' AND rq.expires_at > NOW()
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

    if (rows.length > 0) {
      const row = rows[0];
      if (!row.driver_name || !row.registration_no) {
        console.log('WARNING: Ride found but missing some joined data:', row);
      }
    }

    res.json({ ride: rows[0] });
  } catch (err) {
    console.error('CRASH inside getActiveRideRider:', err);
    logger.error('getActiveRideRider error', { message: err.message });
    next(err);
  }
};

// ── GET ACTIVE RIDE (driver) ──────────────────────────────────────────────────
// OTP is intentionally excluded — the rider shares it verbally with the driver.
const getActiveRideDriver = async (req, res, next) => {
  try {
    const [rows] = await db.execute(
      `SELECT r.ride_id, r.status, r.start_time,
              rq.pickup_address, rq.pickup_lat, rq.pickup_lng,
              rq.drop_address, rq.drop_lat, rq.drop_lng,
              rq.estimated_fare, rq.estimated_km, rq.stops, rq.is_pool,
              rq.payment_method AS ride_payment_method,
              u.full_name AS rider_name,
              u.phone     AS rider_phone,
              p.payment_status,
              p.total_amount
       FROM rides r
       JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
       JOIN ride_requests    rq ON rq.request_id    = ra.request_id
       JOIN users u             ON u.user_id         = rq.rider_id
       LEFT JOIN payments p     ON p.ride_id         = r.ride_id
       WHERE ra.driver_id = ?
         AND (
           r.status IN ('accepted', 'otp_pending', 'in_progress')
           OR (r.status = 'completed' AND p.payment_status = 'pending')
         )
       ORDER BY r.created_at ASC`
      // removed LIMIT 1 so all active pool rides return
      ,
      [req.user.user_id]
    );

    res.json({ rides: rows });
  } catch (err) {
    logger.error('getActiveRideDriver error', { message: err.message });
    next(err);
  }
};

// ── START RIDE (verify OTP) ───────────────────────────────────────────────────
const startRide = async (req, res, next) => {
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
    logger.error('startRide error', { message: err.message });
    next(err);
  }
};

// ── COMPLETE RIDE ─────────────────────────────────────────────────────────────
const completeRide = async (req, res, next) => {
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
          payment_method, payment_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          ride_id, ride.rider_id,
          base, perKm, distance_fare,
          combined_mult, surge_amount, total_amount,
          ride.payment_method || 'cash'
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

      try {
        const io = getIO();
        io.to(`user_${ride.rider_id}`).emit('ride_completed', {
          message: 'You have arrived!',
          ride_id,
          total_amount
        });
      } catch(wsErr) {}

      res.json({
        message:        'Ride completed',
        ride_id,
        total_amount,
        payment_method: ride.payment_method || 'cash'
      });

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

  } catch (err) {
    logger.error('completeRide error', { message: err.message, stack: err.stack });
    next(err);
  }
};

// ── CANCEL RIDE ───────────────────────────────────────────────────────────────
const cancelRide = async (req, res, next) => {
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
    logger.error('cancelRide error', { message: err.message, stack: err.stack });
    next(err);
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
const rateRide = async (req, res, next) => {
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
    logger.error('rateRide error', { message: err.message });
    next(err);
  }
};

// ── CANCEL PENDING REQUEST (before any driver has accepted) ─────────────────
const cancelPendingRequest = async (req, res, next) => {
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
    logger.error('cancelPendingRequest error', { message: err.message });
    next(err);
  }
};

// ── GET UNRATED COMPLETED RIDE (rider) ───────────────────────────────────────────
// Returns the most recent ride that the rider completed but hasn't rated yet.
// The client polls this to know when to show the post-ride rating overlay.
const getUnratedRide = async (req, res, next) => {
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
    logger.error('getUnratedRide error', { message: err.message });
    next(err);
  }
};

// ── HISTORY ───────────────────────────────────────────────────────────────────
const getRiderHistory = async (req, res, next) => {
  try {
    const rides = await RideModel.getRiderHistory(req.user.user_id);
    res.json({ rides });
  } catch (err) {
    logger.error('getRiderHistory error', { message: err.message });
    next(err);
  }
};

const getDriverHistory = async (req, res, next) => {
  try {
    const rides = await RideModel.getDriverHistory(req.user.user_id);
    res.json({ rides });
  } catch (err) {
    logger.error('getDriverHistory error', { message: err.message });
    next(err);
  }
};

// ── GET ALL ZONES ─────────────────────────────────────────────────────────────
const getZones = async (req, res, next) => {
  try {
    const [zones] = await db.execute('SELECT * FROM zones ORDER BY zone_name');
    res.json({ zones });
  } catch (err) {
    logger.error('getZones error', { message: err.message });
    next(err);
  }
};

// ── CONFIRM PAYMENT (driver) ──────────────────────────────────────────────────
const confirmPayment = async (req, res, next) => {
  const { ride_id } = req.params;

  try {
    const ride = await RideModel.getRideById(ride_id);
    if (!ride) return res.status(404).json({ message: 'Ride not found' });
    if (ride.driver_id !== req.user.user_id) {
      return res.status(403).json({ message: 'Not your ride' });
    }
    if (ride.status !== 'completed') {
      return res.status(400).json({ message: 'Ride is not completed yet' });
    }

    await db.execute(
      `UPDATE payments SET payment_status = 'completed', paid_at = NOW() WHERE ride_id = ?`,
      [ride_id]
    );

    res.json({ message: 'Payment confirmed', ride_id });
  } catch (err) {
    logger.error('confirmPayment error', { message: err.message });
    next(err);
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
  getZones,
  confirmPayment
};