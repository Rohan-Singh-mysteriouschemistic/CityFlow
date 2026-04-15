const logger  = require('../config/logger');
const AppError = require('../utils/AppError');

/**
 * Global Express error-handling middleware.
 * Must be registered AFTER all routes in index.js with four arguments.
 *
 * Handles:
 *  - AppError  (operational, expected HTTP errors)
 *  - Zod parse failures forwarded via validate() middleware
 *  - JWT / MySQL errors mapped to friendly messages
 *  - Unexpected crashes (500)
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  // ── Defaults ──────────────────────────────────────────────────────────────
  let statusCode = err.statusCode || 500;
  let message    = err.message    || 'Internal Server Error';
  let errors     = err.errors     || null;

  // ── Map well-known library errors ────────────────────────────────────────
  // MySQL duplicate entry
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    message    = 'A record with that value already exists.';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message    = 'Invalid token. Please log in again.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message    = 'Your session has expired. Please log in again.';
  }

  // ── Log ───────────────────────────────────────────────────────────────────
  const logPayload = {
    statusCode,
    method  : req.method,
    url     : req.originalUrl,
    user_id : req.user?.user_id || null,
  };

  if (statusCode >= 500) {
    logger.error(message, { ...logPayload, stack: err.stack });
  } else {
    logger.warn(message, logPayload);
  }

  // ── Respond ───────────────────────────────────────────────────────────────
  const body = { status: statusCode >= 500 ? 'error' : 'fail', message };
  if (errors) body.errors = errors;

  // In production, hide stack traces from clients
  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
};

module.exports = errorHandler;
