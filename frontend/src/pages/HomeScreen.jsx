import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSocket, getSocket } from '../hooks/useSocket';
import { useApi } from '../hooks/useApi';

const MaterialIcon = ({ className, children }) => (
  <span className={`material-symbols-outlined ${className || ''}`}>{children}</span>
);

const TagIcon = () => <MaterialIcon>tag</MaterialIcon>;
const GridViewIcon = () => <MaterialIcon>grid_view</MaterialIcon>;
const NotificationsIcon = () => <MaterialIcon>notifications</MaterialIcon>;
const SearchIcon = () => <MaterialIcon>search</MaterialIcon>;
const SettingsIcon = () => <MaterialIcon>settings</MaterialIcon>;
const HelpIcon = () => <MaterialIcon>help</MaterialIcon>;
const UnfoldMoreIcon = () => <MaterialIcon>unfold_more</MaterialIcon>;
const AddIcon = () => <MaterialIcon>add</MaterialIcon>;
const HistoryIcon = () => <MaterialIcon>history</MaterialIcon>;
const AddCircleIcon = () => <MaterialIcon>add_circle</MaterialIcon>;
const MoodIcon = () => <MaterialIcon>mood</MaterialIcon>;
const AlternateEmailIcon = () => <MaterialIcon>alternate_email</MaterialIcon>;
const SendIcon = () => <MaterialIcon>send</MaterialIcon>;
const LinkIcon = () => <MaterialIcon>link</MaterialIcon>;
const CloseIcon = () => <MaterialIcon>close</MaterialIcon>;
const DescriptionIcon = () => <MaterialIcon>description</MaterialIcon>;
const ImageIcon = () => <MaterialIcon>image</MaterialIcon>;
const PushPinIcon = () => <MaterialIcon>push_pin</MaterialIcon>;
const AutoAwesomeIcon = () => <MaterialIcon style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</MaterialIcon>;
const ReplyIcon = () => <MaterialIcon>reply</MaterialIcon>;

