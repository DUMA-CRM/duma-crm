/**
 * The words for the /compare/duma-vs-… pages, one Comparison each — one file
 * per competitor in lib/marketing/compare/ — rendered by
 * components/marketing/compare/ComparePage.tsx through app/(marketing)/compare/[slug].
 *
 * Two rules, from the "DUMA Business Profile" vault note:
 *
 * 1. Every competitor fact is one we read on the competitor's own UK website,
 *    on the date in `checked`, and its row or line names the page in `source`.
 *    A fact we could not find there is left out, not guessed. Prices change:
 *    re-check each source and move `checked` when you edit a page.
 * 2. Every DUMA fact is true of the product today (the till's offline queue,
 *    recipe costing in lib/menu/costing.ts, the rota in components/scheduling,
 *    the Square, SumUp and Stripe Terminal reader connections in duma-api
 *    payment-connections.ts). Say where the competitor is stronger, and never
 *    say DUMA replaces Shopify. Readers are confirmed by staff on the till, so
 *    never claim payments reconcile automatically.
 */
import { DUMA_VS_LIGHTSPEED } from '@/lib/marketing/compare/lightspeed';
import { DUMA_VS_SEVENROOMS } from '@/lib/marketing/compare/sevenrooms';
import { DUMA_VS_SHOPIFY } from '@/lib/marketing/compare/shopify';
import { DUMA_VS_SQUARE } from '@/lib/marketing/compare/square';
import { DUMA_VS_SUNDAY } from '@/lib/marketing/compare/sunday';
import { DUMA_VS_ZAVO } from '@/lib/marketing/compare/zavo';
import type { Tone } from '@/lib/marketing/home';
import type { ListItem } from '@/lib/marketing/solutions';

export type SourcedFact = { text: string; source: string };

export type CompareVerdict = 'yes' | 'part' | 'no';

export type CompareRow = {
  job: string;
  duma: string;
  them: string;
  /** The competitor page `them` was read on. */
  source?: string;
  /**
   * The table's discs, as the text beside them says it. Left off rows where a
   * tick would be a judgment rather than a fact — prices and card fees.
   */
  marks?: { duma: CompareVerdict; them: CompareVerdict };
};

/** One line of the competitor's monthly bill, with the page its price was read on. */
export type BillLine = { label: string; pounds: number; source: string };

/** The icons the "stronger" cards can wear, mapped to components in ComparePage. */
export type StrongerIcon = 'payments' | 'hardware' | 'offline' | 'till' | 'scale' | 'store' | 'apps' | 'sync';

/** The icons the "different" cards can wear, mapped to components in ComparePage. */
export type DifferentIcon = 'bill' | 'margin' | 'team' | 'sync' | 'api' | 'help' | 'till' | 'apps' | 'customers' | 'card';

/**
 * What the "use both" diagram shows: the tools on the left, beaming into DUMA,
 * and what a sale in DUMA updates on the right. Only connections that exist —
 * `how` says plainly what each one is (a direct connection, a CSV import, the
 * amount keyed in).
 */
export type Connections = {
  sources: readonly { name: string; how: string; kind: 'card' | 'file' | 'api' | 'qr' | 'booking' | 'walkin'; logo?: 'Square' | 'SumUp' | 'Stripe' }[];
  updates: readonly { label: string; icon: 'stock' | 'margin' | 'customers' | 'reports' | 'rotas' | 'loyalty' }[];
  /** Under the picture; defaults to what connects and what a sale updates. */
  caption?: string;
};

export type Comparison = {
  slug: string;
  path: `/compare/${string}`;
  competitor: string;
  breadcrumb: string;
  metaTitle: string;
  description: string;
  /** ISO date the competitor facts were read on their site. */
  checked: string;
  /** "November 2026" — shown on the page beside every competitor figure. */
  asOf: string;
  hero: { lead: string; mark: string; subtitle: string; ticks: [string, string, string] };
  verdict: { title: string; paragraphs: string[] };
  table: { title: string; intro: string; rows: readonly CompareRow[] };
  pricing: {
    title: string;
    intro: string;
    /**
     * The competitor's paid parts for the business this page is about, itemised
     * and totalled per month — or, when they publish no prices, `unpublished`:
     * what their site says instead ("Get a quote"), never an estimate.
     */
    bill: { title: string; lines: readonly BillLine[]; note: string } | { unpublished: string; source: string };
    /** What the same parts cost on DUMA, under its £0. */
    dumaBill: { title: string; note: string };
    /** Everything else on their price list, each with its source. */
    facts: readonly SourcedFact[];
    duma: readonly string[];
  };
  stronger: {
    title: string;
    intro: string;
    /** What the competitor does better (`them`), and where DUMA stands on it today (`duma`). */
    items: readonly { title: string; them: string; duma: string; icon: StrongerIcon }[];
    /** The closing card: when the competitor alone is enough, and when to add DUMA. */
    verdict: { alone: string; addDuma: string };
  };
  different: { title: string; intro: string; items: readonly (ListItem & { icon: DifferentIcon; tone: Tone })[] };
  together: { title: string; intro: string; steps: readonly ListItem[]; connections: Connections };
  faqTitle: string;
  faqs: { question: string; answer: string }[];
  closing: { title: string; muted: string; body: string };
};

/** Every comparison, in the order the footer lists them. One file per competitor in lib/marketing/compare/. */
export const COMPARISONS: readonly Comparison[] = [
  DUMA_VS_SQUARE,
  DUMA_VS_SHOPIFY,
  DUMA_VS_LIGHTSPEED,
  DUMA_VS_SEVENROOMS,
  DUMA_VS_SUNDAY,
  DUMA_VS_ZAVO,
];

/** The comparison at /compare/<slug>, if there is one. */
export function comparisonFor(slug: string): Comparison | undefined {
  return COMPARISONS.find((comparison) => comparison.slug === slug);
}
