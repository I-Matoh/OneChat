/**
 * Workspace Routes
 * 
 * REST API for workspace management. Handles CRUD for workspaces,
 * pages within workspaces, and member management with role-based access.
 */

const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const {
  validateWorkspaceCreate,
  validatePageCreate,
  validatePagePatch,
  validateWorkspaceMemberCreate,
  validateWorkspaceMemberPatch,
} = require('../middleware/validate');
const Workspace = require('../models/Workspace');
const Page = require('../models/Page');
const User = require('../models/User');
const { getGlobalIo } = require('../websocket/socketServer');
const { logActivity } = require('../activity/activity.service');
const { createNotification } = require('../notifications/notification.service');
const {
  normalizeId,
  hasRole,
  getRoleForUser,
  workspaceFilterForUser,
  getWorkspaceForUser,
} = require('./workspace.access');
const { AppError, asyncHandler } = require('../middleware/errors');
const {
  normalizeBlocks,
  blocksToPlainText,
  normalizeThread,
  normalizeReply,
  collectUserMentionIds,
} = require('./page.editor');

const router = Router();

function serializePage(page) {
  const source = typeof page?.toObject === 'function' ? page.toObject() : page;
  const blocks = normalizeBlocks(page.blocks, page.content);
  return {
    ...source,
    blocks,
    content: typeof page.content === 'string' && page.content.trim()
      ? page.content
      : blocksToPlainText(blocks),
    commentThreads: Array.isArray(page.commentThreads) ? page.commentThreads : [],
  };
}

function getNewMentionedUserIds(previousBlocks, nextBlocks, actorId) {
  const previousIds = collectUserMentionIds(previousBlocks);
  const nextIds = collectUserMentionIds(nextBlocks);
  return [...nextIds].filter((userId) => !previousIds.has(userId) && normalizeId(userId) !== normalizeId(actorId));
}

/**
 * GET /workspaces
 * List all workspaces the user has access to.
 */
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const workspaces = await Workspace.find(workspaceFilterForUser(req.user.id))
    .sort({ updatedAt: -1 })
    .select('name ownerId members createdAt updatedAt');
  res.json(workspaces);
}));

/**
 * POST /workspaces
 * Create a new workspace. Creator becomes owner.
 */
router.post('/', authMiddleware, validateWorkspaceCreate, asyncHandler(async (req, res) => {
  const name = req.body.name.trim();

  const workspace = await Workspace.create({
    name,
    description: req.body.description || '',
    icon: req.body.icon || '🏢',
    ownerId: req.user.id,
    members: [{ userId: req.user.id, role: 'owner' }],
  });

  await logActivity(getGlobalIo(), {
    actorId: req.user.id,
    workspaceId: workspace._id,
    type: 'workspace_created',
    message: `Created workspace "${workspace.name}"`,
    meta: { workspaceId: workspace._id.toString() },
  });

  res.status(201).json(workspace);
}));

/**
 * PATCH /workspaces/:workspaceId
 * Update a workspace.
 */
router.patch('/:workspaceId', authMiddleware, asyncHandler(async (req, res) => {
  const workspace = await getWorkspaceForUser(req.params.workspaceId, req.user.id);
  if (!workspace) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
  if (!hasRole(workspace, req.user.id, 'editor')) {
    throw new AppError('Insufficient role for workspace update', 403, 'INSUFFICIENT_ROLE');
  }

  const updates = {};
  if (typeof req.body.name === 'string') updates.name = req.body.name.trim();
  if (typeof req.body.description === 'string') updates.description = req.body.description;
  if (typeof req.body.icon === 'string') updates.icon = req.body.icon;

  const updated = await Workspace.findByIdAndUpdate(workspace._id, { $set: updates }, { new: true });
  res.json(updated);
}));

/**
 * DELETE /workspaces/:workspaceId
 * Delete a workspace.
 */
