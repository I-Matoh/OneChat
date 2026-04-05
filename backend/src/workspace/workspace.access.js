/**
 * Workspace Access Control
 * 
 * Utilities for workspace authorization and role checking.
 * Defines role hierarchy and provides helper functions for
 * determining user permissions within workspaces.
 */

const Workspace = require('../models/Workspace');

/**
 * Role hierarchy ranks for permission comparison.
 * Higher rank means more permissions.
 */
const ROLE_RANK = {
  viewer: 1,
  commenter: 2,
  editor: 3,
  admin: 4,
  owner: 5,
};

/**
 * Normalize ID to string for consistent comparison.
 */
function normalizeId(value) {
  return value?.toString?.() || String(value);
}

/**
 * Get user's role in a workspace.
 */
function getRoleForUser(workspace, userId) {
  const uid = normalizeId(userId);
  if (normalizeId(workspace.ownerId) === uid) return 'owner';
  const member = (workspace.members || []).find((item) => normalizeId(item.userId) === uid);
  return member?.role || null;
}

/**
 * Check if user has minimum required role in workspace.
 */
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
