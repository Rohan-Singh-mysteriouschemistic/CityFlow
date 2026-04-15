/**
 * AppError — operational errors with a known HTTP status code.
 * Throw this anywhere in controllers/middleware instead of manual res.status().
 *
 * Usage:
 *   throw new AppError('Zone not found', 404);
 *   throw new AppError('Validation failed', 400, zodIssues);
 */
class AppError extends Error {
  /**
   * @param {string}  message    Human-readable error message
   * @param {number}  statusCode HTTP status code (default 500)
   * @param {Array}   [errors]   Optional structured error list (e.g. Zod issues)
   */
  constructor(message, statusCode = 500, errors = null) {
    super(message);
    this.statusCode  = statusCode;
    this.status      = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.isOperational = true;   // distinguishes our errors from unexpected crashes
    this.errors      = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
