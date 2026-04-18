import { useState, useEffect, useCallback } from 'react';
import { Bell } from 'lucide-react';
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
  }, [token, apiFetch]);

  useSocketEvent('notification:new', useCallback((notification) => {
    setNotifications((prev) => [notification, ...prev]);
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
    <div style={{ position: 'relative' }}>
      <button className="btn-icon" onClick={() => setOpen((prev) => !prev)} id="notification-bell" title="Notifications">
        <Bell className="w-4 h-4" />
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
                notifications.slice(0, 20).map((notification) => (
                  <div key={notification._id} className={`notification-item ${!notification.read ? 'unread' : ''}`}>
                    <div className="notification-text">{notification.message}</div>
                    <div className="notification-time" style={{ textTransform: 'capitalize' }}>
                      {String(notification.type || 'system').replace('_', ' ')}
                    </div>
                    <div className="notification-time">{formatTime(notification.createdAt)}</div>
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
