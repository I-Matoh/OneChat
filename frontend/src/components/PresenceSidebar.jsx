import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { getSocket } from '../hooks/useSocket';

export default function PresenceSidebar() {
  const { user, token } = useAuth();
  const { connected } = useSocket(token);
  const [onlineUsers, setOnlineUsers] = useState([]);

  useEffect(() => {
    if (!token || !connected) return;
    
    const socket = getSocket(token);
    
    const handleInit = (users) => {
      setOnlineUsers(users);
    };
    
    const handleUpdate = (data) => {
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
    };
    
    socket.on('presence:init', handleInit);
    socket.on('presence:update', handleUpdate);
    
    return () => {
      socket.off('presence:init', handleInit);
      socket.off('presence:update', handleUpdate);
    };
  }, [token, connected]);

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
