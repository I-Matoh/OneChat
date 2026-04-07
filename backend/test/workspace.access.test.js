const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getRoleForUser,
  hasRole,
  normalizeId,
  workspaceFilterForUser,
} = require('../src/workspace/workspace.access');

test('workspace access helpers resolve roles and hierarchy', () => {
  const workspace = {
    ownerId: 'owner-1',
    members: [
      { userId: 'editor-1', role: 'editor' },
      { userId: 'viewer-1', role: 'viewer' },
    ],
  };

  assert.equal(normalizeId(42), '42');
  assert.equal(getRoleForUser(workspace, 'owner-1'), 'owner');
  assert.equal(getRoleForUser(workspace, 'editor-1'), 'editor');
  assert.equal(getRoleForUser(workspace, 'missing'), null);
  assert.equal(hasRole(workspace, 'editor-1', 'viewer'), true);
  assert.equal(hasRole(workspace, 'viewer-1', 'editor'), false);
  assert.deepEqual(workspaceFilterForUser('user-9'), {
    $or: [{ ownerId: 'user-9' }, { 'members.userId': 'user-9' }],
  });
});
