/**
 * Task Routes
 * 
 * REST API for task management within workspaces. Supports CRUD operations
 * with role-based access control (editor role required for modifications).
 */

const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const { validateTaskCreate, validateTaskPatch } = require('../middleware/validate');
const Task = require('../models/Task');
const { getWorkspaceForUser, hasRole } = require('../workspace/workspace.access');
const { getGlobalIo } = require('../websocket/socketServer');
const { logActivity } = require('../activity/activity.service');
const { AppError, asyncHandler } = require('../middleware/errors');

const router = Router();

/**
 * GET /tasks
 * List tasks for a workspace, optionally filtered by status or assignee.
 */
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const workspaceId = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  if (!workspaceId) throw new AppError('workspaceId is required', 400, 'VALIDATION_ERROR');

  const workspace = await getWorkspaceForUser(workspaceId, req.user.id);
  if (!workspace || !hasRole(workspace, req.user.id, 'viewer')) {
    throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
  }

  const filter = { workspaceId };
  if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
  if (typeof req.query.assigneeId === 'string' && req.query.assigneeId) filter.assigneeId = req.query.assigneeId;

  const tasks = await Task.find(filter)
    .sort({ updatedAt: -1 })
    .populate('assigneeId', 'name email status')
    .populate('createdBy', 'name email');
  return res.json(tasks);
}));

router.post('/', authMiddleware, validateTaskCreate, asyncHandler(async (req, res) => {
  const { workspaceId, title, description, status, assigneeId, dueDate, sourceType, sourceId } = req.body;
  const workspace = await getWorkspaceForUser(workspaceId, req.user.id);
  if (!workspace || !hasRole(workspace, req.user.id, 'editor')) {
    throw new AppError('Insufficient role for task creation', 403, 'INSUFFICIENT_ROLE');
  }

  const task = await Task.create({
    workspaceId,
    title: title.trim(),
    description: typeof description === 'string' ? description : '',
    status: status || 'todo',
    assigneeId: assigneeId || null,
    dueDate: dueDate ? new Date(dueDate) : null,
    createdBy: req.user.id,
    sourceType: sourceType || 'manual',
    sourceId: sourceId || '',
  });

  const populated = await task.populate('assigneeId', 'name email status');
  await logActivity(getGlobalIo(), {
    actorId: req.user.id,
    workspaceId,
    type: 'task_created',
    message: `Created task "${task.title}"`,
    meta: { taskId: task._id.toString() },
  });
  return res.status(201).json(populated);
}));

router.patch('/:taskId', authMiddleware, validateTaskPatch, asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');

  const workspace = await getWorkspaceForUser(task.workspaceId, req.user.id);
  if (!workspace || !hasRole(workspace, req.user.id, 'editor')) {
    throw new AppError('Insufficient role for task update', 403, 'INSUFFICIENT_ROLE');
  }

  const updates = {};
  if (typeof req.body.title === 'string') updates.title = req.body.title.trim();
  if (typeof req.body.description === 'string') updates.description = req.body.description;
  if (typeof req.body.status === 'string') updates.status = req.body.status;
  if (req.body.assigneeId !== undefined) updates.assigneeId = req.body.assigneeId || null;
  if (req.body.dueDate !== undefined) updates.dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;

  const updated = await Task.findByIdAndUpdate(task._id, { $set: updates }, { new: true })
    .populate('assigneeId', 'name email status')
    .populate('createdBy', 'name email');
  await logActivity(getGlobalIo(), {
    actorId: req.user.id,
    workspaceId: task.workspaceId,
    type: 'task_updated',
    message: `Updated task "${updated.title}"`,
    meta: { taskId: updated._id.toString(), status: updated.status },
  });
  return res.json(updated);
}));

router.delete('/:taskId', authMiddleware, asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.taskId);
  if (!task) throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');

  const workspace = await getWorkspaceForUser(task.workspaceId, req.user.id);
  if (!workspace || !hasRole(workspace, req.user.id, 'editor')) {
    throw new AppError('Insufficient role for task delete', 403, 'INSUFFICIENT_ROLE');
  }

  await Task.findByIdAndDelete(task._id);
  await logActivity(getGlobalIo(), {
    actorId: req.user.id,
    workspaceId: task.workspaceId,
    type: 'task_deleted',
    message: `Deleted task "${task.title}"`,
    meta: { taskId: task._id.toString() },
  });
  return res.json({ success: true });
}));

module.exports = router;

