import { Minus, Plus } from 'lucide-react';
import type { EnergyLevel } from '../state';

const energyStyles: Record<EnergyLevel, string> = {
  low: 'bg-energy-low/15 text-energy-low',
  medium: 'bg-energy-medium/15 text-energy-medium',
  high: 'bg-energy-high/15 text-energy-high'
};

const energyLabels: Record<EnergyLevel, string> = { low: 'Low', medium: 'Med', high: 'High' };

export const energyLevels: EnergyLevel[] = ['low', 'medium', 'high'];

export function EnergyBadge({ level }: { level: EnergyLevel }) {
  return (
    <span className={`inline-block w-14 text-center text-base font-semibold py-0.5 rounded-md ${energyStyles[level]}`} title={`${level} energy`}>
      {energyLabels[level]}
    </span>
  );
}

interface EnergyPickerProps {
  value: EnergyLevel;
  onChange: (level: EnergyLevel) => void;
}

export function EnergyPicker({ value, onChange }: EnergyPickerProps) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label="Task energy">
      {energyLevels.map((level) => (
        <button
          key={level}
          type="button"
          role="radio"
          aria-checked={value === level}
          onClick={() => onChange(level)}
          className={`px-3 py-1.5 rounded-md text-base font-semibold transition-colors ${
            value === level ? energyStyles[level] + ' ring-1 ring-current' : 'bg-secondary text-muted-foreground hover:text-foreground'
          }`}
        >
          {energyLabels[level]}
        </button>
      ))}
    </div>
  );
}

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  label: string;
  min?: number;
  max?: number;
  size?: 'md' | 'lg';
}

export function Stepper({ value, onChange, label, min = 1, max = 99, size = 'md' }: StepperProps) {
  const buttonSize = size === 'lg' ? 'h-8 w-8' : 'h-6 w-6';
  const iconSize = size === 'lg' ? 'w-4 h-4' : 'w-3 h-3';

  return (
    <div className="flex items-center gap-1" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        aria-label={`Decrease ${label}`}
        className={`${buttonSize} rounded-md bg-secondary hover:bg-muted flex items-center justify-center disabled:opacity-40`}
      >
        <Minus className={iconSize} />
      </button>
      <span className={`w-6 text-center font-semibold tabular-nums ${size === 'lg' ? 'text-base' : 'text-sm'}`}>{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        aria-label={`Increase ${label}`}
        className={`${buttonSize} rounded-md bg-secondary hover:bg-muted flex items-center justify-center disabled:opacity-40`}
      >
        <Plus className={iconSize} />
      </button>
    </div>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );
}

interface PomDotsProps {
  done: number;
  estimated: number;
  // 0-1 progress of the pomodoro in progress, shown as the next dot filling up.
  current?: number;
}

export function PomDots({ done, estimated, current = 0 }: PomDotsProps) {
  const total = Math.max(estimated, done + (current > 0 ? 1 : 0));

  return (
    <span className="flex items-center gap-1.5" role="img" aria-label={`${done} of ${estimated} pomodoros done`}>
      {Array.from({ length: total }, (_, index) => {
        const filling = index === done && current > 0;
        return (
          <span
            key={index}
            className={`h-3 w-3 rounded-full border ${
              index < done ? 'bg-primary border-primary' : 'border-muted-foreground/50'
            } ${index >= estimated ? 'opacity-60' : ''}`}
            style={
              filling
                ? { background: `conic-gradient(var(--primary) ${current * 360}deg, transparent 0deg)`, borderColor: 'var(--primary)' }
                : undefined
            }
          />
        );
      })}
    </span>
  );
}