router.delete('/:workspaceId', authMiddleware, asyncHandler(async (req, res) => {
  const workspace = await getWorkspaceForUser(req.params.workspaceId, req.user.id);
  if (!workspace) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
  if (!hasRole(workspace, req.user.id, 'owner')) {
    throw new AppError('Only owner can delete workspace', 403, 'INSUFFICIENT_ROLE');
  }

  await Workspace.findByIdAndDelete(workspace._id);
  res.json({ success: true });
}));

router.get('/:workspaceId/pages', authMiddleware, asyncHandler(async (req, res) => {
  const workspace = await getWorkspaceForUser(req.params.workspaceId, req.user.id);
  if (!workspace || !hasRole(workspace, req.user.id, 'viewer')) {
    throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
  }

  const pages = await Page.find({ workspaceId: workspace._id })
    .sort({ parentId: 1, order: 1, updatedAt: -1 });
  res.json(pages.map(serializePage));
}));

router.get('/pages/:pageId', authMiddleware, asyncHandler(async (req, res) => {
  const page = await Page.findById(req.params.pageId);
  if (!page) throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND');

  const workspace = await getWorkspaceForUser(page.workspaceId, req.user.id);
  if (!workspace || !hasRole(workspace, req.user.id, 'viewer')) {
    throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  }

  res.json(serializePage(page));
}));

router.post('/:workspaceId/pages', authMiddleware, validatePageCreate, asyncHandler(async (req, res) => {
  const workspace = await getWorkspaceForUser(req.params.workspaceId, req.user.id);
  if (!workspace) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
  if (!hasRole(workspace, req.user.id, 'editor')) {
    throw new AppError('Insufficient role for page creation', 403, 'INSUFFICIENT_ROLE');
  }

  const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
  const parentId = req.body?.parentId || null;
  const blocks = normalizeBlocks(req.body?.blocks, req.body?.content || '');
  const content = typeof req.body?.content === 'string' && req.body.content.trim()
    ? req.body.content
    : blocksToPlainText(blocks);

  const lastPage = await Page.findOne({
    workspaceId: workspace._id,
    parentId: parentId || null,
  }).sort({ order: -1 }).select('order');

  const page = await Page.create({
    workspaceId: workspace._id,
    parentId: parentId || null,
    title: title || 'Untitled',
    content,
    blocks,
    order: (lastPage?.order || 0) + 1,
    createdBy: req.user.id,
    updatedBy: req.user.id,
  });

  await logActivity(getGlobalIo(), {
    actorId: req.user.id,
    workspaceId: workspace._id,
    type: 'page_created',
    message: `Created page "${page.title}"`,
    meta: { pageId: page._id.toString() },
  });

  res.status(201).json(serializePage(page));
}));

router.patch('/pages/:pageId', authMiddleware, validatePagePatch, asyncHandler(async (req, res) => {
  const page = await Page.findById(req.params.pageId);
  if (!page) throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND');

  const workspace = await getWorkspaceForUser(page.workspaceId, req.user.id);
  if (!workspace) throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  if (!hasRole(workspace, req.user.id, 'editor')) {
    throw new AppError('Insufficient role for page update', 403, 'INSUFFICIENT_ROLE');
  }

  const updates = { updatedBy: req.user.id };
  if (typeof req.body?.title === 'string') updates.title = req.body.title.trim() || 'Untitled';
  if (typeof req.body?.icon === 'string') updates.icon = req.body.icon;
  if (typeof req.body?.order === 'number') updates.order = req.body.order;
  if (req.body?.parentId !== undefined) updates.parentId = req.body.parentId || null;
  if (req.body?.blocks !== undefined) {
    updates.blocks = normalizeBlocks(req.body.blocks, req.body.content || page.content || '');
    updates.content = typeof req.body?.content === 'string' && req.body.content.trim()
      ? req.body.content
      : blocksToPlainText(updates.blocks);
  } else if (typeof req.body?.content === 'string') {
    updates.content = req.body.content;
    updates.blocks = normalizeBlocks(page.blocks, req.body.content);
  }

  const updated = await Page.findByIdAndUpdate(page._id, { $set: updates }, { new: true });
  const newMentionedUserIds = getNewMentionedUserIds(page.blocks || [], updates.blocks || page.blocks || [], req.user.id);

  await Promise.all(newMentionedUserIds.map((userId) => createNotification(
    getGlobalIo(),
    userId,
    'mention',
    `${req.user.name} mentioned you in page "${updated.title}"`,
    { pageId: normalizeId(updated._id), workspaceId: normalizeId(updated.workspaceId), type: 'page' }
  )));

  await logActivity(getGlobalIo(), {
    actorId: req.user.id,
    workspaceId: page.workspaceId,
    type: 'page_updated',
    message: `Updated page "${updated.title}"`,
    meta: { pageId: updated._id.toString() },
  });
  res.json(serializePage(updated));
}));

