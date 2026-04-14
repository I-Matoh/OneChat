import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Settings as SettingsIcon, Users, Bell, Building2, Trash2, UserPlus, Check, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'workspace', label: 'Workspace', icon: Building2 },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

export default function Settings() {
  const { user, currentWorkspaceId } = useOutletContext();
  const [activeTab, setActiveTab] = useState('workspace');
  const queryClient = useQueryClient();

  const { data: workspaces = [] } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => base44.entities.Workspace.list(),
  });

  const workspace = workspaces.find(w => w.id === currentWorkspaceId);
  const isOwner = workspace?.owner_email === user?.email;

  if (!workspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No workspace selected.</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
        <SettingsIcon className="w-12 h-12 text-muted-foreground/30" />
        <p className="font-semibold text-foreground">Admin access required</p>
        <p className="text-sm text-muted-foreground">Only the workspace owner can access settings.</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-cal font-semibold text-foreground">Workspace Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">{workspace.name}</p>
        </div>

        <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6 w-fit">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all select-none',
                  activeTab === tab.id
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'workspace' && (
          <WorkspaceTab workspace={workspace} queryClient={queryClient} />
        )}
        {activeTab === 'members' && (
          <MembersTab workspace={workspace} user={user} queryClient={queryClient} />
        )}
        {activeTab === 'notifications' && (
          <NotificationsTab user={user} />
        )}
      </div>
    </div>
  );
}

