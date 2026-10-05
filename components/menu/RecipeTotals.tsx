'use client';

import { Flame, TriangleAlert } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';

import { cn } from '@/lib/utils/cn';
import { formatMoney } from '@/lib/utils/dashboard';
import type { Costing } from '@/lib/menu/costing';

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
}: {
  summary: SummaryEntry[];
  allAllergens: string[];
  /** Menu items have a sale price to measure against; modifiers only add cost. */
  showMargin?: boolean;
  title?: string;
}) {
  const missingData = summary.some((s) => s.missingCost > 0 || s.missingNutrition > 0);

  return (
    <SettingsSection title={title}>
      <div className="space-y-3">
        {summary.map((s) => (
          <div key={s.col.id} className="rounded-lg border border-rule/60 bg-card px-3.5 py-3">
            {/* Only worth a size heading when there is more than one size. */}
            {summary.length > 1 && <p className="mb-2 text-label uppercase text-muted-foreground">{s.col.label}</p>}
            <dl className="space-y-1.5 text-sm tabular-nums">
              <Figure label="Ingredients" value={formatMoney(s.cogs, 2)} strong incomplete={s.missingCost > 0} />
              {showMargin && s.costing && (
                <>
                  {s.costing.vat > 0 && <Figure label={`VAT (${s.costing.vatRate}%)`} value={`−${formatMoney(s.costing.vat, 2)}`} />}
                  <Figure
                    label="Margin"
                    value={
                      <>
                        {formatMoney(s.costing.margin, 2)} <span className="font-normal text-muted-foreground">({s.costing.marginPct.toFixed(0)}%)</span>
                      </>
                    }
                    strong
                    tone={s.costing.margin >= 0 ? 'good' : 'bad'}
                  />
                </>
              )}
              <Figure label={<><Flame size={13} aria-hidden="true" /> Energy</>} value={`${Math.round(s.kcal)} kcal`} incomplete={s.missingNutrition > 0} />
            </dl>
          </div>
        ))}

        {allAllergens.length > 0 && (
          <div>
            <p className="mb-2 text-label uppercase text-muted-foreground">Allergens</p>
            <div className="flex flex-wrap gap-1.5">
              {allAllergens.map((allergen) => (
                <span key={allergen} className="rounded-sm bg-measured/10 px-2 py-0.5 text-xs font-semibold capitalize text-measured">
                  {allergen}
                </span>
              ))}
            </div>
          </div>
        )}

        {missingData && (
          <p className="flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs leading-relaxed text-measured">
            <TriangleAlert size={13} className="mt-px shrink-0" aria-hidden="true" />
            Marked figures (*) are incomplete — some ingredients have no cost or nutrition set on the stock item.
          </p>
        )}
      </div>
    </SettingsSection>
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
      <dd className={cn(strong && 'font-semibold', tone === 'good' ? 'text-momentum' : tone === 'bad' ? 'text-exception' : 'text-foreground')}>
        {value}
        {incomplete && <span className="text-measured">*</span>}
      </dd>
    </div>
  );
}
