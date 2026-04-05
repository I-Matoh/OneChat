/**
 * Redis Client Factory
 * 
 * Creates and manages Redis client connections for the application.
 * Uses ioredis for robust Redis connectivity with retry logic.
 * 
 * Three separate clients are maintained:
 *   - redis: General purpose read/write operations
 *   - pub: Publisher for pub/sub messaging
 *   - sub: Subscriber for pub/sub messaging
 * 
 * This separation prevents blocking on pub/sub operations.
 */

const Redis = require('ioredis');
const { logger } = require('../logger');

let redis = null;
let pub = null;
let sub = null;

/**
 * Get or create the general-purpose Redis client.
 * Lazy-initialized on first access with automatic reconnection.
 */
function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
    });
    redis.on('connect', () => logger.info('Redis connected'));
    redis.on('error', (err) => logger.error({ err: err.message }, 'Redis error'));
  }
  return redis;
}

/**
 * Get or create a Redis client for publishing messages.
 * Used for pub/sub pattern to broadcast events across instances.
 */
function getPub() {
  if (!pub) {
    pub = new Redis(process.env.REDIS_URL);
    pub.on('error', (err) => logger.error({ err: err.message }, 'Redis pub error'));
  }
  return pub;
}

function getSub() {
  if (!sub) {
    sub = new Redis(process.env.REDIS_URL);
    sub.on('error', (err) => logger.error({ err: err.message }, 'Redis sub error'));
  }
  return sub;
}

module.exports = { getRedis, getPub, getSub };

