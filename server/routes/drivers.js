const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { protect, restrictTo } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.patch('/availability', protect, restrictTo(ROLES.DRIVER), async (req, res) => {
  const { is_available } = req.body;
  try {
    await db.execute(
      `UPDATE driver_profiles SET is_available = ? WHERE driver_id = ?`,
      [is_available, req.user.user_id]
    );
    res.json({ message: 'Availability updated', is_available });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── UPDATE DRIVER'S OPERATING ZONE ───────────────────────────────────────────
router.patch('/zone', protect, restrictTo(ROLES.DRIVER), async (req, res) => {
  const { zone_id } = req.body;
  if (!zone_id) return res.status(400).json({ message: 'zone_id is required' });
  try {
    // Verify zone exists
    const [zones] = await db.execute(`SELECT zone_id FROM zones WHERE zone_id = ?`, [zone_id]);
    if (zones.length === 0) return res.status(404).json({ message: 'Zone not found' });

    await db.execute(
      `UPDATE driver_profiles SET current_zone_id = ? WHERE driver_id = ?`,
      [zone_id, req.user.user_id]
    );
    res.json({ message: 'Zone updated successfully', zone_id });
  } catch (err) {
    console.error('updateZone error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

router.get('/me', protect, restrictTo(ROLES.DRIVER), async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT dp.*, v.vehicle_type, v.make, v.model, v.color, v.registration_no
       FROM driver_profiles dp
       LEFT JOIN vehicles v ON v.driver_id = dp.driver_id
       WHERE dp.driver_id = ?`,
      [req.user.user_id]
    );
    res.json({ driver: rows[0] });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;