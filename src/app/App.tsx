import { TodoList } from './components/TodoList';
import { EnergyPlanner } from './components/EnergyPlanner';
import { WaterTracker } from './components/WaterTracker';
import { FoodTracker } from './components/FoodTracker';
import { PomodoroTimer } from './components/PomodoroTimer';
import { PomodoroHistory } from './components/PomodoroHistory';
import { WeekPlanner } from './components/WeekPlanner';
import { BackgroundDecoration } from './components/BackgroundDecoration';
import { Logo } from './components/Logo';
import {
  createId,
  createTask,
  energyFit,
  formatMinutes,
  loadState,
  normalizeState,
  rollOverTasks,
  saveState,
  toDateKey,
  type AppState,
  type EnergyLevel,
  type Feeling,
  type Meal,
  type MealReminder,
  type Task,
  type ThemePreference,
  type WaterState,
  type WorkSession
} from './state';
import { CalendarDays, Heart, ListChecks, Monitor, Moon, Sparkles, Sun } from 'lucide-react';
import { useTheme } from './theme';
import { isToday } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';

type ActiveTab = 'checkins' | 'work' | 'week';
type Work = AppState['work'];

const DATE_CHECK_INTERVAL_MS = 60_000;
const UNDO_TIMEOUT_MS = 6_000;

const themeOptions = [
  { id: 'system' as const, label: 'Match system', icon: Monitor },
  { id: 'light' as const, label: 'Light', icon: Sun },
  { id: 'dark' as const, label: 'Dark', icon: Moon }
];

const tabs = [
  { id: 'checkins' as const, label: 'Check-ins', icon: Heart },
  { id: 'work' as const, label: 'Work', icon: ListChecks },
  { id: 'week' as const, label: 'Week Planner', icon: CalendarDays }
];

// Tracks the current day so rollover and "today" views update when the app stays open past midnight.
function useTodayKey() {
  const [todayKey, setTodayKey] = useState(() => toDateKey(new Date()));

  useEffect(() => {
    const check = () => setTodayKey(toDateKey(new Date()));
    const interval = window.setInterval(check, DATE_CHECK_INTERVAL_MS);
    window.addEventListener('focus', check);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', check);
    };
  }, []);

  return todayKey;
}

