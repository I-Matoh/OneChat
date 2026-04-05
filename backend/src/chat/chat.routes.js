/**
 * Chat Routes
 * 
 * REST API endpoints for conversation and message management.
 * Handles conversation CRUD and paginated message retrieval.
 */

const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { getGlobalIo } = require('../websocket/socketServer');
const { logActivity } = require('../activity/activity.service');
const { AppError, asyncHandler } = require('../middleware/errors');
const { validateConversationCreate } = require('../middleware/validate');

const router = Router();

/**
 * GET /chat/conversations
 * List all conversations for the authenticated user.
 */
router.get('/conversations', authMiddleware, asyncHandler(async (req, res) => {
  const convs = await Conversation.find({ participants: req.user.id })
    .populate('participants', 'name email status')
    .sort({ updatedAt: -1 });
  res.json(convs);
}));

/**
 * POST /chat/conversations
 * Create a new conversation with specified participants.
 */
router.post('/conversations', authMiddleware, validateConversationCreate, asyncHandler(async (req, res) => {
  const { participantIds, name } = req.body;
  const participants = [req.user.id, ...(participantIds || [])];
  const conv = await Conversation.create({ participants, name: name || '' });
  const populated = await conv.populate('participants', 'name email status');

  const io = getGlobalIo();
  if (io) {
    for (const participantId of participants) {
      io.to(`user:${participantId}`).emit('conversation:new', {
        ...populated.toObject(),
        createdBy: { _id: req.user.id, name: req.user.name },
      });
    }
  }

  await logActivity(io, {
    actorId: req.user.id,
    type: 'conversation_created',
    message: `Created conversation "${name || 'Conversation'}"`,
    meta: { conversationId: conv._id.toString() },
  });

  res.status(201).json(populated);
}));

/**
 * GET /chat/conversations/:id/messages
 * Get paginated messages for a conversation.
 */
router.get('/conversations/:id/messages', authMiddleware, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50;
  const skip = (page - 1) * limit;
  const conversation = await Conversation.findOne({ _id: id, participants: req.user.id });
  if (!conversation) throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');

  const messages = await Message.find({ conversationId: id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('senderId', 'name email');

  res.json(messages.reverse());
}));

module.exports = router;
