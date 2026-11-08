import { format } from 'date-fns';

export type EnergyLevel = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  text: string;
  // Day the task is planned for (yyyy-MM-dd). Today's tasks are the Work tab.
  date: string;
  completed: boolean;
  energyLevel: EnergyLevel;
  estimatedPomodoros: number;
  // Day the task was planned for before it rolled over; cleared when moved by hand.
  originalDate?: string;
}

// Sessions are stored apart from tasks so clearing or deleting a task keeps its history.
export interface WorkSession {
  id: string;
  taskId: string;
  taskName: string;
  completedAt: string;
  durationMinutes: number;
  note?: string;
}

export interface WaterState {
  glasses: number;
  lastDrink: string | null;
  reminderMinutes: number;
  // When off, the reminder timer still runs but no notification is shown.
  notify: boolean;
  goal: number;
  lastReminderAt: string | null;
  date?: string;
}

export interface Meal {
  id: string;
  name: string;
  time: string;
}

// How someone feels on a given day, in their own words.
export interface Feeling {
  physical: string;
  mental: string;
}

// A one-time reminder: it switches itself off once it has passed.
export interface MealReminder {
  enabled: boolean;
  time: string;
  // Day (yyyy-MM-dd) the reminder is set for; chosen when it's switched on or its time changes.
  date: string | null;
  notified: boolean;
}

export type ThemePreference = 'system' | 'light' | 'dark';

export interface AppState {
  version: 2;
  settings: {
    theme: ThemePreference;
  };
  checkins: {
    water: WaterState;
    meals: Meal[];
    energy: number;
    // Keyed by day (yyyy-MM-dd) so each day starts blank and past entries are kept.
    feelings: Record<string, Feeling>;
    mealReminder: MealReminder;
  };
  work: {
    tasks: Task[];
    sessions: WorkSession[];
  };
}

const BROWSER_STORAGE_KEY = 'myday:state';

export const toDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

export const createId = () => crypto.randomUUID();

export function createTask(
  text: string,
  date: string,
  energyLevel: EnergyLevel = 'medium',
  estimatedPomodoros = 2
): Task {
  return { id: createId(), text, date, completed: false, energyLevel, estimatedPomodoros };
}

// Unfinished tasks from past days move to today; finished ones stay on their day.
export function rollOverTasks(tasks: Task[], todayKey: string) {
  if (!tasks.some((task) => !task.completed && task.date < todayKey)) return tasks;
  return tasks.map((task) =>
    !task.completed && task.date < todayKey
      ? { ...task, date: todayKey, originalDate: task.originalDate ?? task.date }
      : task
  );
}

// Which task energy level suits a 1-5 energy check-in.
export function energyFit(energy: number): EnergyLevel {
  if (energy <= 2) return 'low';
  if (energy === 3) return 'medium';
  return 'high';
}

export const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

function toIsoString(value: unknown) {
  if (!value) return null;
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function defaultState(todayKey: string): AppState {
  return {
    version: 2,
    settings: { theme: 'system' },
    checkins: {
      water: { glasses: 0, lastDrink: null, reminderMinutes: 40, notify: true, goal: 8, lastReminderAt: null },
      meals: [],
      energy: 3,
      feelings: {},
      mealReminder: { enabled: false, time: '12:30', date: null, notified: false }
    },
    work: {
      tasks: [
        createTask('Morning meditation', todayKey, 'low', 1),
        createTask('Work on project presentation', todayKey, 'high', 4),
        createTask('Light walk', todayKey, 'low', 1)
      ],
      sessions: []
    }
  };
}

export function normalizeState(raw: any, todayKey: string): AppState {
  if (!raw) return defaultState(todayKey);

  const defaults = defaultState(todayKey);
  const water = raw.checkins?.water ?? {};

  const tasks: Task[] = (raw.work?.tasks ?? []).map((task: any) => ({
    id: String(task.id),
    text: String(task.text ?? ''),
    date: typeof task.date === 'string' ? task.date : todayKey,
    completed: Boolean(task.completed),
    energyLevel: task.energyLevel ?? 'medium',
    estimatedPomodoros: Math.max(1, Number(task.estimatedPomodoros) || 1),
    originalDate: typeof task.originalDate === 'string' ? task.originalDate : undefined
  }));

  return {
    version: 2,
    settings: {
      theme: ['system', 'light', 'dark'].includes(raw.settings?.theme) ? raw.settings.theme : 'system'
    },
    checkins: {
      water: {
        ...defaults.checkins.water,
        glasses: Number(water.glasses) || 0,
        reminderMinutes: Number(water.reminderMinutes) || defaults.checkins.water.reminderMinutes,
        notify: water.notify !== false,
        goal: Number(water.goal) || defaults.checkins.water.goal,
        date: water.date,
        lastDrink: toIsoString(water.lastDrink),
        lastReminderAt: toIsoString(water.lastReminderAt)
      },
      meals: (raw.checkins?.meals ?? []).map((meal: any) => ({
        id: String(meal.id),
        name: String(meal.name ?? ''),
        time: toIsoString(meal.time) ?? new Date().toISOString()
      })),
      energy: Number(raw.checkins?.energy) || defaults.checkins.energy,
      feelings: Object.fromEntries(
        Object.entries(raw.checkins?.feelings ?? {}).map(([day, feeling]: [string, any]) => [
          day,
          { physical: String(feeling?.physical ?? ''), mental: String(feeling?.mental ?? '') }
        ])
      ),
      mealReminder: {
        enabled: Boolean(raw.checkins?.mealReminder?.enabled),
        time: raw.checkins?.mealReminder?.time ?? defaults.checkins.mealReminder.time,
        date: typeof raw.checkins?.mealReminder?.date === 'string' ? raw.checkins.mealReminder.date : null,
        notified: Boolean(raw.checkins?.mealReminder?.notified)
      }
    },
    work: {
      tasks: rollOverTasks(tasks, todayKey),
      sessions: (raw.work?.sessions ?? []).filter((session: any) => toIsoString(session.completedAt))
    }
  };
}

// The desktop app persists through Electron; a plain browser (vite dev) falls back to localStorage.
export async function loadState(): Promise<unknown> {
  if (window.myDay) return window.myDay.readState();

  try {
    const raw = localStorage.getItem(BROWSER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveState(state: AppState) {
  if (window.myDay) {
    window.myDay.writeState(state);
    return;
  }

  try {
    localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Browser storage unavailable; the session simply won't persist.
  }
}
