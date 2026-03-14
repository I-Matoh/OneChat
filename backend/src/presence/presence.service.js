const { getRedis } = require('../config/redis');
const User = require('../models/User');

const HEARTBEAT_INTERVAL = 10000; // 10 seconds
const AWAY_THRESHOLD = 30000;     // 30 seconds
const OFFLINE_THRESHOLD = 60000;  // 60 seconds

function registerPresenceHandlers(io, socket) {
  const userId = socket.user.id;
  const userName = socket.user.name;

  // Set user online
  setPresence(io, userId, userName, 'online');

  // Heartbeat
  socket.on('presence:heartbeat', () => {
    setPresence(io, userId, userName, 'online');
  });

  // Explicit status update
  socket.on('presence:update', (data) => {
    setPresence(io, userId, userName, data.status || 'online');
  });

  // On disconnect
  socket.on('disconnect', () => {
    setPresence(io, userId, userName, 'offline');
  });
}

async function setPresence(io, userId, userName, status) {
  try {
    const redis = getRedis();
    const presenceData = JSON.stringify({ userId, userName, status, lastSeen: Date.now() });
    await redis.set(`presence:${userId}`, presenceData, 'EX', 120);
    await User.findByIdAndUpdate(userId, { status });
    io.emit('presence:update', { userId, userName, status });
  } catch {
    // Emit even if Redis fails
    io.emit('presence:update', { userId, userName, status });
  }
}

async function getOnlineUsers() {
  try {
    const redis = getRedis();
    const keys = await redis.keys('presence:*');
    const users = [];
    for (const key of keys) {
      const data = await redis.get(key);
      if (data) users.push(JSON.parse(data));
    }
    return users;
  } catch {
    return [];
  }
}

module.exports = { registerPresenceHandlers, getOnlineUsers };
