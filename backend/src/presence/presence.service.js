/**
 * Presence Service
 * 
 * Manages user online/offline/away status via WebSocket heartbeats.
 * Uses Redis for distributed presence tracking across multiple server instances.
 * 
 * Status lifecycle: online -> away -> offline
 * Heartbeat interval: 10s, Away threshold: 30s, Offline threshold: 60s
 */

const { getRedis } = require('../config/redis');
const User = require('../models/User');

const HEARTBEAT_INTERVAL = 10000; // 10 seconds
const AWAY_THRESHOLD = 30000; // 30 seconds
const OFFLINE_THRESHOLD = 60000; // 60 seconds
let monitorStarted = false;

/**
 * Scan all presence keys from Redis.
 * Uses Redis SCAN for efficient key iteration without blocking.
 */
async function scanPresenceKeys(redis) {
  const keys = [];
  let cursor = '0';
  do {
    const [nextCursor, batch] = await redis.scan(cursor, 'MATCH', 'presence:*', 'COUNT', 100);
    cursor = nextCursor;
    if (Array.isArray(batch) && batch.length > 0) {
      keys.push(...batch);
    }
  } while (cursor !== '0');
  return keys;
}

/**
 * Register presence handlers for a connected socket.
 * Sets up heartbeat listeners and presence status tracking.
 */
function registerPresenceHandlers(io, socket) {
  const userId = socket.user.id;
  const userName = socket.user.name;

  startPresenceMonitor(io);

  setPresence(io, userId, userName, 'online');

  socket.on('presence:heartbeat', () => {
    setPresence(io, userId, userName, 'online');
  });

  socket.on('presence:update', (data) => {
    setPresence(io, userId, userName, data.status || 'online');
  });

  socket.on('disconnect', () => {
    setPresence(io, userId, userName, 'offline');
  });
}

/**
 * Update user presence status in Redis and broadcast to all clients.
 * Stores presence data with TTL for automatic cleanup.
 */
async function setPresence(io, userId, userName, status) {
  try {
    const redis = getRedis();
    const presenceData = JSON.stringify({ userId, userName, status, lastSeen: Date.now() });
    await redis.set(`presence:${userId}`, presenceData, 'EX', 120);
    await User.findByIdAndUpdate(userId, { status });
    io.emit('presence:update', { userId, userName, status });
  } catch {
    io.emit('presence:update', { userId, userName, status });
  }
}

/**
 * Start the background presence monitor.
 * Periodically checks all presence keys and updates status based on last heartbeat.
 * Only one monitor instance runs per process.
 */
function startPresenceMonitor(io) {
  if (monitorStarted) return;
  monitorStarted = true;

  setInterval(async () => {
    try {
      const redis = getRedis();
      const keys = await scanPresenceKeys(redis);
      const now = Date.now();

      for (const key of keys) {
        const raw = await redis.get(key);
        if (!raw) continue;

        const data = JSON.parse(raw);
        const elapsed = now - data.lastSeen;
        let nextStatus = 'online';

        if (elapsed >= OFFLINE_THRESHOLD) {
          nextStatus = 'offline';
        } else if (elapsed >= AWAY_THRESHOLD) {
          nextStatus = 'away';
        }

        if (nextStatus !== data.status) {
          await setPresence(io, data.userId, data.userName, nextStatus);
        }
      }
    } catch {
      // Presence should degrade gracefully if Redis is unavailable.
    }
  }, HEARTBEAT_INTERVAL);
}

async function getOnlineUsers() {
  try {
    const redis = getRedis();
    const keys = await scanPresenceKeys(redis);
    const users = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (!data) continue;
      const parsed = JSON.parse(data);
      if (parsed.status !== 'offline') users.push(parsed);
    }
    return users;
  } catch {
    return [];
  }
}

module.exports = { registerPresenceHandlers, getOnlineUsers };

