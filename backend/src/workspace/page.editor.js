const crypto = require('crypto');

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'checklist', 'quote', 'code', 'toggle']);
const MENTION_TYPES = new Set(['user', 'page', 'document']);

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString('hex')}`;
}

function normalizeMention(mention = {}) {
  if (!mention || typeof mention !== 'object') return null;
  const type = MENTION_TYPES.has(mention.type) ? mention.type : null;
  const refId = typeof mention.refId === 'string' ? mention.refId.trim() : '';
  const label = typeof mention.label === 'string' ? mention.label.trim() : '';

  if (!type || !refId || !label) return null;

  return {
    id: typeof mention.id === 'string' && mention.id.trim() ? mention.id.trim() : createId('mnt'),
    type,
    refId,
    label,
  };
}

function normalizeBlock(block = {}, index = 0) {
  const type = BLOCK_TYPES.has(block.type) ? block.type : 'paragraph';
  const text = typeof block.text === 'string' ? block.text : '';
  const normalized = {
    id: typeof block.id === 'string' && block.id.trim() ? block.id.trim() : createId('blk'),
    type,
    text,
    checked: Boolean(block.checked),
    collapsed: Boolean(block.collapsed),
    level: [1, 2, 3].includes(Number(block.level)) ? Number(block.level) : 1,
    language: typeof block.language === 'string' ? block.language.trim().slice(0, 40) : '',
    order: Number.isFinite(block.order) ? Number(block.order) : index,
    mentions: Array.isArray(block.mentions)
      ? block.mentions.map(normalizeMention).filter(Boolean)
      : [],
  };

  return normalized;
}

function normalizeBlocks(blocks, fallbackContent = '') {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    if (typeof fallbackContent === 'string' && fallbackContent.trim()) {
      return [normalizeBlock({ type: 'paragraph', text: fallbackContent }, 0)];
    }
    return [normalizeBlock({ type: 'paragraph', text: '' }, 0)];
  }

  return blocks.map((block, index) => normalizeBlock(block, index));
}

function blocksToPlainText(blocks = []) {
  return blocks.map((block) => {
    if (block.type === 'checklist') {
      return `${block.checked ? '[x]' : '[ ]'} ${block.text}`.trim();
    }
    if (block.type === 'toggle') {
      return `> ${block.text}`.trim();
    }
    return block.text || '';
  }).join('\n\n').trim();
}

function normalizeReply(reply = {}) {
  const message = typeof reply.message === 'string' ? reply.message.trim() : '';
  const userId = typeof reply.userId === 'string' ? reply.userId.trim() : '';

  if (!message || !userId) return null;

  return {
    id: typeof reply.id === 'string' && reply.id.trim() ? reply.id.trim() : createId('rpl'),
    userId,
    message,
    createdAt: reply.createdAt ? new Date(reply.createdAt) : new Date(),
  };
}

function normalizeThread(thread = {}) {
  const replies = Array.isArray(thread.replies) ? thread.replies.map(normalizeReply).filter(Boolean) : [];
  return {
    id: typeof thread.id === 'string' && thread.id.trim() ? thread.id.trim() : createId('thr'),
    blockId: typeof thread.blockId === 'string' ? thread.blockId.trim() : '',
    selectedText: typeof thread.selectedText === 'string' ? thread.selectedText.trim().slice(0, 300) : '',
    resolved: Boolean(thread.resolved),
    createdBy: typeof thread.createdBy === 'string' ? thread.createdBy.trim() : '',
    createdAt: thread.createdAt ? new Date(thread.createdAt) : new Date(),
    replies,
  };
}

function collectUserMentionIds(blocks = []) {
  const ids = new Set();
  for (const block of blocks) {
    for (const mention of block.mentions || []) {
      if (mention.type === 'user') ids.add(mention.refId);
    }
  }
  return ids;
}

module.exports = {
  BLOCK_TYPES,
  normalizeBlocks,
  blocksToPlainText,
  normalizeThread,
  normalizeReply,
  collectUserMentionIds,
};
