const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  name:         { type: String, default: '' },
  lastMessage:  { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Conversation', conversationSchema);
