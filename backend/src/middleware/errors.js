/**
 * Error Handling Middleware
 * 
 * Centralized error handling for Express applications. Provides:
 *   - Custom error class with status codes and error codes
 *   - Async route handler wrapper to catch promise rejections
 *   - 404 handler for undefined routes
 *   - Centralized error response formatter
 */

/**
 * Custom application error with HTTP status and error codes.
 * Use for domain-specific errors that need specific handling.
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

/**
 * Wrapper for async route handlers.
 * Catches rejected promises and forwards to error middleware.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler for unmatched routes.
 * Creates a descriptive error for unknown endpoints.
 */
function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND'));
}

/**
 * Central error handler.
 * Formats errors into consistent JSON response structure.
 * Hides internal error details for 5xx errors for security.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const statusCode = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const code = typeof err.code === 'string' ? err.code : (statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  const message = statusCode >= 500 ? 'Internal server error' : (err.message || 'Request failed');

  return res.status(statusCode).json({
    error: {
      code,
      message,
      details: err.details || null,
      requestId: req.requestId || null,
    },
  });
}

module.exports = {
  AppError,
  asyncHandler,
  notFoundHandler,
  errorHandler,
};

