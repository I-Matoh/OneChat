Replace all the pages section with this

1.AIAssistant page
#here ignore the base44 import
import { useState, useRef, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Send, Loader2, User, Bot, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

const STARTER_PROMPTS = [
  "Summarize our recent conversations",
  "What tasks are overdue?",
  "Help me write meeting notes",
  "Draft a project status update",
  "Extract action items from recent discussions",
];

export default function AIAssistant() {
  const { user, currentWorkspaceId } = useOutletContext();
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm your AI assistant. I can help you summarize documents, extract action items, answer questions about your workspace, and more. What would you like to do?" }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const { data: pages = [] } = useQuery({
    queryKey: ['pages', currentWorkspaceId],
    queryFn: () => base44.entities.Page.filter({ workspace_id: currentWorkspaceId, is_archived: false }),
    enabled: !!currentWorkspaceId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', currentWorkspaceId],
    queryFn: () => base44.entities.Task.filter({ workspace_id: currentWorkspaceId }),
    enabled: !!currentWorkspaceId,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const userText = text || input.trim();
    if (!userText || loading) return;
    setInput('');

    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setLoading(true);

    // Build context
    const pagesSummary = pages.slice(0, 5).map(p => `- "${p.title}" (${p.page_type})`).join('\n');
    const tasksSummary = tasks.filter(t => t.status !== 'done').slice(0, 10).map(t =>
      `- "${t.title}" [${t.priority} priority, ${t.status}${t.assignee_email ? `, assigned to ${t.assignee_email}` : ''}]`
    ).join('\n');

    const systemContext = `You are an AI assistant for a team workspace called OneChat.
Workspace context:
Pages (${pages.length} total):
${pagesSummary || 'No pages yet'}

Open Tasks (${tasks.filter(t => t.status !== 'done').length} total):
${tasksSummary || 'No open tasks'}

Current user: ${user?.full_name || user?.email}
Be concise, helpful and actionable. Format responses with markdown when helpful.`;

    const prompt = `${systemContext}\n\nConversation so far:\n${newMessages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n')}\n\nAssistant:`;

    const response = await base44.integrations.Core.InvokeLLM({ prompt });
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground">AI Assistant</h1>
            <p className="text-xs text-muted-foreground">Powered by advanced AI</p>
          </div>
        </div>
        <button
          onClick={() => setMessages([{ role: 'assistant', content: "Hi! How can I help you today?" }])}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Clear conversation"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === 'user' && "flex-row-reverse")}>
            <div className={cn(
              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
              msg.role === 'user' ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"
            )}>
              {msg.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
            </div>
            <div className={cn(
              "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
              msg.role === 'user'
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-card border border-border text-foreground rounded-tl-sm"
            )}>
              {msg.role === 'assistant' ? (
                <ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  {msg.content}
                </ReactMarkdown>
              ) : msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center shrink-0">
              <Sparkles className="w-3.5 h-3.5 text-accent-foreground" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Starter prompts */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {STARTER_PROMPTS.map(p => (
            <button
              key={p}
              onClick={() => sendMessage(p)}
              className="text-xs px-3 py-1.5 bg-accent text-accent-foreground rounded-full hover:bg-accent/80 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-border">
        <div className="flex items-end gap-2 bg-muted/60 rounded-xl px-3 py-2 border border-border">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="border-0 bg-transparent shadow-none focus-visible:ring-0 px-0 text-sm resize-none min-h-0"
            rows={1}
          />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            className="w-8 h-8 flex items-center justify-center bg-primary rounded-lg text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors shrink-0 mb-0.5"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}



2.Chat.jsx
import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Hash, Plus, Send, MessageSquare, Users } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import CreateConversationModal from '@/components/chat/CreateConversationModal';
import MessageReactions from '@/components/chat/MessageReactions';

export default function Chat() {
  const { user, currentWorkspaceId } = useOutletContext();
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [messageText, setMessageText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', currentWorkspaceId],
    queryFn: () => base44.entities.Conversation.filter({ workspace_id: currentWorkspaceId }),
    enabled: !!currentWorkspaceId,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', selectedConvId],
    queryFn: () => base44.entities.Message.filter({ conversation_id: selectedConvId }, 'created_date', 100),
    enabled: !!selectedConvId,
    refetchInterval: 3000,
  });

  const selectedConv = conversations.find(c => c.id === selectedConvId);

  useEffect(() => {
    if (conversations.length > 0 && !selectedConvId) {
      setSelectedConvId(conversations[0].id);
    }
  }, [conversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Real-time subscription
  useEffect(() => {
    if (!selectedConvId) return;
    const unsub = base44.entities.Message.subscribe((event) => {
      if (event.data?.conversation_id === selectedConvId) {
        queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
      }
    });
    return unsub;
  }, [selectedConvId]);

  const sendMessage = async () => {
    if (!messageText.trim() || !selectedConvId || sending) return;
    setSending(true);
    const text = messageText.trim();
    setMessageText('');

    // Optimistic update — add message immediately
    const optimisticMsg = {
      id: `optimistic-${Date.now()}`,
      conversation_id: selectedConvId,
      workspace_id: currentWorkspaceId,
      sender_email: user?.email,
      sender_name: user?.full_name || user?.email,
      content: text,
      message_type: 'text',
      created_date: new Date().toISOString(),
    };
    queryClient.setQueryData(['messages', selectedConvId], (old = []) => [...old, optimisticMsg]);

    await base44.entities.Message.create({
      conversation_id: selectedConvId,
      workspace_id: currentWorkspaceId,
      sender_email: user?.email,
      sender_name: user?.full_name || user?.email,
      content: text,
      message_type: 'text',
    });
    await base44.entities.Conversation.update(selectedConvId, {
      last_message: text,
      last_message_at: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['messages', selectedConvId] });
    queryClient.invalidateQueries({ queryKey: ['conversations', currentWorkspaceId] });
    setSending(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-44 sm:w-56 border-r border-border bg-muted/30 flex flex-col shrink-0">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Channels</span>
          <button
            onClick={() => setShowCreate(true)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
          {conversations.length === 0 ? (
            <p className="text-xs text-muted-foreground p-2 text-center">No channels yet</p>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => setSelectedConvId(conv.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors text-left",
                  selectedConvId === conv.id
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {conv.type === 'direct' ? <Users className="w-3.5 h-3.5 shrink-0" /> : <Hash className="w-3.5 h-3.5 shrink-0" />}
                <span className="truncate">{conv.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConv ? (
          <>
            {/* Header */}
            <div className="px-5 py-3 border-b border-border flex items-center gap-2">
              <Hash className="w-4.5 h-4.5 text-muted-foreground" />
              <h2 className="font-semibold text-foreground">{selectedConv.name}</h2>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <MessageSquare className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">No messages yet. Start the conversation!</p>
                </div>
              ) : (
                messages.map((msg, i) => {
                  const isMe = msg.sender_email === user?.email;
                  const prevMsg = messages[i - 1];
                  const sameAuthor = prevMsg?.sender_email === msg.sender_email &&
                    (new Date(msg.created_date) - new Date(prevMsg.created_date)) < 300000;
                  return (
                    <MessageBubble key={msg.id} msg={msg} isMe={isMe} compact={sameAuthor} currentUserEmail={user?.email} conversationId={selectedConvId} />
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border">
              <div className="flex items-center gap-2 bg-muted/60 rounded-xl px-3 py-2 border border-border">
                <Input
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Message #${selectedConv.name}`}
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
          onCreated={(conv) => { setSelectedConvId(conv.id); setShowCreate(false); queryClient.invalidateQueries({ queryKey: ['conversations', currentWorkspaceId] }); }}
        />
      )}
    </div>
  );
}

function MessageBubble({ msg, isMe, compact, currentUserEmail, conversationId }) {
  return (
    <div className={cn("flex gap-3 group", isMe && "flex-row-reverse")}>
      {!compact ? (
        <Avatar className="w-8 h-8 shrink-0 mt-0.5">
          <AvatarFallback className={cn("text-xs font-semibold", isMe ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
            {(msg.sender_name || msg.sender_email)?.[0]?.toUpperCase()}
          </AvatarFallback>
        </Avatar>
      ) : (
        <div className="w-8 shrink-0" />
      )}
      <div className={cn("max-w-[70%]", isMe && "items-end flex flex-col")}>
        {!compact && (
          <div className={cn("flex items-baseline gap-2 mb-1", isMe && "flex-row-reverse")}>
            <span className="text-xs font-semibold text-foreground">{msg.sender_name || msg.sender_email}</span>
            <span className="text-xs text-muted-foreground">{format(new Date(msg.created_date), 'HH:mm')}</span>
          </div>
        )}
        <div className={cn(
          "px-3 py-2 rounded-2xl text-sm leading-relaxed",
          isMe
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : "bg-card border border-border text-foreground rounded-tl-sm"
        )}>
          {msg.content}
        </div>
        <MessageReactions
          msg={msg}
          currentUserEmail={currentUserEmail}
          conversationId={conversationId}
        />
      </div>
    </div>
  );
}



3.Home.jsx
import { useOutletContext, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { FileText, MessageSquare, CheckSquare, Plus, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import ActivityFeed from '@/components/home/ActivityFeed';

export default function Home() {
  const { user, currentWorkspaceId } = useOutletContext();

  const { data: pages = [] } = useQuery({
    queryKey: ['pages', currentWorkspaceId],
    queryFn: () => base44.entities.Page.filter({ workspace_id: currentWorkspaceId, is_archived: false }),
    enabled: !!currentWorkspaceId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', currentWorkspaceId],
    queryFn: () => base44.entities.Task.filter({ workspace_id: currentWorkspaceId }),
    enabled: !!currentWorkspaceId,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', currentWorkspaceId],
    queryFn: () => base44.entities.Conversation.filter({ workspace_id: currentWorkspaceId }),
    enabled: !!currentWorkspaceId,
  });

  const recentPages = [...pages].sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date)).slice(0, 5);
  const myTasks = tasks.filter(t => t.assignee_email === user?.email && t.status !== 'done').slice(0, 5);

  const stats = [
    { label: 'Pages', value: pages.length, icon: FileText, color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/10' },
    { label: 'Channels', value: conversations.length, icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10' },
    { label: 'Tasks', value: tasks.filter(t => t.status !== 'done').length, icon: CheckSquare, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10' },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-cal font-semibold text-foreground">
            Good {getTimeGreeting()}, {user?.full_name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-muted-foreground mt-1">Here's what's happening in your workspace.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {stats.map(({ label, value, icon: Icon, color, bg }) => (
            <Card key={label} className="p-4 border border-border/60 shadow-sm">
              <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4.5 h-4.5 ${color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-sm text-muted-foreground">{label}</p>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Recent Pages */}
          <Card className="p-5 border border-border/60 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-violet-500" /> Recent Pages
              </h2>
              <Link to={`/pages/new?w=${currentWorkspaceId}`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                  <Plus className="w-3 h-3" /> New
                </Button>
              </Link>
            </div>
            {recentPages.length === 0 ? (
              <EmptyState icon="📄" text="No pages yet" action="Create your first page" href={`/pages/new?w=${currentWorkspaceId}`} />
            ) : (
              <div className="space-y-1">
                {recentPages.map(page => (
                  <Link key={page.id} to={`/pages/${page.id}?w=${currentWorkspaceId}`}>
                    <div className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/60 transition-colors group">
                      <span className="text-base">{page.icon || '📄'}</span>
                      <span className="flex-1 text-sm truncate text-foreground">{page.title}</span>
                      <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">
                        {formatDistanceToNow(new Date(page.updated_date), { addSuffix: true })}
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* My Tasks */}
          <Card className="p-5 border border-border/60 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-green-500" /> My Tasks
              </h2>
              <Link to={`/tasks?w=${currentWorkspaceId}`}>
                <Button variant="ghost" size="sm" className="h-7 text-xs">View all</Button>
              </Link>
            </div>
            {myTasks.length === 0 ? (
              <EmptyState icon="✅" text="No pending tasks" action="Go to tasks" href={`/tasks?w=${currentWorkspaceId}`} />
            ) : (
              <div className="space-y-1">
                {myTasks.map(task => (
                  <Link key={task.id} to={`/tasks?w=${currentWorkspaceId}`}>
                    <div className="flex items-center gap-2.5 p-2 rounded-md hover:bg-muted/60 transition-colors">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${
                        task.priority === 'high' ? 'bg-red-500' :
                        task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
                      }`} />
                      <span className="flex-1 text-sm truncate">{task.title}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        task.status === 'in_progress' ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300' : 'bg-muted text-muted-foreground'
                      }`}>{task.status === 'in_progress' ? 'In progress' : 'Todo'}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Activity Feed */}
          <Card className="md:col-span-2 p-5 border border-border/60 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
                Recent Activity
              </h2>
            </div>
            <ActivityFeed workspaceId={currentWorkspaceId} />
          </Card>

          {/* AI Quick Access */}
          <Card className="lg:col-span-2 p-5 border border-primary/20 bg-gradient-to-r from-accent/30 to-transparent shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">AI Assistant</p>
                <p className="text-sm text-muted-foreground">Ask questions, summarize content, extract action items</p>
              </div>
              <Link to={`/ai?w=${currentWorkspaceId}`}>
                <Button size="sm" className="gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Open AI
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon, text, action, href }) {
  return (
    <div className="flex flex-col items-center justify-center py-6 text-center">
      <span className="text-3xl mb-2">{icon}</span>
      <p className="text-sm text-muted-foreground mb-3">{text}</p>
      <Link to={href}>
        <Button variant="outline" size="sm" className="text-xs gap-1">
          <Plus className="w-3 h-3" /> {action}
        </Button>
      </Link>
    </div>
  );
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

4.Landing.jsx
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  MessageSquare, FileText, CheckSquare, Search, Zap, Shield,
  Users, ArrowRight, ChevronDown, Star, Check, Menu, X, Globe,
  Sparkles, BarChart3, Lock, Layers, Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ─── Helpers ──────────────────────────────────────── */
function useScrollReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ children, className, delay = 0 }) {
  const [ref, visible] = useScrollReveal();
  return (
    <div
      ref={ref}
      className={cn('transition-all duration-700', visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6', className)}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ─── Data ─────────────────────────────────────────── */
const FEATURES = [
  {
    icon: MessageSquare,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    title: 'Real-time Team Chat',
    desc: 'Channels, DMs, threads — everything your team needs to stay in sync without the noise.',
  },
  {
    icon: FileText,
    color: 'text-violet-500',
    bg: 'bg-violet-50 dark:bg-violet-500/10',
    title: 'Collaborative Docs',
    desc: 'Create, edit, and share documents together in real-time. Knowledge lives with your team, not in inboxes.',
  },
  {
    icon: CheckSquare,
    color: 'text-green-500',
    bg: 'bg-green-50 dark:bg-green-500/10',
    title: 'Tasks & Notes',
    desc: 'Lightweight task tracking and smart notes that capture decisions the moment they happen.',
  },
  {
    icon: Search,
    color: 'text-orange-500',
    bg: 'bg-orange-50 dark:bg-orange-500/10',
    title: 'Unified Search',
    desc: 'One search bar across every message, doc, and task. Find anything in seconds.',
  },
  {
    icon: Sparkles,
    color: 'text-pink-500',
    bg: 'bg-pink-50 dark:bg-pink-500/10',
    title: 'AI Assistant',
    desc: 'Summarise threads, extract action items, draft updates — all with a single prompt.',
  },
  {
    icon: Lock,
    color: 'text-slate-500',
    bg: 'bg-slate-50 dark:bg-slate-500/10',
    title: 'Enterprise Security',
    desc: 'SOC 2 Type II, end-to-end encryption, SSO, and granular permissions baked in from day one.',
  },
];

const STEPS = [
  { num: '01', title: 'Create your workspace', desc: 'Set up in under 60 seconds. No credit card required.' },
  { num: '02', title: 'Invite your team', desc: 'Add members via email or share a link. Roles & permissions included.' },
  { num: '03', title: 'Start collaborating', desc: 'Chat, write docs, assign tasks — everything in one tab, real-time.' },
];

const TESTIMONIALS = [
  {
    quote: "We replaced Slack, Notion, and Asana with OneChat. Our context-switching dropped by 80%.",
    author: 'Sarah Chen',
    role: 'Head of Product, Arkwright Labs',
    avatar: 'SC',
    color: 'bg-violet-500',
  },
  {
    quote: "The AI summaries alone save each engineer 30+ minutes a day. It's become indispensable.",
    author: 'Marcus Webb',
    role: 'CTO, Pillar AI',
    avatar: 'MW',
    color: 'bg-blue-500',
  },
  {
    quote: "Finally, a tool that actually reduces tool sprawl. Onboarding was shockingly fast.",
    author: 'Priya Nair',
    role: 'Operations Lead, Driftwork',
    avatar: 'PN',
    color: 'bg-green-500',
  },
];

const PLANS = [
  {
    name: 'Starter',
    price: { monthly: 10, yearly: 8 },
    desc: 'Perfect for small teams getting started.',
    highlight: false,
    features: [
      'Up to 10 members',
      'Unlimited messages',
      '10 GB storage',
      'Basic AI assistant',
      'Community support',
    ],
  },
  {
    name: 'Business',
    price: { monthly: 25, yearly: 20 },
    desc: 'Everything you need to scale fast.',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Unlimited members',
      'Unlimited messages & docs',
      '100 GB storage',
      'Advanced AI features',
      'Priority support',
      'Custom integrations',
      'Analytics dashboard',
    ],
  },
  {
    name: 'Enterprise',
    price: { monthly: 35, yearly: 28 },
    desc: 'Advanced security and dedicated support.',
    highlight: false,
    features: [
      'Everything in Business',
      'SSO & SAML',
      'Audit logs',
      'Dedicated SLA',
      'Custom contracts',
      'On-boarding sessions',
      'SLA 99.99% uptime',
    ],
  },
];

const FAQS = [
  { q: 'Can I switch plans anytime?', a: 'Yes. Upgrade or downgrade at any time. Billing is prorated automatically.' },
  { q: 'Is there a free trial?', a: 'Every plan starts with a 14-day free trial — no credit card needed.' },
  { q: 'How is data secured?', a: 'All data is encrypted in transit and at rest. We are SOC 2 Type II certified with optional E2E encryption.' },
  { q: 'Does it integrate with our existing tools?', a: 'Yes — GitHub, Jira, Google Drive, Figma, and 50+ more via our native integrations and Zapier.' },
  { q: 'What are the team size limits?', a: 'Starter supports up to 10 members. Business and Enterprise are unlimited.' },
];

const LOGOS = ['Vercel', 'Stripe', 'Linear', 'Loom', 'Framer', 'Raycast'];

/* ─── Sub-components ────────────────────────────────── */
function Navbar({ onCTA }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const links = [
    { label: 'Features', href: '#features' },
    { label: 'How it works', href: '#how' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header className={cn(
      'fixed top-0 inset-x-0 z-50 transition-all duration-300',
      scrolled ? 'bg-background/90 backdrop-blur-lg border-b border-border shadow-sm' : 'bg-transparent'
    )}>
      <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2 select-none">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Layers className="w-4 h-4 text-white" />
          </div>
          <span className="font-cal font-bold text-foreground text-lg tracking-tight">OneChat</span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors select-none">
              {l.label}
            </a>
          ))}
        </div>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-3">
          <button onClick={() => base44.auth.redirectToLogin()} className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors select-none">
            Sign in
          </button>
          <button onClick={() => base44.auth.redirectToLogin()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors select-none shadow-sm">
            Start Free <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile menu button */}
        <button onClick={() => setOpen(!open)} className="md:hidden p-2 text-foreground select-none">
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-background border-b border-border px-4 pb-4 space-y-2">
          {links.map(l => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="block py-2 text-sm text-muted-foreground hover:text-foreground select-none">
              {l.label}
            </a>
          ))}
          <button onClick={() => base44.auth.redirectToLogin()} className="mt-2 flex items-center justify-center gap-1.5 w-full px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold select-none">
            Start Free <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </header>
  );
}

function HeroMockup() {
  return (
    <div className="relative w-full max-w-2xl mx-auto mt-12 select-none">
      {/* Glow */}
      <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-primary/30 via-violet-400/20 to-blue-400/20 blur-3xl scale-105" />

      {/* Window shell */}
      <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
          <div className="flex-1 mx-4 h-5 rounded-md bg-muted" />
        </div>

        {/* App layout */}
        <div className="flex h-64 sm:h-80">
          {/* Sidebar */}
          <div className="w-40 border-r border-border bg-muted/20 p-3 space-y-1.5 hidden sm:block">
            {['# general', '# design', '# engineering', '# announcements'].map((c, i) => (
              <div key={c} className={cn('text-xs px-2 py-1.5 rounded', i === 0 ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground')}>
                {c}
              </div>
            ))}
            <div className="mt-3 pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground px-2 mb-1">PAGES</div>
              {['📋 Roadmap', '📝 Meeting notes'].map(p => (
                <div key={p} className="text-xs px-2 py-1.5 rounded text-muted-foreground">{p}</div>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 p-3 space-y-3 overflow-hidden">
              {[
                { name: 'Alex', msg: 'Just pushed the new design system to staging 🎉', color: 'bg-violet-500', mine: false },
                { name: 'Sam', msg: 'Looks great! The typography is much cleaner.', color: 'bg-blue-500', mine: false },
                { name: 'You', msg: 'Agreed. Merging to main now.', color: 'bg-primary', mine: true },
              ].map((m, i) => (
                <div key={i} className={cn('flex gap-2', m.mine && 'flex-row-reverse')}>
                  <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0', m.color)}>
                    {m.name[0]}
                  </div>
                  <div className={cn('max-w-[70%] text-xs px-3 py-2 rounded-xl', m.mine ? 'bg-primary text-primary-foreground rounded-tr-sm' : 'bg-muted text-foreground rounded-tl-sm')}>
                    {m.msg}
                  </div>
                </div>
              ))}
            </div>
            {/* Input bar */}
            <div className="px-3 py-2 border-t border-border">
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                <span className="text-xs text-muted-foreground flex-1">Message #general</span>
                <div className="w-5 h-5 bg-primary rounded flex items-center justify-center">
                  <ArrowRight className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <div className="absolute -top-4 -right-4 bg-green-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-bounce">
        <div className="w-2 h-2 rounded-full bg-white" />
        Live Sync
      </div>
      <div className="absolute -bottom-4 -left-4 bg-card border border-border shadow-lg rounded-xl px-3 py-2 text-xs font-semibold text-foreground flex items-center gap-2">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        AI summarized 12 messages
      </div>
    </div>
  );
}

function PricingCard({ plan, isYearly }) {
  const price = isYearly ? plan.price.yearly : plan.price.monthly;
  return (
    <div className={cn(
      'relative flex flex-col rounded-2xl border p-6 transition-all duration-300 hover:shadow-xl',
      plan.highlight
        ? 'border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105'
        : 'border-border bg-card hover:border-primary/40'
    )}>
      {plan.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary-foreground text-primary text-xs font-bold rounded-full shadow">
          {plan.badge}
        </div>
      )}
      <div className="mb-4">
        <p className={cn('text-sm font-semibold uppercase tracking-wider mb-1', plan.highlight ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
          {plan.name}
        </p>
        <div className="flex items-end gap-1">
          <span className="text-4xl font-cal font-bold">${price}</span>
          <span className={cn('text-sm mb-1', plan.highlight ? 'text-primary-foreground/70' : 'text-muted-foreground')}>/mo</span>
        </div>
        {isYearly && (
          <p className={cn('text-xs mt-1', plan.highlight ? 'text-primary-foreground/70' : 'text-green-600 dark:text-green-400')}>
            Save ${(plan.price.monthly - plan.price.yearly) * 12}/yr
          </p>
        )}
        <p className={cn('text-sm mt-2', plan.highlight ? 'text-primary-foreground/80' : 'text-muted-foreground')}>{plan.desc}</p>
      </div>
      <ul className="space-y-2.5 flex-1 mb-6">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className={cn('w-4 h-4 mt-0.5 shrink-0', plan.highlight ? 'text-primary-foreground' : 'text-primary')} />
            <span className={plan.highlight ? 'text-primary-foreground/90' : 'text-foreground'}>{f}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={() => base44.auth.redirectToLogin()}
        className={cn(
          'w-full text-center py-2.5 rounded-xl font-semibold text-sm transition-all select-none',
          plan.highlight
            ? 'bg-primary-foreground text-primary hover:bg-primary-foreground/90'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
      >
        Get Started
      </button>
    </div>
  );
}

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-4 text-left select-none group"
      >
        <span className="font-medium text-foreground text-sm sm:text-base">{q}</span>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform shrink-0 ml-4', open && 'rotate-180')} />
      </button>
      {open && (
        <p className="pb-4 text-sm text-muted-foreground leading-relaxed">{a}</p>
      )}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────── */
export default function Landing() {
  const [isYearly, setIsYearly] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <Navbar />

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-28 px-4 sm:px-6 text-center overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-accent/40 via-background to-background" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl -z-10" />

        <Reveal>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-primary text-xs font-semibold mb-6">
            <Zap className="w-3.5 h-3.5" /> New: AI-powered meeting summaries →
          </div>
        </Reveal>

        <Reveal delay={80}>
          <h1 className="font-cal text-4xl sm:text-6xl lg:text-7xl font-bold text-foreground leading-[1.08] tracking-tight max-w-4xl mx-auto">
            One workspace.<br />
            <span className="text-primary">Every tool your team needs.</span>
          </h1>
        </Reveal>

        <Reveal delay={160}>
          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Replace Slack, Notion, and Asana with a single real-time platform.
            Chat, docs, tasks, and AI — all in one tab, always in sync.
          </p>
        </Reveal>

        <Reveal delay={240}>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={() => base44.auth.redirectToLogin()} className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-primary/25 select-none text-sm sm:text-base">
              Start Free Trial <ArrowRight className="w-4 h-4" />
            </button>
            <a href="#features" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-border bg-card text-foreground font-semibold hover:bg-muted transition-all select-none text-sm sm:text-base">
              <Play className="w-4 h-4" /> Book a Demo
            </a>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">No credit card required · 14-day free trial · Cancel anytime</p>
        </Reveal>

        <Reveal delay={320}>
          <HeroMockup />
        </Reveal>
      </section>

      {/* ── Social Proof Logos ───────────────────────── */}
      <section className="py-12 border-y border-border bg-muted/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-8">
            Trusted by teams at
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 sm:gap-12">
            {LOGOS.map(l => (
              <div key={l} className="text-base font-cal font-bold text-muted-foreground/50 hover:text-muted-foreground transition-colors select-none">
                {l}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────── */}
      <section id="features" className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-3">Features</p>
              <h2 className="font-cal text-3xl sm:text-5xl font-bold text-foreground">Everything in one place.</h2>
              <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">No more tab juggling. Every feature your team reaches for, now living under one roof.</p>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <Reveal key={f.title} delay={i * 60}>
                  <div className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-lg transition-all duration-300">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center mb-4', f.bg)}>
                      <Icon className={cn('w-5 h-5', f.color)} />
                    </div>
                    <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────── */}
      <section id="how" className="py-24 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-3">How it works</p>
              <h2 className="font-cal text-3xl sm:text-5xl font-bold text-foreground">Up and running in minutes.</h2>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <Reveal key={s.num} delay={i * 80}>
                <div className="text-center">
                  <div className="text-5xl font-cal font-bold text-primary/20 mb-4">{s.num}</div>
                  <h3 className="font-semibold text-foreground mb-2">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <Reveal>
            <div className="text-center mb-16">
              <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-3">Testimonials</p>
              <h2 className="font-cal text-3xl sm:text-5xl font-bold text-foreground">Loved by teams worldwide.</h2>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.author} delay={i * 80}>
                <div className="p-6 rounded-2xl border border-border bg-card hover:shadow-lg transition-all">
                  <div className="flex gap-1 mb-4">
                    {Array(5).fill(0).map((_, i) => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
                  </div>
                  <p className="text-sm text-foreground leading-relaxed mb-5">"{t.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold', t.color)}>
                      {t.avatar}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{t.author}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product Preview ──────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 bg-gradient-to-b from-accent/20 to-background">
        <div className="max-w-5xl mx-auto text-center">
          <Reveal>
            <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-3">Product Preview</p>
            <h2 className="font-cal text-3xl sm:text-5xl font-bold text-foreground mb-4">Built for how teams actually work.</h2>
            <p className="text-muted-foreground max-w-xl mx-auto mb-12">Real-time editing, instant messaging, and task management — seamlessly connected in a single view.</p>
          </Reveal>
          <Reveal delay={80}>
            <div className="rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <div className="flex-1 mx-8 h-5 rounded-md bg-muted" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
                {[
                  { icon: MessageSquare, label: 'Team Chat', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-500/10', lines: ['# general', '# engineering', '# product', '# design'] },
                  { icon: FileText, label: 'Documents', color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-500/10', lines: ['📋 Q2 Roadmap', '📝 Sprint Notes', '🎯 OKRs 2026', '💡 Ideas'] },
                  { icon: CheckSquare, label: 'Tasks', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-500/10', lines: ['⬜ Design review', '🔄 API integration', '✅ Deploy v2.1', '⬜ Write specs'] },
                ].map(panel => {
                  const Icon = panel.icon;
                  return (
                    <div key={panel.label} className="p-5">
                      <div className={cn('inline-flex items-center gap-2 px-3 py-1.5 rounded-lg mb-3', panel.bg)}>
                        <Icon className={cn('w-4 h-4', panel.color)} />
                        <span className={cn('text-xs font-semibold', panel.color)}>{panel.label}</span>
                      </div>
                      <div className="space-y-2">
                        {panel.lines.map(l => (
                          <div key={l} className="text-xs text-muted-foreground py-1.5 px-2 rounded hover:bg-muted transition-colors cursor-default">{l}</div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────── */}
      <section id="pricing" className="py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-3">Pricing</p>
              <h2 className="font-cal text-3xl sm:text-5xl font-bold text-foreground mb-4">Simple, transparent pricing.</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-8">Start free. Scale as you grow. No hidden fees.</p>

              {/* Toggle */}
              <div className="inline-flex items-center gap-3 bg-muted p-1 rounded-xl">
                <button onClick={() => setIsYearly(false)} className={cn('px-4 py-1.5 rounded-lg text-sm font-medium transition-all select-none', !isYearly ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>Monthly</button>
                <button onClick={() => setIsYearly(true)} className={cn('px-4 py-1.5 rounded-lg text-sm font-medium transition-all select-none', isYearly ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}>
                  Yearly <span className="ml-1 text-xs text-green-600 dark:text-green-400 font-semibold">-20%</span>
                </button>
              </div>
            </div>
          </Reveal>
          <div className="grid sm:grid-cols-3 gap-6 items-start">
            {PLANS.map((plan, i) => (
              <Reveal key={plan.name} delay={i * 80}>
                <PricingCard plan={plan} isYearly={isYearly} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────── */}
      <section id="faq" className="py-24 px-4 sm:px-6 bg-muted/20">
        <div className="max-w-2xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <p className="text-primary text-sm font-semibold uppercase tracking-widest mb-3">FAQ</p>
              <h2 className="font-cal text-3xl sm:text-4xl font-bold text-foreground">Common questions.</h2>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="bg-card border border-border rounded-2xl px-6">
              {FAQS.map(f => <FAQItem key={f.q} {...f} />)}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6">
        <Reveal>
          <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-primary to-violet-600 rounded-3xl p-12 sm:p-16 shadow-2xl shadow-primary/30">
            <h2 className="font-cal text-3xl sm:text-5xl font-bold text-white mb-4">
              Ready to unify your team?
            </h2>
            <p className="text-white/75 text-lg mb-10 max-w-xl mx-auto">
              Join thousands of teams who replaced their tool stack with OneChat. Start free today.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => base44.auth.redirectToLogin()} className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-white text-primary font-semibold hover:bg-white/90 transition-all select-none shadow-lg text-sm sm:text-base">
                Start Free Trial <ArrowRight className="w-4 h-4" />
              </button>
              <a href="#pricing" className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl border border-white/30 text-white font-semibold hover:bg-white/10 transition-all select-none text-sm sm:text-base">
                View Pricing
              </a>
            </div>
            <p className="mt-4 text-white/50 text-xs">No credit card required · Cancel anytime</p>
          </div>
        </Reveal>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="border-t border-border bg-muted/20 py-12 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-8 mb-10">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 mb-3 select-none">
                <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
                  <Layers className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="font-cal font-bold text-foreground">OneChat</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">Real-time collaboration for modern teams.</p>
            </div>
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Changelog', 'Roadmap'] },
              { title: 'Company', links: ['About', 'Blog', 'Careers', 'Press'] },
              { title: 'Resources', links: ['Docs', 'API', 'Status', 'Community'] },
              { title: 'Legal', links: ['Privacy', 'Terms', 'Security', 'Cookies'] },
            ].map(col => (
              <div key={col.title}>
                <p className="text-xs font-semibold text-foreground uppercase tracking-wider mb-3">{col.title}</p>
                <ul className="space-y-2">
                  {col.links.map(l => (
                    <li key={l}><a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors select-none">{l}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8 border-t border-border">
            <p className="text-xs text-muted-foreground">© 2026 OneChat. All rights reserved.</p>
            <div className="flex items-center gap-4">
              {['Twitter', 'GitHub', 'LinkedIn'].map(s => (
                <a key={s} href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors select-none">{s}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}



5. MeetingAI.jsx

import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Mic, MicOff, Sparkles, Trash2, Copy, Check, Loader2, Radio } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';

export default function MeetingAI() {
  const { user } = useOutletContext();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [summary, setSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');
  const transcriptEndRef = useRef(null);

  useEffect(() => {
    transcriptRef.current = transcript;
  }, [transcript]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, interimText]);

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += text + ' ';
        } else {
          interim += text;
        }
      }
      if (final) {
        setTranscript(prev => prev + final);
      }
      setInterimText(interim);
    };

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') {
        setError(`Microphone error: ${e.error}`);
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setError('');
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
    setInterimText('');
  };

  const handleSummarize = async () => {
    const text = transcript.trim();
    if (!text) return;
    setSummarizing(true);
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an expert meeting assistant. Analyze the following meeting transcript and provide:

1. **Meeting Summary** — A concise 2-3 sentence overview of what was discussed.
2. **Key Points** — Bullet list of the most important topics and decisions.
3. **Action Items** — Specific tasks or follow-ups mentioned, with owner if identifiable.
4. **Decisions Made** — Any clear decisions or conclusions reached.

Be concise and actionable. Format using markdown.

Transcript:
${text}`,
      model: 'claude_sonnet_4_6',
    });
    setSummary(result);
    setSummarizing(false);
  };

  const handleCopy = () => {
    const full = `TRANSCRIPT:\n${transcript}\n\nSUMMARY:\n${summary}`;
    navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    stopListening();
    setTranscript('');
    setInterimText('');
    setSummary('');
    setError('');
  };

  const wordCount = transcript.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 animate-fade-in">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-cal font-semibold text-foreground flex items-center gap-2">
              <Radio className="w-6 h-6 text-primary" />
              Meeting AI
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Real-time transcription & AI-powered meeting summaries</p>
          </div>
          {transcript && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5">
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy All'}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleClear} className="gap-1.5 text-destructive hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" /> Clear
              </Button>
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Controls */}
        <Card className="p-6 border border-border/60 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button
              onClick={isListening ? stopListening : startListening}
              className={cn(
                'relative w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg select-none',
                isListening
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-primary hover:bg-primary/90 text-primary-foreground'
              )}
            >
              {isListening && (
                <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />
              )}
              {isListening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
            </button>

            <div className="flex-1 text-center sm:text-left">
              <p className="font-semibold text-foreground text-lg">
                {isListening ? 'Listening...' : 'Ready to record'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {isListening
                  ? 'Speak clearly — everything is being transcribed in real time.'
                  : 'Press the mic button to start transcribing your meeting.'}
              </p>
              {wordCount > 0 && (
                <Badge variant="outline" className="mt-2 text-xs">
                  {wordCount} words transcribed
                </Badge>
              )}
            </div>

            <Button
              onClick={handleSummarize}
              disabled={!transcript.trim() || summarizing}
              className="gap-2 shrink-0"
            >
              {summarizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {summarizing ? 'Summarizing...' : 'Summarize'}
            </Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Live Transcript */}
          <Card className="border border-border/60 flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <h2 className="font-semibold text-foreground text-sm flex items-center gap-2">
                {isListening && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                Live Transcript
              </h2>
              {transcript && (
                <button onClick={() => { setTranscript(''); setInterimText(''); }} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                  Clear
                </button>
              )}
            </div>
            <div className="flex-1 p-5 overflow-y-auto max-h-80 scrollbar-thin">
              {!transcript && !interimText ? (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <Mic className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Transcript will appear here as you speak</p>
                </div>
              ) : (
                <div className="text-sm text-foreground leading-relaxed">
                  <span>{transcript}</span>
                  {interimText && (
                    <span className="text-muted-foreground italic">{interimText}</span>
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              )}
            </div>
          </Card>

          {/* AI Summary */}
          <Card className="border border-border/60 flex flex-col">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-foreground text-sm">AI Summary</h2>
            </div>
            <div className="flex-1 p-5 overflow-y-auto max-h-80 scrollbar-thin">
              {summarizing ? (
                <div className="flex flex-col items-center justify-center h-32 gap-3">
                  <Loader2 className="w-7 h-7 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Analyzing meeting content...</p>
                </div>
              ) : summary ? (
                <ReactMarkdown className="text-sm prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_ul]:my-1 [&_li]:my-0.5 [&_h2]:text-sm [&_h2]:font-semibold [&_h3]:text-sm [&_h3]:font-semibold [&_strong]:font-semibold">
                  {summary}
                </ReactMarkdown>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <Sparkles className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Click "Summarize" to get an AI-powered summary of your meeting</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}







6.PageEditor.jsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useOutletContext, useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { Save, Trash2, FileText, Sparkles, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import AIPageModal from '@/components/pages/AIPageModal';

const PAGE_ICONS = ['📄', '📝', '🗒️', '📋', '📊', '🗃️', '🔖', '💡', '🎯', '🧠', '📅', '🗓️'];

const modules = {
  toolbar: [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['blockquote', 'code-block'],
    ['link'],
    ['clean'],
  ],
};

export default function PageEditor() {
  const { pageId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, currentWorkspaceId } = useOutletContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = pageId === 'new';

  const [title, setTitle] = useState('Untitled');
  const [content, setContent] = useState('');
  const [icon, setIcon] = useState('📄');
  const [pageType, setPageType] = useState('doc');
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const { data: page } = useQuery({
    queryKey: ['page', pageId],
    queryFn: () => base44.entities.Page.filter({ id: pageId }),
    enabled: !isNew && !!pageId,
    select: (data) => data[0],
  });

  useEffect(() => {
    if (page) {
      setTitle(page.title || 'Untitled');
      setContent(page.content || '');
      setIcon(page.icon || '📄');
      setPageType(page.page_type || 'doc');
    }
  }, [page]);

  const save = useCallback(async () => {
    if (!currentWorkspaceId) return;
    setSaving(true);
    if (isNew) {
      const newPage = await base44.entities.Page.create({
        workspace_id: currentWorkspaceId,
        title: title || 'Untitled',
        content,
        icon,
        page_type: pageType,
        last_edited_by: user?.email,
      });
      queryClient.invalidateQueries({ queryKey: ['pages', currentWorkspaceId] });
      navigate(`/pages/${newPage.id}?w=${currentWorkspaceId}`, { replace: true });
    } else {
      await base44.entities.Page.update(pageId, {
        title: title || 'Untitled',
        content,
        icon,
        page_type: pageType,
        last_edited_by: user?.email,
      });
      queryClient.invalidateQueries({ queryKey: ['pages', currentWorkspaceId] });
      queryClient.invalidateQueries({ queryKey: ['page', pageId] });
    }
    setLastSaved(new Date());
    setSaving(false);
  }, [pageId, title, content, icon, pageType, currentWorkspaceId, isNew]);

  const handleDelete = async () => {
    if (!confirm('Delete this page?')) return;
    await base44.entities.Page.update(pageId, { is_archived: true });
    queryClient.invalidateQueries({ queryKey: ['pages', currentWorkspaceId] });
    navigate(`/?w=${currentWorkspaceId}`);
  };

  // Auto-save
  useEffect(() => {
    if (isNew) return;
    const timer = setTimeout(() => { if (page) save(); }, 2000);
    return () => clearTimeout(timer);
  }, [content, title]);

  const typeLabels = { doc: '📝 Doc', database: '🗄️ Database', meeting_notes: '🎙️ Meeting Notes' };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-border flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 flex items-center gap-2">
          {lastSaved && (
            <span className="text-xs text-muted-foreground">
              Saved {formatDistanceToNow(lastSaved, { addSuffix: true })}
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowAI(true)} className="gap-1.5 text-primary">
          <Sparkles className="w-3.5 h-3.5" /> AI
        </Button>
        {!isNew && (
          <Button variant="ghost" size="sm" onClick={handleDelete} className="gap-1.5 text-destructive hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
        <Button size="sm" onClick={save} disabled={saving} className="gap-1.5">
          <Save className="w-3.5 h-3.5" />
          {saving ? 'Saving...' : isNew ? 'Create' : 'Save'}
        </Button>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-8">
          {/* Icon & Type */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <button
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="text-4xl hover:bg-muted rounded-lg p-1 transition-colors"
              >
                {icon}
              </button>
              {showIconPicker && (
                <div className="absolute top-full left-0 mt-1 bg-card border border-border rounded-xl shadow-xl p-2 flex flex-wrap gap-1 z-10 w-48">
                  {PAGE_ICONS.map(i => (
                    <button
                      key={i}
                      onClick={() => { setIcon(i); setShowIconPicker(false); }}
                      className="text-xl p-1.5 rounded-md hover:bg-muted transition-colors"
                    >
                      {i}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-1.5">
              {Object.entries(typeLabels).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => setPageType(type)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${
                    pageType === type
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Untitled"
            className="w-full text-4xl font-cal font-bold text-foreground bg-transparent border-0 outline-none placeholder:text-muted-foreground/40 mb-6"
          />

          {/* Content */}
          <div className="prose-editor">
            <ReactQuill
              value={content}
              onChange={setContent}
              modules={modules}
              placeholder="Start writing something amazing..."
              className="min-h-[400px]"
            />
          </div>
        </div>
      </div>

      {showAI && (
        <AIPageModal
          pageTitle={title}
          pageContent={content}
          onClose={() => setShowAI(false)}
          onInsert={(text) => { setContent(prev => prev + `<p>${text}</p>`); setShowAI(false); }}
        />
      )}
    </div>
  );
}


7. Search.jsx
import { useState, useEffect } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search as SearchIcon, FileText, MessageSquare, CheckSquare, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export default function Search() {
  const { user, currentWorkspaceId } = useOutletContext();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const { data: pages = [] } = useQuery({
    queryKey: ['pages', currentWorkspaceId],
    queryFn: () => base44.entities.Page.filter({ workspace_id: currentWorkspaceId, is_archived: false }),
    enabled: !!currentWorkspaceId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', currentWorkspaceId],
    queryFn: () => base44.entities.Task.filter({ workspace_id: currentWorkspaceId }),
    enabled: !!currentWorkspaceId,
  });

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', currentWorkspaceId],
    queryFn: () => base44.entities.Conversation.filter({ workspace_id: currentWorkspaceId }),
    enabled: !!currentWorkspaceId,
  });

  const q = query.toLowerCase().trim();

  const results = q ? [
    ...( (filter === 'all' || filter === 'pages') ? pages.filter(p =>
      p.title?.toLowerCase().includes(q) || p.content?.toLowerCase().includes(q)
    ).map(p => ({ type: 'page', item: p, href: `/pages/${p.id}?w=${currentWorkspaceId}` })) : []),
    ...( (filter === 'all' || filter === 'tasks') ? tasks.filter(t =>
      t.title?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)
    ).map(t => ({ type: 'task', item: t, href: `/tasks?w=${currentWorkspaceId}` })) : []),
    ...( (filter === 'all' || filter === 'channels') ? conversations.filter(c =>
      c.name?.toLowerCase().includes(q)
    ).map(c => ({ type: 'channel', item: c, href: `/chat?w=${currentWorkspaceId}` })) : []),
  ] : [];

  const FILTERS = [
    { value: 'all', label: 'All' },
    { value: 'pages', label: 'Pages', icon: FileText },
    { value: 'tasks', label: 'Tasks', icon: CheckSquare },
    { value: 'channels', label: 'Channels', icon: MessageSquare },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 animate-fade-in">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-cal font-semibold text-foreground mb-6">Search</h1>

        {/* Search Input */}
        <div className="relative mb-4">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, tasks, channels..."
            className="pl-10 pr-9 h-11 text-base"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full font-medium transition-colors",
                filter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              )}
            >
              {f.icon && <f.icon className="w-3.5 h-3.5" />}
              {f.label}
            </button>
          ))}
        </div>

        {/* Results */}
        {!q ? (
          <div className="text-center py-16">
            <SearchIcon className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Type to search across your workspace</p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-foreground font-medium mb-1">No results for "{query}"</p>
            <p className="text-sm text-muted-foreground">Try different keywords or filters</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground mb-3">{results.length} results</p>
            {results.map(({ type, item, href }, i) => (
              <Link key={`${type}-${item.id}`} to={href}>
                <div className="flex items-center gap-3 p-3.5 bg-card border border-border rounded-xl hover:border-primary/40 hover:shadow-sm transition-all group">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    type === 'page' ? "bg-violet-50 dark:bg-violet-500/10" :
                    type === 'task' ? "bg-green-50 dark:bg-green-500/10" :
                    "bg-blue-50 dark:bg-blue-500/10"
                  )}>
                    {type === 'page' ? <span className="text-base">{item.icon || '📄'}</span> :
                     type === 'task' ? <CheckSquare className="w-4 h-4 text-green-500" /> :
                     <MessageSquare className="w-4 h-4 text-blue-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {type === 'channel' ? `#${item.name}` : item.title || item.name}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {type} • {formatDistanceToNow(new Date(item.updated_date), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}




8.Settings.jsx

import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Settings as SettingsIcon, Users, Bell, Building2, Trash2, UserPlus, Check, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'workspace', label: 'Workspace', icon: Building2 },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

export default function Settings() {
  const { user, currentWorkspaceId } = useOutletContext();
  const [activeTab, setActiveTab] = useState('workspace');
  const queryClient = useQueryClient();

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => base44.entities.Workspace.list(),
  });

  const workspace = workspaces.find(w => w.id === currentWorkspaceId);
  const isOwner = workspace?.owner_email === user?.email;

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No workspace selected.</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
        <SettingsIcon className="w-12 h-12 text-muted-foreground/30" />
        <p className="font-semibold text-foreground">Admin access required</p>
        <p className="text-sm text-muted-foreground">Only the workspace owner can access settings.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-cal font-semibold text-foreground">Workspace Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">{workspace.name}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6 w-fit">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all select-none',
                  activeTab === tab.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'workspace' && (
          <WorkspaceTab workspace={workspace} queryClient={queryClient} />
        )}
        {activeTab === 'members' && (
          <MembersTab workspace={workspace} user={user} queryClient={queryClient} />
        )}
        {activeTab === 'notifications' && (
          <NotificationsTab user={user} />
        )}
      </div>
    </div>
  );
}

function WorkspaceTab({ workspace, queryClient }) {
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Workspace.update(workspace.id, { name, description });
    queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const ICONS = ['🏢', '🚀', '💡', '⚡', '🎯', '🔥', '🌟', '💎', '🛠️', '🎨'];
  const [icon, setIcon] = useState(workspace.icon || '🏢');

  const handleIconSave = async (newIcon) => {
    setIcon(newIcon);
    await base44.entities.Workspace.update(workspace.id, { icon: newIcon });
    queryClient.invalidateQueries({ queryKey: ['workspaces'] });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-border/60">
        <h2 className="font-semibold text-foreground mb-4">General</h2>
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Workspace Icon</Label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(i => (
                <button
                  key={i}
                  onClick={() => handleIconSave(i)}
                  className={cn(
                    'text-xl p-2 rounded-lg transition-all',
                    icon === i ? 'bg-accent ring-2 ring-primary' : 'hover:bg-muted'
                  )}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="ws-name">Workspace Name</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="ws-desc">Description</Label>
            <Input
              id="ws-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this workspace for?"
              className="mt-1"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 border border-destructive/30 bg-destructive/5">
        <h2 className="font-semibold text-destructive mb-2">Danger Zone</h2>
        <p className="text-sm text-muted-foreground mb-4">These actions are permanent and cannot be undone.</p>
        <Button
          variant="destructive"
          size="sm"
          onClick={async () => {
            if (confirm(`Delete workspace "${workspace.name}"? This cannot be undone.`)) {
              await base44.entities.Workspace.delete(workspace.id);
              window.location.href = '/';
            }
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" /> Delete Workspace
        </Button>
      </Card>
    </div>
  );
}

function MembersTab({ workspace, user, queryClient }) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const members = workspace.member_emails || [];

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    const updatedMembers = [...new Set([...members, inviteEmail.trim()])];
    await base44.entities.Workspace.update(workspace.id, { member_emails: updatedMembers });
    queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    setInviteEmail('');
    setInviting(false);
  };

  const handleRemove = async (email) => {
    if (email === workspace.owner_email) return;
    if (!confirm(`Remove ${email} from the workspace?`)) return;
    const updatedMembers = members.filter(m => m !== email);
    await base44.entities.Workspace.update(workspace.id, { member_emails: updatedMembers });
    queryClient.invalidateQueries({ queryKey: ['workspaces'] });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-border/60">
        <h2 className="font-semibold text-foreground mb-4">Invite Member</h2>
        <div className="flex gap-2">
          <Input
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
            type="email"
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
            className="flex-1"
          />
          <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting} className="gap-2 shrink-0">
            <UserPlus className="w-4 h-4" /> Invite
          </Button>
        </div>
        {inviteError && <p className="text-xs text-destructive mt-2">{inviteError}</p>}
      </Card>

      <Card className="p-6 border border-border/60">
        <h2 className="font-semibold text-foreground mb-4">
          Members <span className="text-muted-foreground font-normal">({members.length})</span>
        </h2>
        <div className="space-y-3">
          {members.map(email => (
            <div key={email} className="flex items-center gap-3">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {email[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{email}</p>
              </div>
              {email === workspace.owner_email && (
                <Badge variant="outline" className="text-xs shrink-0">Owner</Badge>
              )}
              {email !== workspace.owner_email && (
                <button
                  onClick={() => handleRemove(email)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  title="Remove member"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function NotificationsTab({ user }) {
  const storageKey = `onechat_notif_${user?.email}`;
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');

  const [prefs, setPrefs] = useState({
    new_messages: true,
    task_assigned: true,
    task_completed: false,
    page_edited: false,
    mentions: true,
    daily_digest: false,
    ...saved,
  });
  const [justSaved, setJustSaved] = useState(false);

  const toggle = (key) => setPrefs(p => ({ ...p, [key]: !p[key] }));

  const handleSave = () => {
    localStorage.setItem(storageKey, JSON.stringify(prefs));
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const PREF_GROUPS = [
    {
      label: 'Messages',
      items: [
        { key: 'new_messages', label: 'New messages in channels', desc: 'Get notified when someone posts in a channel you follow.' },
        { key: 'mentions', label: 'Mentions & direct messages', desc: 'Always notify when you are @mentioned or DM\'d.' },
      ],
    },
    {
      label: 'Tasks',
      items: [
        { key: 'task_assigned', label: 'Task assigned to me', desc: 'Notify when a task is assigned to you.' },
        { key: 'task_completed', label: 'Task completed', desc: 'Notify when a task you created or follow is completed.' },
      ],
    },
    {
      label: 'Pages & Docs',
      items: [
        { key: 'page_edited', label: 'Page edits', desc: 'Notify when a page you own or follow is edited.' },
      ],
    },
    {
      label: 'Digest',
      items: [
        { key: 'daily_digest', label: 'Daily activity digest', desc: 'Receive a daily email summary of workspace activity.' },
      ],
    },
  ];

  return (
    <Card className="p-6 border border-border/60">
      <h2 className="font-semibold text-foreground mb-6">Notification Preferences</h2>
      <div className="space-y-6">
        {PREF_GROUPS.map(group => (
          <div key={group.label}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{group.label}</p>
            <div className="space-y-4">
              {group.items.map(item => (
                <div key={item.key} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => toggle(item.key)}
                    className={cn(
                      'relative w-10 h-6 rounded-full transition-colors shrink-0 mt-0.5',
                      prefs[item.key] ? 'bg-primary' : 'bg-muted'
                    )}
                  >
                    <span className={cn(
                      'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all',
                      prefs[item.key] ? 'left-5' : 'left-1'
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-6 pt-6 border-t border-border">
        <Button onClick={handleSave} className="gap-2">
          {justSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {justSaved ? 'Saved!' : 'Save Preferences'}
        </Button>
      </div>
    </Card>
  );
}



9.Tasks.jsx

import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, CheckSquare, Circle, Clock, AlertCircle, Trash2, User, LayoutGrid, List } from 'lucide-react';
import KanbanBoard from '@/components/tasks/KanbanBoard';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import CreateTaskModal from '@/components/tasks/CreateTaskModal';

const STATUS_CONFIG = {
  todo: { label: 'Todo', icon: Circle, color: 'text-muted-foreground', bg: 'bg-muted' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
  done: { label: 'Done', icon: CheckSquare, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10' },
};

const PRIORITY_CONFIG = {
  low: { label: 'Low', color: 'text-muted-foreground border-muted' },
  medium: { label: 'Medium', color: 'text-yellow-600 border-yellow-300 dark:border-yellow-600' },
  high: { label: 'High', color: 'text-red-600 border-red-300 dark:border-red-700' },
};

export default function Tasks() {
  const { user, currentWorkspaceId } = useOutletContext();
  const [filterStatus, setFilterStatus] = useState('all');
  const [view, setView] = useState('list');
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', currentWorkspaceId],
    queryFn: () => base44.entities.Task.filter({ workspace_id: currentWorkspaceId }),
    enabled: !!currentWorkspaceId,
  });

  const updateStatus = async (taskId, newStatus) => {
    await base44.entities.Task.update(taskId, { status: newStatus });
    queryClient.invalidateQueries({ queryKey: ['tasks', currentWorkspaceId] });
  };

  const deleteTask = async (taskId) => {
    await base44.entities.Task.delete(taskId);
    queryClient.invalidateQueries({ queryKey: ['tasks', currentWorkspaceId] });
  };

  const filtered = filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus);
  const grouped = {
    todo: filtered.filter(t => t.status === 'todo'),
    in_progress: filtered.filter(t => t.status === 'in_progress'),
    done: filtered.filter(t => t.status === 'done'),
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 animate-fade-in">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-cal font-semibold text-foreground">Tasks</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{tasks.length} total • {tasks.filter(t => t.status !== 'done').length} open</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setView('list')}
                className={cn('p-1.5 rounded-md transition-colors', view === 'list' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('kanban')}
                className={cn('p-1.5 rounded-md transition-colors', view === 'kanban' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
                title="Kanban view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
            <Button size="sm" onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Task
            </Button>
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <CheckSquare className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-foreground mb-1">No tasks yet</p>
            <p className="text-sm text-muted-foreground mb-4">Create your first task to get started</p>
            <Button onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus className="w-4 h-4" /> Create Task
            </Button>
          </div>
        ) : view === 'kanban' ? (
          <div className="h-[calc(100vh-220px)] overflow-hidden">
            <KanbanBoard
              tasks={filtered}
              onStatusChange={updateStatus}
              onDelete={deleteTask}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(grouped).map(([status, statusTasks]) => {
              const cfg = STATUS_CONFIG[status];
              const Icon = cfg.icon;
              return (
                <div key={status} className="space-y-2">
                  <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg", cfg.bg)}>
                    <Icon className={cn("w-4 h-4", cfg.color)} />
                    <span className={cn("text-sm font-semibold", cfg.color)}>{cfg.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded-full">{statusTasks.length}</span>
                  </div>
                  <div className="space-y-2">
                    {statusTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onStatusChange={updateStatus}
                        onDelete={deleteTask}
                        currentStatus={status}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTaskModal
          workspaceId={currentWorkspaceId}
          user={user}
          onClose={() => setShowCreate(false)}
          onCreated={() => { queryClient.invalidateQueries({ queryKey: ['tasks', currentWorkspaceId] }); setShowCreate(false); }}
        />
      )}
    </div>
  );
}

function TaskCard({ task, onStatusChange, onDelete, currentStatus }) {
  const priorityCfg = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const nextStatus = { todo: 'in_progress', in_progress: 'done', done: 'todo' };

  return (
    <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow group">
      <div className="flex items-start gap-2">
        <button
          onClick={() => onStatusChange(task.id, nextStatus[currentStatus])}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
          title="Advance status"
        >
          {currentStatus === 'done'
            ? <CheckSquare className="w-4 h-4 text-green-500" />
            : <Circle className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium leading-tight", currentStatus === 'done' && "line-through text-muted-foreground")}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", priorityCfg.color)}>
              {priorityCfg.label}
            </span>
            {task.due_date && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(task.due_date), 'MMM d')}
              </span>
            )}
            {task.assignee_email && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <User className="w-3 h-3" />
                {task.assignee_email.split('@')[0]}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

implement all this first then I'll provide the matching components and lib