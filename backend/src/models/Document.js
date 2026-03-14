const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title:         { type: String, required: true, default: 'Untitled' },
  content:       { type: String, default: '' },
  collaborators: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  versions: [{
    content:   String,
    editedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
