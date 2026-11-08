import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Plus, Trash2, Circle, CheckCircle2, Play, RotateCcw, Timer,
  Edit2, Check, X, GripVertical, ChevronDown, ChevronRight
} from 'lucide-react';
import { EnergyBadge, EnergyPicker, PomDots, Stepper } from './controls';
import { plural, type EnergyLevel, type Task, type WorkSession } from '../state';

interface TodoListProps {
  todos: Task[];
  sessionsByTask: Map<string, WorkSession[]>;
  activeTaskId?: string;
  // 0-1 progress of the running focus session on the active task.
  activeProgress: number;
  energy: number;
  fitLevel: EnergyLevel;
  onAdd: (text: string, energyLevel: EnergyLevel, estimatedPomodoros: number) => void;
  onUpdate: (id: string, changes: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onMove: (draggedId: string, targetId: string) => void;
  onStartTask: (taskId: string) => void;
  onUndoPomodoro: (taskId: string) => void;
  onClearCompleted: () => void;
}

export function TodoList({
  todos,
  sessionsByTask,
  activeTaskId,
  activeProgress,
  energy,
  fitLevel,
  onAdd,
  onUpdate,
  onDelete,
  onMove,
  onStartTask,
  onUndoPomodoro,
  onClearCompleted
}: TodoListProps) {
  const [newTodo, setNewTodo] = useState('');
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>('medium');
  const [estimatedPomodoros, setEstimatedPomodoros] = useState(2);
  const [showDone, setShowDone] = useState(false);

  // Edit Mode State (energy, pomodoros, name)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editEnergy, setEditEnergy] = useState<EnergyLevel>('medium');
  const [editEstimated, setEditEstimated] = useState(2);

  // Inline rename on double-click
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  // Drag and Drop State
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  const addTodo = () => {
    const text = newTodo.trim();
    if (!text) return;
    onAdd(text, energyLevel, estimatedPomodoros);
    setNewTodo('');
    setEstimatedPomodoros(2);
  };

  const startEditing = (todo: Task) => {
    setRenamingId(null);
    setEditingId(todo.id);
    setEditText(todo.text);
    setEditEnergy(todo.energyLevel);
    setEditEstimated(todo.estimatedPomodoros);
  };

  const saveEditing = (id: string) => {
    if (!editText.trim()) return;
    onUpdate(id, { text: editText.trim(), energyLevel: editEnergy, estimatedPomodoros: editEstimated });
    setEditingId(null);
  };

  const saveRename = (id: string) => {
    const text = renameText.trim();
    if (text) onUpdate(id, { text });
    setRenamingId(null);
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const currentDraggedId = draggedTaskId;
    setDraggedTaskId(null);
    if (currentDraggedId && currentDraggedId !== targetId) onMove(currentDraggedId, targetId);
  };

  const openTodos = todos.filter((todo) => !todo.completed);
  const doneTodos = todos.filter((todo) => todo.completed);
  const fitCount = openTodos.filter((todo) => todo.energyLevel === fitLevel).length;
  // Dots share one width across rows so the energy badges line up in a column.
  const maxDots = Math.max(
    1,
    ...openTodos.map((todo) => Math.max(todo.estimatedPomodoros, (sessionsByTask.get(todo.id)?.length ?? 0) + 1))
  );

  return (
    // @container: rows switch to a stacked layout when the card itself is narrow.
    <div className="panel p-4 flex flex-col h-full min-h-0 @container">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 className="text-xl">Today's tasks</h2>
        {fitCount > 0 && (
          <span className="text-base text-muted-foreground text-right">
            Energy {energy}/5 · {fitLevel}-energy tasks highlighted
          </span>
        )}
      </div>

      {/* New task: everything on one row (wraps on narrow windows) */}
      <div className="flex flex-wrap items-center gap-2 mb-3 flex-shrink-0 text-lg">
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a task for today..."
          aria-label="New task"
          className="basis-full @[44rem]:basis-auto min-w-[10rem] flex-1 bg-input rounded-lg px-3 h-11 text-lg border border-border placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <EnergyPicker value={energyLevel} onChange={setEnergyLevel} />
        <div className="flex items-center gap-1.5" title="Estimated pomodoros">
          <Timer className="w-5 h-5 text-muted-foreground" />
          <Stepper size="lg" label="estimated pomodoros" value={estimatedPomodoros} max={12} onChange={setEstimatedPomodoros} />
        </div>
        <button
          type="button"
          onClick={addTodo}
          disabled={!newTodo.trim()}
          aria-label="Add task"
          className="bg-primary text-primary-foreground rounded-lg h-11 px-3 flex items-center gap-1 hover:opacity-90 text-lg font-semibold disabled:opacity-40"
        >
          <Plus className="w-6 h-6" />
          {/* Icon-only on narrower windows so the row doesn't wrap */}
          <span className="pr-1 [@media(max-width:1300px)]:hidden">Add</span>
        </button>
      </div>

      {/* Active Tasks List */}
      <div className="space-y-1.5 overflow-y-auto flex-1 min-h-0 pr-1">
        {openTodos.length === 0 ? (
          <div className="text-lg text-muted-foreground text-center py-8">
            {doneTodos.length > 0 ? 'All tasks for today are done!' : 'No tasks for today yet.'}
          </div>
        ) : (
          openTodos.map((todo) => {
            const isEditing = editingId === todo.id;
            const isRenaming = renamingId === todo.id;
            const isActive = activeTaskId === todo.id;
            const isFit = todo.energyLevel === fitLevel;
            const sessions = sessionsByTask.get(todo.id) ?? [];
            const lastSession = sessions[sessions.length - 1];
            const tags = (
              <>
                {todo.originalDate && (
                  <span className="text-base text-energy-medium bg-energy-medium/10 rounded px-1.5 flex-shrink-0">
                    from {format(parseISO(todo.originalDate), 'EEE')}
                  </span>
                )}
                {isFit && !isActive && <span className="text-base text-primary flex-shrink-0">Good fit</span>}
              </>
            );
            const progressDetails = (
              <>
                <EnergyBadge level={todo.energyLevel} />
                <span className="flex" style={{ minWidth: `${maxDots * 1.125}rem` }}>
                  <PomDots done={sessions.length} estimated={todo.estimatedPomodoros} current={isActive ? activeProgress : 0} />
                </span>
                <span className="tabular-nums w-11 text-right">
                  {sessions.length}/{todo.estimatedPomodoros}
                </span>
              </>
            );

            return (
              <div
                key={todo.id}
                draggable={!isEditing && !isRenaming}
                onDragStart={(e) => {
                  setDraggedTaskId(todo.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(e) => handleDrop(e, todo.id)}
                onDragEnd={() => setDraggedTaskId(null)}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 group border transition-all ${
                  draggedTaskId === todo.id ? 'opacity-40' : ''
                } ${
                  isActive
                    ? 'bg-primary/10 border-primary/60'
                    : isFit
                      ? 'bg-secondary border-primary/25'
                      : 'bg-secondary border-transparent'
                }`}
              >
                <div
                  className={`cursor-grab text-muted-foreground/60 hover:text-foreground ${
                    isEditing ? 'pointer-events-none opacity-30' : ''
                  }`}
                  title="Drag to reorder"
                >
                  <GripVertical className="w-6 h-6" />
                </div>

                <button
                  type="button"
                  onClick={() => onUpdate(todo.id, { completed: true })}
                  className="flex-shrink-0 text-muted-foreground hover:text-primary"
                  aria-label={`Mark "${todo.text}" as done`}
                  title="Mark as done"
                >
                  <Circle className="w-6 h-6" />
                </button>

                {/* Start sits right before the title; the active task shows a Working pill instead */}
                {isActive ? (
                  <span
                    className="h-10 px-3 rounded-lg bg-primary/20 text-primary flex items-center gap-1.5 flex-shrink-0 text-base font-semibold"
                    title="Working on this task"
                  >
                    <Timer className="w-5 h-5 animate-pulse" />
                    Working
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onStartTask(todo.id)}
                    className="bg-primary hover:opacity-90 rounded-lg h-10 w-10 flex items-center justify-center flex-shrink-0 text-primary-foreground"
                    aria-label={`Start working on "${todo.text}"`}
                    title="Start working on this task"
                  >
                    <Play className="w-5 h-5" />
                  </button>
                )}

                {isEditing ? (
                  <div className="flex-1 min-w-0 flex flex-col gap-2 p-2 bg-input rounded-lg border border-border">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEditing(todo.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      aria-label="Task name"
                      className="bg-input rounded-md px-2 py-1 text-lg border border-border w-full focus:outline-none focus:border-primary"
                      autoFocus
                    />

                    <div className="flex flex-wrap items-center gap-3 text-lg">
                      <EnergyPicker value={editEnergy} onChange={setEditEnergy} />
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">Pomodoros</span>
                        <Stepper size="lg" label="estimated pomodoros" value={editEstimated} max={12} onChange={setEditEstimated} />
                      </div>

                      {sessions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => onUndoPomodoro(todo.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-base bg-secondary hover:bg-muted"
                          title="Undo last completed pomodoro"
                        >
                          <RotateCcw className="w-4 h-4" />
                          Undo pom
                        </button>
                      )}

                      <div className="flex gap-1 ml-auto">
                        <button
                          type="button"
                          onClick={() => saveEditing(todo.id)}
                          className="p-1 bg-primary text-primary-foreground rounded-md hover:opacity-90"
                          aria-label="Save changes"
                          title="Save changes"
                        >
                          <Check className="w-6 h-6" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1 bg-muted rounded-md hover:bg-secondary"
                          aria-label="Cancel editing"
                          title="Cancel"
                        >
                          <X className="w-6 h-6" />
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      {isRenaming ? (
                        <input
                          value={renameText}
                          autoFocus
                          aria-label="Task name"
                          onChange={(e) => setRenameText(e.target.value)}
                          onBlur={() => saveRename(todo.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveRename(todo.id);
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          className="flex-1 min-w-0 bg-input rounded-md px-2 py-0.5 text-lg font-medium border border-primary focus:outline-none"
                        />
                      ) : (
                        <span
                          className="text-lg font-medium truncate"
                          title="Double-click to rename"
                          onDoubleClick={() => {
                            setRenamingId(todo.id);
                            setRenameText(todo.text);
                          }}
                        >
                          {todo.text}
                        </span>
                      )}
                      <span className="hidden @[44rem]:contents">{tags}</span>
                    </div>

                    {/* Narrow card: tags, energy and pomodoros move under the title */}
                    <div className="@[44rem]:hidden mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-base text-muted-foreground">
                      {tags}
                      {progressDetails}
                    </div>

                    {lastSession && (
                      <div className="mt-0.5 text-base text-muted-foreground">
                        Last session {format(new Date(lastSession.completedAt), 'h:mm a')}
                      </div>
                    )}
                  </div>
                )}

                {!isEditing && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Wide card: energy and pomodoro progress use the row's spare width */}
                    <div className="hidden @[44rem]:flex items-center gap-2.5 mr-2 text-base text-muted-foreground">
                      {progressDetails}
                    </div>
                    <button
                      type="button"
                      onClick={() => startEditing(todo)}
                      className="hover:bg-muted rounded-md h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label={`Edit "${todo.text}"`}
                      title="Edit energy, pomodoros and name"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(todo.id)}
                      className="rounded-md h-9 w-9 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label={`Delete "${todo.text}"`}
                      title="Delete task"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Done Today (collapsed by default to keep the list clean) */}
        {doneTodos.length > 0 && (
          <div className="pt-3">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDone((current) => !current)}
                aria-expanded={showDone}
                className="flex items-center gap-1 text-lg text-muted-foreground hover:text-foreground"
              >
                {showDone ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                Done today ({doneTodos.length})
              </button>
              <button
                type="button"
                onClick={onClearCompleted}
                className="text-lg text-muted-foreground hover:text-foreground"
                title="Remove completed tasks. Their pomodoros stay in Pom History."
              >
                Clear completed
              </button>
            </div>

            {showDone && (
              <div className="space-y-1 mt-2">
                {doneTodos.map((todo) => (
                  <div key={todo.id} className="flex items-center gap-2 rounded-lg px-3 py-2 bg-secondary/60 group">
                    <button
                      type="button"
                      onClick={() => onUpdate(todo.id, { completed: false })}
                      className="flex-shrink-0"
                      aria-label={`Mark "${todo.text}" as not done`}
                      title="Mark as not done"
                    >
                      <CheckCircle2 className="w-6 h-6 text-primary" />
                    </button>
                    <span className="text-lg flex-1 min-w-0 truncate line-through text-muted-foreground">
                      {todo.text}
                    </span>
                    <span className="text-base text-muted-foreground">
                      {plural(sessionsByTask.get(todo.id)?.length ?? 0, 'pom')}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDelete(todo.id)}
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity flex-shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete "${todo.text}"`}
                      title="Delete task"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
