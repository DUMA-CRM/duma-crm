/**
 * The free tools at /tools/*, for what is shared between them: the /tools
 * index and its ItemList, each tool's breadcrumb, and the "Related" links
 * from one tool to the others and to the glossary terms it works out.
 *
 * A new tool goes here, in PAGES (lib/marketing/site.ts) for the sitemap and
 * the footer, in lib/blog/llms.ts, and as a card on app/(marketing)/tools/page.tsx.
 */
export type FreeTool = {
  path: string;
  /** The tool's name, as its WebApplication schema and its breadcrumb give it. */
  name: string;
  /** One line on what it works out — the anchor text of a link to it. */
  summary: string;
  /** Glossary slugs for the terms the tool calculates, linked from its page. */
  terms: readonly string[];
};

export const TOOLS_INDEX = { path: '/tools', name: 'Free tools' } as const;

export const FREE_TOOLS: readonly FreeTool[] = [
  {
    path: '/tools/margin-calculator',
    name: 'Menu margin & GP calculator',
    summary: 'Menu margin and GP calculator, with VAT',
    terms: ['gross-profit-margin', 'food-cost-percentage', 'margin-vs-markup', 'vat-inclusive-pricing'],
  },
  {
    path: '/tools/cash-up-calculator',
    name: 'Cash-up calculator',
    summary: 'Till cash-up calculator: over, short and what to bank',
    terms: ['cash-up', 'net-sales', 'discounts-and-voids'],
  },
];

export function freeTool(path: string): FreeTool {
  const tool = FREE_TOOLS.find((t) => t.path === path);
  if (!tool) throw new Error(`No free tool at ${path}`);
  return tool;
}

/** Every tool but this one, as related links. */
export function otherTools(path: string): { path: string; label: string }[] {
  return FREE_TOOLS.filter((t) => t.path !== path).map((t) => ({ path: t.path, label: t.summary }));
}
