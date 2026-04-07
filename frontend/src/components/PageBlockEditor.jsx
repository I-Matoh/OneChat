import { useEffect, useMemo, useState } from 'react';

const BLOCK_OPTIONS = [
  { type: 'paragraph', label: 'Paragraph' },
  { type: 'heading', label: 'Heading' },
  { type: 'checklist', label: 'Checklist' },
  { type: 'quote', label: 'Quote' },
  { type: 'code', label: 'Code' },
  { type: 'toggle', label: 'Toggle' },
];

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function createBlock(type = 'paragraph') {
  return {
    id: createId('blk'),
    type,
    text: '',
    checked: false,
    collapsed: false,
    level: 1,
    language: '',
    order: 0,
    mentions: [],
  };
}

function mentionToken(mention) {
  if (mention.type === 'user') return `@${mention.label}`;
  if (mention.type === 'page') return `[[${mention.label}]]`;
  return `{{${mention.label}}}`;
}

function syncMentions(block, nextText) {
  return {
    ...block,
    text: nextText,
    mentions: (block.mentions || []).filter((mention) => nextText.includes(mentionToken(mention))),
  };
}

function blocksToPlainText(blocks = []) {
  return blocks.map((block) => {
    if (block.type === 'checklist') return `${block.checked ? '[x]' : '[ ]'} ${block.text}`.trim();
    if (block.type === 'toggle') return `${block.collapsed ? '▶' : '▼'} ${block.text}`.trim();
    return block.text || '';
  }).join('\n\n').trim();
}

function normalizePage(page) {
  const blocks = Array.isArray(page?.blocks) && page.blocks.length
    ? page.blocks.map((block, index) => ({
      ...createBlock(block.type),
      ...block,
      order: typeof block.order === 'number' ? block.order : index,
      mentions: Array.isArray(block.mentions) ? block.mentions : [],
    }))
    : [createBlock('paragraph')];

  return {
    ...page,
    blocks,
    content: typeof page?.content === 'string' ? page.content : blocksToPlainText(blocks),
    commentThreads: Array.isArray(page?.commentThreads) ? page.commentThreads : [],
  };
}

