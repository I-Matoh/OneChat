/**
 * Conversation Model
 * 
 * Groups messages between participants. Represents a chat thread
 * that can be 1:1 or group conversation. Stores last message preview
 * for efficient list display.
 */

const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  name:         { type: String, default: '' },
  lastMessage:  { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);