router.delete('/pages/:pageId', authMiddleware, asyncHandler(async (req, res) => {
  const page = await Page.findById(req.params.pageId);
  if (!page) throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND');

  const workspace = await getWorkspaceForUser(page.workspaceId, req.user.id);
  if (!workspace) throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  if (!hasRole(workspace, req.user.id, 'editor')) {
    throw new AppError('Insufficient role for page delete', 403, 'INSUFFICIENT_ROLE');
  }

  await Page.deleteMany({
    $or: [
      { _id: page._id },
      { parentId: page._id },
    ],
  });

  await logActivity(getGlobalIo(), {
    actorId: req.user.id,
    workspaceId: page.workspaceId,
    type: 'page_deleted',
    message: 'Deleted page',
    meta: { pageId: page._id.toString() },
  });

  res.json({ success: true, pageId: normalizeId(page._id) });
}));

router.post('/pages/:pageId/comments', authMiddleware, asyncHandler(async (req, res) => {
  const page = await Page.findById(req.params.pageId);
  if (!page) throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND');

  const workspace = await getWorkspaceForUser(page.workspaceId, req.user.id);
  if (!workspace) throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  if (!hasRole(workspace, req.user.id, 'commenter')) {
    throw new AppError('Insufficient role for comments', 403, 'INSUFFICIENT_ROLE');
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const blockId = typeof req.body?.blockId === 'string' ? req.body.blockId.trim() : '';
  if (!message || !blockId) {
    throw new AppError('Comment message and blockId are required', 400, 'VALIDATION_ERROR');
  }

  const thread = normalizeThread({
    blockId,
    selectedText: req.body?.selectedText,
    createdBy: req.user.id,
    replies: [{ userId: req.user.id, message }],
  });

  const existingThreads = Array.isArray(page.commentThreads) ? page.commentThreads : [];
  const updated = await Page.findByIdAndUpdate(page._id, {
    $set: { commentThreads: [...existingThreads, thread], updatedBy: req.user.id },
  }, { new: true });

  const mentionUserIds = Array.isArray(req.body?.mentionedUserIds)
    ? req.body.mentionedUserIds.filter((userId) => normalizeId(userId) !== normalizeId(req.user.id))
    : [];
  await Promise.all(mentionUserIds.map((userId) => createNotification(
    getGlobalIo(),
    userId,
    'mention',
    `${req.user.name} mentioned you in a page comment`,
    { pageId: normalizeId(page._id), workspaceId: normalizeId(page.workspaceId), threadId: thread.id, type: 'page_comment' }
  )));

  res.status(201).json(serializePage(updated));
}));

router.post('/pages/:pageId/comments/:threadId/replies', authMiddleware, asyncHandler(async (req, res) => {
  const page = await Page.findById(req.params.pageId);
  if (!page) throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND');

  const workspace = await getWorkspaceForUser(page.workspaceId, req.user.id);
  if (!workspace) throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  if (!hasRole(workspace, req.user.id, 'commenter')) {
    throw new AppError('Insufficient role for comments', 403, 'INSUFFICIENT_ROLE');
  }

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  if (!message) throw new AppError('Reply message is required', 400, 'VALIDATION_ERROR');

  const threads = Array.isArray(page.commentThreads) ? page.commentThreads.map((thread) => normalizeThread(thread)) : [];
  const index = threads.findIndex((thread) => thread.id === req.params.threadId);
  if (index < 0) throw new AppError('Thread not found', 404, 'THREAD_NOT_FOUND');

  threads[index].replies = [...threads[index].replies, normalizeReply({ userId: req.user.id, message })];
  threads[index].resolved = false;

  const updated = await Page.findByIdAndUpdate(page._id, {
    $set: { commentThreads: threads, updatedBy: req.user.id },
  }, { new: true });

  const recipients = new Set((threads[index].replies || []).map((reply) => normalizeId(reply.userId)));
  recipients.add(normalizeId(threads[index].createdBy));
  recipients.delete(normalizeId(req.user.id));

  await Promise.all([...recipients].map((userId) => createNotification(
    getGlobalIo(),
    userId,
    'mention',
    `${req.user.name} replied in a page comment thread`,
    { pageId: normalizeId(page._id), workspaceId: normalizeId(page.workspaceId), threadId: threads[index].id, type: 'page_comment_reply' }
  )));

  res.status(201).json(serializePage(updated));
}));

router.patch('/pages/:pageId/comments/:threadId', authMiddleware, asyncHandler(async (req, res) => {
  const page = await Page.findById(req.params.pageId);
  if (!page) throw new AppError('Page not found', 404, 'PAGE_NOT_FOUND');

  const workspace = await getWorkspaceForUser(page.workspaceId, req.user.id);
  if (!workspace) throw new AppError('Access denied', 403, 'ACCESS_DENIED');
  if (!hasRole(workspace, req.user.id, 'commenter')) {
    throw new AppError('Insufficient role for comments', 403, 'INSUFFICIENT_ROLE');
  }

  const threads = Array.isArray(page.commentThreads) ? page.commentThreads.map((thread) => normalizeThread(thread)) : [];
  const index = threads.findIndex((thread) => thread.id === req.params.threadId);
  if (index < 0) throw new AppError('Thread not found', 404, 'THREAD_NOT_FOUND');

  if (typeof req.body?.resolved !== 'boolean') {
    throw new AppError('Resolved flag is required', 400, 'VALIDATION_ERROR');
  }

  threads[index].resolved = req.body.resolved;

  const updated = await Page.findByIdAndUpdate(page._id, {
    $set: { commentThreads: threads, updatedBy: req.user.id },
  }, { new: true });

  res.json(serializePage(updated));
}));

router.get('/:workspaceId/members', authMiddleware, asyncHandler(async (req, res) => {
  const workspace = await getWorkspaceForUser(req.params.workspaceId, req.user.id);
  if (!workspace || !hasRole(workspace, req.user.id, 'viewer')) {
    throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
  }

  const memberIds = [...new Set((workspace.members || []).map((item) => normalizeId(item.userId)))];
  const users = await User.find({ _id: { $in: memberIds } }).select('name email status');
  const byId = new Map(users.map((item) => [normalizeId(item._id), item]));

  const members = (workspace.members || []).map((member) => {
    const user = byId.get(normalizeId(member.userId));
    return {
      userId: normalizeId(member.userId),
      role: member.role,
      user: user ? { _id: user._id, name: user.name, email: user.email, status: user.status } : null,
    };
  });
  return res.json(members);
}));

router.post('/:workspaceId/members', authMiddleware, validateWorkspaceMemberCreate, asyncHandler(async (req, res) => {
  const workspace = await getWorkspaceForUser(req.params.workspaceId, req.user.id);
  if (!workspace) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
  if (!hasRole(workspace, req.user.id, 'admin')) {
    throw new AppError('Insufficient role for member management', 403, 'INSUFFICIENT_ROLE');
  }

  const userId = req.body.userId.trim();
  const role = req.body.role || 'viewer';
  const exists = await User.findById(userId).select('_id');
  if (!exists) throw new AppError('User not found', 404, 'USER_NOT_FOUND');

  if (role === 'owner' && getRoleForUser(workspace, req.user.id) !== 'owner') {
    throw new AppError('Only owner can assign owner role', 403, 'INSUFFICIENT_ROLE');
  }

  const memberIndex = (workspace.members || []).findIndex((item) => normalizeId(item.userId) === normalizeId(userId));
  if (memberIndex >= 0) {
    workspace.members[memberIndex].role = role;
  } else {
    workspace.members.push({ userId, role });
  }

  await workspace.save();
  await logActivity(getGlobalIo(), {
    actorId: req.user.id,
    workspaceId: workspace._id,
    type: 'member_added',
    message: 'Added member to workspace',
    meta: { memberUserId: userId, role },
  });
  return res.status(201).json({ success: true });
}));

router.patch('/:workspaceId/members/:memberUserId', authMiddleware, validateWorkspaceMemberPatch, asyncHandler(async (req, res) => {
  const workspace = await getWorkspaceForUser(req.params.workspaceId, req.user.id);
  if (!workspace) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
  if (!hasRole(workspace, req.user.id, 'admin')) {
    throw new AppError('Insufficient role for member management', 403, 'INSUFFICIENT_ROLE');
  }

  const memberUserId = req.params.memberUserId;
  const nextRole = req.body.role;
  const requesterRole = getRoleForUser(workspace, req.user.id);

  if (nextRole === 'owner' && requesterRole !== 'owner') {
    throw new AppError('Only owner can transfer ownership', 403, 'INSUFFICIENT_ROLE');
  }

  const index = (workspace.members || []).findIndex((item) => normalizeId(item.userId) === normalizeId(memberUserId));
  if (index < 0) throw new AppError('Member not found', 404, 'MEMBER_NOT_FOUND');

  if (nextRole === 'owner') {
    workspace.ownerId = memberUserId;
    workspace.members = (workspace.members || []).map((item) => ({
      userId: item.userId,
      role: normalizeId(item.userId) === normalizeId(memberUserId) ? 'owner' : (item.role === 'owner' ? 'admin' : item.role),
    }));
  } else {
    workspace.members[index].role = nextRole;
  }

  await workspace.save();
  await logActivity(getGlobalIo(), {
    actorId: req.user.id,
    workspaceId: workspace._id,
    type: 'member_role_updated',
    message: 'Updated member role',
    meta: { memberUserId, role: nextRole },
  });
  return res.json({ success: true });
}));

router.delete('/:workspaceId/members/:memberUserId', authMiddleware, asyncHandler(async (req, res) => {
  const workspace = await getWorkspaceForUser(req.params.workspaceId, req.user.id);
  if (!workspace) throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
  if (!hasRole(workspace, req.user.id, 'admin')) {
    throw new AppError('Insufficient role for member management', 403, 'INSUFFICIENT_ROLE');
  }

  const memberUserId = req.params.memberUserId;
  if (normalizeId(workspace.ownerId) === normalizeId(memberUserId)) {
    throw new AppError('Cannot remove workspace owner', 400, 'INVALID_OPERATION');
  }

  workspace.members = (workspace.members || []).filter((item) => normalizeId(item.userId) !== normalizeId(memberUserId));
  await workspace.save();
  await logActivity(getGlobalIo(), {
    actorId: req.user.id,
    workspaceId: workspace._id,
    type: 'member_removed',
    message: 'Removed member from workspace',
    meta: { memberUserId },
  });
  return res.json({ success: true });
}));

module.exports = router;
