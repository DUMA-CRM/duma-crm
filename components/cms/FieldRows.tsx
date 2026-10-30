'use client';

import { useState } from 'react';

import { Switch } from '@/components/settings/controls';

import type { CmsFieldDefinition } from '@/lib/modules/cms/client';
import { fieldValueInWords } from '@/lib/utils/cms';

import { FieldSet } from './FieldInput';
import { FIELD_ICONS } from './fieldIcons';
import { InfoRow, PickerRow } from './rows';

type Data = Record<string, unknown>;

/**
 * Fields in the settings rows' shape: each a row with its tile, its name and
 * its value in words — or, when blank, what it falls back to (muted), or
 * "Required" (amber) — that opens its input underneath, one at a time (required
 * fields empty on arrival start open). A row
 * with an error turns red and shows it while closed. Yes/no fields are a
 * switch on the row. The open row is the caller's, so another card can open one.
 */
export function FieldRows({
  fields,
  value,
  onChange,
  disabled,
  locale,
  open,
  onOpenChange,
  issues,
  placeholders,
  recommendedLengths,
  fieldActions,
  otherLanguages = 0,
}: {
  /** How many other language versions the entry has: a shared field's row says it changes them too. */
  otherLanguages?: number;
  fields: CmsFieldDefinition[];
  value: Data;
  onChange: (next: Data) => void;
  disabled: boolean;
  locale: string;
  open: string | null;
  onOpenChange: (key: string | null) => void;
  issues?: Map<string, string[]>;
  placeholders?: Readonly<Record<string, string>>;
  recommendedLengths?: Readonly<Record<string, number>>;
  /** An extra control beside a field's own, by key — e.g. Generate beside a media field's Media. */
  fieldActions?: Readonly<Record<string, React.ReactNode>>;
}) {
  // Required fields still empty when the entry opens start open, ready to fill — and stay open while
  // they're typed in, until tapped closed. Read once: a row snapping shut on the first letter would be worse.
  const [pinned, setPinned] = useState<ReadonlySet<string>>(
    () =>
      new Set(
        disabled
          ? []
          : fields
              .filter((field) => field.required && field.type !== 'boolean' && fieldValueInWords(field, value[field.key]) === null)
              .map((field) => field.key),
      ),
  );
  const isOpen = (key: string) => open === key || pinned.has(key);
  const toggle = (key: string) => {
    if (pinned.has(key)) {
      setPinned((current) => new Set([...current].filter((item) => item !== key)));
      if (open === key) onOpenChange(null);
      return;
    }
    onOpenChange(open === key ? null : key);
  };

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-3">
      {fields.map((field) => {
        const icon = FIELD_ICONS[field.type];
        const shared = field.shared && otherLanguages > 0 ? `Same in all ${otherLanguages + 1} languages` : undefined;
        if (field.type === 'boolean') {
          return (
            <InfoRow key={field.key} icon={icon} title={field.label} description={shared}>
              <Switch
                checked={value[field.key] === true}
                disabled={disabled}
                label={field.label}
                onChange={(checked) => onChange({ ...value, [field.key]: checked })}
              />
            </InfoRow>
          );
        }
        const errors = issues?.get(field.key);
        const written = fieldValueInWords(field, value[field.key]);
        const fallback = placeholders?.[field.key];
        const missing = !written && !fallback && field.required && !disabled;
        return (
          <PickerRow
            key={field.key}
            icon={icon}
            title={field.label}
            description={shared}
            value={errors?.length ? errors[0]! : (written ?? fallback ?? (missing ? 'Required' : 'None'))}
            muted={!written}
            tone={errors?.length ? 'danger' : missing ? 'warning' : undefined}
            open={isOpen(field.key)}
            onToggle={() => toggle(field.key)}
          >
            <FieldSet
              fields={[field]}
              value={value}
              onChange={onChange}
              issues={issues}
              disabled={disabled}
              locale={locale}
              placeholders={placeholders}
              recommendedLengths={recommendedLengths}
              fieldActions={fieldActions}
              hideLabel
            />
          </PickerRow>
        );
      })}
    </fieldset>
  );
}
