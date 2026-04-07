/**
 * Page Model
 * 
 * Represents pages within a workspace - hierarchical content units
 * that can contain arbitrary text content. Supports tree structure
 * via parentId field for organizing pages into folders.
 */

const mongoose = require('mongoose');

const pageMentionSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['user', 'page', 'document'], required: true },
  refId: { type: String, required: true },
  label: { type: String, required: true },
}, { _id: false });

const pageBlockSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['paragraph', 'heading', 'checklist', 'quote', 'code', 'toggle'], default: 'paragraph' },
  text: { type: String, default: '' },
  checked: { type: Boolean, default: false },
  collapsed: { type: Boolean, default: false },
  level: { type: Number, default: 1 },
  language: { type: String, default: '' },
  order: { type: Number, default: 0 },
  mentions: { type: [pageMentionSchema], default: [] },
}, { _id: false });

const pageCommentReplySchema = new mongoose.Schema({
  id: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const pageCommentThreadSchema = new mongoose.Schema({
  id: { type: String, required: true },
  blockId: { type: String, required: true },
  selectedText: { type: String, default: '' },
  resolved: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  replies: { type: [pageCommentReplySchema], default: [] },
}, { _id: false });

const pageSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Page', default: null },
  title: { type: String, required: true, trim: true, default: 'Untitled' },
  icon: { type: String, default: 'doc' },
  content: { type: String, default: '' },
  blocks: { type: [pageBlockSchema], default: [] },
  commentThreads: { type: [pageCommentThreadSchema], default: [] },
  order: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

pageSchema.index({ workspaceId: 1, parentId: 1, order: 1, updatedAt: -1 });

module.exports = mongoose.model('Page', pageSchema);
