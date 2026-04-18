import { useState, useEffect, useCallback } from 'react';
import { Bell, MessageSquare, AtSign, FileEdit, Info } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import { useSocketEvent } from '../hooks/useSocket';
import { cn } from '@/lib/utils';

function typeMeta(type) {
  if (type === 'message') return { icon: MessageSquare, tone: 'text-blue-500 bg-blue-500/10' };
  if (type === 'mention') return { icon: AtSign, tone: 'text-violet-500 bg-violet-500/10' };
  if (type === 'doc_edit') return { icon: FileEdit, tone: 'text-emerald-500 bg-emerald-500/10' };
  return { icon: Info, tone: 'text-slate-500 bg-slate-500/10' };
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

  useSocketEvent('notification:new', useCallback((notification) => {
    setNotifications((prev) => [notification, ...prev].slice(0, 50));
  }, []));

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
        className="relative h-9 w-9 rounded-full border border-border bg-card hover:bg-muted transition-colors flex items-center justify-center"
      >
        <Bell className="w-4 h-4 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] leading-5 text-center font-semibold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 z-50 w-[360px] max-w-[90vw] rounded-xl border border-border bg-card shadow-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
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

            <div className="max-h-[420px] overflow-y-auto">
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
                        'px-4 py-3 border-b border-border/70 last:border-b-0 flex gap-3',
                        !notification.read && 'bg-primary/5'
                      )}
                    >
                      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', meta.tone)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm leading-snug', !notification.read && 'font-medium')}>{notification.message}</p>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="capitalize">{String(notification.type || 'system').replace('_', ' ')}</span>
                          <span>•</span>
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
