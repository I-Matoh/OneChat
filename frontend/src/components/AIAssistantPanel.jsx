import { useState, useRef, useCallback, useEffect } from 'react';
import { useApi } from '../hooks/useApi';

const SparklesIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const SendIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
  </svg>
);

const LoadingSpinner = () => (
  <div className="ai-loading-spinner">
    <span className="ai-spinner-dot" />
    <span className="ai-spinner-dot" />
    <span className="ai-spinner-dot" />
  </div>
);

const actionChips = [
  { id: 'summarize', label: 'Summarize', icon: '📋', prompt: 'Summarize this conversation into key points:' },
  { id: 'tasks', label: 'Extract tasks', icon: '✅', prompt: 'Extract action items and tasks from this conversation:' },
  { id: 'decisions', label: 'Highlight decisions', icon: '🎯', prompt: 'Identify and highlight the key decisions made in this conversation:' },
];

function AIAssistantPanel({ context, contextType }) {
  const { apiFetch } = useApi();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  const generateResponse = useCallback(async (prompt) => {
    setLoading(true);
    setStreamingText('');
    
    const contextData = contextType === 'chat' 
      ? context.map(m => `${m.senderName || 'User'}: ${m.content}`).join('\n')
      : context;

    try {
      const response = await apiFetch('/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({ 
          prompt: prompt + '\n\n' + contextData,
          contextType 
        }),
      });

      if (response.text) {
        const text = response.text;
        for (let i = 0; i < text.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 20));
          setStreamingText(text.slice(0, i + 1));
        }
      }
    } catch (err) {
      setStreamingText('Sorry, I encountered an error processing your request. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [context, contextType, apiFetch]);

  const handleSend = useCallback(() => {
    if (!input.trim()) return;
    
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    
    generateResponse(input);
  }, [input, generateResponse]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleChipClick = useCallback((chip) => {
    if (loading) return;
    
    const userMessage = { role: 'user', content: chip.label };
    setMessages(prev => [...prev, userMessage]);
    
    generateResponse(chip.prompt);
  }, [loading, generateResponse]);

  const handleClear = useCallback(() => {
    setMessages([]);
    setStreamingText('');
    setInput('');
  }, []);

  if (!isOpen) {
    return (
      <button 
        className="ai-panel-toggle"
        onClick={() => setIsOpen(true)}
        title="Open AI Assistant"
      >
        <SparklesIcon />
        <span>AI Assistant</span>
      </button>
    );
  }

  return (
    <div className="ai-panel">
      <div className="ai-panel-header">
        <div className="ai-panel-title">
          <SparklesIcon />
          <span>AI Assistant</span>
          <span className="ai-panel-badge">{contextType}</span>
        </div>
        <div className="ai-panel-actions">
          {messages.length > 0 && (
            <button className="ai-panel-clear" onClick={handleClear}>
              Clear
            </button>
          )}
          <button className="ai-panel-close" onClick={() => setIsOpen(false)}>
            ×
          </button>
        </div>
      </div>

      <div className="ai-panel-content">
        {messages.length === 0 && !streamingText ? (
          <div className="ai-panel-empty">
            <div className="ai-empty-icon">✨</div>
            <div className="ai-empty-title">AI Assistant</div>
            <div className="ai-empty-text">
              Ask me anything about your {contextType}, or use the quick actions below.
            </div>
            <div className="ai-action-chips">
              {actionChips.map((chip) => (
                <button
                  key={chip.id}
                  className="ai-chip"
                  onClick={() => handleChipClick(chip)}
                  disabled={loading}
                >
                  <span className="ai-chip-icon">{chip.icon}</span>
                  <span>{chip.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="ai-messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`ai-message ${msg.role}`}>
                <div className="ai-message-content">{msg.content}</div>
              </div>
            ))}
            {(loading || streamingText) && (
              <div className="ai-message assistant">
                <div className="ai-message-content">
                  {loading && !streamingText ? (
                    <div className="ai-loading">
                      <LoadingSpinner />
                      <span>Processing...</span>
                    </div>
                  ) : (
                    <div className="ai-streaming">
                      {streamingText}
                      <span className="ai-cursor">|</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="ai-panel-input">
        <input
          ref={inputRef}
          type="text"
          className="ai-input"
          placeholder="Ask something..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button 
          className="ai-send-btn" 
          onClick={handleSend}
          disabled={!input.trim() || loading}
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

export default AIAssistantPanel;