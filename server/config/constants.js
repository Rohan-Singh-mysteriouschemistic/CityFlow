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
};