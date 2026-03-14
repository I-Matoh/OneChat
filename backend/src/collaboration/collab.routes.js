const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const Document = require('../models/Document');

const router = Router();

// List documents for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const docs = await Document.find({ collaborators: req.user.id })
      .select('title updatedAt collaborators')
      .sort({ updatedAt: -1 });
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a document
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, content } = req.body;
    const doc = await Document.create({
      title: title || 'Untitled',
      content: content || '',
      collaborators: [req.user.id],
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single document
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id).populate('collaborators', 'name email status');
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
