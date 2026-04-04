const mongoose = require('mongoose');

const workspaceMemberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: {
    type: String,
    enum: ['owner', 'admin', 'editor', 'commenter', 'viewer'],
    default: 'editor',
  },
}, { _id: false });

const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  members: { type: [workspaceMemberSchema], default: [] },
}, { timestamps: true });

workspaceSchema.index({ ownerId: 1, updatedAt: -1 });
workspaceSchema.index({ 'members.userId': 1 });

module.exports = mongoose.model('Workspace', workspaceSchema);
