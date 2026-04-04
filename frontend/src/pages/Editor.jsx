import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getSocket, useSocketEvent } from '../hooks/useSocket';
import { useApi } from '../hooks/useApi';

const MaterialIcon = ({ icon, className = '' }) => (
  <span className={`material-symbols-outlined ${className}`}>{icon}</span>
);

export default function Editor({ activeDocId, setActiveDocId, documents, setDocuments }) {
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
  const isRemoteUpdate = useRef(false);

  useEffect(() => {
    if (!activeDocId) return;
    apiFetch(`/docs/${activeDocId}`).then((d) => {
      setDoc(d);
      setContent(d.content || '');
      setTitle(d.title || '');
      setCollaborators(d.collaborators || []);
    }).catch(() => {});
  }, [activeDocId]);

  useEffect(() => {
    if (!activeDocId || !token) return;
    const s = getSocket(token);
    s.emit('doc:join', activeDocId);
    return () => { s.emit('doc:leave', activeDocId); };
  }, [activeDocId, token]);

  useSocketEvent('doc:update', useCallback((data) => {
    if (data.docId === activeDocId && data.editedBy !== user.id) {
      isRemoteUpdate.current = true;
      setContent(data.content);
      setSaveStatus(`Edited by ${data.editorName}`);
      setTimeout(() => setSaveStatus('Synced'), 2000);
    }
  }, [activeDocId, user]));

  useSocketEvent('doc:cursor', useCallback((data) => {
    if (data.userId !== user.id) {
      setCursorPositions((prev) => ({ ...prev, [data.userId]: data }));
    }
  }, [user]));

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

  function handleContentChange(e) {
    const val = e.target.value;
    setContent(val);
    setSaveStatus('Editing...');

    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      const s = getSocket(token);
      s.emit('doc:update', { docId: activeDocId, content: val });
      setSaveStatus('Saved');
    }, 500);

    const s = getSocket(token);
    const lines = val.substring(0, e.target.selectionStart).split('\n');
    s.emit('doc:cursor', {
      docId: activeDocId,
      line: lines.length,
      ch: lines[lines.length - 1].length,
    });
  }

  if (!activeDocId) {
    return (
      <div className="editor-empty-state">
        <div className="editor-empty-icon">
          <MaterialIcon icon="description" />
        </div>
        <div className="editor-empty-title">Select a document</div>
        <div className="editor-empty-hint">Choose from the sidebar or create a new one</div>
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
              onChange={(e) => setTitle(e.target.value)}
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
                    left: data.ch * 8 + 20
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
            <span className="ai-panel-badge">Beta</span>
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
              <span>2 mins ago</span>
            </div>
            <div className="ai-metadata-item">
              <span>Reading time</span>
              <span>4 mins</span>
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
