import { useState } from 'react';
import api from '@/lib/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQueryClient } from '@tanstack/react-query';

const ICONS = ['🏢', '🚀', '💡', '⚡', '🎯', '🔥', '🌟', '💎', '🛠️', '🎨'];

export default function CreateWorkspaceModal({ user, onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🏢');
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const ws = await api.workspaces.create({
      name: name.trim(),
      description,
      icon,
    });
    queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    setLoading(false);
    onCreated(ws);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-cal text-xl">Create Workspace</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Icon</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {ICONS.map(i => (
                <button
                  key={i}
                  onClick={() => setIcon(i)}
                  className={`text-xl p-1.5 rounded-md transition-colors ${icon === i ? 'bg-accent ring-2 ring-primary' : 'hover:bg-muted'}`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>Workspace Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Team"
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <Label>Description <span className="text-muted-foreground">(optional)</span></Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What is this workspace for?"
              className="mt-1 resize-none"
              rows={2}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!name.trim() || loading}>
              {loading ? 'Creating...' : 'Create Workspace'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}