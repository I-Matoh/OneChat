import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getSocket, useSocketEvent } from '../hooks/useSocket';
import { useApi } from '../hooks/useApi';

const MaterialIcon = ({ icon, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`}>{icon}</span>
);

export default function Editor({ activeDocId, setActiveDocId, documents, setDocuments, onCreateDocument }) {
  const { user, token } = useAuth();
  const { apiFetch } = useApi();
  const [doc, setDoc] = useState(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [collaborators, setCollaborators] = useState([]);
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [cursorPositions, setCursorPositions] = useState({});
  const [showAI, setShowAI] = useState(false);
  const saveTimeout = useRef(null);
  const revisionRef = useRef(0);
  const baseContentRef = useRef('');

  useEffect(() => {
    if (!activeDocId) return;
    apiFetch(`/docs/${activeDocId}`).then((nextDoc) => {
      setDoc(nextDoc);
      setContent(nextDoc.content || '');
      setTitle(nextDoc.title || '');
      setCollaborators(nextDoc.collaborators || []);
      revisionRef.current = nextDoc.revision || 0;
      baseContentRef.current = nextDoc.content || '';
    }).catch(() => {});
  }, [activeDocId, apiFetch]);

  useEffect(() => {
    if (!activeDocId || !token) return;
    const s = getSocket(token);
    s.emit('doc:join', activeDocId);
    return () => {
      s.emit('doc:leave', activeDocId);
    };
  }, [activeDocId, token]);

  useSocketEvent('doc:update', useCallback((data) => {
    if (data.docId === activeDocId && data.editedBy !== user.id) {
      setTitle(data.title || '');
      setContent(data.content);
      revisionRef.current = data.revision || revisionRef.current;
      baseContentRef.current = data.content || '';
      setSaveStatus(data.conflict ? `Conflict merged from ${data.editorName}` : `Edited by ${data.editorName}`);
      setTimeout(() => setSaveStatus('Synced'), 2000);
    }
  }, [activeDocId, user.id]));

  useSocketEvent('doc:sync', useCallback((data) => {
    if (data.docId !== activeDocId) return;
    setTitle(data.title || '');
    setContent(data.content || '');
    revisionRef.current = data.revision || 0;
    baseContentRef.current = data.content || '';
    setSaveStatus('Synced');
  }, [activeDocId]));

  useSocketEvent('doc:ack', useCallback((data) => {
    if (data.docId !== activeDocId) return;
    revisionRef.current = data.revision || revisionRef.current;
    baseContentRef.current = data.content || '';
    setContent(data.content || '');
    setSaveStatus(data.conflict ? 'Merged with conflicts' : 'Saved');
  }, [activeDocId]));

  useSocketEvent('doc:cursor', useCallback((data) => {
    if (data.userId !== user.id) {
      setCursorPositions((prev) => ({ ...prev, [data.userId]: data }));
    }
  }, [user.id]));

  useSocketEvent('doc:user-joined', useCallback((data) => {
    setCollaborators((prev) => {
      if (prev.find((c) => (c._id || c) === data.userId)) return prev;
      return [...prev, { _id: data.userId, name: data.userName }];
    });
  }, []));

  useSocketEvent('doc:user-left', useCallback((data) => {
    setCursorPositions((prev) => {
      const next = { ...prev };
      delete next[data.userId];
      return next;
    });
  }, []));

  useSocketEvent('doc:cursors', useCallback((data) => {
    setCursorPositions(data);
  }, []));

  function syncDocumentList(nextTitle, nextUpdatedAt = new Date().toISOString()) {
    setDocuments((prev) => prev.map((item) => (
      item._id === activeDocId ? { ...item, title: nextTitle, updatedAt: nextUpdatedAt } : item
    )));
  }

  function handleContentChange(e) {
    const val = e.target.value;
    setContent(val);
    setSaveStatus('Editing...');

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      const s = getSocket(token);
      s.emit('doc:update', {
        docId: activeDocId,
        title,
        content: val,
        baseRevision: revisionRef.current,
        baseContent: baseContentRef.current,
      });
      setSaveStatus('Saving...');
      syncDocumentList(title);
    }, 500);

    const s = getSocket(token);
    const lines = val.substring(0, e.target.selectionStart).split('\n');
    s.emit('doc:cursor', {
      docId: activeDocId,
      line: lines.length,
      ch: lines[lines.length - 1].length,
    });
  }

  async function persistTitle() {
    try {
      const updated = await apiFetch(`/docs/${activeDocId}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      });
      setDoc(updated);
      syncDocumentList(updated.title, updated.updatedAt);
    } catch {
      setSaveStatus('Unable to save title');
    }
  }

  if (!activeDocId) {
    return (
      <div className="editor-empty-state">
        <div className="editor-empty-icon">
          <MaterialIcon icon="description" />
        </div>
        <div className="editor-empty-title">Select a document</div>
        <div className="editor-empty-hint">Choose a live document or create a new one</div>
        <div style={{ display: 'grid', gap: 12, width: 'min(680px, 100%)', marginTop: 24 }}>
          {documents.map((item) => (
            <button
              key={item._id}
              className="workspace-section-item"
              style={{ justifyContent: 'space-between' }}
              onClick={() => setActiveDocId(item._id)}
            >
              <span>{item.title || 'Untitled Document'}</span>
              <span style={{ color: 'var(--color-muted)', fontSize: 12 }}>
                {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : ''}
              </span>
            </button>
          ))}
          <button className="btn btn-primary" onClick={onCreateDocument}>Create document</button>
        </div>
      </div>
    );
  }

  return (
    <div className="collab-editor-layout">
      <div className="collab-main">
        <div className="collab-header">
          <div className="collab-header-left">
            <MaterialIcon icon="article" className="collab-doc-icon" />
            <input
              className="collab-title-input"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                syncDocumentList(e.target.value);
              }}
              onBlur={persistTitle}
              placeholder="Untitled Document"
            />
          </div>
          <div className="collab-header-right">
            <div className="collab-avatars">
              {collaborators.slice(0, 4).map((c, i) => (
                <div key={c._id || i} className="collab-avatar" title={c.name || 'User'}>
                  {(c.name || '?')[0].toUpperCase()}
                </div>
              ))}
              {collaborators.length > 4 && (
                <div className="collab-avatar collab-avatar-more">+{collaborators.length - 4}</div>
              )}
            </div>
            <button
              className="collab-ai-btn"
              onClick={() => setShowAI(!showAI)}
            >
              <MaterialIcon icon="bolt" className="collab-ai-icon" />
              AI Assistant
            </button>
          </div>
        </div>

        <div className="collab-toolbar">
          <button className="collab-tool-btn">
            <MaterialIcon icon="text_fields" />
          </button>
          <div className="collab-toolbar-divider" />
          <button className="collab-tool-btn">
            <MaterialIcon icon="format_bold" />
          </button>
          <button className="collab-tool-btn">
            <MaterialIcon icon="format_italic" />
          </button>
          <button className="collab-tool-btn">
            <MaterialIcon icon="format_underlined" />
          </button>
          <div className="collab-toolbar-divider" />
          <button className="collab-tool-btn">
            <MaterialIcon icon="format_list_bulleted" />
          </button>
          <button className="collab-tool-btn">
            <MaterialIcon icon="format_list_numbered" />
          </button>
          <div className="collab-toolbar-divider" />
          <button className="collab-tool-btn">
            <MaterialIcon icon="link" />
          </button>
          <button className="collab-tool-btn">
            <MaterialIcon icon="add_comment" />
          </button>
        </div>

        <div className="collab-content">
          <div className="collab-editor-wrapper">
            <div className="collab-cursors">
              {Object.entries(cursorPositions).map(([userId, data]) => (
                <div
                  key={userId}
                  className="collab-cursor"
                  style={{
                    top: (data.line - 1) * 24,
                    left: data.ch * 8 + 20,
                  }}
                >
                  <div className="collab-cursor-line" />
                  <div className="collab-cursor-label">{data.userName}</div>
                </div>
              ))}
            </div>
            <textarea
              className="collab-textarea"
              value={content}
              onChange={handleContentChange}
              placeholder="Start writing..."
              id="document-editor"
            />
          </div>
        </div>

        <div className="collab-footer">
          <div className="collab-status">
            <span className="collab-status-dot" />
            <span>{saveStatus}</span>
          </div>
          <div className="collab-collab-count">
            {Object.keys(cursorPositions).length} collaborator(s) editing
          </div>
        </div>
      </div>

      <aside className={`collab-ai-panel ${showAI ? 'open' : ''}`}>
        <div className="ai-panel-header">
          <div className="ai-panel-title">
            <MaterialIcon icon="auto_awesome" />
            Assistant
          </div>
          <button className="ai-panel-close" onClick={() => setShowAI(false)}>
            <MaterialIcon icon="close" />
          </button>
        </div>
        <div className="ai-panel-content">
          <div className="ai-actions">
            <button className="ai-action-btn">
              <MaterialIcon icon="summarize" className="ai-action-icon" />
              <div>
                <div className="ai-action-title">Summarize document</div>
                <div className="ai-action-desc">Extract key takeaways and action items</div>
              </div>
            </button>
            <button className="ai-action-btn">
              <MaterialIcon icon="task_alt" className="ai-action-icon" />
              <div>
                <div className="ai-action-title">Extract tasks</div>
                <div className="ai-action-desc">Create tickets from mentioned tasks</div>
              </div>
            </button>
            <button className="ai-action-btn">
              <MaterialIcon icon="spellcheck" className="ai-action-icon" />
              <div>
                <div className="ai-action-title">Fix grammar & tone</div>
                <div className="ai-action-desc">Refine writing professionally</div>
              </div>
            </button>
          </div>
        </div>
        <div className="ai-panel-footer">
          <div className="ai-metadata">
            <div className="ai-metadata-item">
              <span>Last edited</span>
              <span>{doc?.updatedAt ? new Date(doc.updatedAt).toLocaleTimeString() : 'Just now'}</span>
            </div>
            <div className="ai-metadata-item">
              <span>Reading time</span>
              <span>{Math.max(1, Math.ceil(content.split(/\s+/).filter(Boolean).length / 180))} mins</span>
            </div>
            <div className="ai-metadata-item">
              <span>Visibility</span>
              <span className="ai-visibility-badge">
                <MaterialIcon icon="lock" />
                Team-only
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
