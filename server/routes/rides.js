const express = require('express');
const router  = express.Router();
const {
  requestRide, startRide, completeRide,
  cancelRide, getRide, rateRide,
  getRiderHistory, getDriverHistory, getZones
} = require('../controllers/rideController');
const { protect, restrictTo } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

router.get('/zones', getZones);

router.post('/request',              protect, restrictTo(ROLES.RIDER),  requestRide);
router.get('/history/rider',         protect, restrictTo(ROLES.RIDER),  getRiderHistory);
router.get('/history/driver',        protect, restrictTo(ROLES.DRIVER), getDriverHistory);
router.get('/:ride_id',              protect, getRide);
router.patch('/:ride_id/start',      protect, restrictTo(ROLES.DRIVER), startRide);
router.patch('/:ride_id/complete',   protect, restrictTo(ROLES.DRIVER), completeRide);
router.patch('/:ride_id/cancel',     protect, cancelRide);
router.patch('/:ride_id/rate',       protect, rateRide);

module.exports = router;