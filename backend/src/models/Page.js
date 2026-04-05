/**
 * Page Model
 * 
 * Represents pages within a workspace - hierarchical content units
 * that can contain arbitrary text content. Supports tree structure
 * via parentId field for organizing pages into folders.
 */

const mongoose = require('mongoose');

const pageSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page', default: null },
  title: { type: String, required: true, trim: true, default: 'Untitled' },
  icon: { type: String, default: 'doc' },
  content: { type: String, default: '' },
  order: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

pageSchema.index({ workspaceId: 1, parentId: 1, order: 1, updatedAt: -1 });

module.exports = mongoose.model('Page', pageSchema);
