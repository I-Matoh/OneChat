const Workspace = require('../models/Workspace');

const ROLE_RANK = {
  viewer: 1,
  commenter: 2,
  editor: 3,
  admin: 4,
  owner: 5,
};

function normalizeId(value) {
  return value?.toString?.() || String(value);
}

function getRoleForUser(workspace, userId) {
  const uid = normalizeId(userId);
  if (normalizeId(workspace.ownerId) === uid) return 'owner';
  const member = (workspace.members || []).find((item) => normalizeId(item.userId) === uid);
  return member?.role || null;
}

function hasRole(workspace, userId, minimumRole = 'viewer') {
  const role = getRoleForUser(workspace, userId);
  if (!role) return false;
  return (ROLE_RANK[role] || 0) >= (ROLE_RANK[minimumRole] || 0);
}

function workspaceFilterForUser(userId) {
  return {
    $or: [
      { ownerId: userId },
      { 'members.userId': userId },
    ],
  };
}

async function getWorkspaceForUser(workspaceId, userId) {
  return Workspace.findOne({
    _id: workspaceId,
    ...workspaceFilterForUser(userId),
  });
}

module.exports = {
  ROLE_RANK,
  normalizeId,
  getRoleForUser,
  hasRole,
  workspaceFilterForUser,
  getWorkspaceForUser,
};
