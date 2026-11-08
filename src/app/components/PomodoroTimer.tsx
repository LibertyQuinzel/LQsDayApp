import { useState, useEffect } from 'react';
import { Play, Pause, Clock, CheckCircle2, RotateCcw, CheckCheck, SkipForward, Square } from 'lucide-react';
import { showAppNotification } from '../utils/notifications';

// Lavender shades for the wreath flowers: [petal highlight, mid, edge] for the light and deep petals.
const flowerPalettes = [
  { light: ['#d9a7ff', '#9a55d4', '#6f37a7'], deep: ['#b77ae8', '#7f3db9', '#5b2a8a'] },
  { light: ['#f5b8f0', '#c86bd0', '#93429e'], deep: ['#e09ae0', '#a8509f', '#7a3178'] },
  { light: ['#e3d7ff', '#a99af0', '#7466c9'], deep: ['#c9bbf5', '#8576dc', '#5a4bb0'] }
];
// Irregular repeat so neighbouring flowers rarely share a shade.
const paletteOrder = [0, 1, 0, 2, 1, 0, 2, 0];

const wreathFlowers = Array.from({ length: 24 }, (_, index) => ({
  id: index,
  palette: paletteOrder[index % paletteOrder.length],
  angle: -90 + index * 15,
  size: index % 4 === 0 ? 1.08 : index % 4 === 1 ? 0.86 : index % 4 === 2 ? 0.98 : 0.92,
  side: index % 2 === 0 ? -1 : 1,
  delay: index / 24
}));

interface PomodoroTimerProps {
  activeTaskId?: string;
  activeTaskName?: string;
  estimatedPomodoros?: number;
  completedPomodoros?: number;
  todayPomodoros: number;
  onPomodoroComplete: (
    taskId: string,
    durationMinutes: number,
    note?: string,
    isTaskComplete?: boolean
  ) => void;
  onCancelSession: () => void;
  // Fraction (0-1) of the current focus session completed; 0 during breaks or with no task.
  onFocusProgress: (progress: number) => void;
}

