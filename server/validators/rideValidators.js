const { z } = require('zod');

// ── Request a Ride ───────────────────────────────────────────────────────────
const requestRideSchema = z.object({
  pickup_address : z.string().min(3, 'Pickup address is required'),
  pickup_lat     : z.coerce.number().min(-90).max(90,  'Invalid pickup latitude'),
  pickup_lng     : z.coerce.number().min(-180).max(180, 'Invalid pickup longitude'),
  drop_address   : z.string().min(3, 'Drop address is required'),
  drop_lat       : z.coerce.number().min(-90).max(90,  'Invalid drop latitude'),
  drop_lng       : z.coerce.number().min(-180).max(180, 'Invalid drop longitude'),
  vehicle_type   : z.enum(['auto', 'sedan', 'suv', 'xl', 'bike'], {
    errorMap: () => ({ message: 'Vehicle type must be auto, sedan, suv, xl, or bike' })
  }),
  estimated_km   : z.coerce.number().positive('Estimated distance must be a positive number'),
  payment_method : z.enum(['cash', 'card', 'wallet', 'upi'], {
    errorMap: () => ({ message: 'Payment method must be cash, card, wallet, or upi' })
  }),
});

// ── Rate a Ride ───────────────────────────────────────────────────────────────
const rateRideSchema = z.object({
  rating   : z.coerce.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  feedback : z.string().max(300).optional(),
});

// ── Start Ride (OTP) ──────────────────────────────────────────────────────────
const startRideSchema = z.object({
  otp : z.string().length(4, 'OTP must be exactly 4 digits').regex(/^\d{4}$/, 'OTP must be numeric'),
});

module.exports = { requestRideSchema, rateRideSchema, startRideSchema };
