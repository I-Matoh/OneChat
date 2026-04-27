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
const { getWorkspaceForUser, normalizeId } = require('../workspace/workspace.access');
const { getGlobalIo } = require('../websocket/socketServer');
const { logActivity } = require('../activity/activity.service');
const { AppError, asyncHandler } = require('../middleware/errors');
const { validateConversationCreate } = require('../middleware/validate');

const router = Router();

function getWorkspaceMemberIds(workspace) {
  const memberIds = new Set([normalizeId(workspace.ownerId)]);
  for (const member of workspace.members || []) {
    memberIds.add(normalizeId(member.userId));
  }
  return memberIds;
}

/**
 * GET /chat/conversations
 * List all conversations for the authenticated user.
 * Supports workspace-scoped or global (standalone) conversations.
 */
router.get('/conversations', authMiddleware, asyncHandler(async (req, res) => {
  let filter = { participants: req.user.id };
  if (req.query.workspaceId) {
    const workspace = await getWorkspaceForUser(req.query.workspaceId, req.user.id);
    if (!workspace) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    filter = { workspaceId: req.query.workspaceId, participants: req.user.id };
  }

  const convs = await Conversation.find(filter)
    .populate('participants', 'name email status')
    .sort({ updatedAt: -1 });
  res.json(convs);
}));

/**
 * POST /chat/conversations
 * Create a new conversation with specified participants.
 */
router.post('/conversations', authMiddleware, validateConversationCreate, asyncHandler(async (req, res) => {
  const { participantIds, name, workspaceId, type } = req.body;

  let workspaceMemberIds = null;
  if (workspaceId) {
    const workspace = await getWorkspaceForUser(workspaceId, req.user.id);
    if (!workspace) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    workspaceMemberIds = getWorkspaceMemberIds(workspace);

    const requestedParticipantIds = (participantIds || []).map(normalizeId);
    const invalidParticipantIds = requestedParticipantIds.filter((id) => !workspaceMemberIds.has(id));
    if (invalidParticipantIds.length) {
      throw new AppError('All participants must belong to the workspace', 400, 'VALIDATION_ERROR');
    }
  }

  const participantSet = new Set([
    normalizeId(req.user.id),
    ...(participantIds || []).map(normalizeId),
  ]);
  const participants = [...participantSet];

  // Auto-detect type: exactly 2 participants = DM, otherwise channel
  const convType = type || (participants.length === 2 ? 'dm' : 'channel');

  const convData = {
    participants,
    name: name || '',
    type: convType,
  };
  if (workspaceId) convData.workspaceId = workspaceId;

  const conv = await Conversation.create(convData);
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

  if (workspaceId) {
    await logActivity(io, {
      actorId: req.user.id,
      workspaceId,
      type: 'conversation_created',
      message: `Created conversation "${name || 'Conversation'}"`,
      meta: { conversationId: conv._id.toString(), workspaceId: normalizeId(workspaceId) },
    });
  }

  res.status(201).json(populated);
}));

/**
 * POST /chat/conversations/dm/:userId
 * Find or create a DM conversation with the specified user.
 * Race-condition safe: queries DB before creating.
 */
router.post('/conversations/dm/:userId', authMiddleware, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { workspaceId } = req.body;

  if (workspaceId) {
    const workspace = await getWorkspaceForUser(workspaceId, req.user.id);
    if (!workspace) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');

    const workspaceMemberIds = getWorkspaceMemberIds(workspace);
    if (!workspaceMemberIds.has(normalizeId(userId))) {
      throw new AppError('Target user is not a workspace member', 400, 'VALIDATION_ERROR');
    }
  }

  const myId = normalizeId(req.user.id);
  const targetId = normalizeId(userId);

  // Build query for existing DM (workspace-scoped or global)
  const existingQuery = {
    type: 'dm',
    participants: { $all: [myId, targetId], $size: 2 },
  };
  if (workspaceId) existingQuery.workspaceId = workspaceId;
  else existingQuery.workspaceId = { $exists: false };

  const existing = await Conversation.findOne(existingQuery)
    .populate('participants', 'name email status');

  if (existing) {
    return res.json(existing);
  }

  // Create new DM
  const convData = {
    participants: [myId, targetId],
    name: '',
    type: 'dm',
  };
  if (workspaceId) convData.workspaceId = workspaceId;

  const conv = await Conversation.create(convData);
  const populated = await conv.populate('participants', 'name email status');

  const io = getGlobalIo();
  if (io) {
    for (const pid of [myId, targetId]) {
      io.to(`user:${pid}`).emit('conversation:new', {
        ...populated.toObject(),
        createdBy: { _id: req.user.id, name: req.user.name },
      });
    }
  }

  res.status(201).json(populated);
}));

