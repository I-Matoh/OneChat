import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSocketEvent } from '../hooks/useSocket';

export default function PresenceSidebar() {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState([]);

  useSocketEvent('presence:init', useCallback((users) => {
    setOnlineUsers(users);
  }, []));

  useSocketEvent('presence:update', useCallback((data) => {
    setOnlineUsers((prev) => {
      const existing = prev.findIndex((u) => u.userId === data.userId);
      if (data.status === 'offline') {
        return prev.filter((u) => u.userId !== data.userId);
      }
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], ...data };
        return updated;
      }
      return [...prev, data];
    });
  }, []));

  const sortedUsers = [...onlineUsers].sort((a, b) => {
    if (a.userId === user?.id) return -1;
    if (b.userId === user?.id) return 1;
    return (a.userName || '').localeCompare(b.userName || '');
  });

  return (
    <div className="presence-panel">
      <div className="presence-panel-title">Online — {sortedUsers.length}</div>
      {sortedUsers.map((u) => (
        <div key={u.userId} className="presence-user">
          <div className="presence-user-avatar">
            {(u.userName || '?')[0].toUpperCase()}
            <div
              className="presence-user-dot"
              style={{
                background: u.status === 'online' ? 'var(--success)' :
                  u.status === 'away' ? 'var(--warning)' : 'var(--text-muted)',
                boxShadow: u.status === 'online' ? '0 0 6px rgba(34,197,94,0.5)' : 'none',
              }}
            />
          </div>
          <span className="presence-user-name">
            {u.userName}{u.userId === user?.id ? ' (you)' : ''}
          </span>
        </div>
      ))}
      {sortedUsers.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 10px' }}>
          No users online
        </div>
      )}
    </div>
  );
}
