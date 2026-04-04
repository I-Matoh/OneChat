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
const {
  normalizeId,
  hasRole,
  getRoleForUser,
  workspaceFilterForUser,
  getWorkspaceForUser,
} = require('./workspace.access');

const router = Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const workspaces = await Workspace.find(workspaceFilterForUser(req.user.id))
      .sort({ updatedAt: -1 })
      .select('name ownerId members createdAt updatedAt');
    res.json(workspaces);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', authMiddleware, validateWorkspaceCreate, async (req, res) => {
  try {
    const name = req.body.name.trim();

    const workspace = await Workspace.create({
      name,
      ownerId: req.user.id,
      members: [{ userId: req.user.id, role: 'owner' }],
    });

    res.status(201).json(workspace);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:workspaceId/pages', authMiddleware, async (req, res) => {
  try {
    const workspace = await getWorkspaceForUser(req.params.workspaceId, req.user.id);
    if (!workspace || !hasRole(workspace, req.user.id, 'viewer')) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    const pages = await Page.find({ workspaceId: workspace._id })
      .sort({ parentId: 1, order: 1, updatedAt: -1 });
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:workspaceId/pages', authMiddleware, validatePageCreate, async (req, res) => {
  try {
    const workspace = await getWorkspaceForUser(req.params.workspaceId, req.user.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    if (!hasRole(workspace, req.user.id, 'editor')) {
      return res.status(403).json({ error: 'Insufficient role for page creation' });
    }

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const parentId = req.body?.parentId || null;
    const content = typeof req.body?.content === 'string' ? req.body.content : '';

    const lastPage = await Page.findOne({
      workspaceId: workspace._id,
      parentId: parentId || null,
    }).sort({ order: -1 }).select('order');

    const page = await Page.create({
      workspaceId: workspace._id,
      parentId: parentId || null,
      title: title || 'Untitled',
      content,
      order: (lastPage?.order || 0) + 1,
      createdBy: req.user.id,
      updatedBy: req.user.id,
    });

    res.status(201).json(page);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/pages/:pageId', authMiddleware, validatePagePatch, async (req, res) => {
  try {
    const page = await Page.findById(req.params.pageId);
    if (!page) return res.status(404).json({ error: 'Page not found' });

    const workspace = await getWorkspaceForUser(page.workspaceId, req.user.id);
    if (!workspace) return res.status(403).json({ error: 'Access denied' });
    if (!hasRole(workspace, req.user.id, 'editor')) {
      return res.status(403).json({ error: 'Insufficient role for page update' });
    }

    const updates = { updatedBy: req.user.id };
    if (typeof req.body?.title === 'string') updates.title = req.body.title.trim() || 'Untitled';
    if (typeof req.body?.content === 'string') updates.content = req.body.content;
    if (typeof req.body?.icon === 'string') updates.icon = req.body.icon;
    if (typeof req.body?.order === 'number') updates.order = req.body.order;
    if (req.body?.parentId !== undefined) updates.parentId = req.body.parentId || null;

    const updated = await Page.findByIdAndUpdate(page._id, { $set: updates }, { new: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/pages/:pageId', authMiddleware, async (req, res) => {
  try {
    const page = await Page.findById(req.params.pageId);
    if (!page) return res.status(404).json({ error: 'Page not found' });

    const workspace = await getWorkspaceForUser(page.workspaceId, req.user.id);
    if (!workspace) return res.status(403).json({ error: 'Access denied' });
    if (!hasRole(workspace, req.user.id, 'editor')) {
      return res.status(403).json({ error: 'Insufficient role for page delete' });
    }

    await Page.deleteMany({
      $or: [
        { _id: page._id },
        { parentId: page._id },
      ],
    });

    res.json({ success: true, pageId: normalizeId(page._id) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:workspaceId/members', authMiddleware, async (req, res) => {
  try {
    const workspace = await getWorkspaceForUser(req.params.workspaceId, req.user.id);
    if (!workspace || !hasRole(workspace, req.user.id, 'viewer')) {
      return res.status(404).json({ error: 'Workspace not found' });
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
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:workspaceId/members', authMiddleware, validateWorkspaceMemberCreate, async (req, res) => {
  try {
    const workspace = await getWorkspaceForUser(req.params.workspaceId, req.user.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    if (!hasRole(workspace, req.user.id, 'admin')) {
      return res.status(403).json({ error: 'Insufficient role for member management' });
    }

    const userId = req.body.userId.trim();
    const role = req.body.role || 'viewer';
    const exists = await User.findById(userId).select('_id');
    if (!exists) return res.status(404).json({ error: 'User not found' });

    if (role === 'owner' && getRoleForUser(workspace, req.user.id) !== 'owner') {
      return res.status(403).json({ error: 'Only owner can assign owner role' });
    }

    const memberIndex = (workspace.members || []).findIndex((item) => normalizeId(item.userId) === normalizeId(userId));
    if (memberIndex >= 0) {
      workspace.members[memberIndex].role = role;
    } else {
      workspace.members.push({ userId, role });
    }

    await workspace.save();
    return res.status(201).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:workspaceId/members/:memberUserId', authMiddleware, validateWorkspaceMemberPatch, async (req, res) => {
  try {
    const workspace = await getWorkspaceForUser(req.params.workspaceId, req.user.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    if (!hasRole(workspace, req.user.id, 'admin')) {
      return res.status(403).json({ error: 'Insufficient role for member management' });
    }

    const memberUserId = req.params.memberUserId;
    const nextRole = req.body.role;
    const requesterRole = getRoleForUser(workspace, req.user.id);

    if (nextRole === 'owner' && requesterRole !== 'owner') {
      return res.status(403).json({ error: 'Only owner can transfer ownership' });
    }

    const index = (workspace.members || []).findIndex((item) => normalizeId(item.userId) === normalizeId(memberUserId));
    if (index < 0) return res.status(404).json({ error: 'Member not found' });

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
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:workspaceId/members/:memberUserId', authMiddleware, async (req, res) => {
  try {
    const workspace = await getWorkspaceForUser(req.params.workspaceId, req.user.id);
    if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
    if (!hasRole(workspace, req.user.id, 'admin')) {
      return res.status(403).json({ error: 'Insufficient role for member management' });
    }

    const memberUserId = req.params.memberUserId;
    if (normalizeId(workspace.ownerId) === normalizeId(memberUserId)) {
      return res.status(400).json({ error: 'Cannot remove workspace owner' });
    }

    workspace.members = (workspace.members || []).filter((item) => normalizeId(item.userId) !== normalizeId(memberUserId));
    await workspace.save();
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
