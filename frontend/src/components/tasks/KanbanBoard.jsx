import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { Clock, Circle, CheckSquare, Trash2, User } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const STATUS_CONFIG = {
  todo: { label: 'To Do', icon: Circle, color: 'text-muted-foreground', bg: 'bg-muted/60', border: 'border-border' },
  in_progress: { label: 'In Progress', icon: Clock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10', border: 'border-blue-200 dark:border-blue-500/30' },
  done: { label: 'Done', icon: CheckSquare, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-500/10', border: 'border-green-200 dark:border-green-500/30' },
};

const PRIORITY_COLORS = {
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400',
  high: 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400',
};

export default function KanbanBoard({ tasks, onStatusChange, onDelete }) {
  const columns = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    done: tasks.filter(t => t.status === 'done'),
  };

  const handleDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    onStatusChange(draggableId, destination.droppableId);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
          const Icon = cfg.icon;
          const colTasks = columns[status];
          return (
            <div key={status} className="flex flex-col min-w-[280px] w-[280px]">
              {/* Column Header */}
              <div className={cn('flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3 border', cfg.bg, cfg.border)}>
                <Icon className={cn('w-4 h-4', cfg.color)} />
                <span className={cn('text-sm font-semibold', cfg.color)}>{cfg.label}</span>
                <span className="ml-auto text-xs font-medium text-muted-foreground bg-background/80 px-2 py-0.5 rounded-full">
                  {colTasks.length}
                </span>
              </div>

              {/* Droppable Column */}
              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex-1 rounded-xl p-2 space-y-2 min-h-[200px] transition-colors',
                      snapshot.isDraggingOver ? 'bg-accent/40 ring-2 ring-primary/30' : 'bg-muted/20'
                    )}
                  >
                    {colTasks.map((task, index) => (
                      <Draggable key={task.id} draggableId={task.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={cn(
                              'bg-card border border-border rounded-xl p-3.5 shadow-sm group cursor-grab active:cursor-grabbing transition-shadow',
                              snapshot.isDragging && 'shadow-xl ring-2 ring-primary/40 rotate-1'
                            )}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className={cn('text-sm font-medium leading-tight flex-1', status === 'done' && 'line-through text-muted-foreground')}>
                                {task.title}
                              </p>
                              <button
                                onClick={() => onDelete(task.id)}
                                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {task.description && (
                              <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{task.description}</p>
                            )}

                            <div className="flex flex-wrap items-center gap-1.5">
                              {task.priority && (
                                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', PRIORITY_COLORS[task.priority])}>
                                  {task.priority}
                                </span>
                              )}
                              {task.due_date && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(new Date(task.due_date), 'MMM d')}
                                </span>
                              )}
                              {task.assignee_email && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto">
                                  <div className="w-4 h-4 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[9px]">
                                    {task.assignee_email[0]?.toUpperCase()}
                                  </div>
                                  {task.assignee_email.split('@')[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                    {colTasks.length === 0 && !snapshot.isDraggingOver && (
                      <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/60 border-2 border-dashed border-border rounded-lg">
                        Drop tasks here
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          );
        })}
      </div>
    </DragDropContext>
  );
}