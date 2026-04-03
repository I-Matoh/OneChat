import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useSocket, useSocketEvent, getSocket } from './hooks/useSocket';
import { useApi } from './hooks/useApi';
import Login from './pages/Login';
import Chat from './pages/Chat';
import Editor from './pages/Editor';
import Workspace from './pages/Workspace';
import PresenceSidebar from './components/PresenceSidebar';
import NotificationBell from './components/NotificationBell';
import NewConvModal from './components/NewConvModal';

// Icons as simple SVG components
const HomeIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const ShareIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
  </svg>
);

const ChatIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const DocIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const GridIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const LogoutIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const FolderIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

// Sample workspace data
const sampleSpaces = [
  { id: '1', name: 'My Notes', icon: '📝' },
  { id: '2', name: 'Team Hub', icon: '👥' },
  { id: '3', name: 'Projects', icon: '📁' },
  { id: '4', name: 'Customer Calls', icon: '📞' },
];

function AppShell() {
  const { user, token, loading, logout } = useAuth();
  const { connected } = useSocket(token);
  const { apiFetch } = useApi();

  const [view, setView] = useState('workspace'); // 'home' | 'shared' | 'chat' | 'editor' | 'workspace'
  const [activeNav, setActiveNav] = useState('home');
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [showNewConv, setShowNewConv] = useState(false);
  const [showNewDoc, setShowNewDoc] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Handle new conversation created by another user
  useSocketEvent('conversation:new', (conv) => {
    setConversations((prev) => {
      if (prev.find((c) => c._id === conv._id)) return prev;
      return [conv, ...prev];
    });
  }, []);

  // Handle conversation updates (new messages from other users)
  useSocketEvent('conversation:updated', (data) => {
    setConversations((prev) =>
      prev.map((c) =>
        c._id === data.conversationId
          ? { ...c, lastMessage: data.lastMessage, updatedAt: data.updatedAt }
          : c
      ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    );
  }, []);

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
      <div className="loading-page">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-search">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <nav className="app-nav">
          <button
            className={`app-nav-item ${activeNav === 'home' ? 'active' : ''}`}
            onClick={() => { setActiveNav('home'); setView('workspace'); }}
          >
            <HomeIcon />
            <span>Home</span>
          </button>
          <button
            className={`app-nav-item ${activeNav === 'shared' ? 'active' : ''}`}
            onClick={() => { setActiveNav('shared'); setView('workspace'); }}
          >
            <ShareIcon />
            <span>Shared with me</span>
          </button>
          <button
            className={`app-nav-item ${activeNav === 'chat' ? 'active' : ''}`}
            onClick={() => { setActiveNav('chat'); setView('chat'); }}
          >
            <ChatIcon />
            <span>Chat</span>
          </button>
        </nav>

        <div className="app-spaces">
          <div className="app-spaces-header">
            <span>Spaces</span>
            <button className="app-spaces-btn" title="Add space">
              <PlusIcon />
            </button>
          </div>
          <div>
            {sampleSpaces.map((space) => (
              <button
                key={space.id}
                className="app-space-item"
                onClick={() => { setActiveNav('home'); setView('workspace'); }}
              >
                <span>{space.icon}</span>
                <span className="truncate">{space.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="app-footer">
          <div className="app-user">
            <div className="app-user-avatar">
              {user.name[0].toUpperCase()}
            </div>
            <span className="app-user-name">{user.name}</span>
          </div>
          <button className="app-logout-btn" onClick={logout} title="Sign out">
            <LogoutIcon />
          </button>
        </div>
      </aside>

      <main className="app-main">
        <header className="app-main-header">
          <div className="app-breadcrumb">
            <span className="app-breadcrumb-path">
              {activeNav === 'home' ? 'Home' : activeNav === 'shared' ? 'Shared with me' : 'Chat'}
            </span>
            <span className="app-breadcrumb-sep">/</span>
            <span className="app-breadcrumb-current">
              {view === 'workspace' ? 'Team Hub' : view === 'chat' ? 'Conversations' : 'Documents'}
            </span>
          </div>
          <div className="app-main-actions">
            <NotificationBell />
            <div className="app-status">
              {connected ? (
                <span><span className="app-status-dot"></span>Live</span>
              ) : (
                <span>Offline</span>
              )}
            </div>
          </div>
        </header>

        <div className="app-content">
          {view === 'workspace' ? (
            <Workspace />
          ) : view === 'chat' ? (
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
      </main>

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
