import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketEvent } from '@/hooks/useSocket';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const COLORS = ['bg-violet-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500', 'bg-yellow-500'];

function colorForEmail(email) {
  let hash = 0;
  for (let i = 0; i < email.length; i++) hash = email.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function LivePresence({ pageId, currentUser, viewers = [] }) {
  const queryClient = useQueryClient();

  useSocketEvent('page:updated', (data) => {
    if (data.pageId === pageId) {
      queryClient.invalidateQueries({ queryKey: ['page', pageId] });
    }
  }, [pageId]);

  const others = viewers.filter(e => e !== currentUser?.email);
  if (others.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground mr-1">Also viewing:</span>
      <div className="flex -space-x-2">
        {others.slice(0, 4).map((email, i) => (
          <Avatar key={email} className="w-6 h-6 border-2 border-background ring-1 ring-border" title={email}>
            <AvatarFallback className={cn('text-[10px] font-bold text-white', colorForEmail(email))}>
              {email[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
        ))}
        {others.length > 4 && (
          <div className="w-6 h-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
            +{others.length - 4}
          </div>
        )}
      </div>
      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse ml-1" title="Live" />
    </div>
  );
}