/**
 * Message Model
 * 
 * Chat messages within conversations. Each message belongs to
 * a conversation and has sender, content, and delivery status.
 * Status tracks the message lifecycle: sent -> delivered -> seen.
 */

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  conversationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
  senderId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:        { type: String, required: true },
  status:         { type: String, enum: ['sent', 'delivered', 'seen'], default: 'sent' },
  reactions:      { type: Array, default: [] },
}, { timestamps: true });

module.exports = mongoose.model('Message', messageSchema);
