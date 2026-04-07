const Joi = require('joi');
const { AppError } = require('./errors');

function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      return next(new AppError('Validation failed', 400, 'VALIDATION_ERROR', {
        fields: error.details.map((item) => ({
          path: item.path.join('.'),
          message: item.message,
        })),
      }));
    }
    req.body = value;
    return next();
  };
}

const roleSchema = Joi.string().valid('owner', 'admin', 'editor', 'commenter', 'viewer');
const objectIdLike = Joi.string().trim().min(1).max(120);

const validateAuthRegister = validateBody(Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  email: Joi.string().trim().email().max(320).required(),
  password: Joi.string().min(8).max(256).required(),
}));

const validateAuthLogin = validateBody(Joi.object({
  email: Joi.string().trim().email().max(320).required(),
  password: Joi.string().min(1).max(256).required(),
}));

const validateWorkspaceCreate = validateBody(Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
}));

const validatePageCreate = validateBody(Joi.object({
  title: Joi.string().trim().min(1).max(180).optional(),
  content: Joi.string().max(200000).optional(),
  blocks: Joi.array().items(Joi.object({
    id: Joi.string().trim().max(80).optional(),
    type: Joi.string().valid('paragraph', 'heading', 'checklist', 'quote', 'code', 'toggle').required(),
    text: Joi.string().allow('').max(20000).optional(),
    checked: Joi.boolean().optional(),
    collapsed: Joi.boolean().optional(),
    level: Joi.number().integer().min(1).max(3).optional(),
    language: Joi.string().allow('').max(40).optional(),
    order: Joi.number().optional(),
    mentions: Joi.array().items(Joi.object({
      id: Joi.string().trim().max(80).optional(),
      type: Joi.string().valid('user', 'page', 'document').required(),
      refId: Joi.string().trim().min(1).max(120).required(),
      label: Joi.string().trim().min(1).max(180).required(),
    })).optional(),
  })).max(500).optional(),
  parentId: objectIdLike.allow(null, '').optional(),
}));

const validatePagePatch = validateBody(Joi.object({
  title: Joi.string().trim().min(1).max(180).optional(),
  content: Joi.string().max(200000).optional(),
  blocks: Joi.array().items(Joi.object({
    id: Joi.string().trim().max(80).optional(),
    type: Joi.string().valid('paragraph', 'heading', 'checklist', 'quote', 'code', 'toggle').required(),
    text: Joi.string().allow('').max(20000).optional(),
    checked: Joi.boolean().optional(),
    collapsed: Joi.boolean().optional(),
    level: Joi.number().integer().min(1).max(3).optional(),
    language: Joi.string().allow('').max(40).optional(),
    order: Joi.number().optional(),
    mentions: Joi.array().items(Joi.object({
      id: Joi.string().trim().max(80).optional(),
      type: Joi.string().valid('user', 'page', 'document').required(),
      refId: Joi.string().trim().min(1).max(120).required(),
      label: Joi.string().trim().min(1).max(180).required(),
    })).optional(),
  })).max(500).optional(),
  icon: Joi.string().trim().max(60).optional(),
  order: Joi.number().optional(),
  parentId: objectIdLike.allow(null, '').optional(),
}).min(1));

const validateWorkspaceMemberCreate = validateBody(Joi.object({
  userId: objectIdLike.required(),
  role: roleSchema.optional(),
}));

const validateWorkspaceMemberPatch = validateBody(Joi.object({
  role: roleSchema.required(),
}));

const validateTaskCreate = validateBody(Joi.object({
  workspaceId: objectIdLike.required(),
  title: Joi.string().trim().min(1).max(220).required(),
  description: Joi.string().allow('').max(5000).optional(),
  status: Joi.string().valid('todo', 'in_progress', 'done', 'blocked').optional(),
  assigneeId: objectIdLike.allow(null, '').optional(),
  dueDate: Joi.date().iso().allow(null).optional(),
  sourceType: Joi.string().trim().max(80).optional(),
  sourceId: Joi.string().trim().allow('').max(120).optional(),
}));

const validateTaskPatch = validateBody(Joi.object({
  title: Joi.string().trim().min(1).max(220).optional(),
  description: Joi.string().allow('').max(5000).optional(),
  status: Joi.string().valid('todo', 'in_progress', 'done', 'blocked').optional(),
  assigneeId: objectIdLike.allow(null, '').optional(),
  dueDate: Joi.date().iso().allow(null).optional(),
}).min(1));

const validateAiAssistant = validateBody(Joi.object({
  prompt: Joi.string().trim().min(1).max(20000).required(),
  contextType: Joi.string().trim().min(1).max(100).optional(),
}));

const validateAiExtractActions = validateBody(Joi.object({
  workspaceId: objectIdLike.required(),
  text: Joi.string().trim().min(1).max(50000).required(),
  createTasks: Joi.boolean().optional(),
  sourceType: Joi.string().trim().max(80).optional(),
  sourceId: Joi.string().trim().allow('').max(120).optional(),
}));

const validateConversationCreate = validateBody(Joi.object({
  participantIds: Joi.array().items(objectIdLike).default([]),
  name: Joi.string().trim().allow('').max(180).optional(),
}));

const validateDocCreate = validateBody(Joi.object({
  title: Joi.string().trim().max(180).optional(),
  content: Joi.string().max(200000).optional(),
}));

const validateDocPatch = validateBody(Joi.object({
  title: Joi.string().trim().min(1).max(180).optional(),
  content: Joi.string().max(200000).optional(),
  revision: Joi.number().integer().min(0).optional(),
}).min(1));

module.exports = {
  validateAuthRegister,
  validateAuthLogin,
  validateAiAssistant,
  validateAiExtractActions,
  validateWorkspaceCreate,
  validatePageCreate,
  validatePagePatch,
  validateWorkspaceMemberCreate,
  validateWorkspaceMemberPatch,
  validateTaskCreate,
  validateTaskPatch,
  validateConversationCreate,
  validateDocCreate,
  validateDocPatch,
};
