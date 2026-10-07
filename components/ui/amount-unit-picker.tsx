'use client';

import { Timer } from '@/components/icons';

import { DELAY_RANGES, type DelayUnit, delayAmounts, formatDelay } from '@/lib/utils/duration';

import { numberOptions, WheelField } from './wheel-field';
import { WheelPicker, type WheelPickerOption } from './wheel-picker';

export interface AmountUnitPickerProps {
  amount: number;
  unit: DelayUnit;
  onValueChange: (value: { amount: number; unit: DelayUnit }) => void;
  id?: string;
  label?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

const UNIT_OPTIONS: WheelPickerOption<DelayUnit>[] = (Object.keys(DELAY_RANGES) as DelayUnit[]).map((unit) => ({ value: unit, label: DELAY_RANGES[unit].plural }));

/**
 * "Wait [3] [days]" as two wheels. Switching unit keeps the amount when it
 * still fits the new unit's wheel, else settles on its top value.
 */
export function AmountUnitPicker({ amount, unit, onValueChange, 'aria-label': ariaLabel = 'How long', ...field }: AmountUnitPickerProps) {
  const safe = Number.isFinite(amount) && amount >= 1 ? Math.round(amount) : 1;
  return (
    <WheelField {...field} required icon={Timer} display={formatDelay(safe, unit)} aria-label={ariaLabel} wheelsClassName="w-52" summary={formatDelay(safe, unit)}>
      <WheelPicker options={numberOptions(delayAmounts(unit, safe), String)} value={safe} onValueChange={(next) => onValueChange({ amount: next, unit })} infinite />
      <WheelPicker
        options={UNIT_OPTIONS}
        value={unit}
        onValueChange={(nextUnit) => onValueChange({ amount: Math.min(safe, DELAY_RANGES[nextUnit].max), unit: nextUnit })}
      />
    </WheelField>
  );
}
