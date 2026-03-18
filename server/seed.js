const bcrypt = require('bcryptjs');
const db     = require('./config/db');
require('dotenv').config();

const seed = async () => {
  console.log('🌱 Seeding CityFlow database...');

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // ── USERS ──────────────────────────────────
    const password = await bcrypt.hash('test1234', 12);

    // Riders
    const riders = [
      ['Arjun Sharma',   'arjun@cityflow.in',   '9810001002', password, 'rider'],
      ['Priya Patel',    'priya@cityflow.in',    '9810001003', password, 'rider'],
      ['Sneha Reddy',    'sneha@cityflow.in',    '9810001004', password, 'rider'],
      ['Vikram Singh',   'vikram@cityflow.in',   '9810001005', password, 'rider'],
      ['Ananya Iyer',    'ananya@cityflow.in',   '9810001006', password, 'rider'],
    ];

    const riderIds = [];
    for (const r of riders) {
      const [res] = await conn.execute(
        `INSERT IGNORE INTO users (full_name, email, phone, password_hash, role)
         VALUES (?, ?, ?, ?, ?)`, r
      );
      if (res.insertId) {
        await conn.execute(
          `INSERT IGNORE INTO rider_profiles (rider_id) VALUES (?)`,
          [res.insertId]
        );
        riderIds.push(res.insertId);
      }
    }

    // Drivers
    const drivers = [
      ['Ramesh Kumar',  'ramesh@cityflow.in',  '9911001001', password, 'driver'],
      ['Suresh Yadav',  'suresh@cityflow.in',  '9911001002', password, 'driver'],
      ['Mahesh Tiwari', 'mahesh@cityflow.in',  '9911001003', password, 'driver'],
      ['Ganesh Sharma', 'ganesh@cityflow.in',  '9911001004', password, 'driver'],
      ['Paresh Jain',   'paresh@cityflow.in',  '9911001005', password, 'driver'],
    ];

    const driverData = [
      ['DL0120210001', 4.72, 312, 1],
      ['DL0120210002', 4.45, 198, 2],
      ['DL0120210003', 4.89, 423, 3],
      ['DL0120210004', 4.61, 256, 4],
      ['DL0120210005', 4.78, 389, 5],
    ];

    const vehicleData = [
      ['DL01AB1234', 'sedan', 'Maruti', 'Dzire',  'White',  2021],
      ['DL02CD5678', 'suv',   'Toyota', 'Innova', 'Silver', 2022],
      ['DL03EF9012', 'auto',  'Bajaj',  'RE',     'Yellow', 2020],
      ['DL04GH3456', 'sedan', 'Honda',  'Amaze',  'Black',  2021],
      ['DL05IJ7890', 'xl',    'Toyota', 'Crysta', 'White',  2022],
    ];

    const driverIds = [];
    for (let i = 0; i < drivers.length; i++) {
      const [res] = await conn.execute(
        `INSERT IGNORE INTO users (full_name, email, phone, password_hash, role)
         VALUES (?, ?, ?, ?, ?)`, drivers[i]
      );
      if (res.insertId) {
        const d = driverData[i];
        await conn.execute(
          `INSERT IGNORE INTO driver_profiles 
           (driver_id, license_no, avg_rating, total_rating_count, 
            is_available, is_verified, current_zone_id)
           VALUES (?, ?, ?, ?, TRUE, TRUE, ?)`,
          [res.insertId, d[0], d[1], d[2], d[3]]
        );
        const v = vehicleData[i];
        await conn.execute(
          `INSERT IGNORE INTO vehicles 
           (driver_id, registration_no, vehicle_type, make, model, color, year)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [res.insertId, v[0], v[1], v[2], v[3], v[4], v[5]]
        );
        driverIds.push(res.insertId);
      }
    }

    // Admin
    const [adminRes] = await conn.execute(
      `INSERT IGNORE INTO users (full_name, email, phone, password_hash, role)
       VALUES (?, ?, ?, ?, ?)`,
      ['CityFlow Admin', 'admin@cityflow.in', '9999999999', password, 'admin']
    );

    console.log('✅ Users seeded');

    // ── COMPLETED RIDES ────────────────────────
    const rideData = [
      { rider: 0, driver: 0, zone: 1, pickup: 'Connaught Place',  drop: 'Cyber City',    km: 18.5, method: 'upi'    },
      { rider: 1, driver: 1, zone: 3, pickup: 'Noida Sector 18', drop: 'Saket',          km: 22.0, method: 'card'   },
      { rider: 2, driver: 2, zone: 7, pickup: 'Lajpat Nagar',    drop: 'Hauz Khas',      km: 5.5,  method: 'wallet' },
      { rider: 3, driver: 3, zone: 8, pickup: 'Dwarka Sector 10',drop: 'IGI Airport',    km: 12.0, method: 'cash'   },
      { rider: 4, driver: 4, zone: 1, pickup: 'Karol Bagh',      drop: 'Nehru Place',    km: 14.0, method: 'upi'    },
    ];

    for (const rd of rideData) {
      if (riderIds[rd.rider] && driverIds[rd.driver]) {
        const [zoneRows] = await conn.execute(
          'SELECT * FROM zones WHERE zone_id = ?', [rd.zone]
        );
        const zone = zoneRows[0];
        const dist_fare = rd.km * parseFloat(zone.fare_per_km);
        const total     = parseFloat(
          (parseFloat(zone.base_fare) + dist_fare) * parseFloat(zone.surge_multiplier)
        ).toFixed(2);

        const [reqRes] = await conn.execute(
          `INSERT INTO ride_requests 
           (rider_id, pickup_address, pickup_lat, pickup_lng,
            drop_address, drop_lat, drop_lng, zone_id,
            vehicle_type, estimated_fare, estimated_km,
            status, expires_at)
           VALUES (?, ?, 28.6139, 77.2090, ?, 28.5355, 77.3910,
                   ?, 'sedan', ?, ?, 'matched',
                   DATE_ADD(NOW(), INTERVAL 5 MINUTE))`,
          [riderIds[rd.rider], rd.pickup, rd.drop, rd.zone, total, rd.km]
        );

        const [assignRes] = await conn.execute(
          `INSERT INTO ride_assignments (request_id, driver_id, status, response_at)
           VALUES (?, ?, 'accepted', NOW())`,
          [reqRes.insertId, driverIds[rd.driver]]
        );

        const [rideRes] = await conn.execute(
          `INSERT INTO rides 
           (assignment_id, otp, start_time, end_time, 
            actual_km, status, rider_rating)
           VALUES (?, '1234', 
                   DATE_SUB(NOW(), INTERVAL 2 HOUR),
                   DATE_SUB(NOW(), INTERVAL 1 HOUR),
                   ?, 'completed', ?)`,
          [assignRes.insertId, rd.km, Math.floor(Math.random() * 2) + 4]
        );

        await conn.execute(
          `INSERT INTO payments
           (ride_id, rider_id, base_fare, fare_per_km, distance_fare,
            surge_multiplier, surge_amount, total_amount,
            payment_method, payment_status, paid_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'completed', NOW())`,
          [rideRes.insertId, riderIds[rd.rider],
           zone.base_fare, zone.fare_per_km, dist_fare.toFixed(2),
           zone.surge_multiplier, total, rd.method]
        );
      }
    }

    console.log('✅ Rides and payments seeded');
    // After all rides and payments are inserted, fix stats
    await conn.execute(`
    UPDATE rider_profiles rp
    SET
        total_rides = (
        SELECT COUNT(*) FROM rides r
        JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
        JOIN ride_requests rq ON rq.request_id = ra.request_id
        WHERE rq.rider_id = rp.rider_id AND r.status = 'completed'
        ),
        total_spent = (
        SELECT COALESCE(SUM(p.total_amount), 0)
        FROM payments p
        JOIN rides r ON r.ride_id = p.ride_id
        JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
        JOIN ride_requests rq ON rq.request_id = ra.request_id
        WHERE rq.rider_id = rp.rider_id AND p.payment_status = 'completed'
        )
    `);

    await conn.execute(`
    UPDATE driver_profiles dp
    SET
        total_rides = (
        SELECT COUNT(*) FROM rides r
        JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
        WHERE ra.driver_id = dp.driver_id AND r.status = 'completed'
        ),
        total_earned = (
        SELECT COALESCE(SUM(p.total_amount), 0)
        FROM payments p
        JOIN rides r ON r.ride_id = p.ride_id
        JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
        WHERE ra.driver_id = dp.driver_id AND p.payment_status = 'completed'
        ),
        avg_rating = (
        SELECT COALESCE(ROUND(AVG(r.rider_rating), 2), 0)
        FROM rides r
        JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
        WHERE ra.driver_id = dp.driver_id AND r.rider_rating IS NOT NULL
        ),
        total_rating_count = (
        SELECT COUNT(*) FROM rides r
        JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
        WHERE ra.driver_id = dp.driver_id AND r.rider_rating IS NOT NULL
        )
    `);

    console.log('✅ Stats recalculated');
    await conn.commit();
    console.log('🎉 Database seeded successfully!');
    console.log('');
    console.log('Test accounts (password: test1234)');
    console.log('  Rider:  rohan@cityflow.in');
    console.log('  Rider:  arjun@cityflow.in');
    console.log('  Driver: ramesh@cityflow.in');
    console.log('  Admin:  admin@cityflow.in');

  } catch (err) {
    await conn.rollback();
    console.error('❌ Seed error:', err.message);
  } finally {
    conn.release();
    process.exit(0);
  }
};

seed();