function WorkspaceTab({ workspace, queryClient }) {
  const [name, setName] = useState(workspace.name);
  const [description, setDescription] = useState(workspace.description || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.Workspace.update(workspace.id, { name, description });
    queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const ICONS = ['🏢', '🚀', '💡', '⚡', '🎯', '🔥', '🌟', '💎', '🛠️', '🎨'];
  const [icon, setIcon] = useState(workspace.icon || '🏢');

  const handleIconSave = async (newIcon) => {
    setIcon(newIcon);
    await base44.entities.Workspace.update(workspace.id, { icon: newIcon });
    queryClient.invalidateQueries({ queryKey: ['workspaces'] });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-border/60">
        <h2 className="font-semibold text-foreground mb-4">General</h2>
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">Workspace Icon</Label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(i => (
                <button
                  key={i}
                  onClick={() => handleIconSave(i)}
                  className={cn(
                    'text-xl p-2 rounded-lg transition-all',
                    icon === i ? 'bg-accent ring-2 ring-primary' : 'hover:bg-muted'
                  )}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="ws-name">Workspace Name</Label>
            <Input
              id="ws-name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="ws-desc">Description</Label>
            <Input
              id="ws-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this workspace for?"
              className="mt-1"
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-6 border border-destructive/30 bg-destructive/5">
        <h2 className="font-semibold text-destructive mb-2">Danger Zone</h2>
        <p className="text-sm text-muted-foreground mb-4">These actions are permanent and cannot be undone.</p>
        <Button
          variant="destructive"
          size="sm"
          onClick={async () => {
            if (confirm(`Delete workspace "${workspace.name}"? This cannot be undone.`)) {
              await base44.entities.Workspace.delete(workspace.id);
              window.location.href = '/';
            }
          }}
        >
          <Trash2 className="w-4 h-4 mr-2" /> Delete Workspace
        </Button>
      </Card>
    </div>
  );
}

function MembersTab({ workspace, user, queryClient }) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const members = workspace.member_emails || [];

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    const updatedMembers = [...new Set([...members, inviteEmail.trim()])];
    await base44.entities.Workspace.update(workspace.id, { member_emails: updatedMembers });
    queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    setInviteEmail('');
    setInviting(false);
  };

  const handleRemove = async (email) => {
    if (email === workspace.owner_email) return;
    if (!confirm(`Remove ${email} from the workspace?`)) return;
    const updatedMembers = members.filter(m => m !== email);
    await base44.entities.Workspace.update(workspace.id, { member_emails: updatedMembers });
    queryClient.invalidateQueries({ queryKey: ['workspaces'] });
  };

  return (
    <div className="space-y-6">
      <Card className="p-6 border border-border/60">
        <h2 className="font-semibold text-foreground mb-4">Invite Member</h2>
        <div className="flex gap-2">
          <Input
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            placeholder="colleague@company.com"
            type="email"
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
            className="flex-1"
          />
          <Button onClick={handleInvite} disabled={!inviteEmail.trim() || inviting} className="gap-2 shrink-0">
            <UserPlus className="w-4 h-4" /> Invite
          </Button>
        </div>
        {inviteError && <p className="text-xs text-destructive mt-2">{inviteError}</p>}
      </Card>

      <Card className="p-6 border border-border/60">
        <h2 className="font-semibold text-foreground mb-4">
          Members <span className="text-muted-foreground font-normal">({members.length})</span>
        </h2>
        <div className="space-y-3">
          {members.map(email => (
            <div key={email} className="flex items-center gap-3">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {email[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{email}</p>
              </div>
              {email === workspace.owner_email && (
                <Badge variant="outline" className="text-xs shrink-0">Owner</Badge>
              )}
              {email !== workspace.owner_email && (
                <button
                  onClick={() => handleRemove(email)}
                  className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  title="Remove member"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function NotificationsTab({ user }) {
  const storageKey = `onechat_notif_${user?.email}`;
  const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');

  const [prefs, setPrefs] = useState({
    new_messages: true,
    task_assigned: true,
    task_completed: false,
    page_edited: false,
    mentions: true,
    daily_digest: false,
    ...saved,
  });
  const [justSaved, setJustSaved] = useState(false);

  const toggle = (key) => setPrefs(p => ({ ...p, [key]: !p[key] }));

  const handleSave = () => {
    localStorage.setItem(storageKey, JSON.stringify(prefs));
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const PREF_GROUPS = [
    {
      label: 'Messages',
      items: [
        { key: 'new_messages', label: 'New messages in channels', desc: 'Get notified when someone posts in a channel you follow.' },
        { key: 'mentions', label: 'Mentions & direct messages', desc: 'Always notify when you are @mentioned or DM\'d.' },
      ],
    },
    {
      label: 'Tasks',
      items: [
        { key: 'task_assigned', label: 'Task assigned to me', desc: 'Notify when a task is assigned to you.' },
        { key: 'task_completed', label: 'Task completed', desc: 'Notify when a task you created or follow is completed.' },
      ],
    },
    {
      label: 'Pages & Docs',
      items: [
        { key: 'page_edited', label: 'Page edits', desc: 'Notify when a page you own or follow is edited.' },
      ],
    },
    {
      label: 'Digest',
      items: [
        { key: 'daily_digest', label: 'Daily activity digest', desc: 'Receive a daily email summary of workspace activity.' },
      ],
    },
  ];

  return (
    <Card className="p-6 border border-border/60">
      <h2 className="font-semibold text-foreground mb-6">Notification Preferences</h2>
      <div className="space-y-6">
        {PREF_GROUPS.map(group => (
          <div key={group.label}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{group.label}</p>
            <div className="space-y-4">
              {group.items.map(item => (
                <div key={item.key} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  </div>
                  <button
                    onClick={() => toggle(item.key)}
                    className={cn(
                      'relative w-10 h-6 rounded-full transition-colors shrink-0 mt-0.5',
                      prefs[item.key] ? 'bg-primary' : 'bg-muted'
                    )}
                  >
                    <span className={cn(
                      'absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all',
                      prefs[item.key] ? 'left-5' : 'left-1'
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end mt-6 pt-6 border-t border-border">
        <Button onClick={handleSave} className="gap-2">
          {justSaved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {justSaved ? 'Saved!' : 'Save Preferences'}
        </Button>
      </div>
    </Card>
  );
}
