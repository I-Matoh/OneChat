/**
 * Document Model
 * 
 * Collaborative document with version history. Supports real-time
 * editing by multiple users with conflict detection. Maintains array
 * of versions for history and rollback capability.
 */

const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title:         { type: String, required: true, default: 'Untitled' },
  content:       { type: String, default: '' },
  revision:      { type: Number, default: 0 },
  syncMode:      { type: String, enum: ['legacy', 'crdt'], default: 'legacy', index: true },
  crdtState: {
    version: { type: Number, default: 0 },
    content: { type: String, default: '' },
  },
  collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  versions: [{
    content:   String,
    editedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    revision:  { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
