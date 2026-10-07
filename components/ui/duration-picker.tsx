'use client';

import { Timer } from '@/components/icons';

import { durationHours, durationMinutes, formatDuration, joinDuration, splitDuration } from '@/lib/utils/duration';

import { numberOptions, WheelField } from './wheel-field';
import { WheelPicker } from './wheel-picker';

export interface DurationPickerProps {
  /** Total minutes. */
  value: number;
  onValueChange: (minutes: number) => void;
  /** Bounds in minutes; the wheels never offer a total outside them. */
  min?: number;
  max?: number;
  /** Minutes between stops on the minute wheel. */
  minuteStep?: number;
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * A length of time as hours and minutes on two wheels — for prep times,
 * breaks and thresholds that a ± stepper made a chore (90 minutes was 90 taps).
 * The value stays a number of minutes, so nothing that stores it changes.
 */
export function DurationPicker({ value, onValueChange, min = 0, max = 1440, minuteStep = 5, 'aria-label': ariaLabel = 'Duration', ...field }: DurationPickerProps) {
  const safe = Number.isFinite(value) ? value : min;
  const { hours, minutes } = splitDuration(safe);

  return (
    <WheelField
      {...field}
      required
      icon={Timer}
      display={formatDuration(safe)}
      aria-label={ariaLabel}
      wheelsClassName="w-48"
      summary={formatDuration(safe)}
    >
      <WheelPicker
        options={numberOptions(durationHours(min, max), (hour) => `${hour} h`)}
        value={hours}
        onValueChange={(hour) => onValueChange(joinDuration(hour, minutes, min, max))}
      />
      <WheelPicker
        options={numberOptions(durationMinutes(hours, minuteStep, min, max, minutes), (minute) => `${String(minute).padStart(2, '0')} min`)}
        value={minutes}
        onValueChange={(minute) => onValueChange(joinDuration(hours, minute, min, max))}
      />
    </WheelField>
  );
}
