const express = require('express');
const router  = express.Router();
const {
  getDashboardStats, getAllRides, getAllDrivers,
  getAllRiders, verifyDriver,
  suspendUser, activateUser,
  getRevenueByZone, getZones, updateZoneMultiplier, updateAdminSurgeMultiplier
} = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const adminOnly = [protect, restrictTo(ROLES.ADMIN)];

router.get('/stats',                           ...adminOnly, getDashboardStats);
router.get('/rides',                           ...adminOnly, getAllRides);
router.get('/drivers',                         ...adminOnly, getAllDrivers);
router.get('/riders',                          ...adminOnly, getAllRiders);
router.get('/revenue/zones',                   ...adminOnly, getRevenueByZone);
router.get('/zones',                           ...adminOnly, getZones);

router.patch('/drivers/:driver_id/verify',     ...adminOnly, verifyDriver);

// Task 1: suspension with duration
router.patch('/users/:user_id/suspend',        ...adminOnly, suspendUser);
router.patch('/users/:user_id/activate',       ...adminOnly, activateUser);

// Task 5: zone multiplier update
router.patch('/zones/:zone_id/multiplier',     ...adminOnly, updateZoneMultiplier);
router.patch('/zones/:zone_id/surge_admin',    ...adminOnly, updateAdminSurgeMultiplier);

module.exports = router;