/**
 * Search Routes
 * 
 * Global search across multiple content types. Searches workspaces,
 * pages, conversations, and documents that the user has access to.
 * Uses regex matching for flexible search queries.
 */

const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const Conversation = require('../models/Conversation');
const Document = require('../models/Document');
const Workspace = require('../models/Workspace');
const Page = require('../models/Page');
const { AppError, asyncHandler } = require('../middleware/errors');

const router = Router();

/**
 * Escape special regex characters to prevent injection.
 */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * GET /search?q=query
 * Search across all accessible content types.
 */
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const rawQuery = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!rawQuery) {
    throw new AppError('q is required', 400, 'VALIDATION_ERROR');
  }

  const regex = new RegExp(escapeRegExp(rawQuery), 'i');
  const userId = req.user.id;

  const [conversations, documents, workspaces] = await Promise.all([
    Conversation.find({
      participants: userId,
      $or: [{ name: regex }, { lastMessage: regex }],
    }).select('name lastMessage updatedAt participants').limit(20),
    Document.find({
      collaborators: userId,
      $or: [{ title: regex }, { content: regex }],
    }).select('title updatedAt').limit(20),
    Workspace.find({
      $or: [{ ownerId: userId }, { 'members.userId': userId }],
      name: regex,
    }).select('name updatedAt').limit(20),
  ]);

  const workspaceIds = workspaces.map((item) => item._id);
  const pages = workspaceIds.length > 0
    ? await Page.find({
        workspaceId: { $in: workspaceIds },
        $or: [{ title: regex }, { content: regex }],
      }).select('title updatedAt workspaceId').limit(40)
    : [];

  res.json({
    query: rawQuery,
    results: {
      conversations,
      documents,
      workspaces,
      pages,
    },
  });
}));

module.exports = router;
