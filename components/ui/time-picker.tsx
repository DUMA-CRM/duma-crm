'use client';

import { Clock } from '@/components/icons';

import { displayTime, formatTime, from12Hour, hourValues, type Meridiem, minuteValues, parseTime, type TimeFormat, to12Hour } from '@/lib/utils/time';

import { numberOptions, WheelField } from './wheel-field';
import { WheelPicker, type WheelPickerOption } from './wheel-picker';

export interface TimePickerProps {
  /** `HH:MM`, 24-hour — the shape every time in the app is stored in. '' for none. */
  value?: string;
  onValueChange: (value: string) => void;
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  /** The clock the wheels and trigger show. The value is 24-hour either way. */
  format?: TimeFormat;
  /** Minutes between wheel stops; a stored off-step minute is still shown. */
  minuteStep?: number;
  /** What the wheels open on when there is no value yet. */
  defaultTime?: string;
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

const MERIDIEM_OPTIONS: WheelPickerOption<Meridiem>[] = [
  { label: 'AM', value: 'AM' },
  { label: 'PM', value: 'PM' },
];

/** The time field for the whole app: hour and minute wheels (plus AM/PM on a 12-hour clock). */
export function TimePicker({
  value = '',
  onValueChange,
  format = '24h',
  minuteStep = 1,
  defaultTime = '09:00',
  placeholder = '--:--',
  'aria-label': ariaLabel = 'Time',
  ...field
}: TimePickerProps) {
  const current = parseTime(value) ?? parseTime(defaultTime) ?? { hour: 9, minute: 0 };
  const face = to12Hour(current.hour);
  const commit = (hour: number, minute: number) => onValueChange(formatTime(hour, minute));

  return (
    <WheelField
      {...field}
      icon={Clock}
      display={displayTime(value, format)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onClear={() => onValueChange('')}
      wheelsClassName={format === '12h' ? 'w-56' : 'w-40'}
      summary={value ? displayTime(value, format) : undefined}
    >
      {format === '24h' ? (
        <WheelPicker options={numberOptions(hourValues('24h'))} value={current.hour} onValueChange={(hour) => commit(hour, current.minute)} infinite />
      ) : (
        <WheelPicker options={numberOptions(hourValues('12h'), String)} value={face.hour} onValueChange={(hour) => commit(from12Hour(hour, face.meridiem), current.minute)} infinite />
      )}
      <WheelPicker options={numberOptions(minuteValues(minuteStep, current.minute))} value={current.minute} onValueChange={(minute) => commit(current.hour, minute)} infinite />
      {format === '12h' && <WheelPicker options={MERIDIEM_OPTIONS} value={face.meridiem} onValueChange={(meridiem) => commit(from12Hour(face.hour, meridiem), current.minute)} />}
    </WheelField>
  );
}
