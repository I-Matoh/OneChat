/**
 * Activity Service
 * 
 * Creates activity log entries for user actions across the application.
 * Stores activity records and optionally broadcasts to connected clients.
 */

/**
 * Log a user action to the activity feed.
 * Creates a database record and emits WebSocket event to the actor.
 */
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
