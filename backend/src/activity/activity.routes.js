/**
 * Activity Routes
 * 
 * REST API for activity/audit log. Returns user actions within
 * workspaces or across their entire account.
 */

const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const Activity = require('../models/Activity');
const { getWorkspaceForUser, hasRole } = require('../workspace/workspace.access');
const { AppError, asyncHandler } = require('../middleware/errors');

const router = Router();

/**
 * GET /activity
 * Get activity feed, optionally scoped to a workspace.
 */
router.get('/', authMiddleware, asyncHandler(async (req, res) => {
  const workspaceId = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '30', 10)));

  let filter = { actorId: req.user.id };
  if (workspaceId) {
    const workspace = await getWorkspaceForUser(workspaceId, req.user.id);
    if (!workspace || !hasRole(workspace, req.user.id, 'viewer')) {
      throw new AppError('Workspace not found', 404, 'WORKSPACE_NOT_FOUND');
    }
    filter = { workspaceId };
  }

  const list = await Activity.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actorId', 'name email');

  return res.json(list);
}));

module.exports = router;
