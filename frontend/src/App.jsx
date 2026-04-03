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

function AppShell() {
  const { user, token, loading, logout } = useAuth();
  const { connected } = useSocket(token);
  const { apiFetch } = useApi();

  const [view, setView] = useState('workspace'); // 'chat' | 'editor' | 'workspace'
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
      <div className="h-screen flex items-center justify-center bg-[#f7f7f7]">
        <div className="text-gray-500 text-base">Loading...</div>
      </div>
    );
  }

  if (!user) return <Login />;

  return (
    // Full height app layout with flex
    <div className="h-screen flex bg-[#f7f7f7]">
      {/* ===== Left Sidebar - Fixed width 260px ===== */}
      <aside className="w-[260px] min-w-[260px] bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        {/* Sidebar Header */}
        <div className="p-5 border-b border-gray-100 flex justify-center gap-3">
          <img src="/logo.png" alt="OneChat" className="w-10 h-10 object-contain rounded-xl" />
          <span className="text-xl font-semibold text-gray-900">OneChat</span>
        </div>

        {/* Navigation */}
        <nav className="p-4 flex flex-col gap-1">
          <button
            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 font-medium text-sm border-none bg-none w-full text-left ${
              view === 'workspace' 
                ? 'bg-gray-100 text-gray-900' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
            onClick={() => setView('workspace')}
          >
            <GridIcon />
            <span>Workspace</span>
          </button>
          <button
            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 font-medium text-sm border-none bg-none w-full text-left ${
              view === 'chat' 
                ? 'bg-gray-100 text-gray-900' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
            onClick={() => setView('chat')}
          >
            <ChatIcon />
            <span>Chat</span>
          </button>
          <button
            className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 font-medium text-sm border-none bg-none w-full text-left ${
              view === 'editor' 
                ? 'bg-gray-100 text-gray-900' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
            onClick={() => setView('editor')}
          >
            <DocIcon />
            <span>Documents</span>
          </button>
        </nav>

        {/* Conditional list based on view - Conversations */}
        {view === 'chat' && (
          <>
            <div className="flex items-center justify-between px-4 py-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Conversations</div>
              <button
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                onClick={() => setShowNewConv(true)}
                title="New conversation"
              >
                <PlusIcon />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {conversations.map((conv) => {
                const displayName = conv.name ||
                  conv.participants?.filter((p) => (p._id || p) !== user.id).map((p) => p.name || 'User').join(', ') ||
                  'Chat';
                return (
                  <div
                    key={conv._id}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                      activeConvId === conv._id 
                        ? 'bg-gray-100' 
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => { setActiveConvId(conv._id); setView('chat'); }}
                  >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                      {displayName[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{displayName}</div>
                      <div className="text-xs text-gray-400 truncate">{conv.lastMessage || 'No messages yet'}</div>
                    </div>
                  </div>
                );
              })}
              {conversations.length === 0 && (
                <div className="text-gray-400 text-sm text-center py-3">
                  No conversations yet
                </div>
              )}
            </div>
          </>
        )}

        {/* Conditional list based on view - Documents */}
        {view === 'editor' && (
          <>
            <div className="flex items-center justify-between px-4 py-2">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Documents</div>
              <button
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                onClick={createDocument}
                title="New document"
              >
                <PlusIcon />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {documents.map((doc) => (
                <div
                  key={doc._id}
                  className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all duration-200 ${
                    activeDocId === doc._id 
                      ? 'bg-gray-100 text-gray-900' 
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  onClick={() => { setActiveDocId(doc._id); setView('editor'); }}
                >
                  <span className="text-base opacity-80">📄</span>
                  <span className="text-sm">{doc.title || 'Untitled'}</span>
                </div>
              ))}
              {documents.length === 0 && (
                <div className="text-gray-400 text-sm text-center py-3">
                  No documents yet
                </div>
              )}
            </div>
          </>
        )}

        {/* User info at bottom */}
        <div className="mt-auto p-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-white font-semibold text-xs">
              {user.name[0].toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-700">{user.name}</span>
          </div>
          <button 
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" 
            onClick={logout} 
            title="Sign out"
          >
            <LogoutIcon />
          </button>
        </div>
      </aside>

      {/* ===== Main Content Area - flex-1 ===== */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Top Header */}
        <header className="h-16 min-h-16 border-b border-gray-200 flex items-center justify-between px-7 bg-white relative">
          <div className="flex items-center gap-2">
            <div className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              {view === 'workspace' ? (
                <>
                  <GridIcon />
                  <span>Workspace</span>
                </>
              ) : view === 'chat' ? (
                <>
                  <ChatIcon />
                  <span>Chat</span>
                </>
              ) : (
                <>
                  <DocIcon />
                  <span>Documents</span>
                </>
              )}
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" title="Connected" />
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="text-xs text-gray-400">
              {connected ? '🟢 Live' : '🔴 Offline'}
            </div>
          </div>
        </header>

        {/* Content Panel */}
        <div className="flex-1 overflow-hidden">
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
