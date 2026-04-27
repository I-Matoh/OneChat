import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Hash, Plus, Send, MessageSquare, Users, UserPlus, Circle, PanelRightOpen, PanelRightClose, Paperclip, File, X, Image, ExternalLink, Download, Smile, Check, CheckCheck, Search } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import api from '@/lib/api';
import CreateConversationModal from '@/components/chat/CreateCoversationModal';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import { useToast } from '@/components/ui/use-toast';

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

function statusClass(status) {
  if (status === 'online') return 'bg-emerald-500';
  if (status === 'away') return 'bg-amber-400';
  return 'bg-slate-400';
}

export default function Chat() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const { socket, connected } = useSocket(token);
  const { toast } = useToast();
  const bottomRef = useRef(null);

  const [selectedConvId, setSelectedConvId] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [sending, setSending] = useState(false);
  const [joiningChannel, setJoiningChannel] = useState(false);
  const [presenceByUserId, setPresenceByUserId] = useState({});
  const [showOnlinePanel, setShowOnlinePanel] = useState(false);
  const [typingUsers, setTypingUsers] = useState({}); // { [userId]: { userName, timestamp } }
  const [pendingAttachments, setPendingAttachments] = useState([]); // Array of { url, filename, size, mimeType }
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const lastTypingEmit = useRef(0);
  const fileInputRef = useRef(null);

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => api.conversations.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.users.list(),
  });

  const usersById = new Map(
    allUsers.map((u) => [normalizeId(u._id || u.id), u])
  );

  const selectedConv = conversations.find((conversation) => getId(conversation) === selectedConvId) || null;
  const selectedParticipants = (selectedConv?.participants || []).map((participant) => {
    const participantId = normalizeId(participant);
    if (participant && typeof participant === 'object' && (participant._id || participant.id)) {
      return participant;
    }
    return usersById.get(participantId) || { _id: participantId, name: 'Member', status: 'offline' };
  });
  const isParticipant = selectedParticipants.some((participant) => normalizeId(participant) === normalizeId(user?.id));

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', selectedConvId],
    queryFn: () => api.conversations.getMessages(selectedConvId),
    enabled: !!selectedConvId && isParticipant,
  });

  const getUserStatus = (userId, fallbackStatus = 'offline') => (
    presenceByUserId[userId] || fallbackStatus || 'offline'
  );

  // Split conversations into channels and DMs
  const channels = conversations.filter((c) => c.type !== 'dm');
  const dms = conversations.filter((c) => c.type === 'dm');

  // Get display name for a DM conversation (shows the other person's name)
  const getDmDisplayName = (conv) => {
    const participants = conv.participants || [];
    const other = participants.find((p) => normalizeId(p) !== normalizeId(user?.id));
    if (other && typeof other === 'object') return other.name || other.email || 'User';
    const otherUser = usersById.get(normalizeId(other));
    return otherUser?.name || otherUser?.email || 'User';
  };

  // Get the other user's presence in a DM
  const getDmUserStatus = (conv) => {
    const participants = conv.participants || [];
    const other = participants.find((p) => normalizeId(p) !== normalizeId(user?.id));
    const otherId = normalizeId(other);
    return getUserStatus(otherId, 'offline');
  };

  // Get unread count for a conversation for the current user
  const getUnreadCount = (conv) => {
    if (!conv.unreadCounts) return 0;
    const counts = conv.unreadCounts instanceof Map ? Object.fromEntries(conv.unreadCounts) : conv.unreadCounts;
    return counts[user?.id] || 0;
  };

  // Compute the header display for selected conversation
  const getSelectedConvDisplay = () => {
    if (!selectedConv) return { name: '', icon: 'hash' };
    if (selectedConv.type === 'dm') {
      return { name: getDmDisplayName(selectedConv), icon: 'dm' };
    }
    return { name: selectedConv.name || 'channel', icon: 'hash' };
  };
  const selectedDisplay = getSelectedConvDisplay();

  useEffect(() => {
    if (conversations.length === 0) {
      setSelectedConvId(null);
      return;
    }
    const selectedExists = conversations.some((conversation) => getId(conversation) === selectedConvId);
    if (!selectedConvId || !selectedExists) {
      setSelectedConvId(getId(conversations[0]));
    }
  }, [conversations, selectedConvId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!socket || !connected || !selectedConvId || !isParticipant) return undefined;
    socket.emit('chat:join', selectedConvId);
    return () => {
      socket.emit('chat:leave', selectedConvId);
    };
  }, [socket, connected, selectedConvId, isParticipant]);

  useEffect(() => {
    if (!socket) return undefined;

    const onPresenceInit = (users) => {
      const next = {};
      for (const entry of users || []) {
        if (entry?.userId) next[entry.userId] = entry.status || 'online';
      }
      setPresenceByUserId(next);
    };

    const onPresenceUpdate = ({ userId, status }) => {
      if (!userId) return;
      setPresenceByUserId((prev) => ({ ...prev, [userId]: status || 'offline' }));
    };

    socket.on('presence:init', onPresenceInit);
    socket.on('presence:update', onPresenceUpdate);
    return () => {
      socket.off('presence:init', onPresenceInit);
      socket.off('presence:update', onPresenceUpdate);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket) return undefined;

    const updateConversationPreview = (conversationId, lastMessage, updatedAt) => {
      const normalizedConversationId = normalizeId(conversationId);
      queryClient.setQueryData(['conversations'], (existing = []) => {
        const next = existing.map((conversation) => (
          getId(conversation) === normalizedConversationId
            ? { ...conversation, lastMessage, updatedAt: updatedAt || new Date().toISOString() }
            : conversation
        ));
        return next.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
      });
    };

    const onConversationNew = (conversation) => {
      const conversationId = getId(conversation);
      queryClient.setQueryData(['conversations'], (existing = []) => {
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

    const onMessageUpdated = (updatedMessage) => {
      if (!selectedConvId) return;
      queryClient.setQueryData(['messages', selectedConvId], (existing = []) => (
        existing.map((message) => (
          getId(message) === normalizeId(updatedMessage._id) ? { ...message, ...updatedMessage } : message
        ))
      ));
    };

    const onMessageTyping = ({ userId, userName, conversationId }) => {
      if (normalizeId(conversationId) !== selectedConvId) return;
      if (normalizeId(userId) === user?.id) return;

      setTypingUsers((prev) => ({
        ...prev,
        [userId]: { userName, timestamp: Date.now() },
      }));
    };

    const onMessageStatusBulk = ({ conversationId: cid, status }) => {
      if (normalizeId(cid) !== selectedConvId) return;
      queryClient.setQueryData(['messages', selectedConvId], (existing = []) => (
        existing.map((message) => (
          message.status !== status ? { ...message, status } : message
        ))
      ));
    };

    socket.on('conversation:new', onConversationNew);
    socket.on('conversation:updated', onConversationUpdated);
    socket.on('message:new', onMessageNew);
    socket.on('message:status', onMessageStatus);
    socket.on('message:status_bulk', onMessageStatusBulk);
    socket.on('message:updated', onMessageUpdated);
    socket.on('message:typing', onMessageTyping);

    return () => {
      socket.off('conversation:new', onConversationNew);
      socket.off('conversation:updated', onConversationUpdated);
      socket.off('message:new', onMessageNew);
      socket.off('message:status', onMessageStatus);
      socket.off('message:status_bulk', onMessageStatusBulk);
      socket.off('message:updated', onMessageUpdated);
      socket.off('message:typing', onMessageTyping);
    };
  }, [socket, queryClient, selectedConvId]);

  // Cleanup stale typing users
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const next = { ...prev };
        let changed = false;
        Object.entries(next).forEach(([userId, data]) => {
          if (now - data.timestamp > 4000) {
            delete next[userId];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleTyping = () => {
    if (!socket || !selectedConvId) return;
    const now = Date.now();
    if (now - lastTypingEmit.current > 2000) {
      socket.emit('message:typing', { conversationId: selectedConvId });
      lastTypingEmit.current = now;
    }
  };

  const handleStartDM = async (targetUserId) => {
    if (!targetUserId || targetUserId === user?.id) return;

    try {
      const dmConv = await api.conversations.findOrCreateDM(targetUserId);
      const convId = getId(dmConv);
      queryClient.setQueryData(['conversations'], (existing = []) => {
        const alreadyExists = existing.some((item) => getId(item) === convId);
        if (alreadyExists) return existing;
        return [dmConv, ...existing];
      });
      setSelectedConvId(convId);
      setShowOnlinePanel(false);
    } catch (error) {
      console.error('Failed to start direct message', error);
      toast({
        title: "Failed to start direct message",
        description: error.message || "An unexpected error occurred while creating the conversation.",
        variant: "destructive",
      });
    }
  };

  const joinSelectedChannel = async () => {
    if (!selectedConvId || joiningChannel) return;
    setJoiningChannel(true);
    try {
      const joined = await api.conversations.join(selectedConvId);
      queryClient.setQueryData(['conversations'], (existing = []) => (
        existing.map((conversation) => (getId(conversation) === selectedConvId ? joined : conversation))
      ));
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
    } finally {
      setJoiningChannel(false);
    }
  };

  const sendMessage = async () => {
    if ((!messageText.trim() && pendingAttachments.length === 0) || !selectedConvId || sending) return;

    setSending(true);
    try {
      socket.emit('message:send', {
        conversationId: selectedConvId,
        content: messageText.trim(),
        attachments: pendingAttachments,
      });
      setMessageText('');
      setPendingAttachments([]);
    } catch (error) {
      console.error('Failed to send message', error);
      toast({
        title: "Message failed",
        description: "Could not send your message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      try {
        const metadata = await api.messages.uploadFile(file);
        setPendingAttachments(prev => [...prev, metadata]);
      } catch (err) {
        toast({
          title: "Upload failed",
          description: `Failed to upload ${file.name}`,
          variant: "destructive"
        });
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingAttachment = (index) => {
    setPendingAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleToggleReaction = async (messageId, emoji) => {
    try {
      await api.messages.toggleReaction(messageId, emoji);
    } catch (err) {
      console.error('Failed to toggle reaction', err);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const handleConversationCreated = (conversation) => {
    queryClient.setQueryData(['conversations'], (existing = []) => {
      const conversationId = getId(conversation);
      const alreadyExists = existing.some((item) => getId(item) === conversationId);
      if (alreadyExists) return existing;
      return [conversation, ...existing];
    });
    setSelectedConvId(getId(conversation));
    setShowCreate(false);
  };

  const filteredMessages = searchQuery.trim() 
    ? messages.filter(m => m.content?.toLowerCase().includes(searchQuery.toLowerCase()) || m.attachments?.some(a => a.filename.toLowerCase().includes(searchQuery.toLowerCase())))
    : messages;

  return (
    <div className="flex h-full">
      <div className="w-60 border-r border-border bg-muted/30 flex flex-col shrink-0">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Messages</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowOnlinePanel(!showOnlinePanel)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors lg:hidden"
              title="Online users"
            >
              <Users className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Create channel"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-3">
          {/* --- Channels Section --- */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">Channels</p>
            {channels.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2">No channels yet</p>
            ) : (
              channels.map((conv) => {
                const convId = getId(conv);
                const unread = getUnreadCount(conv);
                return (
                  <button
                    key={convId}
                    onClick={() => setSelectedConvId(convId)}
                    className={cn(
                      'w-full px-2 py-1.5 rounded-md text-sm transition-colors text-left flex items-center gap-2',
                      selectedConvId === convId
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Hash className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate flex-1">{conv.name || 'general'}</span>
                    {unread > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{unread > 99 ? '99+' : unread}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* --- Direct Messages Section --- */}
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-1">Direct Messages</p>
            {dms.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2">No DMs yet — click a user to start</p>
            ) : (
              dms.map((conv) => {
                const convId = getId(conv);
                const dmName = getDmDisplayName(conv);
                const dmStatus = getDmUserStatus(conv);
                const unread = getUnreadCount(conv);
                return (
                  <button
                    key={convId}
                    onClick={() => setSelectedConvId(convId)}
                    className={cn(
                      'w-full px-2 py-1.5 rounded-md text-sm transition-colors text-left flex items-center gap-2',
                      selectedConvId === convId
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span className="relative shrink-0">
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-[10px]">{dmName[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background', statusClass(dmStatus))} />
                    </span>
                    <span className="truncate flex-1">{dmName}</span>
                    {unread > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">{unread > 99 ? '99+' : unread}</span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {selectedConv ? (
          <>
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-background/60 backdrop-blur-md sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  {selectedDisplay.icon === 'dm' ? <Users className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedDisplay.name}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Circle className="w-1.5 h-1.5 fill-emerald-500 text-emerald-500" />
                    {selectedParticipants.length} members
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {isSearching ? (
                  <div className="flex items-center bg-muted/60 rounded-full px-2.5 py-1 border border-border w-48 mr-2">
                    <Search className="w-3 h-3 text-muted-foreground mr-1.5" />
                    <Input 
                      className="h-5 border-0 bg-transparent p-0 text-[11px] focus-visible:ring-0 shadow-none" 
                      placeholder="Search..."
                      autoFocus
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <button onClick={() => { setSearchQuery(''); setIsSearching(false); }}>
                      <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsSearching(true)} 
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Search messages"
                  >
                    <Search className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setShowOnlinePanel(!showOnlinePanel)}
                  className={cn(
                    'w-8 h-8 flex items-center justify-center rounded-full transition-colors',
                    showOnlinePanel ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  )}
                >
                  {showOnlinePanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!isParticipant ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="text-center max-w-sm">
                  <UserPlus className="w-9 h-9 mx-auto mb-3 text-primary/80" />
                  <p className="text-sm text-foreground font-medium">Join this channel to start chatting</p>
                  <Button className="mt-4 gap-1.5" onClick={joinSelectedChannel} disabled={joiningChannel}>
                    <UserPlus className="w-4 h-4" />
                    {joiningChannel ? 'Joining...' : 'Join Channel'}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
                  {filteredMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <MessageSquare className="w-10 h-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm text-muted-foreground">
                        {searchQuery ? 'No messages matching your search.' : 'No messages yet. Start the conversation!'}
                      </p>
                    </div>
                  ) : (
                    filteredMessages.map((message, index) => {
                      const senderId = normalizeSenderId(message.senderId);
                      const isMe = senderId === user?.id || message.senderId === user?.id;
                      const previousMessage = filteredMessages[index - 1];
                      const previousSenderId = normalizeSenderId(previousMessage?.senderId);
                      const sameAuthor = previousMessage
                        && previousSenderId === senderId
                        && (new Date(message.createdAt) - new Date(previousMessage.createdAt)) < 300000;
                      return (
                        <MessageBubble
                          key={getId(message)}
                          message={message}
                          isMe={isMe}
                          compact={sameAuthor && !searchQuery}
                          onToggleReaction={(emoji) => handleToggleReaction(getId(message), emoji)}
                          currentUserId={user?.id}
                        />
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                <div className="p-3 border-t border-border relative">
                  {/* Pending Attachments */}
                  {pendingAttachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3 px-2">
                      {pendingAttachments.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 bg-muted p-1.5 rounded-lg border border-border pr-1">
                          {file.mimeType?.startsWith('image/') ? (
                            <div className="w-8 h-8 rounded bg-background overflow-hidden">
                              <img src={file.url} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <File className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="text-[11px] max-w-[100px] truncate">{file.filename}</span>
                          <button 
                            onClick={() => removePendingAttachment(i)}
                            className="p-1 hover:bg-background rounded-full text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Typing Indicator */}
                  {Object.values(typingUsers).length > 0 && (
                    <div className="absolute -top-6 left-5 text-[11px] text-muted-foreground animate-pulse">
                      {Object.values(typingUsers).map(u => u.userName).join(', ')} {Object.values(typingUsers).length === 1 ? 'is' : 'are'} typing...
                    </div>
                  )}
                  <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2 border border-border">
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      multiple
                      onChange={handleFileSelect}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <Input
                      value={messageText}
                      onChange={(event) => {
                        setMessageText(event.target.value);
                        handleTyping();
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder={`Message ${selectedDisplay.icon === 'dm' ? selectedDisplay.name : '#' + selectedDisplay.name}`}
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
            )}
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

      {(showOnlinePanel || true) && (
        <div className={cn(
          'w-64 border-l border-border bg-card/40 flex-col shrink-0 transition-all duration-200',
          showOnlinePanel ? 'flex' : 'hidden lg:flex'
        )}>
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Online Now</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {allUsers.filter((u) => getUserStatus(normalizeId(u._id || u.id), u.status) === 'online').length} online
              </p>
            </div>
            <button
              onClick={() => setShowOnlinePanel(false)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors lg:hidden"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 p-2 overflow-y-auto scrollbar-thin space-y-0.5">
            {allUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No users found</p>
            ) : (
              [...allUsers]
                .sort((a, b) => {
                  const sa = getUserStatus(normalizeId(a._id || a.id), a.status);
                  const sb = getUserStatus(normalizeId(b._id || b.id), b.status);
                  const order = { online: 0, away: 1, offline: 2 };
                  return (order[sa] ?? 3) - (order[sb] ?? 3);
                })
                .map((u) => {
                  const userId = normalizeId(u._id || u.id);
                  const status = getUserStatus(userId, u.status);
                  const isCurrentUser = userId === normalizeId(user?.id);

                  return (
                    <button
                      key={userId}
                      onClick={() => !isCurrentUser && handleStartDM(userId)}
                      disabled={isCurrentUser}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors text-left',
                        isCurrentUser ? 'opacity-60 cursor-default' : 'hover:bg-muted/70 cursor-pointer group'
                      )}
                    >
                      <span className="relative shrink-0">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs">
                            {(u.name || u.email || 'U')[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card', statusClass(status))} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{u.name || u.email || 'User'}{isCurrentUser && ' (You)'}</p>
                        <p className="text-[11px] text-muted-foreground capitalize">{status}</p>
                      </div>
                      {!isCurrentUser && (
                        <MessageSquare className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      )}
                    </button>
                  );
                })
            )}
          </div>
        </div>
      )}

      {showCreate && (
        <CreateConversationModal
          onClose={() => setShowCreate(false)}
          onCreated={handleConversationCreated}
        />
      )}
    </div>
  );
}

function MessageBubble({ message, isMe, compact, onToggleReaction, currentUserId }) {
  const senderName = message.senderName || message.senderId?.name || message.senderEmail || 'User';
  const reactions = message.reactions || [];
  
  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, users: [], me: false };
    acc[r.emoji].count += 1;
    acc[r.emoji].users.push(r.userName);
    if (normalizeId(r.userId) === normalizeId(currentUserId)) acc[r.emoji].me = true;
    return acc;
  }, {});

  const quickEmojis = ['👍', '❤️', '🔥', '😂', '😮', '🙌'];

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
        <div className="relative group/content flex flex-col gap-1">
          <div className={cn(
            'px-3 py-2 rounded-2xl text-sm leading-relaxed relative group/msg',
            isMe
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-card border border-border text-foreground rounded-tl-sm'
          )}>
            {message.content}
            
            {message.attachments?.length > 0 && (
              <div className={cn('mt-2 space-y-2', message.content && 'pt-2 border-t border-white/10')}>
                {message.attachments.map((file, i) => {
                  const isImage = file.mimeType?.startsWith('image/');
                  return (
                    <div key={i} className={cn(
                      'flex items-center gap-3 p-2 rounded-xl border',
                      isMe ? 'bg-black/10 border-white/10' : 'bg-muted/50 border-border'
                    )}>
                      {isImage ? (
                        <img src={file.url} alt="" className="w-12 h-12 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-background flex items-center justify-center">
                          <File className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">{file.filename}</p>
                        <p className="text-[10px] opacity-70">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <a 
                        href={file.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-black/10 rounded-lg transition-colors"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
            
            {isMe && (
              <div className="absolute bottom-1 right-2 flex items-center opacity-70">
                {message.status === 'seen' ? (
                  <CheckCheck className="w-3 h-3 text-blue-300" />
                ) : (
                  <Check className="w-3 h-3 text-white/70" />
                )}
              </div>
            )}
          </div>

          {/* Reactions Display */}
          {Object.keys(groupedReactions).length > 0 && (
            <div className={cn('flex flex-wrap gap-1 mt-1', isMe && 'justify-end')}>
              {Object.entries(groupedReactions).map(([emoji, data]) => (
                <button
                  key={emoji}
                  onClick={() => onToggleReaction(emoji)}
                  title={data.users.join(', ')}
                  className={cn(
                    'flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[11px] border transition-colors',
                    data.me 
                      ? 'bg-primary/10 border-primary/30 text-primary' 
                      : 'bg-muted border-border hover:border-muted-foreground/30'
                  )}
                >
                  <span>{emoji}</span>
                  <span className="font-medium">{data.count}</span>
                </button>
              ))}
            </div>
          )}

          {/* Quick Reaction Picker (Visible on hover) */}
          <div className={cn(
            'absolute -top-8 bg-card border border-border shadow-md rounded-full px-1 py-0.5 flex gap-0.5 opacity-0 group-hover/content:opacity-100 transition-opacity z-10',
            isMe ? 'right-0' : 'left-0'
          )}>
            {quickEmojis.map(emoji => (
              <button
                key={emoji}
                onClick={() => onToggleReaction(emoji)}
                className="w-6 h-6 flex items-center justify-center hover:bg-muted rounded-full text-sm transition-transform hover:scale-125"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
