const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');
const { validateAiAssistant, validateAiExtractActions } = require('../middleware/validate');
const { generateAssistantText, extractActionsWithAI } = require('./ai.service');
const Task = require('../models/Task');
const { getWorkspaceForUser, hasRole } = require('../workspace/workspace.access');

const router = Router();

router.post('/assistant', authMiddleware, rateLimiter(60000, 30), validateAiAssistant, async (req, res) => {
  try {
    const prompt = req.body.prompt;
    const contextType = typeof req.body?.contextType === 'string' ? req.body.contextType : 'general';
    const result = await generateAssistantText(prompt, prompt, contextType);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/extract-actions', authMiddleware, rateLimiter(60000, 20), validateAiExtractActions, async (req, res) => {
  try {
    const { workspaceId, text, createTasks = true, sourceType = 'manual', sourceId = '' } = req.body;
    const workspace = await getWorkspaceForUser(workspaceId, req.user.id);
    if (!workspace || !hasRole(workspace, req.user.id, 'editor')) {
      return res.status(403).json({ error: 'Insufficient role for action extraction' });
    }

    const { actions, provider } = await extractActionsWithAI(text);
    let created = [];

    if (createTasks) {
      const tasks = actions.slice(0, 15).map((title) => ({
        workspaceId,
        title,
        status: 'todo',
        createdBy: req.user.id,
        sourceType,
        sourceId,
      }));
      if (tasks.length > 0) {
        created = await Task.insertMany(tasks);
      }
    }

    return res.json({
      provider,
      actions,
      createdTasks: created,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
