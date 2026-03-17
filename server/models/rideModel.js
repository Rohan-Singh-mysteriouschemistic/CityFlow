const db = require('../config/db');

const createRequest = async (data) => {
  const [result] = await db.execute(
    `INSERT INTO ride_requests 
     (rider_id, pickup_address, pickup_lat, pickup_lng, 
      drop_address, drop_lat, drop_lng, zone_id, 
      vehicle_type, estimated_fare, estimated_km, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 5 MINUTE))`,
    [
      data.rider_id, data.pickup_address, data.pickup_lat, data.pickup_lng,
      data.drop_address, data.drop_lat, data.drop_lng, data.zone_id,
      data.vehicle_type, data.estimated_fare, data.estimated_km
    ]
  );
  return result.insertId;
};

const findAvailableDriver = async (zone_id, vehicle_type) => {
  const [rows] = await db.execute(
    `SELECT dp.driver_id, u.full_name, u.phone, dp.avg_rating,
            v.vehicle_type, v.make, v.model, v.color, v.registration_no
     FROM driver_profiles dp
     JOIN users u ON u.user_id = dp.driver_id
     JOIN vehicles v ON v.driver_id = dp.driver_id
     WHERE dp.is_available = TRUE
       AND dp.is_verified  = TRUE
       AND v.vehicle_type  = ?
       AND dp.current_zone_id = ?
     ORDER BY dp.avg_rating DESC
     LIMIT 1`,
    [vehicle_type, zone_id]
  );
  return rows[0] || null;
};

const createAssignment = async (request_id, driver_id) => {
  const [result] = await db.execute(
    `INSERT INTO ride_assignments (request_id, driver_id) VALUES (?, ?)`,
    [request_id, driver_id]
  );
  return result.insertId;
};

const createRide = async (assignment_id) => {
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const [result] = await db.execute(
    `INSERT INTO rides (assignment_id, otp) VALUES (?, ?)`,
    [assignment_id, otp]
  );
  return { ride_id: result.insertId, otp };
};

const getRideById = async (ride_id) => {
  const [rows] = await db.execute(
    `SELECT r.*, 
            ra.driver_id, ra.request_id,
            rq.rider_id, rq.pickup_address, rq.drop_address,
            rq.pickup_lat, rq.pickup_lng, rq.drop_lat, rq.drop_lng,
            rq.estimated_fare, rq.estimated_km, rq.vehicle_type,
            u_rider.full_name  AS rider_name,  u_rider.phone  AS rider_phone,
            u_driver.full_name AS driver_name, u_driver.phone AS driver_phone,
            dp.avg_rating AS driver_rating,
            v.make, v.model, v.color, v.registration_no,
            z.zone_name, z.surge_multiplier
     FROM rides r
     JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
     JOIN ride_requests    rq ON rq.request_id    = ra.request_id
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

const updateRideStatus = async (ride_id, status) => {
  await db.execute(
    `UPDATE rides SET status = ? WHERE ride_id = ?`,
    [status, ride_id]
  );
};

const getRiderHistory = async (rider_id) => {
  const [rows] = await db.execute(
    `SELECT r.ride_id, r.status, r.start_time, r.end_time,
            r.rider_rating, rq.pickup_address, rq.drop_address,
            rq.estimated_km, p.total_amount, p.payment_method,
            u.full_name AS driver_name, v.vehicle_type,
            v.make, v.model, v.registration_no
     FROM rides r
     JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
     JOIN ride_requests    rq ON rq.request_id    = ra.request_id
     JOIN users u             ON u.user_id         = ra.driver_id
     JOIN vehicles v          ON v.driver_id       = ra.driver_id
     LEFT JOIN payments p     ON p.ride_id         = r.ride_id
     WHERE rq.rider_id = ?
     ORDER BY r.created_at DESC`,
    [rider_id]
  );
  return rows;
};

const getDriverHistory = async (driver_id) => {
  const [rows] = await db.execute(
    `SELECT r.ride_id, r.status, r.start_time, r.end_time,
            r.rider_rating, rq.pickup_address, rq.drop_address,
            rq.estimated_km, p.total_amount, p.payment_method,
            u.full_name AS rider_name
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
  createRequest, findAvailableDriver, createAssignment,
  createRide, getRideById, updateRideStatus,
  getRiderHistory, getDriverHistory
};