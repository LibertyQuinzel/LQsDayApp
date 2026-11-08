import { useEffect, useMemo, useState } from 'react';
import { Droplet, Plus, Minus } from 'lucide-react';
import { showAppNotification } from '../utils/notifications';
import { Stepper, Switch } from './controls';
import type { WaterState } from '../state';

interface WaterTrackerProps {
  water: WaterState;
  onWaterChange: (water: WaterState) => void;
}

export function WaterTracker({ water, onWaterChange }: WaterTrackerProps) {
  const { glasses, goal, lastDrink, reminderMinutes, notify, lastReminderAt, date } = water;
  const [now, setNow] = useState(() => Date.now());
  const [reminderInput, setReminderInput] = useState(String(reminderMinutes));

  const todayStr = new Date().toDateString();
  const displayGlasses = date === todayStr ? Math.max(glasses, 0) : 0;
  const goalProgress = Math.min(displayGlasses / goal, 1);

  useEffect(() => {
    const currentToday = new Date().toDateString();
    if (date !== currentToday) {
      onWaterChange({ ...water, glasses: 0, date: currentToday });
    }
  }, [date, water, onWaterChange]);

  const parsedLastDrink = lastDrink ? new Date(lastDrink) : null;
  const isLastDrinkToday = parsedLastDrink ? parsedLastDrink.toDateString() === todayStr : false;

  const reminderMs = reminderMinutes * 60 * 1000;

  const reminderAnchor = useMemo(() => {
    const drinkTime = lastDrink ? new Date(lastDrink).getTime() : null;
    const reminderTime = lastReminderAt ? new Date(lastReminderAt).getTime() : null;
    const timestamps = [drinkTime, reminderTime].filter(
      (timestamp): timestamp is number => typeof timestamp === 'number' && !isNaN(timestamp)
    );

    return timestamps.length ? Math.max(...timestamps) : null;
  }, [lastDrink, lastReminderAt]);

  const reminderProgress = reminderAnchor && reminderMs > 0
    ? Math.min(Math.max((now - reminderAnchor) / reminderMs, 0), 1)
    : 0;

  // Commit on blur/Enter so typing a multi-digit value isn't clamped mid-keystroke.
  const commitReminderMinutes = (value: string) => {
    const nextValue = Math.min(Math.max(Math.round(Number(value)) || 10, 10), 180);
    setReminderInput(String(nextValue));
    onWaterChange({ ...water, reminderMinutes: nextValue });
  };

  useEffect(() => {
    if (reminderMinutes <= 0) return;

    const checkReminder = () => {
      const currentTime = Date.now();
      setNow(currentTime);

      if (!reminderAnchor) {
        onWaterChange({ ...water, lastReminderAt: new Date(currentTime).toISOString() });
        return;
      }

      // With notifications off, the glass simply stays full until the next drink.
      if (!notify || currentTime < reminderAnchor + reminderMs) return;

      showAppNotification({ title: 'Hydration Reminder', body: 'Time to drink some water!' });
      onWaterChange({ ...water, lastReminderAt: new Date(currentTime).toISOString() });
    };

    checkReminder();
    window.addEventListener('focus', checkReminder);
    document.addEventListener('visibilitychange', checkReminder);
    const timer = window.setInterval(checkReminder, 1000);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', checkReminder);
      document.removeEventListener('visibilitychange', checkReminder);
    };
  }, [notify, onWaterChange, reminderAnchor, reminderMinutes, reminderMs, water]);

  const addGlass = () => {
    const drinkTime = new Date();

    onWaterChange({
      ...water,
      glasses: displayGlasses + 1,
      date: drinkTime.toDateString(),
      lastDrink: drinkTime.toISOString(),
      lastReminderAt: null
    });
    setNow(drinkTime.getTime());
  };

  // Undo a mistaken tap; keeps the reminder timing as is.
  const removeGlass = () => {
    onWaterChange({ ...water, glasses: Math.max(displayGlasses - 1, 0), date: todayStr });
  };

  const minutesUntilReminder = reminderAnchor
    ? Math.max(0, Math.ceil((reminderAnchor + reminderMs - now) / 60000))
    : reminderMinutes;

  const lastDrinkLabel =
    parsedLastDrink && isLastDrinkToday
      ? parsedLastDrink.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;

  return (
    <div className="panel p-5 flex flex-col gap-4">
      {/* Header: title + daily goal setting */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Droplet className="w-5 h-5 text-primary" />
          <h2 className="text-lg">Water</h2>
        </div>
        <div className="flex items-center gap-2.5 text-base">
          Daily goal
          <Stepper size="lg" label="daily water goal" value={goal} min={1} max={20} onChange={(value) => onWaterChange({ ...water, goal: value })} />
        </div>
      </div>

      <div className="flex gap-5">
        {/* The glass fills as the reminder timer runs; full means it's time to drink */}
        <div
          className="relative h-52 w-24 xl:w-28 flex-shrink-0 rounded-b-3xl rounded-t-lg border-[3px] border-primary/40 bg-primary/5 overflow-hidden"
          role="img"
          aria-label={`Next drink in ${minutesUntilReminder} minutes`}
        >
          <div
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-blue-600 via-blue-500 to-cyan-300 transition-[height] duration-1000 ease-linear"
            style={{ height: `${Math.round(reminderProgress * 100)}%` }}
          >
            <div className="absolute -top-1.5 left-0 h-4 w-[200%] bg-white/35 rounded-[50%] animate-[water-wave_2.4s_linear_infinite]" />
          </div>
          <div className="absolute left-2 top-3 bottom-6 w-1.5 rounded-full bg-white/15" />
          {/* Countdown on a translucent pill so it reads over both the water and the empty glass */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-lg bg-black/40 px-2 py-1 text-center text-white backdrop-blur-sm">
              <div className="text-2xl font-bold tabular-nums leading-none">
                {minutesUntilReminder > 0 ? `${minutesUntilReminder}m` : 'Now'}
              </div>
              <div className="text-[0.7rem] leading-tight mt-0.5 opacity-90">
                {minutesUntilReminder > 0 ? 'next drink' : 'time to drink'}
              </div>
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1 flex flex-col">
          {/* Today's progress and logging */}
          <div className="text-3xl font-bold text-primary tabular-nums leading-tight">
            {displayGlasses}
            <span className="text-lg font-semibold text-muted-foreground"> / {goal} glasses</span>
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {lastDrinkLabel ? `Last glass ${lastDrinkLabel}` : 'No glasses yet today'}
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden mt-2.5">
            <div className="h-full bg-primary transition-all" style={{ width: `${goalProgress * 100}%` }} />
          </div>
          <div className="flex gap-1.5 mt-3 mb-3">
            <button
              onClick={removeGlass}
              disabled={displayGlasses === 0}
              aria-label="Remove a glass"
              title="Remove a glass"
              className="h-8 w-8 bg-secondary hover:bg-muted rounded-lg flex items-center justify-center disabled:opacity-40"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              onClick={addGlass}
              className="h-8 px-3 bg-primary text-primary-foreground rounded-lg font-semibold flex items-center gap-1 text-sm hover:opacity-90 active:scale-95 transition"
            >
              <Plus className="w-4 h-4" />
              Glass
            </button>
          </div>

          {/* Reminder */}
          <div className="mt-auto pt-3 border-t border-border">
            <div className="text-base font-medium">Reminders</div>
            <div className="text-sm text-muted-foreground">
              {notify ? 'Notifies you when the glass is full' : 'Notifications off'}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-sm">
              <Switch
                label="Water reminder notifications"
                checked={notify}
                onChange={(checked) => onWaterChange({ ...water, notify: checked })}
              />
              <label htmlFor="water-reminder" className={notify ? '' : 'text-muted-foreground'}>
                Every
              </label>
              <span className="flex items-center gap-1">
                <input
                  id="water-reminder"
                  type="number"
                  min="10"
                  max="180"
                  value={reminderInput}
                  onChange={(e) => {
                    setReminderInput(e.target.value);
                    // Apply in-range values right away so the glass updates while editing.
                    const value = Number(e.target.value);
                    if (Number.isInteger(value) && value >= 10 && value <= 180 && value !== reminderMinutes) {
                      onWaterChange({ ...water, reminderMinutes: value });
                    }
                  }}
                  onBlur={(e) => commitReminderMinutes(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitReminderMinutes(e.currentTarget.value);
                  }}
                  className="w-12 bg-input border border-border rounded-md px-1 py-0.5 text-center focus:outline-none focus:border-primary"
                />
                <span className="text-muted-foreground">min</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
