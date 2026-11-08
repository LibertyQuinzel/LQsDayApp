import { Battery, BatteryLow, BatteryMedium, BatteryFull, Brain, HeartPulse } from 'lucide-react';
import { energyFit, type Feeling, type Task } from '../state';

const energyLevels = [
  { value: 1, label: 'Very low', icon: BatteryLow, color: 'text-red-600 dark:text-red-400' },
  { value: 2, label: 'Low', icon: BatteryLow, color: 'text-orange-600 dark:text-orange-400' },
  { value: 3, label: 'Medium', icon: BatteryMedium, color: 'text-yellow-700 dark:text-yellow-400' },
  { value: 4, label: 'Good', icon: BatteryFull, color: 'text-green-700 dark:text-green-400' },
  { value: 5, label: 'Excellent', icon: BatteryFull, color: 'text-emerald-700 dark:text-emerald-400' }
];

const recommendations = {
  low: {
    title: 'Low energy mode',
    tips: ['Focus on low-effort tasks', 'Take short breaks every 25 minutes'],
    color: 'text-red-600 dark:text-red-400'
  },
  medium: {
    title: 'Moderate energy',
    tips: ['Mix high and low effort tasks', 'Schedule important work in the morning'],
    color: 'text-yellow-700 dark:text-yellow-400'
  },
  high: {
    title: 'High energy mode',
    tips: ['Tackle challenging projects first', 'Schedule important meetings'],
    color: 'text-green-700 dark:text-green-400'
  }
};

const feelingFields = [
  { key: 'physical' as const, label: 'Physically', icon: HeartPulse },
  { key: 'mental' as const, label: 'Mentally', icon: Brain }
];

interface EnergyPlannerProps {
  energy: number;
  onEnergyChange: (energy: number) => void;
  feeling: Feeling;
  onFeelingChange: (feeling: Feeling) => void;
  // Today's unfinished tasks, used to suggest ones that match the current energy.
  openTasks: Task[];
}

export function EnergyPlanner({ energy, onEnergyChange, feeling, onFeelingChange, openTasks }: EnergyPlannerProps) {
  const selected = energyLevels.find((level) => level.value === energy) ?? energyLevels[2];
  const fit = energyFit(energy);
  const recs = recommendations[fit];
  const fittingTasks = openTasks.filter((task) => task.energyLevel === fit);

  return (
    <div className="panel p-5 h-full flex flex-col min-h-0 overflow-y-auto">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Battery className="w-5 h-5 text-primary" />
          <h2 className="text-lg">Energy</h2>
        </div>
        <span className={`text-base font-semibold ${selected.color}`}>{selected.label}</span>
      </div>

      <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Energy level">
        {energyLevels.map((level) => (
          <button
            key={level.value}
            type="button"
            role="radio"
            aria-checked={energy === level.value}
            aria-label={`${level.value}, ${level.label}`}
            title={level.label}
            onClick={() => onEnergyChange(level.value)}
            className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border transition-colors ${
              energy === level.value
                ? 'bg-primary/15 border-primary'
                : 'bg-secondary border-transparent hover:border-border'
            }`}
          >
            <level.icon className={`w-5 h-5 ${level.color}`} />
            <span className="text-base font-semibold">{level.value}</span>
          </button>
        ))}
      </div>

      <div className="bg-secondary rounded-lg p-3.5 mt-4">
        <h3 className={`mb-2 text-base ${recs.color}`}>{recs.title}</h3>
        <ul className="space-y-1.5">
          {recs.tips.map((tip) => (
            <li key={tip} className="flex items-start gap-2 text-base">
              <span className="text-primary">•</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Today's feelings, saved per day */}
      <div className="mt-4">
        <h3 className="text-sm uppercase tracking-wide text-muted-foreground mb-2">How I'm feeling today</h3>
        <div className="space-y-3">
          {feelingFields.map((field) => (
            <label key={field.key} className="block">
              <span className="flex items-center gap-1.5 text-base font-medium mb-1">
                <field.icon className="w-5 h-5 text-primary" />
                {field.label}
              </span>
              <textarea
                value={feeling[field.key]}
                onChange={(event) => onFeelingChange({ ...feeling, [field.key]: event.target.value })}
                rows={2}
                className="w-full bg-input rounded-lg px-3 py-2 text-base resize-none border border-border focus:outline-none focus:border-primary"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-sm uppercase tracking-wide text-muted-foreground mb-2">Good fit today</h3>
        {fittingTasks.length === 0 ? (
          <p className="text-base text-muted-foreground">No {fit}-energy tasks left today.</p>
        ) : (
          <ul className="space-y-1.5">
            {fittingTasks.map((task) => (
              <li key={task.id} className="text-base bg-secondary rounded-md px-3 py-2 truncate">
                {task.text}
              </li>
            ))}
          </ul>
        )}
        <p className="pt-2 text-sm text-muted-foreground">These are highlighted in the Work tab too.</p>
      </div>
    </div>
  );
}
