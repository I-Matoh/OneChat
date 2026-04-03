import { useState } from 'react';

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
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const SendIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const FolderIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
  </svg>
);

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const ChevronIcon = ({ className }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const mockData = {
  companies: [
    { id: 1, name: 'Acme Corp', people: ['JD', 'MK', 'AS'], notes: 12, lastNote: '2h ago' },
    { id: 2, name: 'TechStart Inc', people: ['RB', 'LP'], notes: 8, lastNote: '1d ago' },
    { id: 3, name: 'Global Solutions', people: ['TW', 'HN', 'JC', 'BM'], notes: 24, lastNote: '3h ago' },
    { id: 4, name: 'Innovation Labs', people: ['AK'], notes: 5, lastNote: '5d ago' },
    { id: 5, name: 'Digital Dynamics', people: ['MS', 'DG'], notes: 15, lastNote: '6h ago' },
  ]
};

const tabs = ['Notes', 'Files', 'Companies', 'People'];
const actions = ['Recent Notes', 'Summarize Notes', 'Show Insights', 'Auto-tags'];

export default function Workspace() {
  const [activeTab, setActiveTab] = useState('Companies');
  const [activeNav, setActiveNav] = useState('home');
  const [query, setQuery] = useState('');

  return (
    <div className="workspace-layout">
      {/* Left Sidebar */}
      <aside className="workspace-sidebar">
        <div className="workspace-sidebar-header">
          <div className="workspace-logo">
            <span className="workspace-logo-icon">O</span>
            <span className="workspace-logo-text">OneChat</span>
          </div>
        </div>

        <div className="workspace-search">
          <SearchIcon />
          <input 
            type="text" 
            placeholder="Search..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <nav className="workspace-nav">
          <button 
            className={`workspace-nav-item ${activeNav === 'home' ? 'active' : ''}`}
            onClick={() => setActiveNav('home')}
          >
            <HomeIcon />
            <span>Home</span>
          </button>
          <button 
            className={`workspace-nav-item ${activeNav === 'shared' ? 'active' : ''}`}
            onClick={() => setActiveNav('shared')}
          >
            <ShareIcon />
            <span>Shared</span>
          </button>
          <button 
            className={`workspace-nav-item ${activeNav === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveNav('chat')}
          >
            <ChatIcon />
            <span>Chat</span>
          </button>
        </nav>

        <div className="workspace-section">
          <div className="workspace-section-header">
            <span>Workspace</span>
            <button className="workspace-section-btn"><PlusIcon /></button>
          </div>
          <div className="workspace-section-items">
            <div className="workspace-section-item">
              <FolderIcon />
              <span>My Notes</span>
            </div>
            <div className="workspace-section-item">
              <FolderIcon />
              <span>Team Notes</span>
            </div>
            <div className="workspace-section-item">
              <FolderIcon />
              <span>Projects</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="workspace-main">
        {/* Header */}
        <header className="workspace-header">
          <div className="workspace-header-left">
            <h1 className="workspace-title">User calls</h1>
            <p className="workspace-subtitle">Manage your contacts and notes</p>
          </div>
          <div className="workspace-header-right">
            <button className="workspace-btn-secondary">
              <span>Integrations</span>
            </button>
          </div>
        </header>

        {/* AI Input */}
        <div className="workspace-input-section">
          <div className="workspace-input-wrapper">
            <input 
              type="text" 
              className="workspace-input"
              placeholder="Ask AI anything..."
            />
            <button className="workspace-input-btn">
              <SendIcon />
            </button>
          </div>
        </div>

        {/* Action Row */}
        <div className="workspace-actions">
          {actions.map((action) => (
            <button key={action} className="workspace-action-chip">
              {action}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="workspace-tabs">
          {tabs.map((tab) => (
            <button 
              key={tab}
              className={`workspace-tab ${activeTab === tab ? 'active' : ''}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Data Table */}
        <div className="workspace-table-container">
          <table className="workspace-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>People</th>
                <th>Notes</th>
                <th>Last Note</th>
              </tr>
            </thead>
            <tbody>
              {mockData.companies.map((company) => (
                <tr key={company.id}>
                  <td className="workspace-table-company">
                    <span className="workspace-company-avatar">{company.name[0]}</span>
                    {company.name}
                  </td>
                  <td>
                    <div className="workspace-people-avatars">
                      {company.people.map((person, idx) => (
                        <span 
                          key={idx} 
                          className="workspace-person-avatar"
                          style={{ '--idx': idx }}
                        >
                          {person}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="workspace-notes-count">{company.notes}</td>
                  <td className="workspace-last-note">{company.lastNote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}