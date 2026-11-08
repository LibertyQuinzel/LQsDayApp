import { addDays, format, parseISO } from 'date-fns';
import { CalendarDays, CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toDateKey, type Task, type WorkSession } from '../state';

const energyDot = { low: 'bg-energy-low', medium: 'bg-energy-medium', high: 'bg-energy-high' };

interface WeekPlannerProps {
  tasks: Task[];
  sessionsByTask: Map<string, WorkSession[]>;
  todayKey: string;
  onAddTask: (text: string, date: string) => void;
  onUpdateTask: (id: string, changes: Partial<Task>) => void;
  onMoveTask: (id: string, date: string, beforeId?: string) => void;
  onDeleteTask: (id: string) => void;
  onClearCompleted: () => void;
}

export function WeekPlanner({
  tasks,
  sessionsByTask,
  todayKey,
  onAddTask,
  onUpdateTask,
  onMoveTask,
  onDeleteTask,
  onClearCompleted
}: WeekPlannerProps) {
  const days = useMemo(() => {
    const today = parseISO(todayKey);
    return Array.from({ length: 7 }, (_, index) => addDays(today, index));
  }, [todayKey]);

  const [newTasks, setNewTasks] = useState<Record<string, string>>({});
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const hasCompletedTasks = tasks.some((task) => task.completed && task.date >= todayKey);

  const addTask = (dayKey: string) => {
    const text = newTasks[dayKey]?.trim();
    if (!text) return;

    onAddTask(text, dayKey);
    setNewTasks((current) => ({ ...current, [dayKey]: '' }));
  };

  const saveRename = (taskId: string) => {
    const text = editText.trim();
    if (text) onUpdateTask(taskId, { text });
    setEditingId(null);
  };

  const dropTask = (event: React.DragEvent, dayKey: string, beforeId?: string) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverDay(null);
    const taskId = event.dataTransfer.getData('text/plain');
    if (taskId && taskId !== beforeId) onMoveTask(taskId, dayKey, beforeId);
  };

  return (
    <div className="panel p-4 h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h2 className="text-base">7-Day Rolling Planner</h2>
          <span className="text-sm text-muted-foreground ml-1">
            {format(days[0], 'MMM d')} – {format(days[6], 'MMM d')}
          </span>
        </div>

        {hasCompletedTasks && (
          <button
            type="button"
            onClick={onClearCompleted}
            title="Remove completed tasks. Their pomodoros stay in Pom History."
            className="px-2.5 py-1 rounded-md text-sm text-muted-foreground border border-border hover:text-foreground hover:bg-secondary flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear completed
          </button>
        )}
      </div>

      <div className="grid grid-flow-col auto-cols-[minmax(170px,1fr)] gap-2 flex-1 min-h-0 overflow-x-auto">
        {days.map((day) => {
          const dayKey = toDateKey(day);
          const isCurrentDay = dayKey === todayKey;
          const dayTasks = tasks.filter((task) => task.date === dayKey);

          return (
            <div
              key={dayKey}
              className={`bg-secondary rounded-lg p-2 flex flex-col min-h-0 border-2 transition-colors ${
                dragOverDay === dayKey ? 'border-primary' : isCurrentDay ? 'border-primary/50' : 'border-transparent'
              }`}
              onDragOver={(event) => event.preventDefault()}
              onDragEnter={() => setDragOverDay(dayKey)}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragOverDay(null);
              }}
              onDrop={(event) => dropTask(event, dayKey)}
            >
              <div className="mb-2 px-1 flex items-center justify-between flex-shrink-0">
                <h3 className={`text-sm flex items-center gap-1.5 ${isCurrentDay ? 'text-primary' : ''}`}>
                  {format(day, 'EEE')}
                  {isCurrentDay && <span className="text-xs font-normal">Today</span>}
                </h3>
                <span className="text-sm text-muted-foreground">{format(day, 'd')}</span>
              </div>

              <div className="space-y-1 overflow-y-auto flex-1 min-h-0">
                {dayTasks.map((task) => {
                  const poms = sessionsByTask.get(task.id)?.length ?? 0;

                  return (
                    <div
                      key={task.id}
                      draggable={editingId !== task.id}
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', task.id);
                        event.dataTransfer.effectAllowed = 'move';
                      }}
                      onDrop={(event) => dropTask(event, dayKey, task.id)}
                      className="bg-tile hover:bg-tile-hover shadow-sm dark:shadow-none rounded-md p-1.5 flex items-start gap-1.5 group cursor-grab"
                    >
                      <button
                        onClick={() => onUpdateTask(task.id, { completed: !task.completed })}
                        className="mt-0.5 flex-shrink-0"
                        aria-label={task.completed ? `Mark "${task.text}" as not done` : `Mark "${task.text}" as done`}
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Circle className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        {editingId === task.id ? (
                          <input
                            value={editText}
                            autoFocus
                            aria-label="Task name"
                            onChange={(event) => setEditText(event.target.value)}
                            onBlur={() => saveRename(task.id)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') saveRename(task.id);
                              if (event.key === 'Escape') setEditingId(null);
                            }}
                            className="w-full bg-input rounded px-1 text-sm border border-primary focus:outline-none"
                          />
                        ) : (
                          <span
                            onDoubleClick={() => {
                              setEditingId(task.id);
                              setEditText(task.text);
                            }}
                            title="Double-click to rename"
                            className={`block text-sm leading-snug hyphens-auto ${task.completed ? 'line-through text-muted-foreground' : ''}`}
                          >
                            {task.text}
                          </span>
                        )}
                        <div className="flex flex-wrap items-center gap-x-1.5 mt-1 text-xs text-muted-foreground">
                          <span className={`h-1.5 w-1.5 rounded-full ${energyDot[task.energyLevel]}`} title={`${task.energyLevel} energy`} />
                          <span className="tabular-nums">
                            {poms}/{task.estimatedPomodoros}
                          </span>
                          {task.originalDate && (
                            <span className="text-energy-medium">from {format(parseISO(task.originalDate), 'EEE')}</span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => onDeleteTask(task.id)}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity flex-shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={`Delete "${task.text}"`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}

                {/* Add box sits right under the day's tasks */}
                <div className="flex gap-1 pt-1">
                  <input
                    value={newTasks[dayKey] ?? ''}
                    onChange={(event) => setNewTasks((current) => ({ ...current, [dayKey]: event.target.value }))}
                    onKeyDown={(event) => event.key === 'Enter' && addTask(dayKey)}
                    placeholder="Add task"
                    aria-label={`Add task for ${format(day, 'EEEE')}`}
                    className="min-w-0 flex-1 bg-input border border-transparent rounded-md px-2 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                  <button
                    onClick={() => addTask(dayKey)}
                    aria-label={`Add task for ${format(day, 'EEEE')}`}
                    className="text-primary hover:bg-primary/15 rounded-md px-1.5 flex items-center justify-center"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
