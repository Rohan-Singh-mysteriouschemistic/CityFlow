const { z } = require('zod');

// ── Register ────────────────────────────────────────────────────────────────
const vehicleSchema = z.object({
  registration_no : z.string().min(4, 'Registration number is required'),
  vehicle_type    : z.enum(['auto', 'sedan', 'suv', 'xl', 'bike']),
  make            : z.string().min(1, 'Vehicle make is required'),
  model           : z.string().min(1, 'Vehicle model is required'),
  color           : z.string().min(1, 'Vehicle color is required'),
  year            : z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1),
});

const registerSchema = z.object({
  full_name  : z.string().min(2,  'Full name must be at least 2 characters'),
  email      : z.string().email('Invalid email address'),
  phone      : z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
  password   : z.string().min(6,  'Password must be at least 6 characters'),
  role       : z.enum(['rider', 'driver'], { message: 'Role must be rider or driver' }),
  // driver-only optional fields
  license_no : z.string().min(4, 'License number is required').optional(),
  vehicle    : vehicleSchema.optional(),
}).superRefine((data, ctx) => {
  if (data.role === 'driver') {
    if (!data.license_no) {
      ctx.addIssue({ path: ['license_no'], message: 'License number is required for drivers', code: z.ZodIssueCode.custom });
    }
    if (!data.vehicle) {
      ctx.addIssue({ path: ['vehicle'], message: 'Vehicle details are required for drivers', code: z.ZodIssueCode.custom });
    }
  }
});

// ── Login ────────────────────────────────────────────────────────────────────
const loginSchema = z.object({
  email    : z.string().email('Invalid email address'),
  password : z.string().min(1, 'Password is required'),
});

module.exports = { registerSchema, loginSchema };
