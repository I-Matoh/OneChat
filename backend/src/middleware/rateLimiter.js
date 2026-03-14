const { getRedis } = require('../config/redis');

/**
 * Redis-backed sliding-window rate limiter.
 * @param {number} windowMs  — window in milliseconds
 * @param {number} maxHits   — max requests per window
 */
function rateLimiter(windowMs = 60000, maxHits = 30) {
  return async (req, res, next) => {
    try {
      const redis = getRedis();
      const key = `rl:${req.ip}:${req.path}`;
      const current = await redis.incr(key);
      if (current === 1) await redis.pexpire(key, windowMs);
      if (current > maxHits) {
        return res.status(429).json({ error: 'Too many requests' });
      }
      next();
    } catch {
      // If Redis is down, allow the request through
      next();
    }
  };
}

module.exports = { rateLimiter };
