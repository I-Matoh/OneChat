import { useState, useEffect, useCallback } from 'react';
import { Bell, MessageSquare, AtSign, FileEdit, Info } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import { useSocketEvent } from '../hooks/useSocket';
import { cn } from '@/lib/utils';

function typeMeta(type) {
  if (type === 'message') return { icon: MessageSquare, tone: 'text-blue-600 bg-blue-500/15 ring-1 ring-blue-500/25' };
  if (type === 'mention') return { icon: AtSign, tone: 'text-fuchsia-600 bg-fuchsia-500/15 ring-1 ring-fuchsia-500/25' };
  if (type === 'doc_edit') return { icon: FileEdit, tone: 'text-emerald-600 bg-emerald-500/15 ring-1 ring-emerald-500/25' };
  return { icon: Info, tone: 'text-slate-600 bg-slate-500/15 ring-1 ring-slate-500/25' };
}

export default function NotificationBell() {
  const { token } = useAuth();
  const { apiFetch } = useApi();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!token) return;
    apiFetch('/notifications').then(setNotifications).catch(() => {});
  }, [token, apiFetch]);

  useSocketEvent(
    'notification:new',
    useCallback((notification) => {
      setNotifications((prev) => [notification, ...prev].slice(0, 50));
    }, [])
  );

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  async function markAllRead() {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })));
  }

  function formatTime(timestamp) {
    const diff = Date.now() - new Date(timestamp).getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        id="notification-bell"
        title="Notifications"
        className={cn(
          'relative h-9 w-9 rounded-full border flex items-center justify-center transition-all duration-300',
          open
            ? 'border-white/40 bg-white/45 shadow-[0_8px_24px_rgba(15,23,42,0.2)] backdrop-blur-xl dark:border-white/20 dark:bg-slate-900/45'
            : 'border-border bg-card hover:bg-muted'
        )}
      >
        <Bell className={cn('w-4 h-4 transition-colors', open ? 'text-slate-800 dark:text-slate-100' : 'text-foreground')} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-5 text-center font-semibold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/5 backdrop-blur-[1px]" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-[360px] max-w-[90vw] rounded-2xl border border-white/40 bg-white/65 dark:border-white/15 dark:bg-slate-900/55 shadow-[0_20px_45px_rgba(15,23,42,0.28)] backdrop-blur-2xl overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/35 via-white/10 to-transparent dark:from-slate-300/5 dark:via-slate-200/0 dark:to-transparent" />
            <div className="relative px-4 py-3 border-b border-white/35 dark:border-white/10 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Notifications</p>
                <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
              </div>
              {unreadCount > 0 && (
                <button className="text-xs text-primary hover:underline" onClick={markAllRead}>
                  Mark all read
                </button>
              )}
            </div>

            <div className="relative max-h-[420px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <Bell className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                notifications.slice(0, 30).map((notification) => {
                  const meta = typeMeta(notification.type);
                  const Icon = meta.icon;
                  return (
                    <div
                      key={notification._id}
                      className={cn(
                        'px-4 py-3 border-b border-white/25 dark:border-white/8 last:border-b-0 flex gap-3 hover:bg-white/35 dark:hover:bg-white/5 transition-colors',
                        !notification.read && 'bg-primary/10'
                      )}
                    >
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', meta.tone)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm leading-snug', !notification.read && 'font-medium')}>{notification.message}</p>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="capitalize">{String(notification.type || 'system').replace('_', ' ')}</span>
                          <span>|</span>
                          <span>{formatTime(notification.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
