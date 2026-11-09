import Link from 'next/link';

import { ChevronRight } from '@/components/icons';

import { TOOLS_INDEX, freeTool } from '@/lib/marketing/tools';

/**
 * "Free tools › Cash-up calculator" above a tool's heading — the trail its
 * BreadcrumbList states, visible, as on a feature page. Server-rendered.
 */
export function ToolBreadcrumb({ path }: { path: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-5 flex items-center gap-1.5 text-sm text-[var(--mkt-ink-3)]">
      <Link href={TOOLS_INDEX.path} className="hover:text-foreground">
        {TOOLS_INDEX.name}
      </Link>
      <ChevronRight className="size-3.5" aria-hidden="true" />
      <span className="text-[var(--mkt-ink-2)]" aria-current="page">
        {freeTool(path).name}
      </span>
    </nav>
  );
}
