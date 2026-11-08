import { Timer, CheckCircle2 } from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { formatMinutes, plural, type Task, type WorkSession } from '../state';

interface PomodoroHistoryProps {
  sessions: WorkSession[];
  tasks: Task[];
}

// Back-to-back sessions on the same task are shown as one row.
interface SessionGroup {
  id: string;
  taskId: string;
  taskName: string;
  sessions: WorkSession[];
}

interface HistoryDay {
  label: string;
  groups: SessionGroup[];
  count: number;
  minutes: number;
}

function dayLabel(date: Date) {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'EEE, MMM d');
}

export function PomodoroHistory({ sessions, tasks }: PomodoroHistoryProps) {
  // Prefer the task's current name; fall back to the name saved with the session once a task is cleared.
  const taskNames = new Map(tasks.map((task) => [task.id, task.text]));

  const days: HistoryDay[] = [];
  for (const session of [...sessions].reverse()) {
    const label = dayLabel(new Date(session.completedAt));
    let day = days[days.length - 1];
    if (day?.label !== label) {
      day = { label, groups: [], count: 0, minutes: 0 };
      days.push(day);
    }

    day.count += 1;
    day.minutes += session.durationMinutes;

    const lastGroup = day.groups[day.groups.length - 1];
    if (lastGroup?.taskId === session.taskId) {
      lastGroup.sessions.push(session);
    } else {
      day.groups.push({
        id: session.id,
        taskId: session.taskId,
        taskName: taskNames.get(session.taskId) ?? session.taskName,
        sessions: [session]
      });
    }
  }

  const todayCount = days[0]?.label === 'Today' ? days[0].count : 0;

  return (
    <div className="panel p-5 h-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-primary" />
          <h2 className="text-lg">Pom History</h2>
        </div>
        <span className="text-base font-semibold text-muted-foreground">{todayCount} today</span>
      </div>

      {/* Scrollable History List, newest day first */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1">
        {days.length === 0 ? (
          <div className="h-full flex items-center justify-center text-base text-muted-foreground text-center px-2">
            No pomodoros yet
          </div>
        ) : (
          days.map((day) => (
            <section key={day.label}>
              <h3 className="text-sm uppercase tracking-wide text-muted-foreground mb-2 flex justify-between">
                <span>{day.label}</span>
                <span className="normal-case tracking-normal">
                  {plural(day.count, 'pom')} · {formatMinutes(day.minutes)}
                </span>
              </h3>
              <div className="space-y-1.5">
                {day.groups.map((group) => {
                  // Sessions are newest first, so the last one is the earliest.
                  const earliest = group.sessions[group.sessions.length - 1];
                  const latest = group.sessions[0];
                  const minutes = group.sessions.reduce((total, session) => total + session.durationMinutes, 0);
                  const notes = group.sessions.map((session) => session.note).filter(Boolean);

                  return (
                    <div key={group.id} className="bg-secondary rounded-lg px-3 py-2.5 flex items-start gap-2.5">
                      <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="text-base font-medium leading-tight break-words">{group.taskName}</p>
                          {group.sessions.length > 1 && (
                            <span className="text-sm font-semibold text-primary flex-shrink-0">
                              ×{group.sessions.length}
                            </span>
                          )}
                        </div>
                        {notes.map((note, index) => (
                          <p key={index} className="text-sm text-muted-foreground mt-0.5 break-words">
                            {note}
                          </p>
                        ))}
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {formatMinutes(minutes)} · {format(new Date(earliest.completedAt), 'h:mm a')}
                          {group.sessions.length > 1 && ` – ${format(new Date(latest.completedAt), 'h:mm a')}`}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
