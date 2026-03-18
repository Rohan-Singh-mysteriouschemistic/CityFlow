-- ============================================================
-- CityFlow Delhi — Complete SQL Reference
-- All queries, schema, seeds, triggers
-- ============================================================

-- ─────────────────────────────────────────────
-- SECTION 1: DATABASE & TABLE CREATION
-- ─────────────────────────────────────────────

CREATE DATABASE cityflow_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE cityflow_db;

-- Users (unified auth)
CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    full_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    phone         VARCHAR(15)  NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          ENUM('rider','driver','admin') NOT NULL,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_email CHECK (email LIKE '%@%.%')
);

-- Rider profiles
CREATE TABLE rider_profiles (
    rider_id          INT PRIMARY KEY,
    total_rides       INT DEFAULT 0,
    total_spent       DECIMAL(10,2) DEFAULT 0.00,
    preferred_payment ENUM('cash','card','wallet','upi') DEFAULT 'upi',
    rating            DECIMAL(3,2) DEFAULT 5.00,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (rider_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Driver profiles
CREATE TABLE driver_profiles (
    driver_id          INT PRIMARY KEY,
    license_no         VARCHAR(50)  NOT NULL UNIQUE,
    avg_rating         DECIMAL(3,2) DEFAULT 0.00,
    total_rating_count INT          DEFAULT 0,
    total_rides        INT          DEFAULT 0,
    total_earned       DECIMAL(10,2) DEFAULT 0.00,
    is_available       BOOLEAN DEFAULT FALSE,
    is_verified        BOOLEAN DEFAULT FALSE,
    current_zone_id    INT NULL,
    last_location_lat  DECIMAL(10,8) NULL,
    last_location_lng  DECIMAL(11,8) NULL,
    last_seen          DATETIME NULL,
    created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_rating CHECK (avg_rating >= 0 AND avg_rating <= 5)
);

-- Vehicles
CREATE TABLE vehicles (
    vehicle_id      INT AUTO_INCREMENT PRIMARY KEY,
    driver_id       INT NOT NULL UNIQUE,
    registration_no VARCHAR(20) NOT NULL UNIQUE,
    vehicle_type    ENUM('auto','sedan','suv','xl','bike') NOT NULL,
    make            VARCHAR(50) NOT NULL,
    model           VARCHAR(50) NOT NULL,
    color           VARCHAR(30) NOT NULL,
    year            YEAR        NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (driver_id) REFERENCES driver_profiles(driver_id) ON DELETE CASCADE
);

-- Delhi zones
CREATE TABLE zones (
    zone_id          INT AUTO_INCREMENT PRIMARY KEY,
    zone_name        VARCHAR(100) NOT NULL UNIQUE,
    area_name        VARCHAR(100) NOT NULL,
    base_fare        DECIMAL(8,2) NOT NULL,
    fare_per_km      DECIMAL(6,2) NOT NULL DEFAULT 12.00,
    surge_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00,
    is_surge_active  BOOLEAN DEFAULT FALSE,
    center_lat       DECIMAL(10,8) NOT NULL,
    center_lng       DECIMAL(11,8) NOT NULL,
    CONSTRAINT chk_base_fare   CHECK (base_fare > 0),
    CONSTRAINT chk_surge       CHECK (surge_multiplier BETWEEN 1.0 AND 5.0),
    CONSTRAINT chk_fare_per_km CHECK (fare_per_km > 0)
);

-- Ride requests
CREATE TABLE ride_requests (
    request_id       INT AUTO_INCREMENT PRIMARY KEY,
    rider_id         INT NOT NULL,
    pickup_address   VARCHAR(255) NOT NULL,
    pickup_lat       DECIMAL(10,8) NOT NULL,
    pickup_lng       DECIMAL(11,8) NOT NULL,
    drop_address     VARCHAR(255) NOT NULL,
    drop_lat         DECIMAL(10,8) NOT NULL,
    drop_lng         DECIMAL(11,8) NOT NULL,
    zone_id          INT NOT NULL,
    vehicle_type     ENUM('auto','sedan','suv','xl','bike') NOT NULL,
    estimated_fare   DECIMAL(8,2) NOT NULL,
    estimated_km     DECIMAL(6,2) NOT NULL,
    status           ENUM('pending','matched','cancelled','expired') DEFAULT 'pending',
    requested_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at       DATETIME NOT NULL,
    FOREIGN KEY (rider_id) REFERENCES rider_profiles(rider_id),
    FOREIGN KEY (zone_id)  REFERENCES zones(zone_id),
    CONSTRAINT chk_diff_location CHECK (
        pickup_lat != drop_lat OR pickup_lng != drop_lng
    )
);

-- Ride assignments
CREATE TABLE ride_assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    request_id    INT NOT NULL UNIQUE,
    driver_id     INT NOT NULL,
    assigned_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
    response_at   DATETIME NULL,
    status        ENUM('pending','accepted','rejected','timeout') DEFAULT 'pending',
    FOREIGN KEY (request_id) REFERENCES ride_requests(request_id),
    FOREIGN KEY (driver_id)  REFERENCES driver_profiles(driver_id)
);

-- Rides
CREATE TABLE rides (
    ride_id           INT AUTO_INCREMENT PRIMARY KEY,
    assignment_id     INT NOT NULL UNIQUE,
    otp               CHAR(4) NOT NULL,
    start_time        DATETIME NULL,
    end_time          DATETIME NULL,
    actual_km         DECIMAL(6,2) NULL,
    status            ENUM('accepted','otp_pending','in_progress',
                           'completed','cancelled') DEFAULT 'accepted',
    rider_rating      INT NULL,
    driver_rating     INT NULL,
    rider_feedback    VARCHAR(300) NULL,
    driver_feedback   VARCHAR(300) NULL,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assignment_id) REFERENCES ride_assignments(assignment_id),
    CONSTRAINT chk_rider_rating  CHECK (rider_rating  BETWEEN 1 AND 5),
    CONSTRAINT chk_driver_rating CHECK (driver_rating BETWEEN 1 AND 5),
    CONSTRAINT chk_end_after_start CHECK (
        end_time IS NULL OR end_time > start_time
    )
);

