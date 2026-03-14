const Redis = require('ioredis');

let redis = null;
let pub = null;
let sub = null;

function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
    });
    redis.on('connect', () => console.log('✅ Redis connected'));
    redis.on('error', (err) => console.error('❌ Redis error:', err.message));
  }
  return redis;
}

function getPub() {
  if (!pub) {
    pub = new Redis(process.env.REDIS_URL);
    pub.on('error', (err) => console.error('❌ Redis pub error:', err.message));
  }
  return pub;
}

function getSub() {
  if (!sub) {
    sub = new Redis(process.env.REDIS_URL);
    sub.on('error', (err) => console.error('❌ Redis sub error:', err.message));
  }
  return sub;
}

module.exports = { getRedis, getPub, getSub };
