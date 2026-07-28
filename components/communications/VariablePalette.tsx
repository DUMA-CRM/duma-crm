'use client';

import { toast } from '@/stores/toastStore';

import { labelClass } from './shared';

/** Human-readable hints for the variable groups the API returns. */
const GROUP_LABELS: Record<string, string> = {
  customer: 'Customer',
  order: 'Order',
  location: 'Location',
  brand: 'Your business',
  other: 'Other',
};

const GROUP_ORDER = ['customer', 'order', 'location', 'brand', 'other'];

/**
 * Clickable list of the variables a template can use. Clicking inserts the
 * variable into the field the user was last typing in; if they haven't clicked
 * into a field yet, it copies instead so nothing is lost.
 */
export function VariablePalette({ variables, onInsert }: { variables: string[]; onInsert: (token: string) => boolean }) {
  const groups = new Map<string, string[]>();
  for (const variable of variables) {
    const group = variable.includes('.') ? variable.split('.')[0] : 'other';
    groups.set(group, [...(groups.get(group) ?? []), variable]);
  }
  const ordered = [...groups.entries()].sort(
    (a, b) => (GROUP_ORDER.indexOf(a[0]) + 1 || 99) - (GROUP_ORDER.indexOf(b[0]) + 1 || 99) || a[0].localeCompare(b[0]),
  );

  const handleClick = (variable: string) => {
    const token = `{{${variable}}}`;
    if (onInsert(token)) return;
    navigator.clipboard?.writeText(token);
    toast('success', `Copied ${token} — click into a field, then paste.`);
  };

  if (!variables.length) return null;

  return (
    <div>
      <p className={labelClass}>Personalise it</p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Click a chip to drop it where your cursor is. Each one is replaced with real details when the email is sent.
      </p>
      <div className="mt-3 space-y-3">
        {ordered.map(([group, items]) => (
          <div key={group}>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{GROUP_LABELS[group] ?? group}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {items.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => handleClick(variable)}
                  className="rounded-md bg-muted px-2 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                  title={`Insert {{${variable}}}`}
                >
                  {variable.includes('.') ? variable.split('.').slice(1).join('.') : variable}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
