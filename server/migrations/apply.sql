-- ================================================================
-- CityFlow — FINAL Migration Script (Rerun Safe)
-- ================================================================

USE cityflow_db;

-- ────────────────────────────────────────────────────────────────
-- Task 1: Account Suspension Columns
-- ────────────────────────────────────────────────────────────────

-- suspension_duration
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'suspension_duration'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN suspension_duration ENUM("1_day","3_days","1_week","permanent") NULL DEFAULT NULL',
  'SELECT "suspension_duration already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- suspended_at
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'suspended_at'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN suspended_at DATETIME NULL DEFAULT NULL',
  'SELECT "suspended_at already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- suspension_until
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'suspension_until'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE users ADD COLUMN suspension_until DATETIME NULL DEFAULT NULL',
  'SELECT "suspension_until already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ────────────────────────────────────────────────────────────────
-- Task 5: Zones Table Cleanup (Rerun Safe)
-- ────────────────────────────────────────────────────────────────

-- base_fare
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'zones'
    AND COLUMN_NAME = 'base_fare'
);

SET @sql = IF(@col_exists = 1,
  'ALTER TABLE zones DROP COLUMN base_fare',
  'SELECT "base_fare already removed"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- fare_per_km
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'zones'
    AND COLUMN_NAME = 'fare_per_km'
);

SET @sql = IF(@col_exists = 1,
  'ALTER TABLE zones DROP COLUMN fare_per_km',
  'SELECT "fare_per_km already removed"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- is_surge_active
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'zones'
    AND COLUMN_NAME = 'is_surge_active'
);

SET @sql = IF(@col_exists = 1,
  'ALTER TABLE zones DROP COLUMN is_surge_active',
  'SELECT "is_surge_active already removed"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- surge_multiplier_admin
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'zones'
    AND COLUMN_NAME = 'surge_multiplier_admin'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE zones ADD COLUMN surge_multiplier_admin DECIMAL(5,2) DEFAULT 1.0',
  'SELECT "surge_multiplier_admin already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ────────────────────────────────────────────────────────────────
-- Task: Payment Method on Ride Requests
-- ────────────────────────────────────────────────────────────────

-- payment_method
SET @col_exists = (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'ride_requests'
    AND COLUMN_NAME = 'payment_method'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE ride_requests ADD COLUMN payment_method ENUM(''cash'',''card'',''wallet'',''upi'') DEFAULT ''cash''',
  'SELECT "payment_method already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ────────────────────────────────────────────────────────────────
-- Notes
-- ────────────────────────────────────────────────────────────────
-- ✔ Safe to run multiple times
-- ✔ No DROP CHECK (avoids MySQL syntax errors)
-- ✔ Existing columns won't cause failure
-- ✔ Removed columns won't cause failure
-- ✔ surge_multiplier remains unchanged (used as zone_multiplier in backend)
-- ✔ payment_method column added to ride_requests

-- ================================================================
-- END OF SCRIPT
-- ================================================================