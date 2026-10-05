'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

import {
  Ban,
  Banknote,
  BarChart3,
  Calculator,
  Clock,
  Download,
  Gauge,
  type IconComponent,
  LineChart,
  Package,
  Printer,
  Receipt,
  Repeat,
  RotateCcw,
  Scale,
  Store,
  Timer,
  Trash2,
  Truck,
  Users,
  UtensilsCrossed,
  Wallet,
} from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { Button } from '@/components/ui/button';

import { REPORT_CATEGORIES, type ReportDefinition, type ReportId } from '@/lib/reports/catalogue';
import { rangeDates } from '@/lib/utils/report-filters';

import { ReportFilterBar } from './ReportFilterBar';
import type { ReportFilterState } from './useReportFilters';

/** The glyph each report carries in the library and its own header. */
export const REPORT_ICON: Record<ReportId, IconComponent> = {
  'sales-summary': LineChart,
  'sales-by-hour': Clock,
  'sales-by-channel': BarChart3,
  'sales-by-location': Store,
  'payment-methods': Wallet,
  vat: Calculator,
  'item-sales': UtensilsCrossed,
  'menu-engineering': Scale,
  refunds: RotateCcw,
  'discounts-voids': Ban,
  'labour-vs-sales': Timer,
  'staff-hours': Users,
  'customer-retention': Repeat,
  'stock-usage': Package,
  waste: Trash2,
  purchasing: Truck,
  'end-of-day': Banknote,
  'prime-cost': Gauge,
};

/** Fallback for anything without its own glyph. */
export const DEFAULT_REPORT_ICON: IconComponent = Receipt;

/** Saves text as a file — the CSV export, built in the browser from what is on screen. */
export function downloadFile(name: string, contents: string, type = 'text/csv;charset=utf-8') {
  // A byte-order mark so Excel opens UTF-8 (£, accents) correctly.
  const blob = new Blob(['﻿', contents], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Prints just the report: the body is copied into a fresh window with the
 * page's own stylesheets, so the sidebar, header and filter bar don't print and
 * the charts (inline SVG) print exactly as drawn.
 */
function printElement(element: HTMLElement, title: string, subtitle: string) {
  const popup = window.open('', '_blank', 'width=1024,height=768');
  if (!popup) return;
  const styles = [...document.querySelectorAll('link[rel="stylesheet"], style')].map((node) => node.outerHTML).join('\n');
  const theme = document.documentElement.className;
  popup.document
    .write(`<!doctype html><html class="${theme.replace(/"/g, '')}" data-theme="light"><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title>${styles}
<style>@page{margin:14mm}button{display:none!important}</style></head>
<body class="bg-background p-0 text-foreground"><div class="mb-4"><h1 class="text-lg font-semibold">${title.replace(/</g, '&lt;')}</h1><p class="text-xs text-muted-foreground">${subtitle.replace(/</g, '&lt;')}</p></div>${element.innerHTML}</body></html>`);
  popup.document.close();
  // Give the stylesheets a moment to apply before the print dialog snapshots the page.
  popup.addEventListener('load', () => {
    popup.focus();
    popup.print();
  });
  setTimeout(() => {
    try {
      popup.focus();
      popup.print();
    } catch {
      // Already printed from the load handler, or the window was closed.
    }
  }, 600);
}

/**
 * One report: its title and category in the header, the shared filter bar
 * beneath, Export CSV and Print on the right, then the report itself — the
 * same anatomy for every report, as Toast and Square keep theirs.
 */
export function ReportFrame({
  report,
  filters,
  onExport,
  canPrint = true,
  children,
}: {
  report: ReportDefinition;
  filters: ReportFilterState;
  /** Builds and downloads the CSV; omitted while there is nothing to export. */
  onExport?: () => void;
  canPrint?: boolean;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const body = useRef<HTMLDivElement>(null);
  const Icon = REPORT_ICON[report.id] ?? DEFAULT_REPORT_ICON;
  const category = REPORT_CATEGORIES.find((entry) => entry.id === report.category);
  const back = filters.query ? `/reports?${filters.query}` : '/reports';
  const subtitle = [rangeDates(filters.range), filters.locationName ?? (report.allLocationsOnly ? 'Every location' : 'All locations')].join(
    ' · ',
  );

  return (
    <EditorShell
      eyebrow={category?.label ?? 'Reports'}
      title={report.title}
      icon={<Icon size={20} aria-hidden="true" />}
      onClose={() => router.push(back)}
      // The span of days, beside the title: the date button names the preset, this names the days.
      meta={<span className="hidden text-sm tabular-nums text-muted-foreground xl:inline">{rangeDates(filters.range)}</span>}
      actions={
        <>
          {/* The filters live in the header from md up; a phone gets them as a row below. */}
          <div className="hidden md:block">
            <ReportFilterBar
              state={filters}
              allLocationsOnly={report.allLocationsOnly}
              noComparison={report.noComparison}
              layout="header"
            />
          </div>
          <span className="mx-0.5 hidden h-6 w-px bg-divider md:block" aria-hidden="true" />
          {canPrint && (
            <Button
              variant="outline"
              size="icon"
              className="size-9"
              onClick={() => body.current && printElement(body.current, report.title, subtitle)}
              aria-label="Print this report"
              title="Print"
            >
              <Printer size={15} aria-hidden="true" />
            </Button>
          )}
          <Button className="h-9 gap-1.5" onClick={onExport} disabled={!onExport} aria-label="Export as CSV" title="Export as CSV">
            <Download size={15} aria-hidden="true" />
            <span className="hidden 2xl:inline">Export CSV</span>
          </Button>
        </>
      }
      subheader={
        <div className="border-b border-divider bg-card px-3 py-2 md:hidden">
          <ReportFilterBar state={filters} allLocationsOnly={report.allLocationsOnly} noComparison={report.noComparison} />
        </div>
      }
    >
      <motion.div
        ref={body}
        key={`${filters.query}`}
        className="space-y-6"
        initial={reduceMotion ? false : 'hidden'}
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.05 } } }}
      >
        {children}
      </motion.div>
    </EditorShell>
  );
}
