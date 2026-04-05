/**
 * Rate Limiter Middleware
 * 
 * Redis-backed sliding-window rate limiter to protect against:
 *   - Brute force attacks on login/registration endpoints
 *   - Denial of Service (DoS) attacks
 *   - API abuse and excessive request volumes
 * 
 * How it works:
 *   - Uses Redis INCR to atomically increment a counter
 *   - The counter key is scoped to IP address + request path
 *   - Each unique IP+path combination gets its own limit window
 *   - The key expires after the window period (auto-cleanup)
 * 
 * Security considerations:
 *   - Default: 30 requests per minute per IP/path
 *   - Falls back to allowing requests if Redis is unavailable
 *     (fail-open to prevent complete service outage)
 *   - Consider adjusting limits based on endpoint sensitivity
 * 
 * @param {number} windowMs - Time window in milliseconds (default: 60000 = 1 min)
 * @param {number} maxHits   - Maximum requests allowed in window (default: 30)
 */

const { getRedis } = require('../config/redis');
const { AppError } = require('./errors');

function rateLimiter(windowMs = 60000, maxHits = 30) {
  return async (req, res, next) => {
    try {
      const redis = getRedis();
      const key = `rl:${req.ip}:${req.path}`;
      const current = await redis.incr(key);
      if (current === 1) await redis.pexpire(key, windowMs);
      if (current > maxHits) {
        return next(new AppError('Too many requests', 429, 'RATE_LIMITED'));
      }
      next();
    } catch {
      next();
    }
  };
}

module.exports = { rateLimiter };
