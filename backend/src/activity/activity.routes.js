const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const Activity = require('../models/Activity');
const { getWorkspaceForUser, hasRole } = require('../workspace/workspace.access');

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const workspaceId = typeof req.query.workspaceId === 'string' ? req.query.workspaceId : '';
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '30', 10)));

    let filter = { actorId: req.user.id };
    if (workspaceId) {
      const workspace = await getWorkspaceForUser(workspaceId, req.user.id);
      if (!workspace || !hasRole(workspace, req.user.id, 'viewer')) {
        return res.status(404).json({ error: 'Workspace not found' });
      }
      filter = { workspaceId };
    }

    const list = await Activity.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('actorId', 'name email');

    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
