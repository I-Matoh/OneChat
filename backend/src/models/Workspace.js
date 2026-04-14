/**
 * Workspace Model
 * 
 * MongoDB schema for workspaces - top-level containers for pages and tasks.
 * Each workspace has an owner and can have multiple members with different roles.
 * 
 * Roles hierarchy (rank ascending):
 *   - viewer: Read-only access
 *   - commenter: Can comment but not edit
 *   - editor: Can create and edit content
 *   - admin: Can manage members
 *   - owner: Full control including delete
 */

const mongoose = require('mongoose');

/**
 * Embedded schema for workspace members.
 * Stores user reference and their role in this workspace.
 */
const workspaceMemberSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: {
    type: String,
    enum: ['owner', 'admin', 'editor', 'commenter', 'viewer'],
    default: 'editor',
  },
}, { _id: false });

/**
 * Workspace document schema.
 * Indexed on ownerId and member userId for efficient queries.
 */
const workspaceSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  icon: { type: String, default: '🏢' },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  members: { type: [workspaceMemberSchema], default: [] },
}, { timestamps: true });

workspaceSchema.index({ ownerId: 1, updatedAt: -1 });
workspaceSchema.index({ 'members.userId': 1 });

module.exports = mongoose.model('Workspace', workspaceSchema);