-- Payments
CREATE TABLE payments (
    payment_id       INT AUTO_INCREMENT PRIMARY KEY,
    ride_id          INT NOT NULL UNIQUE,
    rider_id         INT NOT NULL,
    base_fare        DECIMAL(8,2) NOT NULL,
    fare_per_km      DECIMAL(6,2) NOT NULL,
    distance_fare    DECIMAL(8,2) NOT NULL,
    surge_multiplier DECIMAL(4,2) DEFAULT 1.00,
    surge_amount     DECIMAL(8,2) DEFAULT 0.00,
    discount_amount  DECIMAL(8,2) DEFAULT 0.00,
    total_amount     DECIMAL(10,2) NOT NULL,
    payment_method   ENUM('cash','card','wallet','upi') NOT NULL,
    payment_status   ENUM('pending','completed','refunded','failed') DEFAULT 'pending',
    paid_at          DATETIME NULL,
    created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ride_id)  REFERENCES rides(ride_id),
    FOREIGN KEY (rider_id) REFERENCES rider_profiles(rider_id),
    CONSTRAINT chk_total CHECK (total_amount > 0)
);

-- Cancellations
CREATE TABLE cancellations (
    cancellation_id INT AUTO_INCREMENT PRIMARY KEY,
    ride_id         INT NOT NULL UNIQUE,
    cancelled_by    ENUM('rider','driver','system') NOT NULL,
    reason          VARCHAR(300) NOT NULL,
    penalty_amount  DECIMAL(8,2) DEFAULT 0.00,
    cancelled_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ride_id) REFERENCES rides(ride_id)
);

-- Ride logs (trigger populated)
CREATE TABLE ride_logs (
    log_id      INT AUTO_INCREMENT PRIMARY KEY,
    ride_id     INT NOT NULL,
    old_status  VARCHAR(30) NOT NULL,
    new_status  VARCHAR(30) NOT NULL,
    changed_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    changed_by  ENUM('rider','driver','system') NOT NULL,
    note        VARCHAR(200) NULL,
    FOREIGN KEY (ride_id) REFERENCES rides(ride_id) ON DELETE CASCADE
);

-- Notifications
CREATE TABLE notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    title           VARCHAR(100) NOT NULL,
    message         VARCHAR(300) NOT NULL,
    type            ENUM('ride','payment','promo','system') DEFAULT 'system',
    is_read         BOOLEAN DEFAULT FALSE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- Promo codes
