import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useApi } from '../hooks/useApi';
import { useSocketEvent } from '../hooks/useSocket';

export default function NotificationBell() {
  const { token } = useAuth();
  const { apiFetch } = useApi();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!token) return;
    apiFetch('/notifications').then(setNotifications).catch(() => {});
  }, [token]);

  useSocketEvent('notification:new', useCallback((notif) => {
    setNotifications((prev) => [notif, ...prev]);
  }, []));

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markAllRead() {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function formatTime(ts) {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleDateString();
  }

  return (
    <div style={{ position: 'relative' }}>
      <button className="btn-icon" onClick={() => setOpen(!open)} id="notification-bell">
        🔔
        {unreadCount > 0 && <span className="badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setOpen(false)} />
          <div className="notification-dropdown">
            <div className="notification-header">
              <span>Notifications</span>
              {unreadCount > 0 && (
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={markAllRead}>
                  Mark all read
                </button>
              )}
            </div>
            <div className="notification-list">
              {notifications.length === 0 ? (
                <div className="notification-empty">No notifications yet</div>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <div key={n._id} className={`notification-item ${!n.read ? 'unread' : ''}`}>
                    <div className="notification-text">{n.message}</div>
                    <div className="notification-time" style={{ textTransform: 'capitalize' }}>
                      {String(n.type || 'system').replace('_', ' ')}
                    </div>
                    <div className="notification-time">{formatTime(n.createdAt)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
