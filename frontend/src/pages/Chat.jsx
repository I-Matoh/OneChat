import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getSocket, useSocketEvent } from '../hooks/useSocket';
import { useApi } from '../hooks/useApi';

export default function Chat({ activeConvId, setActiveConvId, conversations, setConversations }) {
  const { user, token } = useAuth();
  const { apiFetch } = useApi();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showContactInfo, setShowContactInfo] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);
  
  
  // Use refs to access latest state in socket event handlers (avoid stale closures)
  const activeConvIdRef = useRef(activeConvId);
  const setConversationsRef = useRef(setConversations);
  const setMessagesRef = useRef(setMessages);
  const setTypingUsersRef = useRef(setTypingUsers);
  
  // Keep refs updated
  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);
  useEffect(() => {
    setConversationsRef.current = setConversations;
  }, [setConversations]);
  useEffect(() => {
    setMessagesRef.current = setMessages;
  }, [setMessages]);
  useEffect(() => {
    setTypingUsersRef.current = setTypingUsers;
  }, [setTypingUsers]);

  // Clear messages and load new when conversation changes
  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    
    // Clear existing messages immediately
    setMessages([]);
    
    // Load messages for new conversation
    apiFetch(`/chat/conversations/${activeConvId}/messages`)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [activeConvId]);

  // Join conversation room and leave previous one
  useEffect(() => {
    if (!token) return;
    const s = getSocket(token);
    
    if (activeConvId) {
      s.emit('chat:join', activeConvId);
    }
    
    // Cleanup: leave conversation when component unmounts or conversation changes
    return () => {
      if (activeConvId) {
        s.emit('chat:leave', activeConvId);
      }
    };
  }, [activeConvId, token]);

  // Listen for new messages - use refs to avoid stale closures
  useSocketEvent('message:new', (msg) => {
    const currentConvId = activeConvIdRef.current;
    
    if (msg.conversationId === currentConvId) {
      setMessagesRef.current((prev) => [...prev, msg]);
    }
    
    // Update conversation list's last message
    setConversationsRef.current((prev) =>
      prev.map((c) =>
        c._id === msg.conversationId ? { ...c, lastMessage: msg.content, updatedAt: msg.createdAt } : c
      ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    );
  }, []);

  // Typing indicators - use refs to avoid stale closures
  useSocketEvent('message:typing', (data) => {
    const currentConvId = activeConvIdRef.current;
    if (data.conversationId !== currentConvId) return;
    
    setTypingUsersRef.current((prev) => {
      if (prev.find((u) => u.userId === data.userId)) return prev;
      return [...prev, data];
    });
    
    // Auto-remove typing indicator after 3 seconds
    setTimeout(() => {
      setTypingUsersRef.current((prev) => prev.filter((u) => u.userId !== data.userId));
    }, 3000);
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend(e) {
    e.preventDefault();
    if (!input.trim() || !activeConvId) return;
    const s = getSocket(token);
    s.emit('message:send', { conversationId: activeConvId, content: input.trim() });
    setInput('');
  }

  function handleInputChange(e) {
    setInput(e.target.value);
    const s = getSocket(token);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    s.emit('message:typing', { conversationId: activeConvId });
    typingTimeout.current = setTimeout(() => {}, 3000);
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  if (!activeConvId) {
    return (
      <div className="chat-layout">
        {/* Left Panel - Chats List */}
        <div className="chat-sidebar">
          <div className="chat-sidebar-header">
            <h2 className="chat-sidebar-title">Conversations</h2>
            <div className="chat-search">
              <span className="chat-search-icon">🔍</span>
            <input 
              type="text" 
              className="chat-search-input"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            </div>
          </div>
          <div className="chat-list">
            {conversations
              .filter(c => {
                const displayName = c.name || c.participants?.map(p => p.name || 'User').join(', ') || 'Chat';
                return displayName.toLowerCase().includes(searchQuery.toLowerCase());
              })
              .map((conv) => {
              const displayName = conv.name || conv.participants?.filter((p) => (p._id || p) !== user.id).map((p) => p.name || 'User').join(', ') || 'Chat';
              const isActive = activeConvId === conv._id;
              return (
                <div
                  key={conv._id}
                  className={`chat-item ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveConvId(conv._id)}
                >
                  <div className="chat-avatar">
                    {displayName[0].toUpperCase()}
                    <span className="chat-avatar-dot"></span>
                  </div>
                  <div className="chat-info">
                    <div className="chat-name-row">
                      <span className="chat-name">{displayName}</span>
                      <span className="chat-time">
                        {conv.updatedAt ? new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="chat-preview">{conv.lastMessage || 'No messages yet'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Panel - Empty Chat Area */}
        <div className="chat-main">
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <div className="empty-title">Select a conversation</div>
            <div className="empty-hint">Choose from the sidebar to start chatting</div>
          </div>
        </div>

        {/* Right Panel - Contact Info (placeholder) */}
        <div className="contact-panel">
          <div className="contact-empty">
            <div className="empty-icon">👤</div>
            <div className="empty-hint">Select a chat to view contact info</div>
          </div>
        </div>
      </div>
    );
  }

  const activeConv = conversations.find((c) => c._id === activeConvId);
  const displayName = activeConv?.name || activeConv?.participants?.filter((p) => (p._id || p) !== user.id).map((p) => p.name || 'User').join(', ') || 'Chat';

return (
    <div className="chat-layout">
      {/* Left Panel - Chats List */}
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h2 className="chat-sidebar-title">Conversations</h2>
          <div className="chat-search">
            <span className="chat-search-icon">🔍</span>
            <input 
              type="text" 
              className="chat-search-input"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="chat-list">
          {conversations
            .filter(c => {
              const name = c.name || c.participants?.map(p => p.name || 'User').join(', ') || 'Chat';
              return name.toLowerCase().includes(searchQuery.toLowerCase());
            })
            .map((conv) => {
            const name = c.name || conv.participants?.filter((p) => (p._id || p) !== user.id).map((p) => p.name || 'User').join(', ') || 'Chat';
            const isActive = activeConvId === conv._id;
            return (
              <div
                key={conv._id}
                className={`chat-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveConvId(conv._id)}
              >
                <div className="chat-avatar">
                  {name[0].toUpperCase()}
                  <span className="chat-avatar-dot"></span>
                </div>
                <div className="chat-info">
                  <div className="chat-name-row">
                    <span className="chat-name">{name}</span>
                    <span className="chat-time">
                      {conv.updatedAt ? new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div className="chat-preview">{conv.lastMessage || 'No messages yet'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center Panel - Chat Area */}
      <div className="chat-main">
        <div className="chat-header">
          <div className="chat-header-info">
            <div className="chat-avatar">{displayName[0].toUpperCase()}</div>
            <div className="chat-info">
              <div className="chat-name">{displayName}</div>
              <div className="chat-header-status">Online</div>
            </div>
          </div>
          <div className="chat-header-actions">
            <button className="btn-icon" title="Voice call">📞</button>
            <button className="btn-icon" title="Video call">📹</button>
            <button className="btn-icon" title="More options">⋮</button>
          </div>
        </div>

        <div className="messages-panel">
          {messages.map((msg) => {
            const isOwn = (msg.senderId === user.id) || (msg.senderId?._id === user.id);
            return (
              <div key={msg._id} className={`message ${isOwn ? 'own' : ''}`}>
                {!isOwn && (
                  <div className="message-avatar">
                    {(msg.senderName || msg.senderId?.name || '?')[0].toUpperCase()}
                  </div>
                )}
                <div className="message-bubble">
                  {!isOwn && (
                    <div className="message-sender">
                      {msg.senderName || msg.senderId?.name || 'Unknown'}
                    </div>
                  )}
                  <div className="message-text">{msg.content}</div>
                  <div className="message-time">{formatTime(msg.createdAt)}</div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span /><span /><span />
            </div>
            {typingUsers.map((u) => u.userName).join(', ')} typing...
          </div>
        )}

        <div className="chat-input-panel">
          <form className="chat-input-form" onSubmit={handleSend}>
            <input
              className="chat-input"
              placeholder="Type a message..."
              value={input}
              onChange={handleInputChange}
              id="chat-message-input"
            />
            <button type="submit" className="btn btn-primary">
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Right Panel - Contact Info */}
      <div className={`contact-panel ${showContactInfo ? '' : ''}`}>
        <div className="contact-header">
          <div className="contact-avatar-large">{displayName[0].toUpperCase()}</div>
          <div className="contact-name">{displayName}</div>
          <div className="contact-status">Online</div>
        </div>
        <div className="contact-details">
          <div className="contact-section">
            <div className="contact-label">About</div>
            <div className="contact-value">Hey there! I'm using OneChat</div>
          </div>
          <div className="contact-section">
            <div className="contact-label">Phone</div>
            <div className="contact-value">+1 234 567 8900</div>
          </div>
          <div className="contact-section">
            <div className="contact-label">Email</div>
            <div className="contact-value">user@example.com</div>
          </div>
        </div>
        <div className="contact-actions">
          <button className="contact-action-btn">
            <span>📞</span> Voice Call
          </button>
          <button className="contact-action-btn">
            <span>📹</span> Video Call
          </button>
          <button className="contact-action-btn danger">
            <span>🚫</span> Block
          </button>
        </div>
      </div>
    </div>
  );
}
