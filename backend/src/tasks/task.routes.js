const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const { validateTaskCreate, validateTaskPatch } = require('../middleware/validate');
const Task = require('../models/Task');
const { getWorkspaceForUser, hasRole } = require('../workspace/workspace.access');
const { getGlobalIo } = require('../websocket/socketServer');
const { logActivity } = require('../activity/activity.service');

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const workspaceId = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
    if (!workspaceId) return res.status(400).json({ error: 'workspaceId is required' });

    const workspace = await getWorkspaceForUser(workspaceId, req.user.id);
    if (!workspace || !hasRole(workspace, req.user.id, 'viewer')) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const filter = { workspaceId };
    if (typeof req.query.status === 'string' && req.query.status) filter.status = req.query.status;
    if (typeof req.query.assigneeId === 'string' && req.query.assigneeId) filter.assigneeId = req.query.assigneeId;

    const tasks = await Task.find(filter)
      .sort({ updatedAt: -1 })
      .populate('assigneeId', 'name email status')
      .populate('createdBy', 'name email');
    return res.json(tasks);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', authMiddleware, validateTaskCreate, async (req, res) => {
  try {
    const { workspaceId, title, description, status, assigneeId, dueDate, sourceType, sourceId } = req.body;
    const workspace = await getWorkspaceForUser(workspaceId, req.user.id);
    if (!workspace || !hasRole(workspace, req.user.id, 'editor')) {
      return res.status(403).json({ error: 'Insufficient role for task creation' });
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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:taskId', authMiddleware, validateTaskPatch, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const workspace = await getWorkspaceForUser(task.workspaceId, req.user.id);
    if (!workspace || !hasRole(workspace, req.user.id, 'editor')) {
      return res.status(403).json({ error: 'Insufficient role for task update' });
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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:taskId', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const workspace = await getWorkspaceForUser(task.workspaceId, req.user.id);
    if (!workspace || !hasRole(workspace, req.user.id, 'editor')) {
      return res.status(403).json({ error: 'Insufficient role for task delete' });
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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
