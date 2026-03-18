module.exports = {
  ROLES: {
    RIDER:  'rider',
    DRIVER: 'driver',
    ADMIN:  'admin',
  },
  RIDE_STATUS: {
    ACCEPTED:    'accepted',
    OTP_PENDING: 'otp_pending',
    IN_PROGRESS: 'in_progress',
    COMPLETED:   'completed',
    CANCELLED:   'cancelled',
  },
  PAYMENT_STATUS: {
    PENDING:   'pending',
    COMPLETED: 'completed',
    REFUNDED:  'refunded',
    FAILED:    'failed',
  },
  OTP_EXPIRY_MINUTES: 10,
  REQUEST_EXPIRY_MINUTES: 5,
  CANCELLATION_PENALTY: 25.00,

  // ── Vehicle-type based BASE FARES (₹) ──────────────────────────
  // Final fare = (VEHICLE_BASE_FARES[type] + estimated_km × PER_KM_RATE)
  //              × zone_multiplier × surge_multiplier_admin
  VEHICLE_BASE_FARES: {
    bike:  50,
    auto:  80,
    sedan: 120,
    suv:   180,
    xl:    220,
  },
  PER_KM_RATE: 12,   // ₹ per km — applied to all vehicle types uniformly
};