const express = require('express');
const router  = express.Router();
const {
  getDashboardStats, getAllRides, getAllDrivers,
  getAllRiders, verifyDriver, toggleUserStatus,
  getRevenueByZone, getZones, updateZoneSurge
} = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

const adminOnly = [protect, restrictTo(ROLES.ADMIN)];

router.get('/stats',                    ...adminOnly, getDashboardStats);
router.get('/rides',                    ...adminOnly, getAllRides);
router.get('/drivers',                  ...adminOnly, getAllDrivers);
router.get('/riders',                   ...adminOnly, getAllRiders);
router.get('/revenue/zones',            ...adminOnly, getRevenueByZone);
router.get('/zones',                    ...adminOnly, getZones);
router.patch('/drivers/:driver_id/verify', ...adminOnly, verifyDriver);
router.patch('/users/:user_id/toggle',     ...adminOnly, toggleUserStatus);
router.patch('/zones/:zone_id/surge',      ...adminOnly, updateZoneSurge);

module.exports = router;