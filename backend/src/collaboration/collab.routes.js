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
const DEFAULT_SYNC_MODE = process.env.DOC_SYNC_MODE === 'legacy' ? 'legacy' : 'crdt';

/**
 * GET /docs
 * List documents where user is a collaborator.
 */
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const docs = await Document.find({ collaborators: req.user.id })
    .select('title updatedAt collaborators revision syncMode crdtState.version')
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
    syncMode: DEFAULT_SYNC_MODE,
    crdtState: {
      version: 0,
      content: content || '',
    },
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
  const payload = doc.toObject();
  if (payload.syncMode === 'crdt') {
    payload.content = payload.crdtState?.content || payload.content || '';
    payload.revision = payload.crdtState?.version || payload.revision || 0;
  }
  res.json(payload);
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
  if (typeof req.body.content === 'string') {
    updates['crdtState.content'] = req.body.content;
  }
  if (typeof req.body.revision === 'number') {
    updates['crdtState.version'] = req.body.revision;
  }

  const doc = await Document.findOneAndUpdate(
    { _id: req.params.id, collaborators: req.user.id },
    { $set: updates },
    { new: true }
  ).populate('collaborators', 'name email status');

  if (!doc) throw new AppError('Document not found', 404, 'DOCUMENT_NOT_FOUND');
  const payload = doc.toObject();
  if (payload.syncMode === 'crdt') {
    payload.content = payload.crdtState?.content || payload.content || '';
    payload.revision = payload.crdtState?.version || payload.revision || 0;
  }
  res.json(payload);
}));

module.exports = router;