CREATE TABLE promo_codes (
    promo_id        INT AUTO_INCREMENT PRIMARY KEY,
    code            VARCHAR(20) NOT NULL UNIQUE,
    discount_type   ENUM('flat','percent') NOT NULL,
    discount_value  DECIMAL(8,2) NOT NULL,
    min_fare        DECIMAL(8,2) DEFAULT 0.00,
    max_discount    DECIMAL(8,2) NULL,
    usage_limit     INT DEFAULT 1,
    used_count      INT DEFAULT 0,
    valid_from      DATETIME NOT NULL,
    valid_until     DATETIME NOT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────
-- SECTION 2: INDEXES
-- ─────────────────────────────────────────────

CREATE INDEX idx_users_role           ON users(role);
CREATE INDEX idx_users_phone          ON users(phone);
CREATE INDEX idx_rides_status         ON rides(status);
CREATE INDEX idx_rides_created        ON rides(created_at);
CREATE INDEX idx_ride_requests_status ON ride_requests(status);
CREATE INDEX idx_ride_requests_rider  ON ride_requests(rider_id);
CREATE INDEX idx_assignments_driver   ON ride_assignments(driver_id);
CREATE INDEX idx_payments_status      ON payments(payment_status);
CREATE INDEX idx_payments_method      ON payments(payment_method);
CREATE INDEX idx_driver_available     ON driver_profiles(is_available);
CREATE INDEX idx_driver_zone          ON driver_profiles(current_zone_id);
CREATE INDEX idx_notifications_user   ON notifications(user_id, is_read);
CREATE INDEX idx_ride_logs_ride       ON ride_logs(ride_id);

-- ─────────────────────────────────────────────
-- SECTION 3: TRIGGERS
-- ─────────────────────────────────────────────

DELIMITER $$

-- Trigger 1: Auto log every ride status change
CREATE TRIGGER trg_ride_status_log
AFTER UPDATE ON rides
FOR EACH ROW
BEGIN
    IF OLD.status != NEW.status THEN
        INSERT INTO ride_logs(ride_id, old_status, new_status, changed_by, note)
        VALUES (NEW.ride_id, OLD.status, NEW.status, 'system',
                CONCAT('Status changed from ', OLD.status, ' to ', NEW.status));
    END IF;
END$$

-- Trigger 2: Update driver rating after ride is rated
CREATE TRIGGER trg_update_driver_rating
AFTER UPDATE ON rides
FOR EACH ROW
BEGIN
    DECLARE v_driver_id INT;
    IF NEW.rider_rating IS NOT NULL AND OLD.rider_rating IS NULL THEN
        SELECT ra.driver_id INTO v_driver_id
        FROM ride_assignments ra
        WHERE ra.assignment_id = NEW.assignment_id;

        UPDATE driver_profiles
        SET
            avg_rating = (
                SELECT ROUND(AVG(r2.rider_rating), 2)
                FROM rides r2
                JOIN ride_assignments ra2 ON ra2.assignment_id = r2.assignment_id
                WHERE ra2.driver_id = v_driver_id
                AND r2.rider_rating IS NOT NULL
            ),
            total_rating_count = (
                SELECT COUNT(*)
                FROM rides r2
                JOIN ride_assignments ra2 ON ra2.assignment_id = r2.assignment_id
                WHERE ra2.driver_id = v_driver_id
                AND r2.rider_rating IS NOT NULL
            )
        WHERE driver_id = v_driver_id;
    END IF;
END$$

-- Trigger 3: Update driver and rider stats on ride completion
CREATE TRIGGER trg_update_stats_on_complete
AFTER UPDATE ON rides
FOR EACH ROW
BEGIN
    DECLARE v_driver_id INT;
    DECLARE v_rider_id  INT;
    DECLARE v_amount    DECIMAL(10,2);

    IF NEW.status = 'completed' AND OLD.status = 'in_progress' THEN
        SELECT ra.driver_id INTO v_driver_id
        FROM ride_assignments ra
        WHERE ra.assignment_id = NEW.assignment_id;

        SELECT rr.rider_id INTO v_rider_id
        FROM ride_assignments ra
        JOIN ride_requests rr ON rr.request_id = ra.request_id
        WHERE ra.assignment_id = NEW.assignment_id;

        SELECT total_amount INTO v_amount
        FROM payments WHERE ride_id = NEW.ride_id;

        UPDATE driver_profiles
        SET total_rides  = total_rides + 1,
            total_earned = total_earned + IFNULL(v_amount, 0),
            is_available = TRUE
        WHERE driver_id = v_driver_id;

        UPDATE rider_profiles
        SET total_rides = total_rides + 1,
            total_spent = total_spent + IFNULL(v_amount, 0)
        WHERE rider_id = v_rider_id;
    END IF;
END$$

DELIMITER ;

-- ─────────────────────────────────────────────
-- SECTION 4: SEED DATA
-- ─────────────────────────────────────────────

-- ============================================================
-- CityFlow Delhi — SEED DATA ONLY
-- Run this on your existing cityflow_db that already has tables.
-- Safe to re-run: uses INSERT IGNORE where possible.
-- ============================================================

USE cityflow_db;

-- ─────────────────────────────────────────────
-- STEP 1: ZONES
-- ─────────────────────────────────────────────
INSERT IGNORE INTO zones
(zone_name, area_name, base_fare, fare_per_km, surge_multiplier, is_surge_active, center_lat, center_lng)
VALUES
('Connaught Place', 'Central Delhi',    45.00, 14.00, 1.0, FALSE, 28.63290000, 77.21990000),
('Cyber City',      'Gurugram',         55.00, 15.00, 1.5, TRUE,  28.49510000, 77.08840000),
('Noida Sector 18', 'Noida',            40.00, 12.00, 1.2, TRUE,  28.57000000, 77.32130000),
('Saket',           'South Delhi',      38.00, 12.00, 1.0, FALSE, 28.52300000, 77.21560000),
('Dwarka',          'West Delhi',       32.00, 11.00, 1.0, FALSE, 28.59130000, 77.04620000),
('Rohini',          'North West Delhi', 28.00, 11.00, 1.0, FALSE, 28.73510000, 77.11480000),
('Lajpat Nagar',    'South Delhi',      38.00, 13.00, 1.8, TRUE,  28.56770000, 77.24360000),
('IGI Airport',     'South West Delhi', 80.00, 16.00, 1.5, TRUE,  28.55620000, 77.10010000),
('Janakpuri',       'West Delhi',       32.00, 11.00, 1.0, FALSE, 28.62440000, 77.08320000),
('Greater Noida',   'Greater Noida',    50.00, 13.00, 1.2, FALSE, 28.47410000, 77.50310000),
('Hauz Khas',       'South Delhi',      42.00, 13.00, 1.3, TRUE,  28.54310000, 77.20530000),
('Karol Bagh',      'Central Delhi',    35.00, 12.00, 1.0, FALSE, 28.65130000, 77.19010000),
('Pitampura',       'North West Delhi', 30.00, 11.00, 1.0, FALSE, 28.69780000, 77.13140000),
('Vasant Kunj',     'South West Delhi', 40.00, 13.00, 1.1, FALSE, 28.52190000, 77.15780000),
('Nehru Place',     'South Delhi',      42.00, 13.00, 1.4, TRUE,  28.54820000, 77.25190000);

-- ─────────────────────────────────────────────
-- STEP 2: USERS
-- Password for all accounts: test1234
-- Hash generated with bcrypt rounds=10
-- ─────────────────────────────────────────────
INSERT IGNORE INTO users (full_name, email, phone, password_hash, role) VALUES
-- Riders (will get user_id 1-6)
('Rohan Singh',  'rohan@cityflow.in',  '9810001001', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.ucrTOwrIK', 'rider'),
('Arjun Sharma', 'arjun@cityflow.in',  '9810001002', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.ucrTOwrIK', 'rider'),
('Priya Patel',  'priya@cityflow.in',  '9810001003', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.ucrTOwrIK', 'rider'),
('Sneha Reddy',  'sneha@cityflow.in',  '9810001004', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.ucrTOwrIK', 'rider'),
('Vikram Singh', 'vikram@cityflow.in', '9810001005', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.ucrTOwrIK', 'rider'),
('Ananya Iyer',  'ananya@cityflow.in', '9810001006', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.ucrTOwrIK', 'rider'),
-- Drivers (will get user_id 7-11)
('Ramesh Kumar',  'ramesh@cityflow.in', '9911001001', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.ucrTOwrIK', 'driver'),
('Suresh Yadav',  'suresh@cityflow.in', '9911001002', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.ucrTOwrIK', 'driver'),
('Mahesh Tiwari', 'mahesh@cityflow.in', '9911001003', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.ucrTOwrIK', 'driver'),
('Ganesh Sharma', 'ganesh@cityflow.in', '9911001004', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.ucrTOwrIK', 'driver'),
('Paresh Jain',   'paresh@cityflow.in', '9911001005', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.ucrTOwrIK', 'driver'),
-- Admin (will get user_id 12)
('CityFlow Admin', 'admin@cityflow.in', '9999999999', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.ucrTOwrIK', 'admin');

-- ─────────────────────────────────────────────
-- STEP 3: RIDER PROFILES
-- THIS WAS MISSING FROM THE ORIGINAL — root cause of FK failures
-- ride_requests.rider_id → rider_profiles.rider_id
-- payments.rider_id      → rider_profiles.rider_id
-- ─────────────────────────────────────────────
INSERT IGNORE INTO rider_profiles (rider_id, total_rides, total_spent, preferred_payment, rating)
VALUES
(1, 0, 0.00, 'upi',    5.00),
(2, 0, 0.00, 'card',   5.00),
(3, 0, 0.00, 'wallet', 5.00),
(4, 0, 0.00, 'cash',   5.00),
(5, 0, 0.00, 'upi',    5.00),
(6, 0, 0.00, 'upi',    5.00);

-- ─────────────────────────────────────────────
-- STEP 4: DRIVER PROFILES
-- ─────────────────────────────────────────────
INSERT IGNORE INTO driver_profiles
(driver_id, license_no, avg_rating, total_rating_count, total_rides, total_earned, is_available, is_verified, current_zone_id)
VALUES
(7,  'DL0120210001', 4.72, 312, 0, 0.00, TRUE, TRUE, 1),
(8,  'DL0120210002', 4.45, 198, 0, 0.00, TRUE, TRUE, 2),
(9,  'DL0120210003', 4.89, 423, 0, 0.00, TRUE, TRUE, 3),
(10, 'DL0120210004', 4.61, 256, 0, 0.00, TRUE, TRUE, 4),
(11, 'DL0120210005', 4.78, 389, 0, 0.00, TRUE, TRUE, 5);

-- ─────────────────────────────────────────────
-- STEP 5: VEHICLES
-- ─────────────────────────────────────────────
INSERT IGNORE INTO vehicles
(driver_id, registration_no, vehicle_type, make, model, color, year)
VALUES
(7,  'DL01AB1234', 'sedan', 'Maruti', 'Dzire',  'White',  2021),
(8,  'DL02CD5678', 'suv',   'Toyota', 'Innova', 'Silver', 2022),
(9,  'DL03EF9012', 'auto',  'Bajaj',  'RE',     'Yellow', 2020),
(10, 'DL04GH3456', 'sedan', 'Honda',  'Amaze',  'Black',  2021),
(11, 'DL05IJ7890', 'xl',    'Toyota', 'Crysta', 'White',  2022);

-- ─────────────────────────────────────────────
-- STEP 6: RIDE REQUESTS
-- ─────────────────────────────────────────────
INSERT IGNORE INTO ride_requests
(rider_id, pickup_address, pickup_lat, pickup_lng,
 drop_address, drop_lat, drop_lng,
 zone_id, vehicle_type, estimated_fare, estimated_km, status, expires_at)
VALUES
(1, 'Connaught Place',  28.6139, 77.2090, 'Cyber City',  28.4951, 77.0884, 1, 'sedan', 304.00, 18.5, 'matched', DATE_ADD(NOW(), INTERVAL 1 YEAR)),
(2, 'Noida Sector 18',  28.5700, 77.3213, 'Saket',       28.5230, 77.2156, 3, 'sedan', 365.00, 22.0, 'matched', DATE_ADD(NOW(), INTERVAL 1 YEAR)),
(3, 'Lajpat Nagar',     28.5677, 77.2436, 'Hauz Khas',   28.5431, 77.2053, 7, 'auto',  197.00,  5.5, 'matched', DATE_ADD(NOW(), INTERVAL 1 YEAR)),
(4, 'Dwarka Sector 10', 28.5913, 77.0462, 'IGI Airport', 28.5562, 77.1001, 8, 'sedan', 408.00, 12.0, 'matched', DATE_ADD(NOW(), INTERVAL 1 YEAR)),
(5, 'Karol Bagh',       28.6513, 77.1901, 'Nehru Place', 28.5482, 77.2519, 1, 'sedan', 241.00, 14.0, 'matched', DATE_ADD(NOW(), INTERVAL 1 YEAR));

-- ─────────────────────────────────────────────
-- STEP 7: RIDE ASSIGNMENTS
-- ─────────────────────────────────────────────
INSERT IGNORE INTO ride_assignments (request_id, driver_id, status, response_at)
VALUES
(1, 7,  'accepted', NOW()),
(2, 8,  'accepted', NOW()),
(3, 9,  'accepted', NOW()),
(4, 10, 'accepted', NOW()),
(5, 11, 'accepted', NOW());

-- ─────────────────────────────────────────────
-- STEP 8: RIDES
-- Inserted directly as 'completed' — triggers won't fire on INSERT
-- Stats are manually synced in STEP 10 below
-- ─────────────────────────────────────────────
INSERT IGNORE INTO rides
(assignment_id, otp, start_time, end_time, actual_km, status, rider_rating)
VALUES
(1, '1234', DATE_SUB(NOW(), INTERVAL 4 HOUR),  DATE_SUB(NOW(), INTERVAL 3 HOUR),         18.5, 'completed', 5),
(2, '1234', DATE_SUB(NOW(), INTERVAL 3 HOUR),  DATE_SUB(NOW(), INTERVAL 2 HOUR),         22.0, 'completed', 4),
(3, '1234', DATE_SUB(NOW(), INTERVAL 2 HOUR),  DATE_SUB(NOW(), INTERVAL 1 HOUR),          5.5, 'completed', 5),
(4, '1234', DATE_SUB(NOW(), INTERVAL 5 HOUR),  DATE_SUB(NOW(), INTERVAL 4 HOUR),         12.0, 'completed', 4),
(5, '1234', DATE_SUB(NOW(), INTERVAL 1 HOUR),  DATE_SUB(NOW(), INTERVAL 30 MINUTE),      14.0, 'completed', 5);

-- ─────────────────────────────────────────────
-- STEP 9: PAYMENTS
-- Must come after rides (FK: ride_id) and after rider_profiles (FK: rider_id)
-- ─────────────────────────────────────────────
INSERT IGNORE INTO payments
(ride_id, rider_id, base_fare, fare_per_km, distance_fare,
 surge_multiplier, surge_amount, discount_amount, total_amount,
 payment_method, payment_status, paid_at)
VALUES
(1, 1, 45.00, 14.00, 259.00, 1.0, 0.00, 0.00, 304.00, 'upi',    'completed', NOW()),
(2, 2, 40.00, 12.00, 264.00, 1.2, 0.00, 0.00, 365.00, 'card',   'completed', NOW()),
(3, 3, 38.00, 13.00,  71.50, 1.8, 0.00, 0.00, 197.00, 'wallet', 'completed', NOW()),
(4, 4, 80.00, 16.00, 192.00, 1.5, 0.00, 0.00, 408.00, 'cash',   'completed', NOW()),
(5, 5, 45.00, 14.00, 196.00, 1.0, 0.00, 0.00, 241.00, 'upi',    'completed', NOW());

-- ─────────────────────────────────────────────
-- STEP 10: SYNC PROFILE STATS
-- Triggers fire on UPDATE not INSERT, so we patch stats manually.
-- These numbers match exactly what was inserted in payments above.
-- ─────────────────────────────────────────────
UPDATE rider_profiles SET total_rides = 1, total_spent = 304.00 WHERE rider_id = 1;
UPDATE rider_profiles SET total_rides = 1, total_spent = 365.00 WHERE rider_id = 2;
UPDATE rider_profiles SET total_rides = 1, total_spent = 197.00 WHERE rider_id = 3;
UPDATE rider_profiles SET total_rides = 1, total_spent = 408.00 WHERE rider_id = 4;
UPDATE rider_profiles SET total_rides = 1, total_spent = 241.00 WHERE rider_id = 5;

UPDATE driver_profiles SET total_rides = 1, total_earned = 304.00, is_available = TRUE WHERE driver_id = 7;
UPDATE driver_profiles SET total_rides = 1, total_earned = 365.00, is_available = TRUE WHERE driver_id = 8;
UPDATE driver_profiles SET total_rides = 1, total_earned = 197.00, is_available = TRUE WHERE driver_id = 9;
UPDATE driver_profiles SET total_rides = 1, total_earned = 408.00, is_available = TRUE WHERE driver_id = 10;
UPDATE driver_profiles SET total_rides = 1, total_earned = 241.00, is_available = TRUE WHERE driver_id = 11;

-- ─────────────────────────────────────────────
-- VERIFY — run these SELECTs to confirm everything seeded correctly
-- ─────────────────────────────────────────────
SELECT 'zones'           AS tbl, COUNT(*) AS rows FROM zones
UNION ALL
SELECT 'users',            COUNT(*) FROM users
UNION ALL
SELECT 'rider_profiles',   COUNT(*) FROM rider_profiles
UNION ALL
SELECT 'driver_profiles',  COUNT(*) FROM driver_profiles
UNION ALL
SELECT 'vehicles',         COUNT(*) FROM vehicles
UNION ALL
SELECT 'ride_requests',    COUNT(*) FROM ride_requests
UNION ALL
SELECT 'ride_assignments', COUNT(*) FROM ride_assignments
UNION ALL
SELECT 'rides',            COUNT(*) FROM rides
UNION ALL
SELECT 'payments',         COUNT(*) FROM payments;

-- ─────────────────────────────────────────────
-- SECTION 5: TASK 4 — SQL QUERIES (15+)
-- ─────────────────────────────────────────────

-- Q1: All active drivers with vehicle and zone
SELECT
    u.full_name AS driver_name,
    u.phone,
    dp.avg_rating,
    dp.is_available,
    v.vehicle_type, v.make, v.model, v.registration_no,
    z.zone_name AS current_zone
FROM driver_profiles dp
JOIN users u    ON u.user_id    = dp.driver_id
JOIN vehicles v ON v.driver_id  = dp.driver_id
LEFT JOIN zones z ON z.zone_id  = dp.current_zone_id
WHERE u.is_active = TRUE
ORDER BY dp.avg_rating DESC;

-- Q2: All completed rides with full details
SELECT
    r.ride_id,
    u_rider.full_name  AS rider_name,
    u_driver.full_name AS driver_name,
    rq.pickup_address,
    rq.drop_address,
    r.actual_km,
    p.total_amount,
    p.payment_method,
    r.rider_rating,
    r.start_time,
    r.end_time
FROM rides r
JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
JOIN ride_requests    rq ON rq.request_id    = ra.request_id
JOIN users u_rider        ON u_rider.user_id  = rq.rider_id
JOIN users u_driver       ON u_driver.user_id = ra.driver_id
JOIN payments p           ON p.ride_id        = r.ride_id
WHERE r.status = 'completed'
ORDER BY r.start_time DESC;

-- Q3: Total revenue per payment method
SELECT
    payment_method,
    COUNT(*)          AS total_transactions,
    SUM(total_amount) AS total_revenue,
    ROUND(AVG(total_amount), 2) AS avg_transaction
FROM payments
WHERE payment_status = 'completed'
GROUP BY payment_method
ORDER BY total_revenue DESC;

-- Q4: Top drivers by earnings
SELECT
    u.full_name AS driver_name,
    dp.avg_rating,
    dp.total_rides,
    dp.total_earned,
    v.vehicle_type,
    z.zone_name AS zone
FROM driver_profiles dp
JOIN users u    ON u.user_id   = dp.driver_id
JOIN vehicles v ON v.driver_id = dp.driver_id
LEFT JOIN zones z ON z.zone_id = dp.current_zone_id
ORDER BY dp.total_earned DESC;

-- Q5: Riders who spent the most
SELECT
    u.full_name AS rider_name,
    u.email,
    rp.total_rides,
    rp.total_spent,
    rp.preferred_payment,
    ROUND(rp.total_spent / NULLIF(rp.total_rides, 0), 2) AS avg_spend_per_ride
FROM rider_profiles rp
JOIN users u ON u.user_id = rp.rider_id
ORDER BY rp.total_spent DESC;

-- Q6: Revenue by zone
SELECT
    z.zone_name,
    z.area_name,
    z.base_fare,
    z.surge_multiplier,
    COUNT(p.payment_id)          AS total_rides,
    ROUND(SUM(p.total_amount),2) AS total_revenue,
    ROUND(AVG(p.total_amount),2) AS avg_fare
FROM zones z
LEFT JOIN ride_requests  rq ON rq.zone_id        = z.zone_id
LEFT JOIN ride_assignments ra ON ra.request_id   = rq.request_id
LEFT JOIN rides r          ON r.assignment_id    = ra.assignment_id
LEFT JOIN payments p       ON p.ride_id          = r.ride_id
WHERE p.payment_status = 'completed' OR p.payment_status IS NULL
GROUP BY z.zone_id
ORDER BY total_revenue DESC;

-- Q7: Average ride duration per vehicle type
SELECT
    v.vehicle_type,
    COUNT(r.ride_id) AS total_rides,
    ROUND(AVG(TIMESTAMPDIFF(MINUTE, r.start_time, r.end_time)), 1) AS avg_duration_minutes,
    ROUND(AVG(p.total_amount), 2) AS avg_fare
FROM rides r
JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
JOIN vehicles v          ON v.driver_id      = ra.driver_id
LEFT JOIN payments p     ON p.ride_id        = r.ride_id
WHERE r.status = 'completed'
GROUP BY v.vehicle_type
ORDER BY avg_fare DESC;

-- Q8: Drivers who have never been rated below 4
SELECT
    u.full_name AS driver_name,
    dp.avg_rating,
    dp.total_rating_count
FROM driver_profiles dp
JOIN users u ON u.user_id = dp.driver_id
WHERE dp.driver_id NOT IN (
    SELECT ra.driver_id
    FROM rides r
    JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
    WHERE r.rider_rating IS NOT NULL
    AND r.rider_rating < 4
)
AND dp.total_rating_count > 0
ORDER BY dp.avg_rating DESC;

-- Q9: Surge zones with active rides
SELECT
    z.zone_name,
    z.surge_multiplier,
    z.base_fare,
    COUNT(rq.request_id) AS active_requests
FROM zones z
LEFT JOIN ride_requests rq ON rq.zone_id = z.zone_id
    AND rq.status = 'pending'
WHERE z.is_surge_active = TRUE
GROUP BY z.zone_id
ORDER BY z.surge_multiplier DESC;

-- Q10: Full ride lifecycle audit
SELECT
    rq.request_id,
    u_rider.full_name  AS rider,
    u_driver.full_name AS driver,
    rq.pickup_address,
    rq.drop_address,
    rq.requested_at,
    ra.assigned_at,
    r.start_time,
    r.end_time,
    r.status           AS ride_status,
    r.rider_rating,
    p.total_amount,
    p.payment_method,
    p.payment_status,
    CASE
        WHEN p.payment_id IS NULL AND r.status = 'completed' THEN 'MISSING PAYMENT'
        WHEN c.cancellation_id IS NOT NULL THEN 'CANCELLED'
        ELSE 'OK'
    END AS audit_flag
FROM ride_requests rq
JOIN ride_assignments ra ON ra.request_id    = rq.request_id
JOIN rides           r  ON r.assignment_id   = ra.assignment_id
JOIN users u_rider       ON u_rider.user_id  = rq.rider_id
JOIN users u_driver      ON u_driver.user_id = ra.driver_id
LEFT JOIN payments     p ON p.ride_id        = r.ride_id
LEFT JOIN cancellations c ON c.ride_id       = r.ride_id
ORDER BY rq.requested_at DESC;

-- Q11: Daily revenue trend
SELECT
    DATE(p.paid_at)       AS ride_date,
    COUNT(p.payment_id)   AS total_rides,
    SUM(p.total_amount)   AS daily_revenue,
    AVG(p.total_amount)   AS avg_fare,
    MIN(p.total_amount)   AS min_fare,
    MAX(p.total_amount)   AS max_fare
FROM payments p
WHERE p.payment_status = 'completed'
GROUP BY DATE(p.paid_at)
ORDER BY ride_date DESC;

-- Q12: Driver ranking with dense rank
SELECT
    u.full_name AS driver_name,
    dp.avg_rating,
    dp.total_rides,
    dp.total_earned,
    DENSE_RANK() OVER (ORDER BY dp.total_earned DESC) AS earnings_rank,
    DENSE_RANK() OVER (ORDER BY dp.avg_rating  DESC) AS rating_rank
FROM driver_profiles dp
JOIN users u ON u.user_id = dp.driver_id
WHERE dp.total_rides > 0;

-- Q13: Riders with above average spend
SELECT
    u.full_name AS rider_name,
    rp.total_spent,
    rp.total_rides,
    ROUND(rp.total_spent / NULLIF(rp.total_rides,0), 2) AS avg_per_ride
FROM rider_profiles rp
JOIN users u ON u.user_id = rp.rider_id
WHERE rp.total_spent > (
    SELECT AVG(total_spent) FROM rider_profiles WHERE total_rides > 0
)
ORDER BY rp.total_spent DESC;

-- Q14: Cancellation analysis
SELECT
    c.cancelled_by,
    COUNT(*)                        AS total_cancellations,
    ROUND(AVG(c.penalty_amount), 2) AS avg_penalty,
    SUM(c.penalty_amount)           AS total_penalty_collected
FROM cancellations c
GROUP BY c.cancelled_by;

-- Q15: Zone performance comparison
SELECT
    z.zone_name,
    z.area_name,
    z.base_fare,
    z.fare_per_km,
    z.surge_multiplier,
    z.is_surge_active,
    COUNT(DISTINCT rq.request_id)   AS total_requests,
    COUNT(DISTINCT r.ride_id)       AS completed_rides,
    ROUND(SUM(p.total_amount), 2)   AS total_revenue
FROM zones z
LEFT JOIN ride_requests    rq ON rq.zone_id        = z.zone_id
LEFT JOIN ride_assignments ra ON ra.request_id     = rq.request_id
LEFT JOIN rides r             ON r.assignment_id   = ra.assignment_id AND r.status = 'completed'
LEFT JOIN payments p          ON p.ride_id         = r.ride_id
GROUP BY z.zone_id
ORDER BY total_revenue DESC NULLS LAST;

-- Q16: Ride log audit trail
SELECT
    rl.log_id,
    r.ride_id,
    u_rider.full_name  AS rider,
    u_driver.full_name AS driver,
    rl.old_status,
    rl.new_status,
    rl.changed_at,
    rl.changed_by,
    rl.note
FROM ride_logs rl
JOIN rides r              ON r.ride_id         = rl.ride_id
JOIN ride_assignments ra  ON ra.assignment_id  = r.assignment_id
JOIN ride_requests rq     ON rq.request_id     = ra.request_id
JOIN users u_rider        ON u_rider.user_id   = rq.rider_id
JOIN users u_driver       ON u_driver.user_id  = ra.driver_id
ORDER BY rl.changed_at DESC;

-- Q17: Payment method popularity by zone
SELECT
    z.zone_name,
    p.payment_method,
    COUNT(*) AS usage_count,
    SUM(p.total_amount) AS revenue
FROM payments p
JOIN rides r           ON r.ride_id        = p.ride_id
JOIN ride_assignments ra ON ra.assignment_id = r.assignment_id
JOIN ride_requests rq  ON rq.request_id    = ra.request_id
JOIN zones z           ON z.zone_id        = rq.zone_id
WHERE p.payment_status = 'completed'
GROUP BY z.zone_id, p.payment_method
ORDER BY z.zone_name, usage_count DESC;

-- ─────────────────────────────────────────────
-- SECTION 6: TASK 6 — TRANSACTIONS
-- ─────────────────────────────────────────────

-- Transaction 1: Complete a ride atomically
START TRANSACTION;
    UPDATE rides
       SET status = 'completed', end_time = NOW(), actual_km = 15.5
     WHERE ride_id = 1;

    INSERT INTO payments
        (ride_id, rider_id, base_fare, fare_per_km, distance_fare,
         surge_multiplier, surge_amount, total_amount,
         payment_method, payment_status, paid_at)
    VALUES (1, 1, 45.00, 14.00, 217.00, 1.0, 0, 262.00, 'upi', 'completed', NOW());

    UPDATE driver_profiles
       SET is_available = TRUE, total_rides = total_rides + 1
     WHERE driver_id = 7;

    UPDATE rider_profiles
       SET total_rides = total_rides + 1, total_spent = total_spent + 262.00
     WHERE rider_id = 1;
COMMIT;

-- Transaction 2: Conflicting update (demonstrates lock behaviour)
-- Session A
START TRANSACTION;
    UPDATE driver_profiles SET is_available = FALSE WHERE driver_id = 7;
    -- intentional delay before commit

-- Session B (runs concurrently — will wait for Session A's lock)
START TRANSACTION;
    UPDATE driver_profiles SET current_zone_id = 3 WHERE driver_id = 7;
    -- this blocks until Session A commits or rolls back
COMMIT;

-- Session A commits, Session B proceeds
COMMIT;

-- Transaction 3: Rollback on duplicate payment
START TRANSACTION;
    INSERT INTO payments
        (ride_id, rider_id, base_fare, fare_per_km, distance_fare,
         total_amount, payment_method, payment_status)
    VALUES (1, 1, 45.00, 14.00, 200.00, 245.00, 'cash', 'completed');
    -- This will fail: ride_id=1 already has a payment (UNIQUE constraint)
    -- MySQL raises error, we roll back
ROLLBACK;

-- Transaction 4: Cancel ride with penalty
START TRANSACTION;
    UPDATE rides
       SET status = 'cancelled', end_time = NOW()
     WHERE ride_id = 2 AND status IN ('accepted','in_progress');

    INSERT INTO cancellations (ride_id, cancelled_by, reason, penalty_amount)
    VALUES (2, 'rider', 'Changed plans', 25.00);

    UPDATE driver_profiles
       SET is_available = TRUE
     WHERE driver_id = (
         SELECT ra.driver_id FROM ride_assignments ra
         WHERE ra.assignment_id = (
             SELECT assignment_id FROM rides WHERE ride_id = 2
         )
     );
COMMIT;