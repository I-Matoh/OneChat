import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { ChevronDown, Check, Building2, Plus } from 'lucide-react';

function getWorkspaceId(workspace) {
  return workspace?._id || workspace?.id || null;
}

export default function WorkspaceDrawer({ workspaces, currentWorkspaceId, onWorkspaceChange, onCreateNew }) {
  const [open, setOpen] = useState(false);
  const current = workspaces.find((workspace) => getWorkspaceId(workspace) === currentWorkspaceId);

  const handleSelect = (id) => {
    onWorkspaceChange(id);
    setOpen(false);
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button className="w-full flex items-center gap-2 bg-sidebar-accent text-sidebar-foreground text-sm font-semibold rounded-md px-3 py-2 border border-sidebar-border select-none hover:bg-sidebar-accent/80 transition-colors">
          <span className="truncate flex-1 text-left">
            {current ? `${current.name}` : 'No workspace'}
          </span>
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Switch Workspace</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-4 space-y-1">
          {workspaces.map((workspace) => {
            const workspaceId = getWorkspaceId(workspace);
            return (
              <button
                key={workspaceId}
                onClick={() => handleSelect(workspaceId)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors select-none min-h-[48px] text-left"
              >
                <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 font-medium text-sm text-foreground">{workspace.name}</span>
                {workspaceId === currentWorkspaceId && <Check className="w-4 h-4 text-primary" />}
              </button>
            );
          })}
          <button
            onClick={() => { setOpen(false); onCreateNew(); }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted transition-colors select-none min-h-[48px] text-muted-foreground"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="text-sm font-medium">New Workspace</span>
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
