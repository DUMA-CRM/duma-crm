'use client';

import { RowWarning } from '@/components/shared/rows';
import { Flame } from '@/components/icons';
import { AllergenChip } from '@/components/menu/shared';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';

import type { Costing } from '@/lib/menu/costing';
import { cn } from '@/lib/utils/cn';

interface SummaryEntry {
  col: { id: string; label: string };
  cogs: number;
  kcal: number;
  missingCost: number;
  missingNutrition: number;
  costing?: Costing | undefined;
}

/**
 * What the recipe costs, per size. The workbench half of the
 * board-then-workbench split: the editor gets the width, this stays a stable
 * narrow column beside it rather than a total buried under a long form.
 *
 * One block per size, each reading top to bottom, instead of the old
 * transposed table where metrics were rows and sizes were columns — that
 * layout made "what does the large cost" a cross-reference against a header
 * two rows up.
 */
export function RecipeTotals({
  summary,
  allAllergens,
  showMargin = false,
  title = 'Cost',
  framed = true,
}: {
  summary: SummaryEntry[];
  allAllergens: string[];
  /** Menu items have a sale price to measure against; modifiers only add cost. */
  showMargin?: boolean;
  title?: string;
  /** A titled card on a page; `false` in a drawer, where a section is a heading and its rows, never a card. */
  framed?: boolean;
}) {
  const formatMoney = useFormatMoney();
  const missingData = summary.some((s) => s.missingCost > 0 || s.missingNutrition > 0);
  const id = `recipe-totals-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  const body = (
    <div className="space-y-4">
      {summary.map((s) => (
        <div key={s.col.id}>
          {/* Only worth a size heading when there is more than one size. */}
          {summary.length > 1 && <p className="mb-1.5 text-label uppercase text-muted-foreground">{s.col.label}</p>}
          <dl className="space-y-1.5 text-sm tabular-nums">
            <Figure label="Ingredients" value={formatMoney(s.cogs, 2)} strong incomplete={s.missingCost > 0} />
            {showMargin && s.costing && (
              <>
                {s.costing.vat > 0 && <Figure label={`VAT (${s.costing.vatRate}%)`} value={`−${formatMoney(s.costing.vat, 2)}`} />}
                <Figure
                  label="Margin"
                  value={
                    <>
                      {formatMoney(s.costing.margin, 2)}{' '}
                      <span className="font-normal text-muted-foreground">({s.costing.marginPct.toFixed(0)}%)</span>
                    </>
                  }
                  strong
                  tone={s.costing.margin >= 0 ? 'good' : 'bad'}
                />
              </>
            )}
            <Figure
              label={
                <>
                  <Flame size={13} aria-hidden="true" /> Energy
                </>
              }
              value={`${Math.round(s.kcal)} kcal`}
              incomplete={s.missingNutrition > 0}
            />
          </dl>
        </div>
      ))}

      {allAllergens.length > 0 && (
        <div>
          <p className="mb-1.5 text-label uppercase text-muted-foreground">Allergens</p>
          <div className="flex flex-wrap gap-1.5">
            {allAllergens.map((allergen) => (
              <AllergenChip key={allergen} allergen={allergen} />
            ))}
          </div>
        </div>
      )}

      {missingData && (
        <RowWarning>Marked figures (*) are incomplete — some ingredients have no cost or nutrition set on the stock item.</RowWarning>
      )}
    </div>
  );

  if (!framed)
    return (
      <section aria-labelledby={`${id}-title`}>
        <h3 id={`${id}-title`} className="mb-2 text-sm font-semibold text-foreground">
          {title}
        </h3>
        {body}
      </section>
    );
  return (
    <RecordGroup card id={id} title={title}>
      {body}
    </RecordGroup>
  );
}

/** One label–value line in a figures block; `*` marks a figure missing data. */
export function Figure({
  label,
  value,
  strong,
  tone,
  incomplete,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
  tone?: 'good' | 'bad';
  incomplete?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="flex items-center gap-1 text-muted-foreground">{label}</dt>
      <dd
        className={cn(strong && 'font-semibold', tone === 'good' ? 'text-momentum' : tone === 'bad' ? 'text-exception' : 'text-foreground')}
      >
        {value}
        {incomplete && <span className="text-measured">*</span>}
      </dd>
    </div>
  );
}
