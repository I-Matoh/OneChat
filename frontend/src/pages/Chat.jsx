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
      <div className="windows-chat-layout">
        {/* Left Panel - Chats List */}
        <div className="windows-chat-list">
          <div className="windows-search-box">
            <span className="windows-search-icon">🔍</span>
            <input 
              type="text" 
              className="windows-search-input"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="windows-chat-items">
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
                  className={`windows-chat-item ${isActive ? 'active' : ''}`}
                  onClick={() => setActiveConvId(conv._id)}
                >
                  <div className="windows-chat-avatar">
                    {displayName[0].toUpperCase()}
                    <span className="windows-online-dot"></span>
                  </div>
                  <div className="windows-chat-info">
                    <div className="windows-chat-name-row">
                      <span className="windows-chat-name">{displayName}</span>
                      <span className="windows-chat-time">
                        {conv.updatedAt ? new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    <div className="windows-chat-preview">{conv.lastMessage || 'No messages yet'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center Panel - Empty Chat Area */}
        <div className="windows-chat-main">
          <div className="windows-empty-state">
            <div className="windows-empty-icon">💬</div>
            <div className="windows-empty-title">Select a conversation</div>
            <div className="windows-empty-hint">Choose from the sidebar to start chatting</div>
          </div>
        </div>

        {/* Right Panel - Contact Info (placeholder) */}
        <div className="windows-contact-panel">
          <div className="windows-contact-empty">
            <div className="windows-contact-icon">👤</div>
            <div className="windows-contact-text">Select a chat to view contact info</div>
          </div>
        </div>
      </div>
    );
  }

  const activeConv = conversations.find((c) => c._id === activeConvId);
  const displayName = activeConv?.name || activeConv?.participants?.filter((p) => (p._id || p) !== user.id).map((p) => p.name || 'User').join(', ') || 'Chat';

  return (
    <div className="windows-chat-layout">
      {/* Left Panel - Chats List */}
      <div className="windows-chat-list">
        <div className="windows-search-box">
          <span className="windows-search-icon">🔍</span>
          <input 
            type="text" 
            className="windows-search-input"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="windows-chat-items">
          {conversations
            .filter(c => {
              const name = c.name || c.participants?.map(p => p.name || 'User').join(', ') || 'Chat';
              return name.toLowerCase().includes(searchQuery.toLowerCase());
            })
            .map((conv) => {
            const name = conv.name || conv.participants?.filter((p) => (p._id || p) !== user.id).map((p) => p.name || 'User').join(', ') || 'Chat';
            const isActive = activeConvId === conv._id;
            return (
              <div
                key={conv._id}
                className={`windows-chat-item ${isActive ? 'active' : ''}`}
                onClick={() => setActiveConvId(conv._id)}
              >
                <div className="windows-chat-avatar">
                  {name[0].toUpperCase()}
                  <span className="windows-online-dot"></span>
                </div>
                <div className="windows-chat-info">
                  <div className="windows-chat-name-row">
                    <span className="windows-chat-name">{name}</span>
                    <span className="windows-chat-time">
                      {conv.updatedAt ? new Date(conv.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </span>
                  </div>
                  <div className="windows-chat-preview">{conv.lastMessage || 'No messages yet'}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Center Panel - Chat Area */}
      <div className="windows-chat-main">
        <div className="windows-chat-header">
          <div className="windows-chat-header-info">
            <div className="windows-chat-header-avatar">{displayName[0].toUpperCase()}</div>
            <div className="windows-chat-header-details">
              <div className="windows-chat-header-name">{displayName}</div>
              <div className="windows-chat-header-status">Online</div>
            </div>
          </div>
          <div className="windows-chat-header-actions">
            <button className="windows-header-btn" title="Voice call">📞</button>
            <button className="windows-header-btn" title="Video call">📹</button>
            <button className="windows-header-btn" title="More options">⋮</button>
          </div>
        </div>

        <div className="messages-container">
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

        <div className="chat-input-container">
          <form className="chat-input-wrapper" onSubmit={handleSend}>
            <input
              className="chat-input"
              placeholder="Type a message..."
              value={input}
              onChange={handleInputChange}
              id="chat-message-input"
            />
            <button type="submit" className="btn btn-primary" style={{ borderRadius: 12 }}>
              Send
            </button>
          </form>
        </div>
      </div>

      {/* Right Panel - Contact Info */}
      <div className={`windows-contact-panel ${showContactInfo ? 'show' : ''}`}>
        <div className="windows-contact-header">
          <div className="windows-contact-avatar-large">{displayName[0].toUpperCase()}</div>
          <div className="windows-contact-name">{displayName}</div>
          <div className="windows-contact-status-online">Online</div>
        </div>
        <div className="windows-contact-details">
          <div className="windows-contact-section">
            <div className="windows-contact-label">About</div>
            <div className="windows-contact-value">Hey there! I'm using OneChat</div>
          </div>
          <div className="windows-contact-section">
            <div className="windows-contact-label">Phone</div>
            <div className="windows-contact-value">+1 234 567 8900</div>
          </div>
          <div className="windows-contact-section">
            <div className="windows-contact-label">Email</div>
            <div className="windows-contact-value">user@example.com</div>
          </div>
        </div>
        <div className="windows-contact-actions">
          <button className="windows-contact-action-btn">
            <span>📞</span> Voice Call
          </button>
          <button className="windows-contact-action-btn">
            <span>📹</span> Video Call
          </button>
          <button className="windows-contact-action-btn danger">
            <span>🚫</span> Block
          </button>
        </div>
      </div>
    </div>
  );
}
