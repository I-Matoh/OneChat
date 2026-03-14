import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getSocket, useSocketEvent } from '../hooks/useSocket';
import { useApi } from '../hooks/useApi';

export default function Editor({ activeDocId, setActiveDocId, documents, setDocuments }) {
  const { user, token } = useAuth();
  const { apiFetch } = useApi();
  const [doc, setDoc] = useState(null);
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [collaborators, setCollaborators] = useState([]);
  const [saveStatus, setSaveStatus] = useState('Saved');
  const [cursorPositions, setCursorPositions] = useState({});
  const saveTimeout = useRef(null);
  const isRemoteUpdate = useRef(false);

  // Load document
  useEffect(() => {
    if (!activeDocId) return;
    apiFetch(`/docs/${activeDocId}`).then((d) => {
      setDoc(d);
      setContent(d.content || '');
      setTitle(d.title || '');
      setCollaborators(d.collaborators || []);
    }).catch(() => {});
  }, [activeDocId]);

  // Join doc room
  useEffect(() => {
    if (!activeDocId || !token) return;
    const s = getSocket(token);
    s.emit('doc:join', activeDocId);
    return () => { s.emit('doc:leave', activeDocId); };
  }, [activeDocId, token]);

  // Remote document updates
  useSocketEvent('doc:update', useCallback((data) => {
    if (data.docId === activeDocId && data.editedBy !== user.id) {
      isRemoteUpdate.current = true;
      setContent(data.content);
      setSaveStatus(`Edited by ${data.editorName}`);
      setTimeout(() => setSaveStatus('Synced'), 2000);
    }
  }, [activeDocId, user]));

  // Cursor updates
  useSocketEvent('doc:cursor', useCallback((data) => {
    if (data.userId !== user.id) {
      setCursorPositions((prev) => ({ ...prev, [data.userId]: data }));
    }
  }, [user]));

  // User joined
  useSocketEvent('doc:user-joined', useCallback((data) => {
    setCollaborators((prev) => {
      if (prev.find((c) => (c._id || c) === data.userId)) return prev;
      return [...prev, { _id: data.userId, name: data.userName }];
    });
  }, []));

  // User left
  useSocketEvent('doc:user-left', useCallback((data) => {
    setCursorPositions((prev) => {
      const next = { ...prev };
      delete next[data.userId];
      return next;
    });
  }, []));

  // Cursors
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

    // Send cursor position
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
      <div className="empty-state">
        <div className="empty-state-icon">📝</div>
        <div className="empty-state-text">Select a document</div>
        <div className="empty-state-hint">Choose from the sidebar or create a new one</div>
      </div>
    );
  }

  return (
    <div className="editor-container">
      <div className="editor-toolbar">
        <input
          className="editor-title-input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled Document"
        />
        <div className="editor-collaborators">
          {collaborators.slice(0, 5).map((c, i) => (
            <div key={c._id || i} className="editor-collab-avatar" title={c.name || 'User'}>
              {(c.name || '?')[0].toUpperCase()}
            </div>
          ))}
          {collaborators.length > 5 && (
            <div className="editor-collab-avatar">+{collaborators.length - 5}</div>
          )}
        </div>
      </div>

      <textarea
        className="editor-textarea"
        value={content}
        onChange={handleContentChange}
        placeholder="Start typing..."
        id="document-editor"
      />

      <div className="editor-status">
        <span>{saveStatus}</span>
        <span>{Object.keys(cursorPositions).length} collaborator(s) editing</span>
      </div>
    </div>
  );
}
