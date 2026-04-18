import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  MessageSquare,
  CheckSquare,
  Sparkles,
  Search,
  Radio,
  Plus,
  ChevronDown,
  ChevronRight,
  LogOut,
  Home,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import CreateWorkspaceModal from '@/components/workspace/CreateWorkspaceModal';
import WorkspaceDrawer from './WorkspaceDrawer';
import DeleteAccountDialog from './DeleteAccountDialog';

export default function AppSidebar({
  user,
  currentWorkspaceId,
  onWorkspaceChange,
  onLogout,
  collapsed = false,
  onToggleCollapse,
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [pagesExpanded, setPagesExpanded] = useState(true);

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.workspaces.list(),
  });

  const { data: pages = [] } = useQuery({
    queryKey: ['pages', currentWorkspaceId],
    queryFn: () => api.pages.list(currentWorkspaceId),
    enabled: !!currentWorkspaceId,
  });

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: MessageSquare, label: 'Chat', path: '/chat' },
    { icon: CheckSquare, label: 'Tasks', path: '/tasks' },
    { icon: Sparkles, label: 'AI Assistant', path: '/ai' },
    { icon: Search, label: 'Search', path: '/search' },
    { icon: Radio, label: 'Meeting AI', path: '/meeting' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const topLevelPages = pages.filter((p) => !p.parentId);

  return (
    <>
      <aside
        className={cn(
          'bg-sidebar border-r border-sidebar-border flex flex-col h-full shrink-0 transition-[width] duration-300 ease-out',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        <div className="p-2.5 border-b border-sidebar-border" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 10px)' }}>
          <div className={cn('flex items-center gap-2', collapsed && 'flex-col gap-1')}>
            <WorkspaceDrawer
              workspaces={workspaces}
              currentWorkspaceId={currentWorkspaceId}
              onWorkspaceChange={onWorkspaceChange}
              onCreateNew={() => setShowCreateWorkspace(true)}
              collapsed={collapsed}
            />
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cn(
                'rounded-md border border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent/70 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0',
                collapsed ? 'w-full' : 'w-9'
              )}
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <nav className={cn('flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5', collapsed && 'px-1.5')}>
          {navItems.map(({ icon: Icon, label, path }) => (
            <Link key={path} to={currentWorkspaceId ? `${path}?w=${currentWorkspaceId}` : path}>
              <div
                className={cn(
                  'flex items-center rounded-md text-sm font-medium transition-colors cursor-pointer select-none min-h-[40px]',
                  collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
                  location.pathname === path
                    ? 'bg-sidebar-accent text-sidebar-primary font-semibold'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                )}
                title={collapsed ? label : undefined}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!collapsed && label}
              </div>
            </Link>
          ))}

          {currentWorkspaceId && !collapsed && (
            <div className="mt-3">
              <button
                onClick={() => setPagesExpanded(!pagesExpanded)}
                className="flex items-center gap-1 w-full px-2.5 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors select-none min-h-[36px]"
              >
                {pagesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                Pages
                <span className="ml-auto text-xs normal-case font-normal">{topLevelPages.length}</span>
              </button>

              {pagesExpanded && (
                <div className="mt-0.5 space-y-0.5">
                  {topLevelPages.map((page) => (
                    <Link key={page._id} to={`/pages/${page._id}?w=${currentWorkspaceId}`}>
                      <div
                        className={cn(
                          'flex items-center gap-2 px-2.5 rounded-md text-sm transition-colors cursor-pointer ml-2 select-none min-h-[36px]',
                          location.pathname === `/pages/${page._id}`
                            ? 'bg-sidebar-accent text-sidebar-primary'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                        )}
                      >
                        <span className="text-base leading-none">{page.icon || 'File'}</span>
                        <span className="truncate">{page.title}</span>
                      </div>
                    </Link>
                  ))}
                  <button
                    onClick={() => navigate(`/pages/new?w=${currentWorkspaceId}`)}
                    className="flex items-center gap-2 px-2.5 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50 transition-colors w-full ml-2 select-none min-h-[36px]"
                  >
                    <Plus className="w-3 h-3" /> New page
                  </button>
                </div>
              )}
            </div>
          )}
        </nav>

        <div className={cn('p-3 border-t border-sidebar-border', collapsed && 'px-2 py-2.5')}>
          <div className={cn('flex items-center gap-2 mb-1', collapsed && 'flex-col mb-0')}>
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {user?.name?.[0] || user?.email?.[0] || 'U'}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate text-sidebar-foreground">{user?.name || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            )}
            <button
              onClick={onLogout}
              className="text-muted-foreground hover:text-foreground transition-colors select-none min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
          {!collapsed && <DeleteAccountDialog />}
        </div>
      </aside>

      {showCreateWorkspace && (
        <CreateWorkspaceModal
          user={user}
          onClose={() => setShowCreateWorkspace(false)}
          onCreated={(ws) => {
            onWorkspaceChange(ws._id);
            setShowCreateWorkspace(false);
          }}
        />
      )}
    </>
  );
}
