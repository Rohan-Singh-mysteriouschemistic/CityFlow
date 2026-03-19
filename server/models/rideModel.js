const db = require('../config/db');

// ── CREATE REQUEST ────────────────────────────────────────────────────────────
const createRequest = async (data) => {
  const [result] = await db.execute(
    `INSERT INTO ride_requests
     (rider_id, pickup_address, pickup_lat, pickup_lng,
      drop_address, drop_lat, drop_lng, zone_id,
      vehicle_type, estimated_fare, estimated_km,
      payment_method, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
             ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))`,
    [
      data.rider_id,
      data.pickup_address, data.pickup_lat,  data.pickup_lng,
      data.drop_address,   data.drop_lat,    data.drop_lng,
      data.zone_id,        data.vehicle_type,
      data.estimated_fare, data.estimated_km,
      data.payment_method || 'cash'
    ]
  );
  return result.insertId;
};

// ── PENDING REQUESTS FOR A DRIVER ─────────────────────────────────────────────
// Returns requests that:
//   1. Are still pending (no assignment row yet)
//   2. Haven't expired
//   3. Match the driver's zone (with fallback to any zone)
//   4. Match the driver's vehicle type
const getPendingRequestsForDriver = async (driver_id) => {
  // Primary: same zone + matching vehicle type
  const [zoneMatch] = await db.execute(
    `SELECT rq.request_id, rq.pickup_address, rq.drop_address,
            rq.estimated_fare, rq.estimated_km, rq.vehicle_type,
            rq.requested_at,
            z.zone_name, z.surge_multiplier AS zone_multiplier,
            z.surge_multiplier_admin,
            u.full_name AS rider_name
     FROM ride_requests rq
     JOIN zones z ON z.zone_id = rq.zone_id
     JOIN users u ON u.user_id = rq.rider_id
     WHERE rq.status     = 'pending'
       AND rq.expires_at > NOW()
       AND rq.zone_id    = (
           SELECT current_zone_id FROM driver_profiles WHERE driver_id = ?
       )
       AND rq.vehicle_type = (
           SELECT vehicle_type FROM vehicles WHERE driver_id = ?
       )
       AND rq.request_id NOT IN (
           SELECT request_id FROM ride_assignments
       )
     ORDER BY rq.requested_at ASC`,
    [driver_id, driver_id]
  );
  return zoneMatch;
};

// ── CREATE ASSIGNMENT ─────────────────────────────────────────────────────────
const createAssignment = async (request_id, driver_id) => {
  const [result] = await db.execute(
    `INSERT INTO ride_assignments (request_id, driver_id, status, response_at)
     VALUES (?, ?, 'accepted', NOW())`,
    [request_id, driver_id]
  );
  return result.insertId;
};

// ── CREATE RIDE ───────────────────────────────────────────────────────────────
const createRide = async (assignment_id) => {
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const [result] = await db.execute(
    `INSERT INTO rides (assignment_id, otp, status) VALUES (?, ?, 'accepted')`,
    [assignment_id, otp]
  );
  return { ride_id: result.insertId, otp };
};

// ── GET RIDE BY ID (full join) ────────────────────────────────────────────────
// NOTE: base_fare and fare_per_km were removed from zones table.
//       Fare computation is now done in rideController using VEHICLE_BASE_FARES.
const getRideById = async (ride_id) => {
  const [rows] = await db.execute(
    `SELECT r.*,
            ra.driver_id, ra.request_id, ra.status AS assignment_status,
            rq.rider_id,  rq.pickup_address,  rq.drop_address,
            rq.pickup_lat, rq.pickup_lng, rq.drop_lat, rq.drop_lng,
            rq.estimated_fare, rq.estimated_km, rq.vehicle_type,
            rq.payment_method,
            u_rider.full_name  AS rider_name,
            u_rider.phone      AS rider_phone,
            u_driver.full_name AS driver_name,
            u_driver.phone     AS driver_phone,
            dp.avg_rating      AS driver_avg_rating,
            v.make, v.model, v.color, v.registration_no,
            v.vehicle_type     AS vehicle_type_actual,
            z.zone_name,
            z.surge_multiplier       AS zone_multiplier,
            z.surge_multiplier_admin AS surge_multiplier_admin
     FROM rides r
     JOIN ride_assignments ra  ON ra.assignment_id = r.assignment_id
     JOIN ride_requests    rq  ON rq.request_id    = ra.request_id
     JOIN users u_rider        ON u_rider.user_id  = rq.rider_id
     JOIN users u_driver       ON u_driver.user_id = ra.driver_id
     JOIN driver_profiles dp   ON dp.driver_id     = ra.driver_id
     JOIN vehicles v           ON v.driver_id      = ra.driver_id
     JOIN zones z              ON z.zone_id        = rq.zone_id
     WHERE r.ride_id = ?`,
    [ride_id]
  );
  return rows[0] || null;
};

// ── RIDER HISTORY ─────────────────────────────────────────────────────────────
const getRiderHistory = async (rider_id) => {
  const [rows] = await db.execute(
    `SELECT r.ride_id, r.status, r.start_time, r.end_time,
            r.rider_rating, r.otp, r.created_at,
            rq.pickup_address, rq.drop_address, rq.estimated_km,
            rq.estimated_fare, rq.vehicle_type,
            p.total_amount, p.payment_method,
            u.full_name  AS driver_name,
            u.phone      AS driver_phone,
            dp.avg_rating AS driver_avg_rating,
            v.vehicle_type, v.make, v.model, v.color, v.registration_no,
            z.zone_name, z.surge_multiplier AS zone_multiplier
     FROM rides r
     JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
     JOIN ride_requests    rq ON rq.request_id    = ra.request_id
     JOIN users u             ON u.user_id         = ra.driver_id
     JOIN driver_profiles dp  ON dp.driver_id      = ra.driver_id
     JOIN vehicles v          ON v.driver_id       = ra.driver_id
     JOIN zones z             ON z.zone_id         = rq.zone_id
     LEFT JOIN payments p     ON p.ride_id         = r.ride_id
     WHERE rq.rider_id = ?
     ORDER BY r.created_at DESC`,
    [rider_id]
  );
  return rows;
};

// ── DRIVER HISTORY ────────────────────────────────────────────────────────────
const getDriverHistory = async (driver_id) => {
  const [rows] = await db.execute(
    `SELECT r.ride_id, r.status, r.start_time, r.end_time,
            r.rider_rating, r.created_at,
            rq.pickup_address, rq.drop_address, rq.estimated_km,
            rq.estimated_fare, rq.vehicle_type,
            p.total_amount, p.payment_method,
            u.full_name AS rider_name,
            u.phone     AS rider_phone
     FROM rides r
     JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
     JOIN ride_requests    rq ON rq.request_id    = ra.request_id
     JOIN users u             ON u.user_id         = rq.rider_id
     LEFT JOIN payments p     ON p.ride_id         = r.ride_id
     WHERE ra.driver_id = ?
     ORDER BY r.created_at DESC`,
    [driver_id]
  );
  return rows;
};

module.exports = {
  createRequest,
  getPendingRequestsForDriver,
  createAssignment,
  createRide,
  getRideById,
  getRiderHistory,
  getDriverHistory
};