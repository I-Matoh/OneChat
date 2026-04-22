/**
 * Conversation Model
 * 
 * Groups messages between participants. Represents a chat thread
 * that can be 1:1 or group conversation. Stores last message preview
 * for efficient list display.
 */

const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  workspaceId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', index: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  name:         { type: String, default: '' },
  lastMessage:  { type: String, default: '' },
  type:         { type: String, enum: ['dm', 'channel'], default: 'channel' },
  unreadCounts: { type: Map, of: Number, default: {} },
}, { timestamps: true });

// Fast lookup for existing DMs between two users in a workspace
conversationSchema.index({ type: 1, workspaceId: 1, participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
