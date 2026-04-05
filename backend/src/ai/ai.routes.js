/**
 * AI Routes
 * 
 * AI-powered assistant endpoints for text generation and action extraction.
 * Uses Groq API for LLM capabilities with fallback to local processing.
 * Rate limited to prevent abuse.
 */

const { Router } = require('express');
const { authMiddleware } = require('../middleware/auth');
const { rateLimiter } = require('../middleware/rateLimiter');
const { validateAiAssistant, validateAiExtractActions } = require('../middleware/validate');
const { generateAssistantText, extractActionsWithAI } = require('./ai.service');
const Task = require('../models/Task');
const { getWorkspaceForUser, hasRole } = require('../workspace/workspace.access');
const { logActivity } = require('../activity/activity.service');
const { AppError, asyncHandler } = require('../middleware/errors');

const router = Router();

/**
 * POST /ai/assistant
 * General purpose AI assistant for answering questions and generating text.
 * Accepts prompt and optional context type. Falls back to local processing if API unavailable.
 */
router.post('/assistant', authMiddleware, rateLimiter(60000, 30), validateAiAssistant, asyncHandler(async (req, res) => {
  const prompt = req.body.prompt;
  const contextType = typeof req.body?.contextType === 'string' ? req.body.contextType : 'general';
  const result = await generateAssistantText(prompt, prompt, contextType);
  await logActivity(req.app.get('io') || null, {
    actorId: req.user.id,
    type: 'ai_assistant_used',
    message: 'Used AI assistant',
    meta: { contextType, provider: result.provider },
  });
  return res.json(result);
}));

/**
 * POST /ai/extract-actions
 * Extract actionable tasks from text using AI.
 * Optionally creates tasks in the workspace. Requires editor role.
 */
router.post('/extract-actions', authMiddleware, rateLimiter(60000, 20), validateAiExtractActions, asyncHandler(async (req, res) => {
  const { workspaceId, text, createTasks = true, sourceType = 'manual', sourceId = '' } = req.body;
  const workspace = await getWorkspaceForUser(workspaceId, req.user.id);
  if (!workspace || !hasRole(workspace, req.user.id, 'editor')) {
    throw new AppError('Insufficient role for action extraction', 403, 'INSUFFICIENT_ROLE');
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

  await logActivity(req.app.get('io') || null, {
    actorId: req.user.id,
    workspaceId,
    type: 'ai_actions_extracted',
    message: `Extracted ${actions.length} actions from content`,
    meta: { provider, createdTasks: created.length, sourceType, sourceId },
  });

  return res.json({
    provider,
    actions,
    createdTasks: created,
  });
}));

module.exports = router;
