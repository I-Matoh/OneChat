import { Outlet } from 'react-router-dom';
import { useState, useEffect } from 'react';
import AppSidebar from './Appsidebar';
import { useAuth } from '@/hooks/useAuth';

export default function MainLayout() {
  const { user, logout } = useAuth();
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const w = params.get('w');
    if (w) setCurrentWorkspaceId(w);
  }, []);

  return (
    <div className="flex h-screen w-full bg-background">
      <AppSidebar
        user={user}
        currentWorkspaceId={currentWorkspaceId}
        onWorkspaceChange={setCurrentWorkspaceId}
        onLogout={logout}
      />
      <main className="flex-1 overflow-hidden">
        <Outlet context={{ user, currentWorkspaceId }} />
      </main>
    </div>
  );
}