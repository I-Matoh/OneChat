import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getSocket, useSocketEvent } from '../hooks/useSocket';
import { useApi } from '../hooks/useApi';
import AIAssistantPanel from '../components/AIAssistantPanel';

const AttachIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
  </svg>
);

const EmojiIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const SendIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const CheckDoubleIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const EyeIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

function MessageSkeleton() {
  return (
    <div className="message-skeleton">
      <div className="skeleton-avatar" />
      <div className="skeleton-bubble">
        <div className="skeleton-line short" />
        <div className="skeleton-line" />
      </div>
    </div>
  );
}

function TypingIndicator({ users }) {
  const names = users.map(u => u.userName).join(', ');
  return (
    <div className="typing-indicator">
      <div className="typing-bubble">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="typing-text">{names} {users.length === 1 ? 'is' : 'are'} typing</span>
    </div>
  );
}

export default function Chat({ activeConvId, setActiveConvId, conversations, setConversations }) {
  const { user, token } = useAuth();
  const { apiFetch } = useApi();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeout = useRef(null);

  const activeConvIdRef = useRef(activeConvId);
  const setConversationsRef = useRef(setConversations);
  const setMessagesRef = useRef(setMessages);
  const setTypingUsersRef = useRef(setTypingUsers);

  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);
  useEffect(() => { setConversationsRef.current = setConversations; }, [setConversations]);
  useEffect(() => { setMessagesRef.current = setMessages; }, [setMessages]);
  useEffect(() => { setTypingUsersRef.current = setTypingUsers; }, [setTypingUsers]);

  useEffect(() => {
    if (!activeConvId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    setMessages([]);
    apiFetch(`/chat/conversations/${activeConvId}/messages`)
      .then((data) => {
        setMessages(data || []);
        setLoading(false);
      })
      .catch(() => {
        setMessages([]);
        setLoading(false);
      });
  }, [activeConvId]);

  useEffect(() => {
    if (!token) return;
    const s = getSocket(token);
    if (activeConvId) s.emit('chat:join', activeConvId);
    return () => {
      if (activeConvId) s.emit('chat:leave', activeConvId);
    };
  }, [activeConvId, token]);

  useSocketEvent('message:new', (msg) => {
    const currentConvId = activeConvIdRef.current;
    if (msg.conversationId === currentConvId) {
      setMessagesRef.current((prev) => [...prev, msg]);
    }
    setConversationsRef.current((prev) =>
      prev.map((c) =>
        c._id === msg.conversationId ? { ...c, lastMessage: msg.content, updatedAt: msg.createdAt } : c
      ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    );
  }, []);

  useSocketEvent('message:typing', (data) => {
    const currentConvId = activeConvIdRef.current;
    if (data.conversationId !== currentConvId) return;
    setTypingUsersRef.current((prev) => {
      if (prev.find((u) => u.userId === data.userId)) return prev;
      return [...prev, data];
    });
    setTimeout(() => {
      setTypingUsersRef.current((prev) => prev.filter((u) => u.userId !== data.userId));
    }, 3000);
  }, []);

  useSocketEvent('message:status', (data) => {
    setMessagesRef.current((prev) =>
      prev.map((m) => m._id === data.messageId ? { ...m, status: data.status } : m)
    );
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback((e) => {
    e?.preventDefault();
    if (!input.trim() || !activeConvId) return;
    const s = getSocket(token);
    s.emit('message:send', { conversationId: activeConvId, content: input.trim() });
    setInput('');
  }, [input, activeConvId, token]);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
    const s = getSocket(token);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    s.emit('message:typing', { conversationId: activeConvId });
    typingTimeout.current = setTimeout(() => {}, 3000);
  }, [activeConvId, token]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const formatTime = (ts) => {
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
           date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const groupMessages = (msgs) => {
    const groups = [];
    let currentGroup = null;
    msgs.forEach((msg) => {
      const isOwn = (msg.senderId === user.id) || (msg.senderId?._id === user.id);
      if (!currentGroup || currentGroup.isOwn !== isOwn || 
          new Date(msg.createdAt) - new Date(currentGroup.lastTime) > 300000) {
        currentGroup = { isOwn, messages: [msg], firstTime: msg.createdAt, lastTime: msg.createdAt };
        groups.push(currentGroup);
      } else {
        currentGroup.messages.push(msg);
        currentGroup.lastTime = msg.createdAt;
      }
    });
    return groups;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'sent': return <CheckIcon />;
      case 'delivered': return <CheckDoubleIcon />;
      case 'seen': return <EyeIcon />;
      default: return null;
    }
  };

  const filteredConversations = conversations.filter(c => {
    const displayName = c.name || c.participants?.map(p => p.name || 'User').join(', ') || 'Chat';
    return displayName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (!activeConvId) {
    return (
      <div className="chat-layout">
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
            {filteredConversations.map((conv) => {
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
        <div className="chat-main">
          <div className="empty-state">
            <div className="empty-icon">💬</div>
            <div className="empty-title">Select a conversation</div>
            <div className="empty-hint">Choose from the sidebar to start chatting</div>
          </div>
        </div>
      </div>
    );
  }

  const activeConv = conversations.find((c) => c._id === activeConvId);
  const displayName = activeConv?.name || activeConv?.participants?.filter((p) => (p._id || p) !== user.id).map((p) => p.name || 'User').join(', ') || 'Chat';
  const messageGroups = groupMessages(messages);

  return (
    <div className="chat-layout">
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
          {filteredConversations.map((conv) => {
            const name = conv.name || conv.participants?.filter((p) => (p._id || p) !== user.id).map((p) => p.name || 'User').join(', ') || 'Chat';
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
          {loading ? (
            <>
              <MessageSkeleton />
              <MessageSkeleton />
              <MessageSkeleton />
            </>
          ) : messageGroups.map((group, gIdx) => (
            <div key={gIdx} className={`message-group ${group.isOwn ? 'own' : ''}`}>
              {!group.isOwn && (
                <div className="message-avatar">
                  {group.messages[0].senderName?.[0]?.toUpperCase() || '?'}
                </div>
              )}
              <div className="message-bubbles">
                {group.messages.map((msg) => (
                  <div key={msg._id} className="message-bubble-entry">
                    <div className="message-bubble">
                      <div className="message-text">{msg.content}</div>
                      <div className="message-meta">
                        <span className="message-time">{formatTime(msg.createdAt)}</span>
                        {group.isOwn && (
                          <span className={`message-status ${msg.status || 'sent'}`}>
                            {getStatusIcon(msg.status)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {typingUsers.length > 0 && <TypingIndicator users={typingUsers} />}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input-panel">
          <div className="chat-input-tools">
            <button 
              className="chat-tool-btn" 
              onClick={() => setShowAttachments(!showAttachments)}
              title="Attach file"
            >
              <AttachIcon />
            </button>
            <button 
              className="chat-tool-btn" 
              onClick={() => setShowEmoji(!showEmoji)}
              title="Add emoji"
            >
              <EmojiIcon />
            </button>
          </div>
          <form className="chat-input-form" onSubmit={handleSend}>
            <textarea
              ref={inputRef}
              className="chat-input"
              placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button type="submit" className="btn btn-primary chat-send-btn" disabled={!input.trim()}>
              <SendIcon />
            </button>
          </form>
          <div className="chat-input-hint">Enter to send • Shift+Enter for new line</div>
        </div>

        <AIAssistantPanel context={messages} contextType="chat" />
      </div>

      <div className="contact-panel">
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