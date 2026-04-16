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

// ── UPDATE DRIVER'S GPS LOCATION ─────────────────────────────────────────────
// Called by the driver dashboard when they go online or periodically while online.
// Replaces the old /zone endpoint — proximity is now purely coordinate-based.
router.patch('/location', protect, restrictTo(ROLES.DRIVER), async (req, res) => {
  const { lat, lng } = req.body;
  if (lat == null || lng == null) {
    return res.status(400).json({ message: 'lat and lng are required' });
  }
  const latitude  = parseFloat(lat);
  const longitude = parseFloat(lng);
  if (isNaN(latitude) || isNaN(longitude) ||
      latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ message: 'Invalid coordinates' });
  }

  try {
    // Save GPS position + update last_seen
    await db.execute(
      `UPDATE driver_profiles
       SET last_location_lat = ?, last_location_lng = ?, last_seen = NOW()
       WHERE driver_id = ?`,
      [latitude, longitude, req.user.user_id]
    );

    // Auto-detect nearest zone within 5km (for display purposes only)
    const HAVERSINE_SQL = `
      6371 * ACOS(
        LEAST(1.0,
          COS(RADIANS(?)) * COS(RADIANS(center_lat))
          * COS(RADIANS(center_lng) - RADIANS(?))
          + SIN(RADIANS(?)) * SIN(RADIANS(center_lat))
        )
      )`;
    const [zones] = await db.execute(
      `SELECT zone_id, zone_name, area_name, (${HAVERSINE_SQL}) AS dist_km
       FROM zones
       ORDER BY dist_km ASC
       LIMIT 1`,
      [latitude, longitude, latitude]
    );

    const nearestZone = zones[0] || null;

    // Update current_zone_id to nearest zone (for legacy admin queries etc.)
    if (nearestZone) {
      await db.execute(
        `UPDATE driver_profiles SET current_zone_id = ? WHERE driver_id = ?`,
        [nearestZone.zone_id, req.user.user_id]
      );
    }

    res.json({
      message:      'Location updated',
      lat:          latitude,
      lng:          longitude,
      nearest_zone: nearestZone ? {
        zone_id:   nearestZone.zone_id,
        zone_name: nearestZone.zone_name,
        area_name: nearestZone.area_name,
        dist_km:   parseFloat(nearestZone.dist_km).toFixed(2)
      } : null
    });
  } catch (err) {
    console.error('updateLocation error:', err.message);
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