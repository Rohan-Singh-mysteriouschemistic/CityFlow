const express = require('express');
const router  = express.Router();
const {
  requestRide,
  getAvailableRequests,
  acceptRequest,
  getActiveRideRider,
  getActiveRideDriver,
  startRide,
  completeRide,
  cancelRide,
  getRide,
  rateRide,
  getRiderHistory,
  getDriverHistory,
  getZones
} = require('../controllers/rideController');
const { protect, restrictTo } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// ── PUBLIC ────────────────────────────────────
router.get('/zones', getZones);

// ── RIDER ─────────────────────────────────────
router.post('/request',            protect, restrictTo(ROLES.RIDER),  requestRide);
router.get('/active/rider',        protect, restrictTo(ROLES.RIDER),  getActiveRideRider);
router.get('/history/rider',       protect, restrictTo(ROLES.RIDER),  getRiderHistory);

// ── DRIVER ────────────────────────────────────
// NOTE: /available and /active/driver must come before /:ride_id
// so Express doesn't swallow them as param routes
router.get('/available',           protect, restrictTo(ROLES.DRIVER), getAvailableRequests);
router.get('/active/driver',       protect, restrictTo(ROLES.DRIVER), getActiveRideDriver);
router.post('/accept/:request_id', protect, restrictTo(ROLES.DRIVER), acceptRequest);
router.get('/history/driver',      protect, restrictTo(ROLES.DRIVER), getDriverHistory);

// ── SHARED (ride_id param routes — must be last) ──
router.get('/:ride_id',            protect, getRide);
router.patch('/:ride_id/start',    protect, restrictTo(ROLES.DRIVER), startRide);
router.patch('/:ride_id/complete', protect, restrictTo(ROLES.DRIVER), completeRide);
router.patch('/:ride_id/cancel',   protect,                           cancelRide);
router.patch('/:ride_id/rate',     protect,                           rateRide);

module.exports = router;