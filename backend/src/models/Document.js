const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title:         { type: String, required: true, default: 'Untitled' },
  content:       { type: String, default: '' },
  revision:      { type: Number, default: 0 },
  collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  versions: [{
    content:   String,
    editedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    revision:  { type: Number, default: 0 },
    timestamp: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
