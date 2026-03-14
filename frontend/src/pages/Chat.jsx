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
  const messagesEndRef = useRef(null);
  const typingTimeout = useRef(null);

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConvId) return;
    apiFetch(`/chat/conversations/${activeConvId}/messages`)
      .then(setMessages)
      .catch(() => setMessages([]));
  }, [activeConvId]);

  // Join conversation room
  useEffect(() => {
    if (!activeConvId || !token) return;
    const s = getSocket(token);
    s.emit('chat:join', activeConvId);
  }, [activeConvId, token]);

  // Listen for new messages
  useSocketEvent('message:new', useCallback((msg) => {
    if (msg.conversationId === activeConvId) {
      setMessages((prev) => [...prev, msg]);
    }
    // Update conversation list's last message
    setConversations((prev) =>
      prev.map((c) =>
        c._id === msg.conversationId ? { ...c, lastMessage: msg.content, updatedAt: msg.createdAt } : c
      )
    );
  }, [activeConvId]));

  // Typing indicators
  useSocketEvent('message:typing', useCallback((data) => {
    if (data.conversationId !== activeConvId) return;
    setTypingUsers((prev) => {
      if (prev.find((u) => u.userId === data.userId)) return prev;
      return [...prev, data];
    });
    setTimeout(() => {
      setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
    }, 3000);
  }, [activeConvId]));

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
      <div className="empty-state">
        <div className="empty-state-icon">💬</div>
        <div className="empty-state-text">Select a conversation</div>
        <div className="empty-state-hint">Choose from the sidebar or start a new chat</div>
      </div>
    );
  }

  const activeConv = conversations.find((c) => c._id === activeConvId);

  return (
    <div className="chat-area">
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
  );
}
