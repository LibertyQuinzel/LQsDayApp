import { useState, useEffect } from 'react';
import { Utensils, Plus, Trash2, Bell } from 'lucide-react';
import { Switch } from './controls';
import { CookingPot, type PotState } from './CookingPot';
import { addDays, format, isToday, parseISO } from 'date-fns';
import { showAppNotification } from '../utils/notifications';
import { createId, formatMinutes, toDateKey, type Meal, type MealReminder } from '../state';

const REMINDER_CHECK_MS = 15_000;
// After the reminder time, the pot stays open (and a missed notification can still fire) for this long.
// Then the reminder switches itself off.
const READY_DURATION_MS = 60 * 60 * 1000;

// The given day (yyyy-MM-dd, default today) at an "HH:mm" time.
function dayAt(time: string, dateKey?: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const date = dateKey ? parseISO(dateKey) : new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

// The next occurrence of a time: today if it's still ahead, otherwise tomorrow.
function nextOccurrence(time: string) {
  const today = dayAt(time);
  return toDateKey(today.getTime() > Date.now() ? today : addDays(today, 1));
}

interface FoodTrackerProps {
  meals: Meal[];
  onMealsChange: (meals: Meal[]) => void;
  reminder: MealReminder;
  onReminderChange: (reminder: MealReminder) => void;
}

export function FoodTracker({ meals, onMealsChange, reminder, onReminderChange }: FoodTrackerProps) {
  const [mealName, setMealName] = useState('');
  // null means "now": the box shows the current time until the user picks another.
  const [mealTime, setMealTime] = useState<string | null>(null);

  const [now, setNow] = useState(() => Date.now());

  const todaysMeals = meals
    .filter((meal) => isToday(new Date(meal.time)))
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const dueAt = dayAt(reminder.time, reminder.date ?? undefined).getTime();
  // Only a meal at or after the reminder time answers it; earlier meals don't cancel a reminder you set.
  const ateForReminder = meals.some((meal) => new Date(meal.time).getTime() >= dueAt);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), REMINDER_CHECK_MS);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!reminder.enabled) return;

    const currentTime = Date.now();
    const shouldNotify =
      !reminder.notified && !ateForReminder && currentTime >= dueAt && currentTime < dueAt + READY_DURATION_MS;
    if (shouldNotify) {
      showAppNotification({ title: 'Meal Reminder', body: "It's time for your scheduled meal!" });
    }

    // One-time reminder: done once a meal is logged for it or the open-lid hour is over.
    if (ateForReminder || currentTime >= dueAt + READY_DURATION_MS) {
      onReminderChange({ ...reminder, enabled: false, notified: false });
    } else if (shouldNotify) {
      onReminderChange({ ...reminder, notified: true });
    }
  }, [now, dueAt, ateForReminder, reminder, onReminderChange]);

  const potState: PotState = !reminder.enabled ? 'off' : now < dueAt ? 'cooking' : 'ready';
  const minutesLeft = Math.max(1, Math.ceil((dueAt - now) / 60000));
  const reminderTimeLabel = format(new Date(dueAt), 'h:mm a');
  const potStatus = {
    off: { title: 'No reminder set', detail: 'Turn on for a one-time nudge at mealtime' },
    cooking: {
      title: `Meal in ${formatMinutes(minutesLeft)}`,
      detail: `Reminder ${isToday(dueAt) ? 'at' : 'tomorrow at'} ${reminderTimeLabel}`
    },
    ready: { title: 'Time to eat!', detail: 'Log your meal below' }
  }[potState];

  const handleAddMeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mealName.trim()) return;

    const time = (mealTime ? dayAt(mealTime) : new Date()).toISOString();
    onMealsChange([{ id: createId(), name: mealName.trim(), time }, ...meals]);
    setMealName('');
    setMealTime(null);
  };

  const handleMealTimeChange = (id: string, time: string) => {
    if (!time) return;
    onMealsChange(meals.map((meal) => (meal.id === id ? { ...meal, time: dayAt(time).toISOString() } : meal)));
  };

  const handleDeleteMeal = (id: string) => {
    onMealsChange(meals.filter((m) => m.id !== id));
  };

  return (
    <div className="panel p-5 h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Utensils className="w-5 h-5 text-primary" />
          <h2 className="text-lg">Meals</h2>
        </div>
        <span className="text-base font-semibold text-muted-foreground">{todaysMeals.length} today</span>
      </div>

      {/* Reminder: the pot simmers until mealtime, then opens with steam */}
      <div className="flex items-center gap-6 mb-3 bg-secondary rounded-lg py-3 pl-2 pr-3 flex-shrink-0">
        <CookingPot state={potState} label={potStatus.title} />
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold leading-tight">{potStatus.title}</div>
          <div className="text-sm text-muted-foreground mt-0.5">{potStatus.detail}</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-base">
            <Switch
              label="Daily meal reminder"
              checked={reminder.enabled}
              onChange={(enabled) =>
                onReminderChange(
                  enabled
                    ? { ...reminder, enabled, date: nextOccurrence(reminder.time), notified: false }
                    : { ...reminder, enabled }
                )
              }
            />
            <span className={`flex items-center gap-1.5 whitespace-nowrap ${reminder.enabled ? '' : 'text-muted-foreground'}`}>
              <Bell className="w-4 h-4 flex-shrink-0" />
              At
            </span>
            <input
              type="time"
              aria-label="Meal reminder time"
              value={reminder.time}
              disabled={!reminder.enabled}
              onChange={(e) =>
                e.target.value &&
                onReminderChange({ ...reminder, time: e.target.value, date: nextOccurrence(e.target.value), notified: false })
              }
              className="bg-input border border-border rounded-md px-1.5 py-0.5 focus:outline-none focus:border-primary disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Scrollable Meals List */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 pr-1">
        {todaysMeals.length === 0 ? (
          <div className="h-full min-h-16 flex items-center justify-center text-base text-muted-foreground">
            No meals logged today
          </div>
        ) : (
          todaysMeals.map((meal) => (
            <div key={meal.id} className="bg-secondary rounded-lg px-3 py-2 flex items-center justify-between gap-2 group">
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium truncate">{meal.name}</p>
                <label className="text-sm text-muted-foreground flex items-center mt-0.5 w-fit">
                  <input
                    type="time"
                    value={format(new Date(meal.time), 'HH:mm')}
                    onChange={(e) => handleMealTimeChange(meal.id, e.target.value)}
                    aria-label={`Time of ${meal.name}`}
                    title="Change time"
                    className="bg-transparent rounded px-0.5 -mx-0.5 hover:bg-muted focus:bg-input focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteMeal(meal.id)}
                className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-muted-foreground hover:text-destructive transition-opacity flex-shrink-0 p-1"
                aria-label={`Delete ${meal.name}`}
                title="Delete meal"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleAddMeal} className="flex gap-2 mt-3 flex-shrink-0">
        <input
          type="text"
          value={mealName}
          onChange={(e) => setMealName(e.target.value)}
          placeholder="Log a meal..."
          aria-label="Meal name"
          className="min-w-0 flex-1 bg-input border border-border rounded-lg px-3 h-10 text-base placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <input
          type="time"
          value={mealTime ?? format(new Date(), 'HH:mm')}
          onChange={(e) => setMealTime(e.target.value || null)}
          aria-label="Time you had the meal"
          title="Time you had the meal"
          className="w-28 flex-shrink-0 bg-input border border-border rounded-lg px-2 h-10 text-base focus:outline-none focus:border-primary"
        />
        <button
          type="submit"
          aria-label="Log meal"
          className="h-10 w-10 bg-primary text-primary-foreground rounded-lg flex items-center justify-center hover:opacity-90 transition flex-shrink-0 active:scale-95"
        >
          <Plus className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
