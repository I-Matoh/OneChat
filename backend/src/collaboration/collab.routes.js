/**
 * Collaboration Routes
 * 
 * REST API for document management. Provides CRUD operations for
 * collaborative documents that can be edited in real-time via WebSocket.
 */

const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const Document = require('../models/Document');
const { getGlobalIo } = require('../websocket/socketServer');
const { logActivity } = require('../activity/activity.service');
const { AppError, asyncHandler } = require('../middleware/errors');
const { validateDocCreate, validateDocPatch } = require('../middleware/validate');

const router = Router();

/**
 * GET /docs
 * List documents where user is a collaborator.
 */
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const docs = await Document.find({ collaborators: req.user.id })
    .select('title updatedAt collaborators revision')
    .sort({ updatedAt: -1 });
  res.json(docs);
}));

/**
 * POST /docs
 * Create a new collaborative document.
 */
router.post('/', authMiddleware, validateDocCreate, asyncHandler(async (req, res) => {
  const { title, content } = req.body;
  const doc = await Document.create({
    title: title || 'Untitled',
    content: content || '',
    revision: 0,
    collaborators: [req.user.id],
  });
  await logActivity(getGlobalIo(), {
    actorId: req.user.id,
    type: 'document_created',
    message: `Created document "${doc.title}"`,
    meta: { docId: doc._id.toString() },
  });
  res.status(201).json(doc);
}));

/**
 * GET /docs/:id
 * Get a single document by ID.
 */
router.get('/:id', authMiddleware, asyncHandler(async (req, res) => {
  const doc = await Document.findOne({
    _id: req.params.id,
    collaborators: req.user.id,
  }).populate('collaborators', 'name email status');
  if (!doc) throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
  await logActivity(getGlobalIo(), {
    actorId: req.user.id,
    type: 'document_updated',
    message: `Updated document "${doc.title}"`,
    meta: { docId: doc._id.toString() },
  });
  res.json(doc);
}));

/**
 * PATCH /docs/:id
 * Update document title or content.
 */
router.patch('/:id', authMiddleware, validateDocPatch, asyncHandler(async (req, res) => {
  const updates = {};
  if (typeof req.body.title === 'string') updates.title = req.body.title.trim() || 'Untitled';
  if (typeof req.body.content === 'string') updates.content = req.body.content;
  if (typeof req.body.revision === 'number') updates.revision = req.body.revision;

  const doc = await Document.findOneAndUpdate(
    { _id: req.params.id, collaborators: req.user.id },
    { $set: updates },
    { new: true }
  ).populate('collaborators', 'name email status');

  if (!doc) throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
  res.json(doc);
}));

module.exports = router;
