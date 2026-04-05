/**
 * Notification Model
 * 
 * User-facing notifications for events like new messages, mentions,
 * and document edits. Each notification is scoped to a user and
 * includes metadata for linking to the source event.
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type:    { type: String, enum: ['message', 'mention', 'doc_edit', 'system'], required: true },
  message: { type: String, required: true },
  read:    { type: Boolean, default: false },
  meta:    { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
