import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Hash, Plus, Send, MessageSquare, Users, UserPlus, Circle, PanelRightOpen, PanelRightClose } from 'lucide-react';
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
  const { user, currentWorkspaceId } = useOutletContext();
  const { token } = useAuth();
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

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', currentWorkspaceId],
    queryFn: () => api.conversations.list(currentWorkspaceId),
    enabled: !!currentWorkspaceId,
  });

  const { data: workspaceMembers = [] } = useQuery({
    queryKey: ['workspace-members', currentWorkspaceId],
    queryFn: () => api.workspaces.members(currentWorkspaceId),
    enabled: !!currentWorkspaceId,
  });

  const workspaceUsersById = new Map(
    workspaceMembers
      .filter((member) => member?.user)
      .map((member) => [normalizeId(member.userId), member.user])
  );

  const selectedConv = conversations.find((conversation) => getId(conversation) === selectedConvId) || null;
  const selectedParticipants = (selectedConv?.participants || []).map((participant) => {
    const participantId = normalizeId(participant);
    if (participant && typeof participant === 'object' && (participant._id || participant.id)) {
      return participant;
    }
    return workspaceUsersById.get(participantId) || { _id: participantId, name: 'Member', status: 'offline' };
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
    const otherUser = workspaceUsersById.get(normalizeId(other));
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

    socket.on('conversation:new', onConversationNew);
    socket.on('conversation:updated', onConversationUpdated);
    socket.on('message:new', onMessageNew);
    socket.on('message:status', onMessageStatus);

    return () => {
      socket.off('conversation:new', onConversationNew);
      socket.off('conversation:updated', onConversationUpdated);
      socket.off('message:new', onMessageNew);
      socket.off('message:status', onMessageStatus);
    };
  }, [socket, queryClient, selectedConvId, currentWorkspaceId]);

  const handleStartDM = async (targetUserId) => {
    if (!targetUserId || targetUserId === user?.id) return;

    try {
      const dmConv = await api.conversations.findOrCreateDM(targetUserId, currentWorkspaceId);
      const convId = getId(dmConv);
      queryClient.setQueryData(['conversations', currentWorkspaceId], (existing = []) => {
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
      queryClient.setQueryData(['conversations', currentWorkspaceId], (existing = []) => (
        existing.map((conversation) => (getId(conversation) === selectedConvId ? joined : conversation))
      ));
      queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
    } finally {
      setJoiningChannel(false);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConvId || sending || !isParticipant) return;
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
            <div className="px-5 py-3 border-b border-border flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {selectedDisplay.icon === 'dm' ? (
                  <Avatar className="w-6 h-6 shrink-0">
                    <AvatarFallback className="text-[10px]">{selectedDisplay.name[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                ) : (
                  <Hash className="w-4.5 h-4.5 text-muted-foreground shrink-0" />
                )}
                <h2 className="font-semibold text-foreground truncate">{selectedDisplay.name}</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{selectedParticipants.length} members</span>
                <button
                  onClick={() => setShowOnlinePanel(!showOnlinePanel)}
                  className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title={showOnlinePanel ? 'Hide online users' : 'Show online users'}
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
                  <p className="text-xs text-muted-foreground mt-1">This channel belongs to workspace `{currentWorkspaceId}`.</p>
                  <Button className="mt-4 gap-1.5" onClick={joinSelectedChannel} disabled={joiningChannel}>
                    <UserPlus className="w-4 h-4" />
                    {joiningChannel ? 'Joining...' : 'Join Channel'}
                  </Button>
                </div>
              </div>
            ) : (
              <>
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
                {workspaceMembers.filter((m) => m?.user && getUserStatus(normalizeId(m.user), m.user.status) === 'online').length} online
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
            {workspaceMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No members found</p>
            ) : (
              [...workspaceMembers]
                .filter((m) => m?.user)
                .sort((a, b) => {
                  const sa = getUserStatus(normalizeId(a.user), a.user.status);
                  const sb = getUserStatus(normalizeId(b.user), b.user.status);
                  const order = { online: 0, away: 1, offline: 2 };
                  return (order[sa] ?? 3) - (order[sb] ?? 3);
                })
                .map((member) => {
                  const participant = member.user;
                  const participantId = normalizeId(participant);
                  const status = getUserStatus(participantId, participant.status);
                  const isCurrentUser = participantId === normalizeId(user?.id);
                  
                  return (
                    <button
                      key={participantId}
                      onClick={() => !isCurrentUser && handleStartDM(participantId)}
                      disabled={isCurrentUser}
                      className={cn(
                        'w-full flex items-center gap-2 px-2 py-2 rounded-md transition-colors text-left',
                        isCurrentUser ? 'opacity-60 cursor-default' : 'hover:bg-muted/70 cursor-pointer group'
                      )}
                    >
                      <span className="relative shrink-0">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="text-xs">
                            {(participant.name || participant.email || 'U')[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className={cn('absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card', statusClass(status))} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{participant.name || participant.email || 'Member'}{isCurrentUser && ' (You)'}</p>
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
