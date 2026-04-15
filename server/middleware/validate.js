const { z } = require('zod');
const AppError = require('../utils/AppError');

/**
 * Express middleware factory for Zod schema validation.
 *
 * Usage:
 *   router.post('/request', protect, validate(requestRideSchema), requestRide);
 *
 * On failure: forwards a 400 AppError with structured Zod issue list.
 * On success: req.body is replaced with the parsed (coerced + stripped) value.
 *
 * @param   {import('zod').ZodSchema} schema
 * @returns {import('express').RequestHandler}
 */
const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    // Format Zod issues into a simple array clients can consume
    const errors = result.error.issues.map((issue) => ({
      field   : issue.path.join('.') || 'body',
      message : issue.message,
    }));
    const messageStr = 'Validation failed: ' + errors.map(e => e.message).join(', ');
    return next(new AppError(messageStr, 400, errors));
  }

  // Replace req.body with the parsed (coerced, stripped-extra-fields) value
  req.body = result.data;
  next();
};

module.exports = validate;
