'use client';

import { useEffect, useRef, useState } from 'react';

import { copyText } from '@/components/cms/shared';
import { Check, Copy } from '@/components/icons';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Tooltip } from '@/components/shared/Tooltip';

import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';

/** The variable groups the API returns, short enough to sit side by side. */
const GROUP_LABELS: Record<string, string> = {
  customer: 'Customer',
  order: 'Order',
  location: 'Location',
  brand: 'Business',
  other: 'Other',
};

const GROUP_ORDER = ['customer', 'order', 'location', 'brand', 'other'];

/** `customer.firstName` → "First name"; `order.pickup_time` → "Pickup time". */
export function variableLabel(variable: string): string {
  const leaf = variable.includes('.') ? variable.split('.').slice(1).join(' ') : variable;
  const words = leaf
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .trim()
    .toLowerCase();
  return words ? words[0]!.toUpperCase() + words.slice(1) : variable;
}

/**
 * The variables a template can use: a switch between groups, the group's
 * fields as chips. Clicking a chip copies its token, so it can be pasted
 * exactly where it belongs — mid-sentence, in a link, in the HTML.
 */
export function VariablePalette({ variables }: { variables: string[] }) {
  const groups = new Map<string, string[]>();
  for (const variable of variables) {
    const group = variable.includes('.') ? variable.split('.')[0]! : 'other';
    groups.set(group, [...(groups.get(group) ?? []), variable]);
  }
  const ordered = [...groups.keys()].sort(
    (a, b) => (GROUP_ORDER.indexOf(a) + 1 || 99) - (GROUP_ORDER.indexOf(b) + 1 || 99) || a.localeCompare(b),
  );

  const [picked, setPicked] = useState<string | null>(null);
  const group = picked && groups.has(picked) ? picked : ordered[0];
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async (variable: string) => {
    const token = `{{${variable}}}`;
    if (!(await copyText(token))) {
      toast('error', `Copy failed — type ${token} instead.`);
      return;
    }
    setCopied(variable);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1800);
  };

  if (!group) return null;

  return (
    <div className="space-y-3">
      {ordered.length > 1 && (
        <SegmentedControl
          options={ordered.map((value) => ({ value, label: GROUP_LABELS[value] ?? variableLabel(value) }))}
          value={group}
          onChange={setPicked}
          ariaLabel="Variable group"
          className="w-full [&>button]:flex-1"
        />
      )}

      <ul className="flex flex-wrap gap-1.5" aria-label={`${GROUP_LABELS[group] ?? variableLabel(group)} variables`}>
        {(groups.get(group) ?? []).map((variable) => {
          const done = copied === variable;
          const token = `{{${variable}}}`;
          return (
            <li key={variable}>
              <Tooltip side="top" label={done ? 'Copied' : token}>
                <button
                  type="button"
                  onClick={() => void copy(variable)}
                  aria-label={done ? `Copied ${token}` : `Copy ${token}`}
                  className={cn(
                    'group inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                    done
                      ? 'border-success/50 bg-success/8 text-success'
                      : 'border-rule/60 bg-background text-foreground hover:border-primary/40 hover:bg-primary/6 hover:text-primary',
                  )}
                >
                  {variableLabel(variable)}
                  {done ? (
                    <Check size={13} aria-hidden="true" />
                  ) : (
                    <Copy size={13} className="text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
                  )}
                </button>
              </Tooltip>
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted-foreground" aria-live="polite">
        {copied ? (
          <>
            Copied <span className="font-mono text-primary">{`{{${copied}}}`}</span> — paste it anywhere.
          </>
        ) : (
          'Click to copy, then paste anywhere.'
        )}
      </p>
    </div>
  );
}
