import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useSocket, useSocketEvent, getSocket } from './hooks/useSocket';
import { useApi } from './hooks/useApi';
import Login from './pages/Login';
import HomeScreen from './pages/HomeScreen';
import Chat from './pages/Chat';
import Editor from './pages/Editor';
import Workspace from './pages/Workspace';
import NotificationBell from './components/NotificationBell';
import NewConvModal from './components/NewConvModal';

const MenuIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const PanelRightIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const PanelLeftIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

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
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h8l5 5v13a1 1 0 01-1 1H7a2 2 0 01-2-2V5a2 2 0 012-2zm8 1v5h5" />
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

const EMPTY_SEARCH_RESULTS = {
  workspaces: [],
  pages: [],
  documents: [],
  conversations: [],
};

function AppShell() {
  const { user, token, loading, logout } = useAuth();
  const { connected } = useSocket(token);
  const { apiFetch } = useApi();

  const [view, setView] = useState('home');
  const [activeNav, setActiveNav] = useState('home');
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(null);
  const [showNewConv, setShowNewConv] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(EMPTY_SEARCH_RESULTS);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [activities, setActivities] = useState([]);
  const commandInputRef = useRef(null);

  useEffect(() => {
    if (!token) return;
    apiFetch('/chat/conversations').then(setConversations).catch(() => {});
  }, [token, apiFetch]);

  useEffect(() => {
    if (!token) return;
    apiFetch('/docs').then(setDocuments).catch(() => {});
  }, [token, apiFetch]);

  useEffect(() => {
    if (!token) return;
    apiFetch('/workspaces').then(setWorkspaces).catch(() => {});
  }, [token, apiFetch]);

  useEffect(() => {
    if (!token) return;
    apiFetch('/activity?limit=20').then(setActivities).catch(() => {});
  }, [token, apiFetch]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      apiFetch('/activity?limit=20').then(setActivities).catch(() => {});
    }, 20000);
    return () => clearInterval(interval);
  }, [token, apiFetch]);

  useEffect(() => {
    if (!token) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults(EMPTY_SEARCH_RESULTS);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const result = await apiFetch(`/search?q=${encodeURIComponent(q)}`);
        setSearchResults(result?.results || EMPTY_SEARCH_RESULTS);
      } catch {
        setSearchResults(EMPTY_SEARCH_RESULTS);
      }
    }, 220);
    return () => clearTimeout(timeout);
  }, [searchQuery, token, apiFetch]);

  const closeCommandPalette = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setActiveCommandIndex(0);
  }, []);

  useEffect(() => {
    if (!token || !connected) return;
    const socket = getSocket(token);

    const handleInit = (users) => setOnlineUsers(users);
    const handleUpdate = (data) => {
      setOnlineUsers((prev) => {
        const existing = prev.findIndex((u) => u.userId === data.userId);
        if (data.status === 'offline') return prev.filter((u) => u.userId !== data.userId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = { ...updated[existing], ...data };
          return updated;
        }
        return [...prev, data];
      });
    };

    socket.on('presence:init', handleInit);
    socket.on('presence:update', handleUpdate);

    return () => {
      socket.off('presence:init', handleInit);
      socket.off('presence:update', handleUpdate);
    };
  }, [token, connected]);

  useSocketEvent('conversation:new', (conv) => {
    setConversations((prev) => {
      if (prev.find((c) => c._id === conv._id)) return prev;
      return [conv, ...prev];
    });
  }, []);

  useSocketEvent('conversation:updated', (data) => {
    setConversations((prev) => (
      prev
        .map((c) => (
          c._id === data.conversationId
            ? { ...c, lastMessage: data.lastMessage, updatedAt: data.updatedAt }
            : c
        ))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    ));
  }, []);

  useSocketEvent('activity:new', (activity) => {
    setActivities((prev) => [activity, ...prev].slice(0, 30));
  }, []);

  async function createDocument() {
    const doc = await apiFetch('/docs', {
      method: 'POST',
      body: JSON.stringify({ title: 'Untitled Document' }),
    });
    setDocuments((prev) => [doc, ...prev]);
    setActiveDocId(doc._id);
    setView('editor');
    setActiveNav('docs');
  }

  async function createWorkspace() {
    const nextNumber = (workspaces?.length || 0) + 1;
    const created = await apiFetch('/workspaces', {
      method: 'POST',
      body: JSON.stringify({ name: `Workspace ${nextNumber}` }),
    });
    setWorkspaces((prev) => [created, ...prev]);
    setActiveNav('workspace');
    setView('workspace');
  }

  function openHome() {
    setActiveNav('home');
    setView('home');
    setMobileSidebarOpen(false);
  }

  function openWorkspace() {
    setActiveNav('workspace');
    setView('workspace');
    setMobileSidebarOpen(false);
  }

  function openChat() {
    setActiveNav('chat');
    setView('chat');
    setMobileSidebarOpen(false);
  }

  function openDocs() {
    setActiveNav('docs');
    setView('editor');
    setMobileSidebarOpen(false);
  }

  const runCommand = useCallback((action) => {
    closeCommandPalette();
    action();
  }, [closeCommandPalette]);

  const commandItems = useMemo(() => {
    const quickActions = [
      {
        id: 'cmd-home',
        label: 'Go to Home',
        meta: 'Navigation',
        shortcut: 'H',
        onSelect: () => runCommand(openHome),
      },
      {
        id: 'cmd-workspace',
        label: 'Open Workspace',
        meta: 'Navigation',
        shortcut: 'W',
        onSelect: () => runCommand(openWorkspace),
      },
      {
        id: 'cmd-chat',
        label: 'Open Chat',
        meta: 'Navigation',
        shortcut: 'C',
        onSelect: () => runCommand(openChat),
      },
      {
        id: 'cmd-docs',
        label: 'Open Documents',
        meta: 'Navigation',
        shortcut: 'D',
        onSelect: () => runCommand(openDocs),
      },
      {
        id: 'cmd-new-doc',
        label: 'Create New Document',
        meta: 'Create',
        shortcut: 'N',
        onSelect: () => runCommand(() => { void createDocument(); }),
      },
      {
        id: 'cmd-new-workspace',
        label: 'Create New Workspace',
        meta: 'Create',
        onSelect: () => runCommand(() => { void createWorkspace(); }),
      },
      {
        id: 'cmd-toggle-context',
        label: rightPanelOpen ? 'Hide Context Panel' : 'Show Context Panel',
        meta: 'Layout',
        onSelect: () => runCommand(() => setRightPanelOpen((prev) => !prev)),
      },
      {
        id: 'cmd-focus-meeting',
        label: 'Focus Meeting Capture',
        meta: 'Home',
        shortcut: 'M',
        onSelect: () => runCommand(() => {
          openHome();
          window.dispatchEvent(new CustomEvent('home:focusMeetingCapture'));
        }),
      },
    ];

    const searchCommands = [
      ...(searchResults.workspaces || []).map((item) => ({
        id: `ws-${item._id}`,
        label: item.name || 'Workspace',
        subtitle: 'Workspace result',
        meta: 'Search',
        onSelect: () => runCommand(openWorkspace),
      })),
      ...(searchResults.pages || []).map((item) => ({
        id: `pg-${item._id}`,
        label: item.title || 'Page',
        subtitle: 'Page result',
        meta: 'Search',
        onSelect: () => runCommand(openWorkspace),
      })),
      ...(searchResults.documents || []).map((item) => ({
        id: `doc-${item._id}`,
        label: item.title || 'Document',
        subtitle: 'Document result',
        meta: 'Search',
        onSelect: () => runCommand(() => {
          setActiveDocId(item._id);
          openDocs();
        }),
      })),
      ...(searchResults.conversations || []).map((item) => ({
        id: `conv-${item._id}`,
        label: item.name || 'Conversation',
        subtitle: 'Conversation result',
        meta: 'Search',
        onSelect: () => runCommand(() => {
          setActiveConvId(item._id);
          openChat();
        }),
      })),
    ];

    const query = searchQuery.trim().toLowerCase();
    const combined = query.length >= 2 ? [...quickActions, ...searchCommands] : quickActions;
    if (!query) return combined;

    return combined.filter((item) => {
      const haystack = `${item.label} ${item.subtitle || ''} ${item.meta || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [
    closeCommandPalette,
    createDocument,
    createWorkspace,
    openChat,
    openDocs,
    openHome,
    openWorkspace,
    rightPanelOpen,
    runCommand,
    searchQuery,
    searchResults.conversations,
    searchResults.documents,
    searchResults.pages,
    searchResults.workspaces,
  ]);

  useEffect(() => {
    if (searchOpen) {
      commandInputRef.current?.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    setActiveCommandIndex(0);
  }, [searchQuery, searchOpen]);

  useEffect(() => {
    if (activeCommandIndex > commandItems.length - 1) {
      setActiveCommandIndex(Math.max(commandItems.length - 1, 0));
    }
  }, [activeCommandIndex, commandItems.length]);

  useEffect(() => {
    function onKeyDown(e) {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (!searchOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeCommandPalette();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveCommandIndex((prev) => (
          commandItems.length ? (prev + 1) % commandItems.length : 0
        ));
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveCommandIndex((prev) => (
          commandItems.length ? (prev - 1 + commandItems.length) % commandItems.length : 0
        ));
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        commandItems[activeCommandIndex]?.onSelect?.();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeCommandIndex, closeCommandPalette, commandItems, searchOpen]);

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
    <div className="min-h-screen bg-[#fcfcfc] text-[#1a1a1a]">
      <aside className="fixed left-0 top-0 z-20 flex h-screen w-72 flex-col border-r border-slate-100 bg-white p-8">
        <div className="mb-12 flex items-center gap-4 px-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1a1a1a] text-white">
            <span className="material-symbols-outlined !text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>layers</span>
          </div>
          <div>
            <h1 className="font-headline text-xl font-semibold leading-none tracking-tight">OneChat</h1>
            <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.2em] text-[#64748b]/70">Digital Curator</p>
          </div>
        </div>

        <button className="mb-10 flex w-full items-center justify-center gap-2.5 rounded-lg bg-[#1a1a1a] py-3 text-sm font-medium text-white shadow-[0_4px_20px_-2px_rgba(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5" onClick={() => setShowNewConv(true)}>
          <span className="material-symbols-outlined !text-[16px] !font-bold">add</span>
          New Message
        </button>

        <nav className="flex-1 space-y-2">
          <button className={`relative flex w-full items-center gap-3.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${activeNav === 'home' ? 'bg-slate-50/50 text-[#1a1a1a]' : 'text-[#64748b] hover:bg-slate-50/50 hover:text-[#1a1a1a]'}`} onClick={openHome}>
            {activeNav === 'home' && <span className="absolute -left-4 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-[#1a1a1a]" />}
            <span className="material-symbols-outlined" style={{ fontVariationSettings: activeNav === 'home' ? "'FILL' 1" : "'FILL' 0" }}>inbox</span>
            <span>Inbox</span>
          </button>
          <button className={`flex w-full items-center gap-3.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${activeNav === 'chat' ? 'bg-slate-50/50 text-[#1a1a1a]' : 'text-[#64748b] hover:bg-slate-50/50 hover:text-[#1a1a1a]'}`} onClick={openChat}>
            <span className="material-symbols-outlined">chat_bubble</span>
            <span>Messages</span>
          </button>
          <button className={`flex w-full items-center gap-3.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${activeNav === 'workspace' ? 'bg-slate-50/50 text-[#1a1a1a]' : 'text-[#64748b] hover:bg-slate-50/50 hover:text-[#1a1a1a]'}`} onClick={openWorkspace}>
            <span className="material-symbols-outlined">grid_view</span>
            <span>Channels</span>
          </button>
          <button className={`flex w-full items-center gap-3.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${activeNav === 'docs' ? 'bg-slate-50/50 text-[#1a1a1a]' : 'text-[#64748b] hover:bg-slate-50/50 hover:text-[#1a1a1a]'}`} onClick={openDocs}>
            <span className="material-symbols-outlined">settings</span>
            <span>Settings</span>
          </button>
        </nav>

        <div className="space-y-2 border-t border-slate-100 pt-8">
          <button className="flex w-full items-center gap-3.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[#64748b] transition-all hover:bg-slate-50/50 hover:text-[#1a1a1a]">
            <span className="material-symbols-outlined">account_circle</span>
            <span>Profile</span>
          </button>
          <button className="flex w-full items-center gap-3.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[#64748b] transition-all hover:bg-slate-50/50 hover:text-[#1a1a1a]" onClick={logout}>
            <span className="material-symbols-outlined">logout</span>
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      <main className="ml-72 min-h-screen">
        <header className="sticky top-0 z-10 flex items-center justify-between bg-[#fcfcfc]/80 px-12 py-6 backdrop-blur-md">
          <div className="relative w-full max-w-2xl">
            <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#64748b]/40">search</span>
            <input
              ref={commandInputRef}
              className="w-full rounded-xl border border-slate-100 bg-white py-3 pl-12 pr-6 text-sm shadow-sm outline-none transition-all focus:border-slate-200 focus:ring-4 focus:ring-black/5"
              placeholder="Search conversations, files, or people..."
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
            />
            {searchOpen && (
              <div className="notification-dropdown" style={{ left: 0, right: 0, top: 52, width: 'auto' }}>
                <div className="notification-header">
                  <span>Command Palette</span>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={closeCommandPalette}>Close</button>
                </div>
                <div className="notification-list">
                  {commandItems.map((item, index) => (
                    <button
                      key={item.id}
                      className={`notification-item ${activeCommandIndex === index ? 'command-active' : ''}`}
                      onMouseEnter={() => setActiveCommandIndex(index)}
                      onClick={() => item.onSelect()}
                    >
                      <div className="notification-text">{item.label}</div>
                      <div className="command-meta">{item.meta}</div>
                      {item.subtitle && <div className="command-subtitle">{item.subtitle}</div>}
                    </button>
                  ))}
                  {commandItems.length === 0 && <div className="notification-empty">No commands or results match.</div>}
                </div>
                <div className="notification-footer-hint">Arrow keys to navigate, Enter to run, Esc to close</div>
              </div>
            )}
          </div>
          <div className="ml-12 flex items-center gap-6">
            <NotificationBell />
            <div className="h-10 w-10 overflow-hidden rounded-full border border-slate-100 bg-white p-0.5 shadow-sm">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-50 text-xs font-semibold text-[#1a1a1a]">
              {(user?.name || '?')[0].toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {view === 'home' ? (
          <HomeScreen
            user={user}
            workspaces={workspaces}
            documents={documents}
            conversations={conversations}
            activities={activities}
            onOpenWorkspace={openWorkspace}
            onOpenDocs={openDocs}
            onOpenChat={openChat}
            onCreateDocument={createDocument}
            onCreateWorkspace={createWorkspace}
            onOpenConversation={(conversationId) => {
              setActiveConvId(conversationId);
              openChat();
            }}
            onOpenDocument={(docId) => {
              setActiveDocId(docId);
              openDocs();
            }}
          />
        ) : view === 'workspace' ? (
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
            onCreateDocument={createDocument}
          />
        )}
      </main>

      {showNewConv && (
        <NewConvModal
          onClose={() => setShowNewConv(false)}
          onCreate={(conv) => {
            setConversations((prev) => [conv, ...prev]);
            setActiveConvId(conv._id);
            openChat();
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
