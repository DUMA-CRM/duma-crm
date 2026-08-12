'use client';

import { Combine, Download, X } from '@/components/icons';
import { Button } from '@/components/ui/button';

import type { Customer } from '@/types/customers';

/**
 * Actions on the rows a manager has ticked.
 *
 * Two deliberate omissions. There is no bulk points adjustment — applying an
 * unexplained delta to fifty guests at once is a mistake that takes fifty
 * reversals to undo. And "email these" is not here either: a campaign should be
 * aimed at a *segment*, which stays correct as people opt out, rather than at a
 * frozen list of ids captured from one page. Save the filters as a segment and
 * send to that.
 *
 * Merge takes exactly two because that is what merging means; offering it for
 * three would raise the question of which one survives.
 */

interface Props {
  selected: Customer[];
  onClear: () => void;
  onMerge: (a: Customer, b: Customer) => void;
  canMerge: boolean;
}

/** Quote a CSV field: wrap in quotes and double any inner quote. */
const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
};

function exportCsv(rows: Customer[]) {
  const headers = [
    'First name', 'Last name', 'Phone', 'Email', 'Tier', 'Points',
    'Total spent', 'Visits', 'Last visit', 'Allergies', 'Dietary', 'Marketing opt-in',
  ];

  const lines = rows.map((row) =>
    [
      row.firstName,
      row.lastName,
      row.phone,
      row.email ?? '',
      row.tier,
      row.pointsBalance,
      row.totalSpent,
      row.totalVisits,
      row.lastVisitAt ?? '',
      (row.allergies ?? []).join('; '),
      (row.dietary ?? []).join('; '),
      row.marketingOptIn ? 'yes' : 'no',
    ]
      .map(csvCell)
      .join(','),
  );

  // A leading BOM so Excel opens UTF-8 names (accents, non-Latin) correctly
  // instead of mangling them.
  const csv = `﻿${headers.map(csvCell).join(',')}\n${lines.join('\n')}\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));

  const link = document.createElement('a');
  link.href = url;
  link.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function CustomerBulkBar({ selected, onClear, onMerge, canMerge }: Props) {
  if (selected.length === 0) return null;

  const exactlyTwo = selected.length === 2;

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-band px-3 py-2.5"
      role="region"
      aria-label="Actions for selected customers"
    >
      <p className="text-sm font-semibold text-foreground" aria-live="polite">
        {selected.length} selected
      </p>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => exportCsv(selected)} className="h-8 gap-1.5">
          <Download size={14} aria-hidden="true" />
          Export CSV
        </Button>

        {canMerge && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => exactlyTwo && onMerge(selected[0]!, selected[1]!)}
            disabled={!exactlyTwo}
            title={exactlyTwo ? 'Merge these two records' : 'Select exactly two records to merge'}
            className="h-8 gap-1.5"
          >
            <Combine size={14} aria-hidden="true" />
            Merge
          </Button>
        )}

        <Button variant="ghost" size="sm" onClick={onClear} className="h-8 gap-1.5 text-muted-foreground">
          <X size={14} aria-hidden="true" />
          Clear
        </Button>
      </div>
    </div>
  );
}
