const Activity = require('../models/Activity');

async function logActivity(io, payload) {
  try {
    const activity = await Activity.create({
      actorId: payload.actorId,
      workspaceId: payload.workspaceId || null,
      type: payload.type,
      message: payload.message,
      meta: payload.meta || {},
    });

    if (io && payload.actorId) {
      io.to(`user:${payload.actorId}`).emit('activity:new', activity);
    }

    return activity;
  } catch {
    return null;
  }
}

module.exports = { logActivity };