export default function HomeScreen() {
  const { user, token } = useAuth();
  const { apiFetch } = useApi();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('mentions');
  const [message, setMessage] = useState('');

  const channels = [
    { id: 1, name: 'engineering-prod', active: false },
    { id: 2, name: 'design-system', active: true },
    { id: 3, name: 'q3-roadmap', active: false },
  ];

  const directMessages = [
    { id: 1, name: 'Sarah Chen', online: true, avatar: 'SC', hasUnread: false },
    { id: 2, name: 'Marcus Wright', online: true, avatar: 'MW', hasUnread: true, unreadCount: 2 },
    { id: 3, name: 'Jordan Smith', online: false, avatar: 'JS', hasUnread: false, offline: true },
  ];

  const participants = [
    { name: 'You (Alex)', avatar: 'A' },
    { name: 'Sarah Chen', avatar: 'SC' },
    { name: 'Marcus Wright', avatar: 'MW' },
  ];

  const sharedFiles = [
    { name: 'monolith-spec-v2.pdf', size: '2.4 MB', date: 'Sep 12', type: 'doc' },
    { name: 'typography-scale.png', size: '1.1 MB', date: 'Yesterday', type: 'image' },
  ];

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    console.log('Sending message:', message);
    setMessage('');
  };

  return (
    <div className="flex h-screen overflow-hidden homescreen-container">
      {/* Sidebar */}
      <aside className="homescreen-sidebar">
        {/* Workspace Switcher */}
        <div className="homescreen-sidebar-header">
          <div className="flex items-center gap-3">
            <div className="homescreen-workspace-avatar">O</div>
            <div>
              <h2 className="homescreen-workspace-title">OneChat</h2>
              <p className="homescreen-workspace-subtitle">Production Workspace</p>
            </div>
          </div>
          <UnfoldMoreIcon className="homescreen-unfold-icon" />
        </div>

        {/* Search */}
        <div className="homescreen-search">
          <SearchIcon className="homescreen-search-icon" />
          <input
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="homescreen-search-input"
          />
        </div>

        {/* Main Navigation */}
        <nav className="homescreen-nav">
          <div className="homescreen-nav-label">Workspace</div>
          
          <div className="homescreen-nav-item active">
            <GridViewIcon className="homescreen-nav-icon" />
            <span>Workspaces</span>
          </div>
          
          <div className="homescreen-nav-item">
            <NotificationsIcon className="homescreen-nav-icon" />
            <span className="flex-1">Activity</span>
            <span className="homescreen-badge">4</span>
          </div>

          {/* Channels */}
          <div className="homescreen-section">
            <div className="homescreen-section-header">
              <span>Channels</span>
              <AddIcon className="homescreen-section-add" />
            </div>
            <div className="homescreen-section-items">
              {channels.map((channel) => (
                <div
                  key={channel.id}
                  className={`homescreen-channel-item ${channel.active ? 'active' : ''}`}
                >
                  <TagIcon className="homescreen-nav-icon" />
                  <span>{channel.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Direct Messages */}
          <div className="homescreen-section">
            <div className="homescreen-section-header">
              <span>Direct Messages</span>
              <AddIcon className="homescreen-section-add" />
            </div>
            <div className="homescreen-section-items">
              {directMessages.map((dm) => (
                <div
                  key={dm.id}
                  className={`homescreen-dm-item ${dm.offline ? 'offline' : ''}`}
                >
                  <div className="homescreen-dm-avatar-wrapper">
                    <div className={`homescreen-dm-avatar ${dm.hasUnread ? 'has-unread' : ''}`}>
                      {dm.avatar}
                    </div>
                    <div className={`homescreen-dm-status ${dm.online ? 'online' : 'offline'}`} />
                  </div>
                  <span className="flex-1">{dm.name}</span>
                  {dm.hasUnread && (
                    <span className="homescreen-unread-badge">{dm.unreadCount}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="homescreen-footer">
          <div className="homescreen-footer-item">
            <SettingsIcon className="homescreen-nav-icon" />
            <span>Settings</span>
          </div>
          <div className="homescreen-footer-item">
            <HelpIcon className="homescreen-nav-icon" />
            <span>Help</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="homescreen-main-wrapper">
        {/* Top Navigation */}
        <header className="homescreen-header">
          <div className="homescreen-header-left">
            <div className="homescreen-channel-info">
              <TagIcon className="homescreen-channel-icon" />
              <h1 className="homescreen-channel-name">design-system</h1>
            </div>
            <nav className="homescreen-header-tabs">
              <button
                className={`homescreen-tab ${activeTab === 'threads' ? '' : ''}`}
                onClick={() => setActiveTab('threads')}
              >
                Threads
              </button>
              <button
                className={`homescreen-tab active`}
                onClick={() => setActiveTab('mentions')}
              >
                Mentions
              </button>
              <button
                className={`homescreen-tab ${activeTab === 'drafts' ? '' : ''}`}
                onClick={() => setActiveTab('drafts')}
              >
                Drafts
              </button>
            </nav>
          </div>
          <div className="homescreen-header-right">
            <button className="homescreen-share-btn">Share</button>
            <div className="homescreen-header-icons">
              <HistoryIcon className="homescreen-header-icon" />
              <HelpIcon className="homescreen-header-icon" />
            </div>
            <img
              alt="User Profile"
              className="homescreen-user-avatar"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCDogvyYf28T6_SIRK2jjN-z_qWmlt3pSAH_SqPksDplrbV-X3Hsv5tpP3A5dYueooPsHKzu_6dwaNjH6dQ3ep0Wv-CNXpmngzedMMiu8VroN8aS0lVSRr0PA3d7FDDc20Iy5lbhvoalMcN09aLxj0jBH6UQbi4GpSpoOPtBDh5UNJEcSFqA-BQsMKTqqYvxpa4scOj4e2g0-G9BuezNpT-oQCLUQq7ta1al2_L4f8A_7MAYk0xysIAR5HkL37bPGRcYeJFc6ds8HM"
            />
          </div>
        </header>

        {/* Content Area */}
        <main className="homescreen-content">
          {/* Chat Area */}
          <div className="homescreen-chat-area">
            {/* Messages */}
            <div className="homescreen-messages">
              {/* Message from Sarah */}
              <div className="homescreen-message">
                <img
                  className="homescreen-message-avatar"
                  alt="Sarah Chen"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuA-unAf6sq3s5bE3tBjulltR_fh6dj1cBLCgDEnV1ZtkNBA9H-C9_ZuEIh2EbFi3Xmeoj-LF3s2rhHTsbyuKYaxUnUNFUxM3Vv17--XiZcMpDXpYF16JVuLRKAwOwxxWLOHEUdytmsbnGyTr3w-IY9y3DE-6nQslEw2FO7eW6g-GWAtH1sAL5mlvhRS6zn5HUiszFTZd441i5cGuJj2zM67Q_t54PF1VnTaw1vdjteIc0h6w5tgl8NFHccGHVXSuSb5lGQEF7qwijs"
                />
                <div className="homescreen-message-content">
                  <div className="homescreen-message-header">
                    <span className="homescreen-message-sender">Sarah Chen</span>
                    <span className="homescreen-message-time">10:42 AM</span>
                  </div>
                  <div className="homescreen-message-text">
                    Hey team, I've finished the initial draft for the new <span className="homescreen-mention">@design-system</span> components. Specifically looking for feedback on the Monolith strategy we discussed.
                  </div>
                  <div className="homescreen-message-reactions">
                    <button className="homescreen-reaction">
                      <span>🚀</span> <span className="homescreen-reaction-count">3</span>
                    </button>
                    <button className="homescreen-reaction">
                      <span>💯</span> <span className="homescreen-reaction-count">1</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* AI Assistant */}
              <div className="homescreen-ai-message">
                <div className="homescreen-ai-avatar">
                  <AutoAwesomeIcon className="homescreen-ai-icon" />
                </div>
                <div className="homescreen-ai-content">
                  <div className="homescreen-ai-header">
                    <span className="homescreen-ai-title">AI Assistant</span>
                    <span className="homescreen-ai-badge">BETA</span>
                  </div>
                  <p className="homescreen-ai-text">
                    I've analyzed the design tokens. The new elevation scale looks more consistent with the "Quiet Intelligence" philosophy. Would you like a summary of the pending changes?
                  </p>
                  <div className="homescreen-ai-actions">
                    <button className="homescreen-ai-action-btn">Summarize Thread</button>
                    <button className="homescreen-ai-action-btn">Extract Tasks</button>
                    <button className="homescreen-ai-action-btn">Generate Insights</button>
                  </div>
                </div>
              </div>

              {/* Message from Marcus */}
              <div className="homescreen-message">
                <img
                  className="homescreen-message-avatar"
                  alt="Marcus Wright"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuCX30MAT1fC3HeeuZgfcpnl3frkILKXy4rOYdp7AofuwlpOiFC-EOooNDKdgLL32JLgfrtbtpdEyoCmAosMrTKRn5ACx0m5ccGf69yq0YY0NAyTTVLzqRA2YdemX_XDNOoTSPFSMnWtuPY6Wasvq841iCIu8Mgh232B0TyDoAQnlw0_jTotMKilznM5pqduDJN_5K7Jvw9tmUuFkHtqNk5Y5j7O-2iVJHeHxd0FEbB2v0aEtD602vZoBSFchszOY2cejf_1UeIt31o"
                />
                <div className="homescreen-message-content">
                  <div className="homescreen-message-header">
                    <span className="homescreen-message-sender">Marcus Wright</span>
                    <span className="homescreen-message-time">11:15 AM</span>
                  </div>
                  <div className="homescreen-message-text">
                    Looks sharp. The surface-container nesting is much cleaner than the old divider lines. I'll start implementing the Tailwind config update this afternoon.
                  </div>
                  <div className="homescreen-reply-thread">
                    <ReplyIcon className="homescreen-reply-icon" />
                    <span className="homescreen-reply-text">2 replies</span>
                    <span className="homescreen-reply-time">Last reply 5 mins ago</span>
                  </div>
                </div>
              </div>

              {/* Typing Indicator */}
              <div className="homescreen-typing">
                <div className="homescreen-typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span>Sarah Chen is typing...</span>
              </div>
            </div>

            {/* Message Input */}
            <div className="homescreen-input-area">
              <form className="homescreen-input-form" onSubmit={handleSendMessage}>
                <button type="button" className="homescreen-input-action">
                  <AddCircleIcon />
                </button>
                <textarea
                  className="homescreen-input"
                  placeholder="Message #design-system"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={1}
                />
                <div className="homescreen-input-actions">
                  <button type="button" className="homescreen-input-action">
                    <MoodIcon />
                  </button>
                  <button type="button" className="homescreen-input-action">
                    <AlternateEmailIcon />
                  </button>
                  <button type="submit" className="homescreen-send-btn">
                    <SendIcon />
                  </button>
                </div>
              </form>
              <div className="homescreen-input-hints">
                <span><strong>B</strong> Bold</span>
                <span><em>I</em> Italic</span>
                <span><LinkIcon className="homescreen-hint-icon" /> Link</span>
              </div>
            </div>
          </div>

          {/* Right Panel */}
          <aside className="homescreen-right-panel">
            <div className="homescreen-panel-header">
              <h3 className="homescreen-panel-title">Details</h3>
              <CloseIcon className="homescreen-panel-close" />
            </div>
            <div className="homescreen-panel-content">
              {/* About */}
              <div className="homescreen-panel-section">
                <h4 className="homescreen-panel-label">About</h4>
                <p className="homescreen-panel-text">
                  Central hub for the OneChat design language, documentation, and component lifecycle management.
                </p>
              </div>

              {/* Participants */}
              <div className="homescreen-panel-section">
                <div className="homescreen-participants-header">
                  <h4 className="homescreen-panel-label">Participants</h4>
                  <span className="homescreen-participants-count">12</span>
                </div>
                <div className="homescreen-participants-list">
                  {participants.map((p, idx) => (
                    <div key={idx} className="homescreen-participant">
                      <div className="homescreen-participant-avatar">{p.avatar}</div>
                      <span>{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shared Files */}
              <div className="homescreen-panel-section">
                <h4 className="homescreen-panel-label">Shared Files</h4>
                <div className="homescreen-files-list">
                  {sharedFiles.map((file, idx) => (
                    <div key={idx} className="homescreen-file-item">
                      <div className="homescreen-file-icon">
                        {file.type === 'doc' ? <DescriptionIcon /> : <ImageIcon />}
                      </div>
                      <div className="homescreen-file-info">
                        <p className="homescreen-file-name">{file.name}</p>
                        <p className="homescreen-file-meta">{file.size} • {file.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pinned */}
              <div className="homescreen-panel-section">
                <h4 className="homescreen-panel-label">Pinned</h4>
                <div className="homescreen-pinned-message">
                  <PushPinIcon className="homescreen-pinned-icon" />
                  <p className="homescreen-pinned-text">
                    "Remember to use the 8px rhythmic grid for all new mobile layouts..."
                  </p>
                  <p className="homescreen-pinned-author">— Sarah Chen</p>
                </div>
              </div>
            </div>
            <div className="homescreen-panel-footer">
              <button className="homescreen-history-btn">View All History</button>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}