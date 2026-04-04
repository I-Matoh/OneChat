const Notification = require('../models/Notification');

/**
 * Create a notification and push it via WebSocket.
 */
async function createNotification(io, userId, type, message, meta = {}) {
  try {
    const notif = await Notification.create({ userId, type, message, meta });
    io.to(`user:${userId}`).emit('notification:new', {
      _id: notif._id,
      type,
      message,
      meta,
      read: false,
      createdAt: notif.createdAt,
    });
  } catch (err) {
    console.error('Notification error:', err.message);
  }
}

module.exports = { createNotification };
