import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Hash, Plus, Send, MessageSquare, Users } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import CreateConversationModal from '@/components/chat/CreateCoversationModal';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';

function getId(item) {
  return item?._id || item?.id;
}

function normalizeId(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  return value._id || value.id || String(value);
}

function normalizeSenderId(senderId) {
  if (!senderId) return null;
  if (typeof senderId === 'string') return senderId;
  return senderId._id || senderId.id || null;
}

export default function Chat() {
  const { user, currentWorkspaceId } = useOutletContext();
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket(token);
  const bottomRef = useRef(null);

  const [selectedConvId, setSelectedConvId] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [sending, setSending] = useState(false);

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', currentWorkspaceId],
    queryFn: () => api.conversations.list(currentWorkspaceId),
    enabled: !!currentWorkspaceId,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', selectedConvId],
    queryFn: () => api.conversations.getMessages(selectedConvId),
    enabled: !!selectedConvId,
  });

  const selectedConv = conversations.find((conversation) => getId(conversation) === selectedConvId) || null;

  useEffect(() => {
    if (!currentWorkspaceId) {
      setSelectedConvId(null);
      return;
    }
    if (conversations.length === 0) {
      setSelectedConvId(null);
      return;
    }
    const selectedExists = conversations.some((conversation) => getId(conversation) === selectedConvId);
    if (!selectedConvId || !selectedExists) {
      setSelectedConvId(getId(conversations[0]));
    }
  }, [conversations, selectedConvId, currentWorkspaceId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!socket || !connected || !selectedConvId) return undefined;
    socket.emit('chat:join', selectedConvId);
    return () => {
      socket.emit('chat:leave', selectedConvId);
    };
  }, [socket, connected, selectedConvId]);

  useEffect(() => {
    if (!socket) return undefined;

    const updateConversationPreview = (conversationId, lastMessage, updatedAt) => {
      const normalizedConversationId = normalizeId(conversationId);
      queryClient.setQueryData(['conversations', currentWorkspaceId], (existing = []) => {
        const next = existing.map((conversation) => (
          getId(conversation) === normalizedConversationId
            ? { ...conversation, lastMessage, updatedAt: updatedAt || new Date().toISOString() }
            : conversation
        ));
        return next.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      });
    };

    const onConversationNew = (conversation) => {
      if (currentWorkspaceId && conversation.workspaceId && normalizeId(conversation.workspaceId) !== currentWorkspaceId) {
        return;
      }
      const conversationId = getId(conversation);
      queryClient.setQueryData(['conversations', currentWorkspaceId], (existing = []) => {
        const alreadyExists = existing.some((item) => getId(item) === conversationId);
        if (alreadyExists) return existing;
        const next = [conversation, ...existing];
        return next.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      });
      if (!selectedConvId) setSelectedConvId(conversationId);
    };

    const onConversationUpdated = ({ conversationId, lastMessage, updatedAt }) => {
      updateConversationPreview(conversationId, lastMessage, updatedAt);
    };

    const onMessageNew = (message) => {
      const conversationId = normalizeId(message.conversationId);
      updateConversationPreview(conversationId, message.content, message.createdAt);

      if (conversationId !== selectedConvId) return;
      queryClient.setQueryData(['messages', selectedConvId], (existing = []) => {
        const messageId = getId(message);
        if (existing.some((item) => getId(item) === messageId)) return existing;
        return [...existing, message];
      });
    };

    const onMessageStatus = ({ messageId, status }) => {
      if (!selectedConvId) return;
      queryClient.setQueryData(['messages', selectedConvId], (existing = []) => (
        existing.map((message) => (
          getId(message) === normalizeId(messageId) ? { ...message, status } : message
        ))
      ));
    };

    const onMessageUpdated = (payload) => {
      if (!selectedConvId) return;
      queryClient.setQueryData(['messages', selectedConvId], (existing = []) => (
        existing.map((message) => (
          getId(message) === payload._id
            ? { ...message, ...payload }
            : message
        ))
      ));
    };

    socket.on('conversation:new', onConversationNew);
    socket.on('conversation:updated', onConversationUpdated);
    socket.on('message:new', onMessageNew);
    socket.on('message:status', onMessageStatus);
    socket.on('message:updated', onMessageUpdated);

    return () => {
      socket.off('conversation:new', onConversationNew);
      socket.off('conversation:updated', onConversationUpdated);
      socket.off('message:new', onMessageNew);
      socket.off('message:status', onMessageStatus);
      socket.off('message:updated', onMessageUpdated);
    };
  }, [socket, queryClient, selectedConvId, currentWorkspaceId]);

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConvId || sending) return;
    const content = messageText.trim();
    setMessageText('');
    setSending(true);
    try {
      if (socket && connected) {
        socket.emit('message:send', { conversationId: selectedConvId, content });
      } else {
        await api.messages.create({ conversationId: selectedConvId, content });
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setMessageText(content);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleConversationCreated = (conversation) => {
    queryClient.setQueryData(['conversations', currentWorkspaceId], (existing = []) => {
      const conversationId = getId(conversation);
      const alreadyExists = existing.some((item) => getId(item) === conversationId);
      if (alreadyExists) return existing;
      return [conversation, ...existing];
    });
    setSelectedConvId(getId(conversation));
    setShowCreate(false);
  };

  if (!currentWorkspaceId) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Select a workspace to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-44 sm:w-56 border-r border-border bg-muted/30 flex flex-col shrink-0">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Channels</span>
          <button
            onClick={() => setShowCreate(true)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Create channel"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2 text-center">No channels yet</p>
          ) : (
            conversations.map((conversation) => {
              const conversationId = getId(conversation);
              return (
                <button
                  key={conversationId}
                  onClick={() => setSelectedConvId(conversationId)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left',
                    selectedConvId === conversationId
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {conversation.participants?.length === 2
                    ? <Users className="w-3.5 h-3.5 shrink-0" />
                    : <Hash className="w-3.5 h-3.5 shrink-0" />}
                  <span className="truncate">{conversation.name || 'channel'}</span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        {selectedConv ? (
          <>
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <Hash className="w-4.5 h-4.5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">{selectedConv.name || 'channel'}</h2>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const senderId = normalizeSenderId(message.senderId);
                  const isMe = senderId === user?.id || message.senderId === user?.id;
                  const previousMessage = messages[index - 1];
                  const previousSenderId = normalizeSenderId(previousMessage?.senderId);
                  const sameAuthor = previousMessage
                    && previousSenderId === senderId
                    && (new Date(message.createdAt) - new Date(previousMessage.createdAt)) < 300000;
                  return (
                    <MessageBubble
                      key={getId(message)}
                      message={message}
                      isMe={isMe}
                      compact={sameAuthor}
                    />
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            <div className="p-3 border-t border-border">
              <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2 border border-border">
                <Input
                  value={messageText}
                  onChange={(event) => setMessageText(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message #${selectedConv.name || 'channel'}`}
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm"
                />
                <button
                  onClick={sendMessage}
                  disabled={!messageText.trim() || sending}
                  className="w-8 h-8 flex items-center justify-center bg-primary rounded-lg text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Select a channel to start chatting</p>
              <Button className="mt-4" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4 mr-1.5" /> Create Channel
              </Button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateConversationModal
          workspaceId={currentWorkspaceId}
          onClose={() => setShowCreate(false)}
          onCreated={handleConversationCreated}
        />
      )}
    </div>
  );
}

function MessageBubble({ message, isMe, compact }) {
  const senderName = message.senderName || message.senderId?.name || message.senderEmail || 'User';
  return (
    <div className={cn('flex gap-3 group', isMe && 'flex-row-reverse')}>
      {!compact ? (
        <Avatar className="w-8 h-8 shrink-0 mt-0.5">
          <AvatarFallback className={cn('text-xs font-semibold', isMe ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
            {senderName?.[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-8 shrink-0" />
      )}
      <div className={cn('max-w-[70%]', isMe && 'items-end flex flex-col')}>
        {!compact && (
          <div className={cn('flex items-baseline gap-2 mb-1', isMe && 'flex-row-reverse')}>
            <span className="text-xs font-semibold text-foreground">{senderName}</span>
            <span className="text-xs text-muted-foreground">{format(new Date(message.createdAt), 'HH:mm')}</span>
          </div>
        )}
        <div className={cn(
          'px-3 py-2 rounded-2xl text-sm leading-relaxed',
          isMe
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-card border border-border text-foreground rounded-tl-sm'
        )}>
          {message.content}
        </div>
      </div>
    </div>
  );
}