export default function App() {
  const todayKey = useTodayKey();
  const [state, setState] = useState<AppState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('checkins');
  const [activeTaskId, setActiveTaskId] = useState<string>();
  const [focusProgress, setFocusProgress] = useState(0);
  const [deletedTask, setDeletedTask] = useState<{ task: Task; index: number } | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadState()
      .then((raw) => {
        if (!cancelled) setState(normalizeState(raw, toDateKey(new Date())));
      })
      .catch((error) => {
        // Never fall back to defaults here: saving them would overwrite the user's data file.
        if (!cancelled) setLoadError(String(error));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (state) saveState(state);
  }, [state]);

  useTheme(state?.settings.theme);

  const setTheme = (theme: ThemePreference) => {
    setState((current) => current && { ...current, settings: { ...current.settings, theme } });
  };

  useEffect(() => {
    if (!deletedTask) return;
    const timeout = window.setTimeout(() => setDeletedTask(null), UNDO_TIMEOUT_MS);
    return () => window.clearTimeout(timeout);
  }, [deletedTask]);

  const updateWork = useCallback((update: (work: Work) => Work) => {
    setState((current) => current && { ...current, work: update(current.work) });
  }, []);

  const updateTasks = useCallback(
    (update: (tasks: Task[]) => Task[]) => updateWork((work) => ({ ...work, tasks: update(work.tasks) })),
    [updateWork]
  );

  useEffect(() => {
    setState((current) => {
      if (!current) return current;
      const tasks = rollOverTasks(current.work.tasks, todayKey);
      return tasks === current.work.tasks ? current : { ...current, work: { ...current.work, tasks } };
    });
  }, [todayKey]);

  const setWater = useCallback((water: WaterState) => {
    setState((current) => current && { ...current, checkins: { ...current.checkins, water } });
  }, []);

  const setMeals = useCallback((meals: Meal[]) => {
    setState((current) => current && { ...current, checkins: { ...current.checkins, meals } });
  }, []);

  const setMealReminder = useCallback((mealReminder: MealReminder) => {
    setState((current) => current && { ...current, checkins: { ...current.checkins, mealReminder } });
  }, []);

  const setFeeling = useCallback(
    (feeling: Feeling) =>
      setState(
        (current) =>
          current && {
            ...current,
            checkins: { ...current.checkins, feelings: { ...current.checkins.feelings, [todayKey]: feeling } }
          }
      ),
    [todayKey]
  );

  const setEnergy = useCallback((energy: number) => {
    setState((current) => current && { ...current, checkins: { ...current.checkins, energy } });
  }, []);

  const addTask = useCallback(
    (text: string, date: string, energyLevel?: EnergyLevel, estimatedPomodoros?: number) =>
      updateTasks((tasks) => [...tasks, createTask(text, date, energyLevel, estimatedPomodoros)]),
    [updateTasks]
  );

  const updateTask = useCallback(
    (id: string, changes: Partial<Task>) =>
      updateTasks((tasks) => tasks.map((task) => (task.id === id ? { ...task, ...changes } : task))),
    [updateTasks]
  );

  const deleteTask = useCallback(
    (id: string) => {
      const index = state?.work.tasks.findIndex((task) => task.id === id) ?? -1;
      if (index === -1 || !state) return;
      setDeletedTask({ task: state.work.tasks[index], index });
      updateTasks((tasks) => tasks.filter((task) => task.id !== id));
    },
    [state, updateTasks]
  );

  const undoDelete = () => {
    if (!deletedTask) return;
    const { task, index } = deletedTask;
    updateTasks((tasks) => [...tasks.slice(0, index), task, ...tasks.slice(index)]);
    setDeletedTask(null);
  };

  // Moves a task to a day, optionally next to another task. Moving by hand clears the rollover tag.
  const moveTask = useCallback(
    (id: string, date: string, targetId?: string) =>
      updateTasks((tasks) => {
        const fromIndex = tasks.findIndex((task) => task.id === id);
        if (fromIndex === -1) return tasks;

        const original = tasks[fromIndex];
        const moved = original.date === date ? original : { ...original, date, originalDate: undefined };
        const targetIndex = targetId ? tasks.findIndex((task) => task.id === targetId) : -1;
        const remaining = tasks.filter((task) => task.id !== id);

        if (targetIndex === -1) {
          return original.date === date ? tasks : [...remaining, moved];
        }

        // Dragging down within a day lands after the target; otherwise before it.
        const insertAfter = original.date === date && fromIndex < targetIndex;
        const position = remaining.findIndex((task) => task.id === targetId) + (insertAfter ? 1 : 0);
        return [...remaining.slice(0, position), moved, ...remaining.slice(position)];
      }),
    [updateTasks]
  );

  const clearCompleted = useCallback(
    () => updateTasks((tasks) => tasks.filter((task) => !task.completed)),
    [updateTasks]
  );

  const completePomodoro = useCallback(
    (taskId: string, durationMinutes: number, note?: string, isTaskComplete?: boolean) => {
      updateWork((work) => {
        const task = work.tasks.find((item) => item.id === taskId);
        if (!task) return work;

        const session: WorkSession = {
          id: createId(),
          taskId,
          taskName: task.text,
          completedAt: new Date().toISOString(),
          durationMinutes,
          note
        };

        return {
          tasks: isTaskComplete
            ? work.tasks.map((item) => (item.id === taskId ? { ...item, completed: true } : item))
            : work.tasks,
          sessions: [...work.sessions, session]
        };
      });

      if (isTaskComplete) setActiveTaskId(undefined);
    },
    [updateWork]
  );

  const undoPomodoro = useCallback(
    (taskId: string) =>
      updateWork((work) => {
        const lastIndex = work.sessions.map((session) => session.taskId).lastIndexOf(taskId);
        if (lastIndex === -1) return work;
        return { ...work, sessions: work.sessions.filter((_, index) => index !== lastIndex) };
      }),
    [updateWork]
  );

  const cancelPomodoro = useCallback(() => setActiveTaskId(undefined), []);

  const tasks = state?.work.tasks ?? [];
  const sessions = state?.work.sessions ?? [];

  const sessionsByTask = useMemo(() => {
    const grouped = new Map<string, WorkSession[]>();
    for (const session of sessions) {
      grouped.set(session.taskId, [...(grouped.get(session.taskId) ?? []), session]);
    }
    return grouped;
  }, [sessions]);

  const todaysTasks = useMemo(() => tasks.filter((task) => task.date === todayKey), [tasks, todayKey]);
  const todaysSessions = useMemo(
    () => sessions.filter((session) => isToday(new Date(session.completedAt))),
    // todayKey is listed so the filter reruns at midnight.
    [sessions, todayKey]
  );
  const activeTask = todaysTasks.find((task) => task.id === activeTaskId && !task.completed);

  if (loadError) {
    return (
      <div className="h-screen bg-background text-foreground flex items-center justify-center p-6 text-center">
        <p className="text-sm">
          Your saved data couldn't be loaded, so nothing was changed.
          <br />
          <span className="text-muted-foreground">{loadError}</span>
        </p>
      </div>
    );
  }

  if (!state) {
    return <div className="h-screen bg-background" />;
  }

  const { water, meals, energy, feelings, mealReminder } = state.checkins;
  const todaysMealsCount = meals.filter((meal) => isToday(new Date(meal.time))).length;
  const todaysWaterGlasses = water.date === new Date().toDateString() ? Math.max(water.glasses, 0) : 0;
  const doneToday = todaysTasks.filter((task) => task.completed).length;
  const focusMinutesToday = todaysSessions.reduce((total, session) => total + session.durationMinutes, 0);

  const overview = [
    { label: 'Tasks done', value: `${doneToday} / ${todaysTasks.length}` },
    { label: 'Focus', value: `${todaysSessions.length} poms`, detail: formatMinutes(focusMinutesToday) },
    { label: 'Water', value: `${todaysWaterGlasses} / ${water.goal}`, detail: 'glasses' },
    { label: 'Meals', value: String(todaysMealsCount), detail: 'logged' }
  ];

  return (
    <div className="h-screen bg-background text-foreground relative overflow-hidden flex flex-col">
      <BackgroundDecoration />
      <div className="relative z-10 flex flex-col h-full w-full max-w-[1600px] mx-auto px-5 py-4">
        <header className="mb-4 flex-shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            {/* Sits directly on the dark artwork in both themes */}
            <h1 className="text-xl text-white drop-shadow-[0_1px_8px_rgba(0,0,0,0.65)]">MyDay</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="panel p-1 flex gap-0.5" role="radiogroup" aria-label="Theme">
              {themeOptions.map((option) => (
                <button
                  key={option.id}
                  role="radio"
                  aria-checked={state.settings.theme === option.id}
                  aria-label={option.label}
                  title={option.label}
                  onClick={() => setTheme(option.id)}
                  className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${
                    state.settings.theme === option.id
                      ? 'bg-secondary text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <option.icon className="w-4 h-4" />
                </button>
              ))}
            </div>
            <nav className="panel p-1 flex gap-1" aria-label="Sections">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-current={activeTab === tab.id ? 'page' : undefined}
                  className={`h-8 px-3 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </header>

        <main className="flex-1 min-h-0">
          {/* Check-ins Tab */}
          <div className={activeTab === 'checkins' ? 'h-full min-h-0 flex flex-col gap-3 overflow-y-auto' : 'hidden'}>
            {/* Today's Summary Banner */}
            <section className="panel p-5 flex-shrink-0" aria-label="Today's overview">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="text-lg">Today's Overview</h2>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {overview.map((item) => (
                  <div key={item.label} className="bg-secondary rounded-lg px-4 py-3">
                    <div className="text-sm text-muted-foreground mb-0.5">{item.label}</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-primary tabular-nums">{item.value}</span>
                      {item.detail && <span className="text-base text-muted-foreground">{item.detail}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Main Trackers & History Grid */}
            <div className="flex-1 min-h-[600px] grid grid-cols-3 gap-3">
              <EnergyPlanner
                energy={energy}
                onEnergyChange={setEnergy}
                feeling={feelings[todayKey] ?? { physical: '', mental: '' }}
                onFeelingChange={setFeeling}
                openTasks={todaysTasks.filter((task) => !task.completed)}
              />
              {/* Water sizes to its content; Meals takes the rest of the column */}
              <div className="flex flex-col gap-3 min-h-0">
                <WaterTracker water={water} onWaterChange={setWater} />
                <div className="flex-1 min-h-[240px]">
                  <FoodTracker
                    meals={meals}
                    onMealsChange={setMeals}
                    reminder={mealReminder}
                    onReminderChange={setMealReminder}
                  />
                </div>
              </div>
              <PomodoroHistory sessions={sessions} tasks={tasks} />
            </div>
          </div>

          {/* Work Tab */}
          <div className={activeTab === 'work' ? 'h-full min-h-0' : 'hidden'}>
            <div className="grid grid-cols-[minmax(340px,45fr)_minmax(0,55fr)] gap-3 h-full min-h-0">
              <PomodoroTimer
                activeTaskId={activeTask?.id}
                activeTaskName={activeTask?.text}
                estimatedPomodoros={activeTask?.estimatedPomodoros}
                completedPomodoros={activeTask ? sessionsByTask.get(activeTask.id)?.length : undefined}
                todayPomodoros={todaysSessions.length}
                onPomodoroComplete={completePomodoro}
                onCancelSession={cancelPomodoro}
                onFocusProgress={setFocusProgress}
              />

              <TodoList
                todos={todaysTasks}
                sessionsByTask={sessionsByTask}
                activeTaskId={activeTask?.id}
                activeProgress={focusProgress}
                energy={energy}
                fitLevel={energyFit(energy)}
                onAdd={(text, energyLevel, estimatedPomodoros) =>
                  addTask(text, todayKey, energyLevel, estimatedPomodoros)
                }
                onUpdate={updateTask}
                onDelete={deleteTask}
                onMove={(draggedId, targetId) => moveTask(draggedId, todayKey, targetId)}
                onStartTask={setActiveTaskId}
                onUndoPomodoro={undoPomodoro}
                onClearCompleted={clearCompleted}
              />
            </div>
          </div>

          {/* Week Planner Tab */}
          <div className={activeTab === 'week' ? 'h-full min-h-0' : 'hidden'}>
            <WeekPlanner
              tasks={tasks}
              sessionsByTask={sessionsByTask}
              todayKey={todayKey}
              onAddTask={(text, date) => addTask(text, date)}
              onUpdateTask={updateTask}
              onMoveTask={moveTask}
              onDeleteTask={deleteTask}
              onClearCompleted={clearCompleted}
            />
          </div>
        </main>
      </div>

      {/* Undo toast for deleted tasks */}
      {deletedTask && (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-xl border border-border bg-raised px-4 py-2.5 shadow-xl text-sm"
        >
          <span className="max-w-72 truncate">Deleted "{deletedTask.task.text}"</span>
          <button onClick={undoDelete} className="font-semibold text-primary hover:underline">
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
