function stringField(value, { min = 0, max = 10000 } = {}) {
  if (typeof value !== 'string') return false;
  const len = value.trim().length;
  return len >= min && len <= max;
}

function validateAiAssistant(req, res, next) {
  if (!stringField(req.body?.prompt, { min: 1, max: 20000 })) {
    return res.status(400).json({ error: 'prompt must be a non-empty string' });
  }
  if (req.body?.contextType !== undefined && !stringField(req.body.contextType, { min: 1, max: 100 })) {
    return res.status(400).json({ error: 'contextType must be a string' });
  }
  return next();
}

function validateWorkspaceCreate(req, res, next) {
  if (!stringField(req.body?.name, { min: 1, max: 120 })) {
    return res.status(400).json({ error: 'name must be a non-empty string' });
  }
  return next();
}

function validatePageCreate(req, res, next) {
  if (req.body?.title !== undefined && !stringField(req.body.title, { min: 1, max: 180 })) {
    return res.status(400).json({ error: 'title must be a string' });
  }
  if (req.body?.content !== undefined && typeof req.body.content !== 'string') {
    return res.status(400).json({ error: 'content must be a string' });
  }
  return next();
}

function validatePagePatch(req, res, next) {
  if (req.body?.title !== undefined && !stringField(req.body.title, { min: 1, max: 180 })) {
    return res.status(400).json({ error: 'title must be a string' });
  }
  if (req.body?.content !== undefined && typeof req.body.content !== 'string') {
    return res.status(400).json({ error: 'content must be a string' });
  }
  if (req.body?.order !== undefined && typeof req.body.order !== 'number') {
    return res.status(400).json({ error: 'order must be a number' });
  }
  return next();
}

function validateWorkspaceMemberCreate(req, res, next) {
  const role = req.body?.role;
  if (typeof req.body?.userId !== 'string' || !req.body.userId.trim()) {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (role !== undefined && !['owner', 'admin', 'editor', 'commenter', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  return next();
}

function validateWorkspaceMemberPatch(req, res, next) {
  const role = req.body?.role;
  if (!['owner', 'admin', 'editor', 'commenter', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  return next();
}

function validateTaskCreate(req, res, next) {
  if (typeof req.body?.workspaceId !== 'string' || !req.body.workspaceId.trim()) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }
  if (!stringField(req.body?.title, { min: 1, max: 220 })) {
    return res.status(400).json({ error: 'title must be a non-empty string' });
  }
  if (req.body?.status !== undefined && !['todo', 'in_progress', 'done', 'blocked'].includes(req.body.status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  return next();
}

function validateTaskPatch(req, res, next) {
  if (req.body?.title !== undefined && !stringField(req.body.title, { min: 1, max: 220 })) {
    return res.status(400).json({ error: 'title must be a non-empty string' });
  }
  if (req.body?.status !== undefined && !['todo', 'in_progress', 'done', 'blocked'].includes(req.body.status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  return next();
}

function validateAiExtractActions(req, res, next) {
  if (!stringField(req.body?.workspaceId, { min: 1, max: 120 })) {
    return res.status(400).json({ error: 'workspaceId is required' });
  }
  if (!stringField(req.body?.text, { min: 1, max: 50000 })) {
    return res.status(400).json({ error: 'text is required' });
  }
  return next();
}

module.exports = {
  validateAiAssistant,
  validateAiExtractActions,
  validateWorkspaceCreate,
  validatePageCreate,
  validatePagePatch,
  validateWorkspaceMemberCreate,
  validateWorkspaceMemberPatch,
  validateTaskCreate,
  validateTaskPatch,
};
