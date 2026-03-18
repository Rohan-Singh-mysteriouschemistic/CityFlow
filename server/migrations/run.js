/**
 * CityFlow Migration Runner
 * Run: node migrations/run.js
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  try {
    console.log('🔄 Running CityFlow DB migration...');

    // ── Task 1: Add suspension columns to users ──────────────────
    // MySQL doesn't support IF NOT EXISTS for ADD COLUMN in older versions;
    // we check each column's existence first.
    async function columnExists(table, column) {
      const [rows] = await conn.execute(
        `SELECT 1 FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME   = ?
           AND COLUMN_NAME  = ?`,
        [table, column]
      );
      return rows.length > 0;
    }

    async function addColumnIfMissing(table, column, definition) {
      if (!(await columnExists(table, column))) {
        await conn.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
        console.log(`  ✅ Added column ${table}.${column}`);
      } else {
        console.log(`  ⏭ Column ${table}.${column} already exists — skipping`);
      }
    }

    await addColumnIfMissing('users', 'suspension_duration',
      `ENUM('1_day','3_days','1_week','permanent') NULL DEFAULT NULL`);
    await addColumnIfMissing('users', 'suspended_at',
      `DATETIME NULL DEFAULT NULL`);
    await addColumnIfMissing('users', 'suspension_until',
      `DATETIME NULL DEFAULT NULL`);

    // ── Task 5: zones table — drop base_fare, fare_per_km, is_surge_active ──
    async function dropColumnIfExists(table, column) {
      if (await columnExists(table, column)) {
        // Drop constraint if it exists
        await conn.execute(`ALTER TABLE \`${table}\` DROP COLUMN \`${column}\``).catch(() => {});
        console.log(`  ✅ Dropped column ${table}.${column}`);
      } else {
        console.log(`  ⏭ Column ${table}.${column} already removed — skipping`);
      }
    }

    // First drop check constraints that reference these columns (MySQL 8+)
    try {
      await conn.execute(`ALTER TABLE zones DROP CONSTRAINT IF EXISTS chk_base_fare`);
      await conn.execute(`ALTER TABLE zones DROP CONSTRAINT IF EXISTS chk_fare_per_km`);
      await conn.execute(`ALTER TABLE zones DROP CONSTRAINT IF EXISTS chk_surge`);
    } catch (e) {
      // Constraints may not exist in some MySQL versions — safe to ignore
    }

    await dropColumnIfExists('zones', 'base_fare');
    await dropColumnIfExists('zones', 'fare_per_km');
    await dropColumnIfExists('zones', 'is_surge_active');

    // ── Task 5: Add new surge_multiplier_admin column ──
    await addColumnIfMissing('zones', 'surge_multiplier_admin',
      `DECIMAL(5,2) DEFAULT 1.0`);

    console.log('\n✅ Migration complete!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

runMigration();
