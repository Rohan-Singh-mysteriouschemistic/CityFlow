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