/**
 * POST /chat/conversations/:id/join
 * Join a workspace conversation as the current user.
 */
router.post('/conversations/:id/join', authMiddleware, asyncHandler(async (req, res) => {
  const conversation = await Conversation.findById(req.params.id);
  if (!conversation) throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');

  // Workspace-scoped conversations require workspace membership
  if (conversation.workspaceId) {
    const workspace = await getWorkspaceForUser(conversation.workspaceId, req.user.id);
    if (!workspace) throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  const userId = normalizeId(req.user.id);
  const hasParticipant = (conversation.participants || []).some((participantId) => normalizeId(participantId) === userId);
  if (!hasParticipant) {
    conversation.participants.push(req.user.id);
    await conversation.save();
  }

  const populated = await conversation.populate('participants', 'name email status');
  res.json(populated);
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
  if (!conversation) throw new AppError('Join the channel first', 403, 'CHAT_JOIN_REQUIRED');

  const messages = await Message.find({ conversationId: id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('senderId', 'name email');

  res.json(messages.reverse());
}));

/**
 * POST /chat/messages
 * Create a new message (alternative to socket).
 */
router.post('/messages', authMiddleware, asyncHandler(async (req, res) => {
  const { conversationId, content } = req.body;
  if (!conversationId || !content?.trim()) {
    throw new AppError('conversationId and content are required', 400, 'VALIDATION_ERROR');
  }

  const conv = await Conversation.findOne({ _id: conversationId, participants: req.user.id });
  if (!conv) throw new AppError('Conversation not found', 404, 'CONVERSATION_NOT_FOUND');

  const msg = await Message.create({
    conversationId,
    senderId: req.user.id,
    content: content.trim(),
  });

  // Increment unread counts for all participants except sender
  const unreadInc = {};
  for (const pid of conv.participants) {
    const pidStr = normalizeId(pid);
    if (pidStr !== normalizeId(req.user.id)) {
      unreadInc[`unreadCounts.${pidStr}`] = 1;
    }
  }

  await Conversation.findByIdAndUpdate(conversationId, {
    lastMessage: content.trim(),
    updatedAt: Date.now(),
    $inc: unreadInc,
  });

  const io = getGlobalIo();
  if (io) {
    io.to(`chat:${conversationId}`).emit('message:new', {
      _id: msg._id,
      conversationId,
      senderId: req.user.id,
      senderName: req.user.name,
      content: content.trim(),
      createdAt: msg.createdAt,
      status: 'sent',
    });
  }

  res.status(201).json(msg);
}));

/**
 * POST /chat/messages/:messageId/reactions
 * Toggle a reaction on a message.
 */
router.post('/messages/:messageId/reactions', authMiddleware, asyncHandler(async (req, res) => {
  const { emoji } = req.body;
  if (!emoji) throw new AppError('Emoji is required', 400, 'VALIDATION_ERROR');

  const msg = await Message.findById(req.params.messageId);
  if (!msg) throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');

  const userId = req.user.id;
  const reactions = msg.reactions || [];
  
  // Check if user already reacted with this emoji
  const existingIndex = reactions.findIndex(r => r.emoji === emoji && normalizeId(r.userId) === normalizeId(userId));
  
  if (existingIndex > -1) {
    // Remove reaction
    reactions.splice(existingIndex, 1);
  } else {
    // Add reaction
    reactions.push({ emoji, userId, userName: req.user.name });
  }

  msg.reactions = reactions;
  await msg.save();

  const io = getGlobalIo();
  if (io) {
    io.to(`chat:${msg.conversationId}`).emit('message:updated', {
      _id: msg._id,
      reactions: msg.reactions,
    });
  }

  res.json(msg);
}));

/**
 * PATCH /chat/messages/:messageId
 * Update message (e.g., content).
 */
router.patch('/messages/:messageId', authMiddleware, asyncHandler(async (req, res) => {
  const msg = await Message.findById(req.params.messageId);
  if (!msg) throw new AppError('Message not found', 404, 'MESSAGE_NOT_FOUND');

  if (req.body.content !== undefined) {
    msg.content = req.body.content;
  }

  await msg.save();

  const io = getGlobalIo();
  if (io) {
    io.to(`chat:${msg.conversationId}`).emit('message:updated', {
      _id: msg._id,
      content: msg.content,
    });
  }

  res.json(msg);
}));

module.exports = router;