export function PomodoroTimer({
  activeTaskId,
  activeTaskName,
  estimatedPomodoros = 1,
  completedPomodoros = 0,
  todayPomodoros,
  onPomodoroComplete,
  onCancelSession,
  onFocusProgress
}: PomodoroTimerProps) {
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [focusInput, setFocusInput] = useState('25');
  const [breakInput, setBreakInput] = useState('5');
  const [isActive, setIsActive] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [sessionNote, setSessionNote] = useState('');

  // Calculate current session number and target pomodoros
  const currentPomCount = completedPomodoros + 1;
  const targetPomodoros = Math.max(estimatedPomodoros, currentPomCount);
  const isLastPomodoro = currentPomCount >= targetPomodoros;

  const [forceTaskComplete, setForceTaskComplete] = useState<boolean | null>(null);
  const willCompleteTask = forceTaskComplete !== null ? forceTaskComplete : isLastPomodoro;

  const canStartFocus = isBreak || Boolean(activeTaskId);
  const totalSeconds = (isBreak ? breakMinutes : focusMinutes) * 60;
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  // A focus session has begun once it's running or paused partway through.
  const focusStarted = Boolean(activeTaskId) && !isBreak && (isActive || remainingSeconds < totalSeconds);

  const commitFocusMinutes = (value: string) => {
    const parsedValue = Number(value);
    const nextValue = Number.isFinite(parsedValue) ? Math.min(Math.max(Math.round(parsedValue), 1), 240) : focusMinutes;
    setFocusMinutes(nextValue);
    setFocusInput(String(nextValue));
  };

  const commitBreakMinutes = (value: string) => {
    const parsedValue = Number(value);
    const nextValue = Number.isFinite(parsedValue) ? Math.min(Math.max(Math.round(parsedValue), 1), 120) : breakMinutes;
    setBreakMinutes(nextValue);
    setBreakInput(String(nextValue));
  };

  // Apply edited durations. Only runs when a duration changes (inputs are disabled while running),
  // so pausing keeps the remaining time.
  useEffect(() => {
    setRemainingSeconds((isBreak ? breakMinutes : focusMinutes) * 60);
  }, [breakMinutes, focusMinutes]);

  useEffect(() => {
    setSessionNote('');
    setForceTaskComplete(null);
  }, [activeTaskId]);

  useEffect(() => {
    if (!isActive || !endsAt) return;

    const completeCurrentSegment = () => {
      setIsActive(false);
      setEndsAt(null);

      if (!isBreak) {
        if (activeTaskId) {
          onPomodoroComplete(activeTaskId, focusMinutes, sessionNote.trim() || undefined, willCompleteTask);
        }
        setSessionNote('');
        setForceTaskComplete(null);
        showAppNotification({
          title: 'Pomodoro Complete!',
          body: willCompleteTask
            ? 'Task complete! Time for a break.'
            : `Pomodoro ${currentPomCount}/${targetPomodoros} done! Take a break.`
        });
        setIsBreak(true);
        setRemainingSeconds(breakMinutes * 60);
      } else {
        showAppNotification({
          title: 'Break Over!',
          body: 'Ready to get back to work?'
        });
        setIsBreak(false);
        setRemainingSeconds(focusMinutes * 60);
      }
    };

    const tick = () => {
      const nextRemainingSeconds = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setRemainingSeconds(nextRemainingSeconds);

      if (nextRemainingSeconds === 0) {
        completeCurrentSegment();
      }
    };

    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [
    activeTaskId,
    breakMinutes,
    currentPomCount,
    endsAt,
    targetPomodoros,
    focusMinutes,
    isActive,
    isBreak,
    onPomodoroComplete,
    sessionNote,
    willCompleteTask
  ]);

  const toggleTimer = () => {
    if (!isActive && !canStartFocus) return;
    if (isActive) {
      setIsActive(false);
      setEndsAt(null);
      return;
    }

    setEndsAt(Date.now() + remainingSeconds * 1000);
    setIsActive(true);
  };

  const restartTimer = () => {
    setIsActive(false);
    setEndsAt(null);
    setRemainingSeconds(totalSeconds);
  };

  const skipBreak = () => {
    setIsActive(false);
    setIsBreak(false);
    setEndsAt(null);
    setRemainingSeconds(focusMinutes * 60);
  };

  const stopTask = () => {
    setIsActive(false);
    setIsBreak(false);
    setEndsAt(null);
    setRemainingSeconds(focusMinutes * 60);
    setSessionNote('');
    setForceTaskComplete(null);
    onCancelSession();
  };

  const logEarly = () => {
    if (!activeTaskId) return;

    const elapsedMinutes = Math.max(1, Math.ceil((focusMinutes * 60 - remainingSeconds) / 60));

    onPomodoroComplete(activeTaskId, elapsedMinutes, sessionNote.trim() || undefined, willCompleteTask);
    setIsActive(false);
    setIsBreak(true);
    setEndsAt(null);
    setSessionNote('');
    setForceTaskComplete(null);
    setRemainingSeconds(breakMinutes * 60);
  };

  // Always shown so every control is easy to find; each is disabled when it doesn't apply.
  const secondaryActions = [
    { label: 'Restart', title: 'Restart the current timer', icon: RotateCcw, onSelect: restartTimer, enabled: remainingSeconds < totalSeconds },
    { label: 'Log pom now', title: 'Log this pomodoro early', icon: CheckCheck, onSelect: logEarly, enabled: focusStarted },
    { label: 'Skip break', title: 'Skip the break', icon: SkipForward, onSelect: skipBreak, enabled: isBreak },
    { label: 'Stop task', title: 'Stop working on this task', icon: Square, onSelect: stopTask, enabled: Boolean(activeTaskId) }
  ];

  const percentage = ((totalSeconds - remainingSeconds) / totalSeconds) * 100;
  const progress = Math.min(Math.max(percentage / 100, 0), 1);
  const circumference = 2 * Math.PI * 82;
  const focusProgress = activeTaskId && !isBreak ? progress : 0;

  useEffect(() => {
    onFocusProgress(focusProgress);
  }, [focusProgress, onFocusProgress]);

  return (
    <div className="panel p-4 h-full flex flex-col min-h-0 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Clock className="w-6 h-6 text-primary" />
          <h2 className="text-xl">Pomodoro</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-muted-foreground">{todayPomodoros} today</span>
        </div>
      </div>

      {/* Durations: editable whenever the timer isn't running. Stacked, or side by side on short windows. */}
      <div className="grid gap-2 mb-3 flex-shrink-0 [@media(max-height:820px)]:grid-cols-2">
        {[
          { id: 'focus', label: 'Focus', value: focusInput, set: setFocusInput, apply: setFocusMinutes, commit: commitFocusMinutes, max: 240 },
          { id: 'break', label: 'Break', value: breakInput, set: setBreakInput, apply: setBreakMinutes, commit: commitBreakMinutes, max: 120 }
        ].map((field) => (
          <label key={field.id} className="bg-secondary rounded-lg px-4 py-2.5 text-lg flex items-center justify-between gap-2">
            <span>{field.label}</span>
            <span className="flex items-center gap-1">
              <input
                type="number"
                min="1"
                max={field.max}
                value={field.value}
                onChange={(e) => {
                  field.set(e.target.value);
                  // Apply in-range values right away so the countdown updates while editing.
                  const value = Number(e.target.value);
                  if (Number.isInteger(value) && value >= 1 && value <= field.max) field.apply(value);
                }}
                onBlur={(e) => field.commit(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') field.commit(e.currentTarget.value);
                }}
                disabled={isActive}
                className="w-16 bg-input rounded-md px-1 py-1 text-center border border-border focus:outline-none focus:border-primary disabled:opacity-50"
              />
              <span className="text-muted-foreground">min</span>
            </span>
          </label>
        ))}
      </div>

      {/* Task Banner */}
      {activeTaskName ? (
        <div className="bg-primary/10 rounded-lg px-4 py-2.5 mb-2 border border-primary/40 flex items-center justify-between gap-2 flex-shrink-0">
          <p className="text-lg font-medium truncate flex-1">{activeTaskName}</p>
          <span className="text-base font-semibold text-primary whitespace-nowrap">
            Pomodoro {currentPomCount} / {targetPomodoros}
          </span>
        </div>
      ) : (
        !isBreak && (
          <div className="bg-secondary rounded-lg px-4 py-2.5 mb-2 text-center flex-shrink-0">
            <p className="text-lg text-muted-foreground">Press ▶ on a task to start a focus session.</p>
          </div>
        )
      )}

      {/* Circle Timer */}
      <div className="relative flex-1 min-h-[230px] [@media(max-height:820px)]:min-h-[200px] flex items-center justify-center">
        <svg className="h-full max-h-80 w-full" viewBox="0 0 200 200" aria-hidden="true">
          <defs>
            {flowerPalettes.map((palette, index) => (
              <g key={index}>
                <radialGradient id={`pom-flower-petal-${index}`} cx="36%" cy="22%" r="76%">
                  <stop offset="0%" stopColor={palette.light[0]} />
                  <stop offset="55%" stopColor={palette.light[1]} />
                  <stop offset="100%" stopColor={palette.light[2]} />
                </radialGradient>
                <radialGradient id={`pom-flower-petal-deep-${index}`} cx="35%" cy="26%" r="78%">
                  <stop offset="0%" stopColor={palette.deep[0]} />
                  <stop offset="58%" stopColor={palette.deep[1]} />
                  <stop offset="100%" stopColor={palette.deep[2]} />
                </radialGradient>
              </g>
            ))}
            <linearGradient id="pom-wreath-stem" x1="28" y1="30" x2="172" y2="170">
              <stop offset="0%" stopColor="#77b76f" />
              <stop offset="100%" stopColor="#4d8f57" />
            </linearGradient>
          </defs>
          <circle cx="100" cy="100" r="82" fill="none" stroke="rgba(125, 207, 120, 0.32)" strokeWidth="7" />
          <circle
            cx="100"
            cy="100"
            r="82"
            fill="none"
            stroke="url(#pom-wreath-stem)"
            strokeWidth="7"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            strokeLinecap="round"
            transform="rotate(-90 100 100)"
            style={{ transition: 'stroke-dashoffset 700ms ease-out' }}
          />
          {wreathFlowers.map((flower) => {
            const radians = (flower.angle * Math.PI) / 180;
            const x = 100 + Math.cos(radians) * 84;
            const y = 100 + Math.sin(radians) * 84;
            const bloom = Math.min(Math.max((progress - flower.delay) * 5, 0), 1);
            const leafBloom = Math.min(Math.max((progress - Math.max(flower.delay - 0.05, 0)) * 5, 0), 1);
            const twigSide = flower.side;
            const petal = `url(#pom-flower-petal-${flower.palette})`;
            const petalDeep = `url(#pom-flower-petal-deep-${flower.palette})`;

            return (
              <g key={flower.id} transform={`translate(${x} ${y}) rotate(${flower.angle + 90})`}>
                <g
                  opacity={0.2 + leafBloom * 0.8}
                  transform={`scale(${0.45 + leafBloom * 0.55})`}
                  style={{ transition: 'opacity 500ms ease, transform 500ms ease' }}
                >
                  <path
                    d={`M${-3 * twigSide} 0 C${5 * twigSide} -4 ${15 * twigSide} -3 ${24 * twigSide} 0`}
                    fill="none"
                    stroke="#5f9f64"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                  />
                  <ellipse cx={5 * twigSide} cy="5" rx="8.8" ry="2.6" fill="#69a86c" transform={`rotate(${18 * twigSide} ${5 * twigSide} 5)`} />
                  <ellipse cx={15 * twigSide} cy="-4" rx="7.6" ry="2.3" fill="#5b975f" transform={`rotate(${-22 * twigSide} ${15 * twigSide} -4)`} />
                </g>
                <g
                  opacity={bloom}
                  transform={`translate(${twigSide * 27} -1) rotate(${twigSide * 88}) scale(${(0.35 + bloom * 0.65) * flower.size})`}
                  style={{ transition: 'opacity 500ms ease, transform 500ms ease' }}
                >
                  <ellipse cx="-5.8" cy="-2" rx="3.6" ry="9.4" fill={petalDeep} transform="rotate(-28 -5.8 -2)" />
                  <ellipse cx="0" cy="-6.8" rx="4.3" ry="10.8" fill={petal} transform="rotate(2 0 -6.8)" />
                  <ellipse cx="5.8" cy="-2" rx="3.6" ry="9.4" fill={petal} transform="rotate(28 5.8 -2)" />
                  <ellipse cx="-3.5" cy="4.2" rx="3.2" ry="7.4" fill={petalDeep} transform="rotate(-42 -3.5 4.2)" />
                  <ellipse cx="3.5" cy="4.2" rx="3.2" ry="7.4" fill={petal} transform="rotate(42 3.5 4.2)" />
                  <path d="M-6 7 C-2 9 2 9 6 7 C4 11 -4 11 -6 7Z" fill="#5a985f" />
                </g>
              </g>
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-6xl [@media(max-height:820px)]:text-5xl font-bold mb-1 tracking-tight tabular-nums" role="timer" aria-live="off">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
          <div className="text-lg font-medium text-muted-foreground">
            {isBreak ? 'Break' : isActive ? 'Focus' : remainingSeconds < totalSeconds ? 'Paused' : 'Focus'}
          </div>
        </div>
      </div>

      {/* Task Note & Completion Toggle, once a focus session has started */}
      {focusStarted && (
        <div className="space-y-2 mb-3 flex-shrink-0">
          <textarea
            value={sessionNote}
            onChange={(e) => setSessionNote(e.target.value)}
            placeholder="What are you working on in this pom?"
            aria-label="Session note"
            rows={2}
            className="w-full bg-input rounded-lg px-3 py-2 text-lg resize-none [@media(max-height:820px)]:h-11 border border-border focus:outline-none focus:border-primary placeholder:text-muted-foreground"
          />
          <button
            type="button"
            role="switch"
            aria-checked={willCompleteTask}
            onClick={() => setForceTaskComplete(!willCompleteTask)}
            className="flex items-center gap-2 text-base text-muted-foreground hover:text-foreground transition-colors"
          >
            <CheckCircle2 className={`w-5 h-5 ${willCompleteTask ? 'text-primary fill-primary/20' : ''}`} />
            Mark task complete when this session ends
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex-shrink-0 space-y-2">
        <button
          onClick={toggleTimer}
          disabled={!isActive && !canStartFocus}
          className="w-full h-12 bg-primary hover:opacity-90 text-primary-foreground rounded-lg flex items-center justify-center gap-2 text-lg font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {isActive ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          {isActive ? 'Pause' : remainingSeconds < totalSeconds ? 'Resume' : isBreak ? 'Start break' : 'Start'}
        </button>
        <div className="grid grid-cols-2 gap-2">
          {secondaryActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onSelect}
              disabled={!action.enabled}
              title={action.title}
              className="h-11 bg-secondary hover:bg-muted rounded-lg flex items-center justify-center gap-2 text-base font-medium disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-secondary"
            >
              <action.icon className="w-5 h-5" />
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
