import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import AppSidebar from './Appsidebar';
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';
import NotificationBell from '@/components/NotificationBell';

export default function MainLayout() {
  const { user, token, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  useSocket(token);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const w = params.get('w');
    if (w && w !== 'null' && w !== 'undefined') {
      setCurrentWorkspaceId(w);
      return;
    }
    setCurrentWorkspaceId(null);
  }, [location.search]);

  const handleWorkspaceChange = (workspaceId) => {
    setCurrentWorkspaceId(workspaceId || null);
    const params = new URLSearchParams(location.search);
    if (workspaceId) {
      params.set('w', workspaceId);
    } else {
      params.delete('w');
    }
    const nextSearch = params.toString();
    navigate({
      pathname: location.pathname,
      search: nextSearch ? `?${nextSearch}` : '',
    });
  };

  return (
    <div className="flex h-screen w-full bg-background">
      <AppSidebar
        user={user}
        currentWorkspaceId={currentWorkspaceId}
        onWorkspaceChange={handleWorkspaceChange}
        onLogout={logout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
      />
      <main className="relative flex-1 overflow-hidden">
        <div className="absolute right-4 top-3 z-20">
          <NotificationBell />
        </div>
        <Outlet context={{ user, currentWorkspaceId }} />
      </main>
    </div>
  );
}
