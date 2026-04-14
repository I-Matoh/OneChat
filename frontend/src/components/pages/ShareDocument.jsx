import { useState } from 'react';
import api from '@/lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Share2, MessageSquare, CheckSquare, X, Check, Link } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function ShareDocument({ page, workspaceId, user }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('chat');
  const [selectedId, setSelectedId] = useState(null);
  const [done, setDone] = useState(false);
  const queryClient = useQueryClient();

  const { data: conversations = [] } = useQuery({
    queryKey: ['conversations', workspaceId],
    queryFn: () => api.conversations.list(),
    enabled: open && tab === 'chat',
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', workspaceId],
    queryFn: () => api.tasks.list(workspaceId),
    enabled: open && tab === 'tasks',
  });

  const pageUrl = `${window.location.origin}/pages/${page._id}`;

  const handleShare = async () => {
    if (!selectedId) return;
    if (tab === 'chat') {
      await api.messages.create({
        conversationId: selectedId,
        content: `${page.icon || '📄'} **${page.title}**\n${pageUrl}`,
      });
      queryClient.invalidateQueries({ queryKey: ['messages', selectedId] });
    } else {
      await api.tasks.update(selectedId, { pageId: page._id });
      queryClient.invalidateQueries({ queryKey: ['tasks', workspaceId] });
    }
    setDone(true);
    setTimeout(() => { setDone(false); setOpen(false); setSelectedId(null); }, 1200);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(pageUrl);
  };

  if (!open) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} className="gap-1.5 text-muted-foreground">
        <Share2 className="w-3.5 h-3.5" /> Share
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-80 p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-foreground">Share Document</h3>
          <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Copy link */}
        <button
          onClick={copyLink}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm text-muted-foreground mb-4 transition-colors"
        >
          <Link className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate flex-1 text-left">{pageUrl}</span>
          <span className="text-xs text-primary font-medium shrink-0">Copy</span>
        </button>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted p-1 rounded-lg mb-3">
          <button
            onClick={() => { setTab('chat'); setSelectedId(null); }}
            className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all', tab === 'chat' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}
          >
            <MessageSquare className="w-3.5 h-3.5" /> Chat
          </button>
          <button
            onClick={() => { setTab('tasks'); setSelectedId(null); }}
            className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all', tab === 'tasks' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground')}
          >
            <CheckSquare className="w-3.5 h-3.5" /> Tasks
          </button>
        </div>

        {/* List */}
        <div className="space-y-1 max-h-48 overflow-y-auto mb-4">
          {(tab === 'chat' ? conversations : tasks).map(item => (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left',
                selectedId === item.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'
              )}
            >
              <span>{tab === 'chat' ? '#' : '☐'}</span>
              <span className="truncate">{item.name || item.title}</span>
              {selectedId === item.id && <Check className="w-3.5 h-3.5 ml-auto shrink-0" />}
            </button>
          ))}
          {(tab === 'chat' ? conversations : tasks).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No {tab === 'chat' ? 'channels' : 'tasks'} found</p>
          )}
        </div>

        <Button onClick={handleShare} disabled={!selectedId || done} className="w-full gap-2">
          {done ? <><Check className="w-4 h-4" /> Shared!</> : <><Share2 className="w-4 h-4" /> Share to {tab === 'chat' ? 'Channel' : 'Task'}</>}
        </Button>
      </div>
    </div>
  );
}