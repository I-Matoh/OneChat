const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  status: {
    type: String,
    enum: ['todo', 'in_progress', 'done', 'blocked'],
    default: 'todo',
  },
  assigneeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  dueDate: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sourceType: { type: String, default: 'manual' },
  sourceId: { type: String, default: '' },
}, { timestamps: true });

taskSchema.index({ workspaceId: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model('Task', taskSchema);