export default function PageBlockEditor({
  page,
  pages,
  documents,
  members,
  saveState,
  extracting,
  extractInfo,
  onPageChange,
  onSave,
  onExtractTasks,
  onCreateThread,
  onReplyThread,
  onResolveThread,
}) {
  const [draft, setDraft] = useState(() => normalizePage(page));
  const [activeBlockId, setActiveBlockId] = useState(null);
  const [slashBlockId, setSlashBlockId] = useState(null);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [replyDrafts, setReplyDrafts] = useState({});

  useEffect(() => {
    setDraft(normalizePage(page));
    setActiveBlockId(page?.blocks?.[0]?.id || null);
    setSlashBlockId(null);
  }, [page]);

  const teammateOptions = useMemo(
    () => (members || [])
      .filter((member) => member.user?._id)
      .map((member) => ({ id: member.user._id, label: member.user.name || member.user.email || member.userId })),
    [members]
  );

  const pageMentionOptions = useMemo(
    () => (pages || [])
      .filter((item) => item._id !== page?._id)
      .map((item) => ({ id: item._id, label: item.title || 'Untitled Page' })),
    [pages, page?._id]
  );

  const documentOptions = useMemo(
    () => (documents || []).map((doc) => ({ id: doc._id, label: doc.title || 'Untitled Document' })),
    [documents]
  );

  const threadsByBlock = useMemo(() => {
    const map = new Map();
    for (const thread of draft.commentThreads || []) {
      const list = map.get(thread.blockId) || [];
      list.push(thread);
      map.set(thread.blockId, list);
    }
    return map;
  }, [draft.commentThreads]);

  const slashItems = useMemo(() => {
    const block = draft.blocks.find((item) => item.id === slashBlockId);
    const query = block?.text?.startsWith('/') ? block.text.slice(1).trim().toLowerCase() : '';
    return BLOCK_OPTIONS.filter((item) => !query || item.label.toLowerCase().includes(query));
  }, [draft.blocks, slashBlockId]);

  function commit(nextPage) {
    setDraft(nextPage);
    onPageChange({
      ...nextPage,
      content: blocksToPlainText(nextPage.blocks),
    });
  }

  function updateBlocks(updater) {
    const nextBlocks = updater(draft.blocks).map((block, index) => ({ ...block, order: index }));
    commit({
      ...draft,
      blocks: nextBlocks,
      content: blocksToPlainText(nextBlocks),
    });
  }

  function updateBlock(blockId, updater) {
    updateBlocks((blocks) => blocks.map((block) => (block.id === blockId ? updater(block) : block)));
  }

  function moveBlock(blockId, direction) {
    updateBlocks((blocks) => {
      const index = blocks.findIndex((block) => block.id === blockId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= blocks.length) return blocks;
      const next = [...blocks];
      const [block] = next.splice(index, 1);
      next.splice(target, 0, block);
      return next;
    });
  }

  function addBlock(type = 'paragraph', afterId = null) {
    updateBlocks((blocks) => {
      const next = [...blocks];
      const block = createBlock(type);
      const index = afterId ? next.findIndex((item) => item.id === afterId) : next.length - 1;
      next.splice(index + 1, 0, block);
      setActiveBlockId(block.id);
      return next;
    });
  }

  function removeBlock(blockId) {
    updateBlocks((blocks) => {
      if (blocks.length === 1) return [createBlock('paragraph')];
      return blocks.filter((block) => block.id !== blockId);
    });
  }

  function insertMention(blockId, mention) {
    updateBlock(blockId, (block) => {
      const token = mentionToken(mention);
      const text = block.text ? `${block.text} ${token}` : token;
      const existing = (block.mentions || []).filter((item) => !(item.type === mention.type && item.refId === mention.refId));
      return {
        ...block,
        text,
        mentions: [...existing, mention],
      };
    });
  }

  function applySlashCommand(blockId, type) {
    updateBlock(blockId, (block) => ({
      ...block,
      type,
      text: block.text.startsWith('/') ? '' : block.text,
      checked: type === 'checklist' ? block.checked : false,
      level: type === 'heading' ? block.level || 1 : 1,
      collapsed: type === 'toggle' ? block.collapsed : false,
      language: type === 'code' ? block.language || 'text' : '',
    }));
    setSlashBlockId(null);
  }

  async function createThread(blockId) {
    const message = (commentDrafts[blockId] || '').trim();
    if (!message) return;
    const block = draft.blocks.find((item) => item.id === blockId);
    const mentionIds = (block?.mentions || []).filter((item) => item.type === 'user').map((item) => item.refId);
    const nextPage = await onCreateThread({
      blockId,
      selectedText: block?.text?.slice(0, 120) || '',
      message,
      mentionedUserIds: mentionIds,
    });
    setCommentDrafts((prev) => ({ ...prev, [blockId]: '' }));
    if (nextPage) setDraft(normalizePage(nextPage));
  }

  async function replyToThread(threadId) {
    const message = (replyDrafts[threadId] || '').trim();
    if (!message) return;
    const nextPage = await onReplyThread({ threadId, message });
    setReplyDrafts((prev) => ({ ...prev, [threadId]: '' }));
    if (nextPage) setDraft(normalizePage(nextPage));
  }

  async function toggleThread(threadId, resolved) {
    const nextPage = await onResolveThread({ threadId, resolved });
    if (nextPage) setDraft(normalizePage(nextPage));
  }

  if (!page) {
    return (
      <div className="empty-state">
        <div className="empty-title">Select a page</div>
        <div className="empty-hint">Create or choose a page to start writing</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <input
        className="input"
        value={draft.title || ''}
        onChange={(e) => commit({ ...draft, title: e.target.value })}
        placeholder="Page title"
      />

      <div className="workspace-table" style={{ display: 'grid', gap: 12, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
            Type `/` inside any block for the slash menu. Use arrows to reorder blocks.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => onSave(draft)}>Save Page</button>
            <button className="btn btn-primary" onClick={onExtractTasks} disabled={extracting}>
              {extracting ? 'Extracting...' : 'Extract Tasks'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 10 }}>
          {draft.blocks.map((block, index) => (
            <div
              key={block.id}
              style={{
                border: activeBlockId === block.id ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                borderRadius: 14,
                background: '#fff',
                padding: 12,
                position: 'relative',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-muted)' }}>
                  {block.type}
                </span>
                <button className="btn btn-ghost" onClick={() => moveBlock(block.id, -1)} disabled={index === 0}>↑</button>
                <button className="btn btn-ghost" onClick={() => moveBlock(block.id, 1)} disabled={index === draft.blocks.length - 1}>↓</button>
                <button className="btn btn-ghost" onClick={() => addBlock('paragraph', block.id)}>+ Block</button>
                <button className="btn btn-ghost" onClick={() => removeBlock(block.id)}>Delete</button>
                <button className="btn btn-ghost" onClick={() => setCommentDrafts((prev) => ({ ...prev, [block.id]: prev[block.id] ?? '' }))}>
                  Comment
                </button>
                <select
                  className="input"
                  style={{ width: 150 }}
                  value=""
                  onChange={(e) => {
                    if (!e.target.value) return;
                    applySlashCommand(block.id, e.target.value);
                    e.target.value = '';
                  }}
                >
                  <option value="">Convert block</option>
                  {BLOCK_OPTIONS.map((option) => (
                    <option key={option.type} value={option.type}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                {block.type === 'checklist' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(block.checked)}
                      onChange={(e) => updateBlock(block.id, (current) => ({ ...current, checked: e.target.checked }))}
                    />
                    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Checked</span>
                  </label>
                )}

                {block.type === 'heading' && (
                  <select
                    className="input"
                    style={{ width: 160 }}
                    value={block.level || 1}
                    onChange={(e) => updateBlock(block.id, (current) => ({ ...current, level: Number(e.target.value) }))}
                  >
                    <option value={1}>Heading 1</option>
                    <option value={2}>Heading 2</option>
                    <option value={3}>Heading 3</option>
                  </select>
                )}

                {block.type === 'code' && (
                  <input
                    className="input"
                    value={block.language || ''}
                    onChange={(e) => updateBlock(block.id, (current) => ({ ...current, language: e.target.value }))}
                    placeholder="Language"
                  />
                )}

                {block.type === 'toggle' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(block.collapsed)}
                      onChange={(e) => updateBlock(block.id, (current) => ({ ...current, collapsed: e.target.checked }))}
                    />
                    <span style={{ fontSize: 12, color: 'var(--color-muted)' }}>Collapsed</span>
                  </label>
                )}

                <textarea
                  className="chat-input"
                  style={{
                    minHeight: block.type === 'code' ? 140 : 90,
                    width: '100%',
                    border: '1px solid var(--color-border)',
                    borderRadius: 12,
                    padding: 12,
                    fontFamily: block.type === 'code' ? 'monospace' : 'inherit',
                    background: block.type === 'quote' ? '#fffaf0' : '#fff',
                  }}
                  value={block.text}
                  onFocus={() => setActiveBlockId(block.id)}
                  onChange={(e) => {
                    const nextText = e.target.value;
                    updateBlock(block.id, (current) => syncMentions(current, nextText));
                    setSlashBlockId(nextText.startsWith('/') ? block.id : null);
                  }}
                  onBlur={() => onSave({ ...draft, content: blocksToPlainText(draft.blocks) })}
                  placeholder={block.type === 'toggle' ? 'Toggle summary...' : 'Write something...'}
                />

                {slashBlockId === block.id && slashItems.length > 0 && (
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 12, overflow: 'hidden', background: '#fffdf8' }}>
                    {slashItems.map((item) => (
                      <button
                        key={item.type}
                        className="workspace-section-item"
                        style={{ borderRadius: 0, width: '100%' }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          applySlashCommand(block.id, item.type);
                        }}
                      >
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <select
                    className="input"
                    style={{ width: 190 }}
                    value=""
                    onChange={(e) => {
                      const selected = teammateOptions.find((item) => item.id === e.target.value);
                      if (selected) {
                        insertMention(block.id, { id: createId('mnt'), type: 'user', refId: selected.id, label: selected.label });
                      }
                      e.target.value = '';
                    }}
                  >
                    <option value="">Mention teammate</option>
                    {teammateOptions.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>

                  <select
                    className="input"
                    style={{ width: 190 }}
                    value=""
                    onChange={(e) => {
                      const selected = pageMentionOptions.find((item) => item.id === e.target.value);
                      if (selected) {
                        insertMention(block.id, { id: createId('mnt'), type: 'page', refId: selected.id, label: selected.label });
                      }
                      e.target.value = '';
                    }}
                  >
                    <option value="">Mention page</option>
                    {pageMentionOptions.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>

                  <select
                    className="input"
                    style={{ width: 190 }}
                    value=""
                    onChange={(e) => {
                      const selected = documentOptions.find((item) => item.id === e.target.value);
                      if (selected) {
                        insertMention(block.id, { id: createId('mnt'), type: 'document', refId: selected.id, label: selected.label });
                      }
                      e.target.value = '';
                    }}
                  >
                    <option value="">Mention document</option>
                    {documentOptions.map((item) => (
                      <option key={item.id} value={item.id}>{item.label}</option>
                    ))}
                  </select>
                </div>

                {(block.mentions || []).length > 0 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {block.mentions.map((mention) => (
                      <span
                        key={mention.id}
                        style={{
                          fontSize: 12,
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: '#eef6ff',
                          color: '#22577a',
                        }}
                      >
                        {mentionToken(mention)}
                      </span>
                    ))}
                  </div>
                )}

                {commentDrafts[block.id] !== undefined && (
                  <div style={{ display: 'grid', gap: 8, marginTop: 4, borderTop: '1px dashed var(--color-border)', paddingTop: 8 }}>
                    <textarea
                      className="chat-input"
                      style={{ minHeight: 84, width: '100%', border: '1px solid var(--color-border)', borderRadius: 12, padding: 10 }}
                      value={commentDrafts[block.id]}
                      onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [block.id]: e.target.value }))}
                      placeholder="Start a comment thread for this block..."
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-secondary" onClick={() => createThread(block.id)}>Post Comment</button>
                      <button
                        className="btn btn-ghost"
                        onClick={() => setCommentDrafts((prev) => {
                          const next = { ...prev };
                          delete next[block.id];
                          return next;
                        })}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {(threadsByBlock.get(block.id) || []).length > 0 && (
                  <div style={{ display: 'grid', gap: 8, marginTop: 6 }}>
                    {(threadsByBlock.get(block.id) || []).map((thread) => (
                      <div key={thread.id} style={{ border: '1px solid var(--color-border)', borderRadius: 12, padding: 10, background: thread.resolved ? '#f7faf7' : '#fcfcff' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                            {thread.selectedText || 'Comment thread'}
                          </div>
                          <button className="btn btn-ghost" onClick={() => toggleThread(thread.id, !thread.resolved)}>
                            {thread.resolved ? 'Reopen' : 'Resolve'}
                          </button>
                        </div>
                        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                          {(thread.replies || []).map((reply) => (
                            <div key={reply.id} style={{ fontSize: 13 }}>
                              {reply.message}
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                          <textarea
                            className="chat-input"
                            style={{ minHeight: 74, width: '100%', border: '1px solid var(--color-border)', borderRadius: 12, padding: 10 }}
                            value={replyDrafts[thread.id] || ''}
                            onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [thread.id]: e.target.value }))}
                            placeholder="Reply to this thread..."
                          />
                          <button className="btn btn-secondary" onClick={() => replyToThread(thread.id)}>Reply</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {BLOCK_OPTIONS.map((option) => (
            <button key={option.type} className="btn btn-ghost" onClick={() => addBlock(option.type, draft.blocks[draft.blocks.length - 1]?.id)}>
              + {option.label}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>{saveState}</div>
        {extractInfo && <div style={{ color: 'var(--color-muted)', fontSize: 12 }}>{extractInfo}</div>}
      </div>
    </div>
  );
}
