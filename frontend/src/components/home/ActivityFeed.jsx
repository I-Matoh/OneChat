import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';

export default function ActivityFeed({ workspaceId }) {
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities', workspaceId],
    queryFn: () => fetch(`/api/activities?workspaceId=${workspaceId}`).then(r => r.json()),
    enabled: !!workspaceId,
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading activity...</div>;
  }

  if (activities.length === 0) {
    return <div className="text-sm text-muted-foreground">No recent activity</div>;
  }

  return (
    <div className="space-y-2">
      {activities.slice(0, 10).map((activity) => (
        <div key={activity.id || activity._id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/60 transition-colors">
          <div className="w-2 h-2 rounded-full bg-green-500 shrink-0 mt-1.5" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-foreground truncate">{activity.message || activity.content}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(activity.created_at || activity.createdAt || activity.created_date), { addSuffix: true })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
