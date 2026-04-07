const states = new Map();
const MAX_HISTORY = 200;

function createEmptyState(doc) {
  const content = doc?.crdtState?.content || doc?.content || '';
  const version = Number.isInteger(doc?.crdtState?.version)
    ? doc.crdtState.version
    : (Number.isInteger(doc?.revision) ? doc.revision : 0);

  return {
    content,
    version,
    history: [],
  };
}

function getDocKey(docId) {
  return String(docId);
}

function loadCrdtState(docId, doc) {
  const key = getDocKey(docId);
  const existing = states.get(key);
  if (existing) return existing;

  const state = createEmptyState(doc);
  states.set(key, state);
  return state;
}

function applyTextOp(content, op) {
  const text = typeof content === 'string' ? content : '';
  const insertText = typeof op?.insertText === 'string' ? op.insertText : '';
  const position = Number.isInteger(op?.pos) ? op.pos : 0;
  const deleteCount = Number.isInteger(op?.deleteCount) ? op.deleteCount : 0;
  const safePos = Math.max(0, Math.min(position, text.length));
  const safeDelete = Math.max(0, Math.min(deleteCount, text.length - safePos));

  return text.slice(0, safePos) + insertText + text.slice(safePos + safeDelete);
}

function normalizeOp(op) {
  return {
    pos: Number.isInteger(op?.pos) ? op.pos : 0,
    deleteCount: Number.isInteger(op?.deleteCount) ? op.deleteCount : 0,
    insertText: typeof op?.insertText === 'string' ? op.insertText : '',
    clientId: typeof op?.clientId === 'string' ? op.clientId : '',
    clientOpId: typeof op?.clientOpId === 'string' ? op.clientOpId : '',
  };
}

function transformOp(op, applied) {
  const next = normalizeOp(op);
  const prior = normalizeOp(applied);
  const insertLen = prior.insertText.length;
  const deleteLen = prior.deleteCount;

  if (insertLen > 0) {
    const insertBefore = prior.pos < next.pos;
    const insertAtSameSpotByLowerClient = prior.pos === next.pos
      && prior.clientId
      && next.clientId
      && prior.clientId < next.clientId;

    if (insertBefore || insertAtSameSpotByLowerClient) {
      next.pos += insertLen;
    }
  }

  if (deleteLen > 0) {
    const deleteStart = prior.pos;
    const deleteEnd = prior.pos + deleteLen;
    const opStart = next.pos;
    const opEnd = next.pos + next.deleteCount;

    if (deleteEnd <= opStart) {
      next.pos -= deleteLen;
    } else if (deleteStart < opEnd && deleteEnd > opStart) {
      const overlapStart = Math.max(opStart, deleteStart);
      const overlapEnd = Math.min(opEnd, deleteEnd);
      if (deleteStart < next.pos) {
        next.pos = deleteStart;
      }
      next.deleteCount = Math.max(0, next.deleteCount - Math.max(0, overlapEnd - overlapStart));
    }
  }

  return next;
}

function applyCrdtOperation(docId, doc, operation, baseVersion) {
  const state = loadCrdtState(docId, doc);
  let rebased = normalizeOp(operation);

  const history = baseVersion < state.version
    ? state.history.slice(Math.max(0, baseVersion))
    : [];

  for (const entry of history) {
    rebased = transformOp(rebased, entry.op);
  }

  state.content = applyTextOp(state.content, rebased);
  state.version += 1;
  state.history.push({
    version: state.version,
    op: rebased,
  });
  if (state.history.length > MAX_HISTORY) {
    state.history = state.history.slice(state.history.length - MAX_HISTORY);
  }

  return {
    content: state.content,
    version: state.version,
    op: rebased,
  };
}

function buildSingleTextOp(previousText, nextText) {
  const previous = typeof previousText === 'string' ? previousText : '';
  const next = typeof nextText === 'string' ? nextText : '';
  if (previous === next) return null;

  let prefix = 0;
  while (
    prefix < previous.length
    && prefix < next.length
    && previous[prefix] === next[prefix]
  ) {
    prefix += 1;
  }

  let previousSuffix = previous.length - 1;
  let nextSuffix = next.length - 1;
  while (
    previousSuffix >= prefix
    && nextSuffix >= prefix
    && previous[previousSuffix] === next[nextSuffix]
  ) {
    previousSuffix -= 1;
    nextSuffix -= 1;
  }

  return {
    pos: prefix,
    deleteCount: Math.max(0, previousSuffix - prefix + 1),
    insertText: next.slice(prefix, nextSuffix + 1),
  };
}

module.exports = {
  loadCrdtState,
  applyTextOp,
  applyCrdtOperation,
  buildSingleTextOp,
};
