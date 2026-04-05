/**
 * Activity Model
 * 
 * Audit log for user actions across the application. Records who did what,
 * when, and in which workspace. Useful for debugging, analytics, and
 * activity feeds.
 */

const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null, index: true },
  type: { type: String, required: true, trim: true, index: true },
  message: { type: String, required: true, trim: true },
  meta: { type: Object, default: {} },
}, { timestamps: true });

activitySchema.index({ actorId: 1, createdAt: -1 });
activitySchema.index({ workspaceId: 1, createdAt: -1 });

module.exports = mongoose.model('Activity', activitySchema);
