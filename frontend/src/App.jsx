import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useSocket } from './hooks/useSocket';
import { useApi } from './hooks/useApi';
import Login from './pages/Login';
import Chat from './pages/Chat';
import Editor from './pages/Editor';
import PresenceSidebar from './components/PresenceSidebar';
import NotificationBell from './components/NotificationBell';
import NewConvModal from './components/NewConvModal';

function AppShell() {
  const { user, token, loading, logout } = useAuth();
  const { connected } = useSocket(token);
  const { apiFetch } = useApi();

  const [view, setView] = useState('chat'); // 'chat' | 'editor'
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [showNewConv, setShowNewConv] = useState(false);
  const [showNewDoc, setShowNewDoc] = useState(false);

  // Load conversations
  useEffect(() => {
    if (!token) return;
    apiFetch('/chat/conversations').then(setConversations).catch(() => {});
  }, [token]);

  // Load documents
  useEffect(() => {
    if (!token) return;
    apiFetch('/docs').then(setDocuments).catch(() => {});
  }, [token]);

  async function createDocument() {
    const doc = await apiFetch('/docs', {
      method: 'POST',
      body: JSON.stringify({ title: 'Untitled Document' }),
    });
    setDocuments((prev) => [doc, ...prev]);
    setActiveDocId(doc._id);
    setView('editor');
  }

  if (loading) {
    return (
      <div className="auth-page">
        <div style={{ color: 'var(--text-muted)', fontSize: 16 }}>Loading...</div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="app-layout">
      {/* ===== Sidebar ===== */}
      <div className="sidebar">
        <div className="sidebar-header">
          <img src="/logo.png" alt="OneChat" className="sidebar-logo" />
          <span className="sidebar-title">OneChat</span>
        </div>

        <div className="sidebar-nav">
          <button
            className={`sidebar-nav-item ${view === 'chat' ? 'active' : ''}`}
            onClick={() => setView('chat')}
          >
            <span className="icon">💬</span>
            <span>Chat</span>
          </button>
          <button
            className={`sidebar-nav-item ${view === 'editor' ? 'active' : ''}`}
            onClick={() => setView('editor')}
          >
            <span className="icon">📝</span>
            <span>Documents</span>
          </button>
        </div>

        {/* Conditional list based on view */}
        {view === 'chat' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
              <div className="sidebar-section-title" style={{ padding: 0 }}>Conversations</div>
              <button
                className="btn-icon"
                onClick={() => setShowNewConv(true)}
                title="New conversation"
                style={{ fontSize: 18 }}
              >
                ＋
              </button>
            </div>
            <div className="sidebar-list">
              {conversations.map((conv) => {
                const displayName = conv.name ||
                  conv.participants?.filter((p) => (p._id || p) !== user.id).map((p) => p.name || 'User').join(', ') ||
                  'Chat';
                return (
                  <div
                    key={conv._id}
                    className={`conv-item ${activeConvId === conv._id ? 'active' : ''}`}
                    onClick={() => { setActiveConvId(conv._id); setView('chat'); }}
                  >
                    <div className="conv-avatar">{displayName[0].toUpperCase()}</div>
                    <div className="conv-info">
                      <div className="conv-name">{displayName}</div>
                      <div className="conv-last-msg">{conv.lastMessage || 'No messages yet'}</div>
                    </div>
                  </div>
                );
              })}
              {conversations.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 14px', textAlign: 'center' }}>
                  No conversations yet
                </div>
              )}
            </div>
          </>
        )}

        {view === 'editor' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px' }}>
              <div className="sidebar-section-title" style={{ padding: 0 }}>Documents</div>
              <button
                className="btn-icon"
                onClick={createDocument}
                title="New document"
                style={{ fontSize: 18 }}
              >
                ＋
              </button>
            </div>
            <div className="sidebar-list">
              {documents.map((doc) => (
                <div
                  key={doc._id}
                  className={`doc-item ${activeDocId === doc._id ? 'active' : ''}`}
                  onClick={() => { setActiveDocId(doc._id); setView('editor'); }}
                >
                  <span className="doc-item-icon">📄</span>
                  <span>{doc.title || 'Untitled'}</span>
                </div>
              ))}
              {documents.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '12px 14px', textAlign: 'center' }}>
                  No documents yet
                </div>
              )}
            </div>
          </>
        )}

        {/* User info at bottom */}
        <div style={{
          marginTop: 'auto', padding: '12px 16px', borderTop: '1px solid var(--border-color)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="conv-avatar" style={{ width: 28, height: 28, fontSize: 12 }}>
              {user.name[0].toUpperCase()}
            </div>
            <span style={{ fontSize: 13, fontWeight: 500 }}>{user.name}</span>
          </div>
          <button className="btn-icon" onClick={logout} title="Sign out" style={{ fontSize: 14 }}>
            ⏻
          </button>
        </div>
      </div>

      {/* ===== Main Content ===== */}
      <div className="main-content">
        <div className="top-bar">
          <div className="top-bar-left">
            <div className="top-bar-title">
              {view === 'chat' ? '💬 Chat' : '📝 Documents'}
            </div>
            <div className="presence-dot online" title="Connected" style={{ marginLeft: 4 }} />
          </div>
          <div className="top-bar-right">
            <NotificationBell />
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {connected ? '🟢 Live' : '🔴 Offline'}
            </div>
          </div>
        </div>

        {view === 'chat' ? (
          <Chat
            activeConvId={activeConvId}
            setActiveConvId={setActiveConvId}
            conversations={conversations}
            setConversations={setConversations}
          />
        ) : (
          <Editor
            activeDocId={activeDocId}
            setActiveDocId={setActiveDocId}
            documents={documents}
            setDocuments={setDocuments}
          />
        )}
      </div>

      {/* ===== Presence Panel ===== */}
      <PresenceSidebar />

      {/* ===== Modals ===== */}
      {showNewConv && (
        <NewConvModal
          onClose={() => setShowNewConv(false)}
          onCreate={(conv) => {
            setConversations((prev) => [conv, ...prev]);
            setActiveConvId(conv._id);
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
