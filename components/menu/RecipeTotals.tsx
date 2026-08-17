'use client';

import { Flame, TriangleAlert } from '@/components/icons';
import { Badge } from '@/components/ui/badge';

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
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>

      <div className="space-y-2">
        {summary.map((s) => (
          <div key={s.col.id} className="rounded-sm border border-rule bg-card p-3">
            {/* Only worth a size heading when there is more than one size. */}
            {summary.length > 1 && (
              <p className="mb-2 text-micro font-semibold uppercase tracking-micro text-muted-foreground">{s.col.label}</p>
            )}

            <div className="space-y-1.5 text-sm tabular-nums">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-muted-foreground">Ingredients</span>
                <span className="font-semibold text-foreground">
                  {formatMoney(s.cogs, 2)}
                  {s.missingCost > 0 && <span className="text-warning">*</span>}
                </span>
              </div>

              {showMargin && s.costing && (
                <>
                  {s.costing.vat > 0 && (
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-muted-foreground">VAT ({s.costing.vatRate}%)</span>
                      <span className="text-muted-foreground">−{formatMoney(s.costing.vat, 2)}</span>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-muted-foreground">Margin</span>
                    <span className={cn('font-semibold', s.costing.margin >= 0 ? 'text-success' : 'text-destructive')}>
                      {formatMoney(s.costing.margin, 2)}{' '}
                      <span className="font-normal text-muted-foreground">({s.costing.marginPct.toFixed(0)}%)</span>
                    </span>
                  </div>
                </>
              )}

              <div className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Flame size={13} aria-hidden="true" />
                  Energy
                </span>
                <span className="text-foreground">
                  {Math.round(s.kcal)} kcal
                  {s.missingNutrition > 0 && <span className="text-warning">*</span>}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {allAllergens.length > 0 && (
        <div className="rounded-sm border border-rule bg-card p-3">
          <p className="mb-2 text-micro font-semibold uppercase tracking-micro text-muted-foreground">Allergens</p>
          <div className="flex flex-wrap gap-1.5">
            {allAllergens.map((allergen) => (
              <Badge key={allergen} variant="warning" className="capitalize">
                {allergen}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {missingData && (
        <div className="flex items-start gap-2 rounded-sm border border-warning/40 bg-warning/6 p-3">
          <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-warning">
            Marked figures (*) are incomplete — some ingredients have no cost or nutrition set on the stock item.
          </p>
        </div>
      )}
    </div>
  );
}
