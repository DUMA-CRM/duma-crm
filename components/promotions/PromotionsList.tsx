'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { CalendarClock, Coins, Pause, Plus, Search, TicketPercent, X } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { Bone, FactsSkeleton, ListSkeleton } from '@/components/shared/Skeleton';
import type { Tone } from '@/components/shared/tone';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import { type PromotionListItem, getPromotions } from '@/lib/modules/promotions/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  KIND_LABELS,
  type PromotionKind,
  type PromotionStanding,
  STANDING_LABELS,
  promotionStanding,
  usageLabel,
} from '@/lib/utils/promotions';
import {
  PROMOTIONS_VIEW_LABELS,
  type PromotionsView,
  filterPromotions,
  inPromotionsView,
  promotionsOverview,
} from '@/lib/utils/promotions-overview';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { PromotionsTabs } from './PromotionsTabs';

export const STANDING_BADGE: Record<PromotionStanding, 'success' | 'reference' | 'warning' | 'muted'> = {
  live: 'success',
  scheduled: 'reference',
  paused: 'warning',
  used_up: 'muted',
  ended: 'muted',
  archived: 'muted',
};

const STANDING_TONE: Record<PromotionStanding, Tone> = {
  live: 'success',
  scheduled: 'info',
  paused: 'warning',
  used_up: 'muted',
  ended: 'muted',
  archived: 'muted',
};

const VIEWS: readonly PromotionsView[] = ['current', 'live', 'scheduled', 'paused', 'ended', 'archived'];
const KINDS = Object.keys(KIND_LABELS) as PromotionKind[];

/**
 * The promotions as a list, like Forms: four figures (the first three filter
 * the list), a search with the Show and Type selects and the count, then one
 * row per promotion. "New promotion" lives in the page header.
 */
export function PromotionsList({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'promotions:write');
  const reduceMotion = useReducedMotion();
  const formatMoney = useFormatMoney();
  const [view, setView] = useState<PromotionsView>('current');
  const [kind, setKind] = useState<PromotionKind | 'any'>('any');
  const [search, setSearch] = useState('');
  // Pinned on mount so "Live" doesn't flip under a render.
  const [now] = useState(() => Date.now());

  const query = useQuery({
    queryKey: moduleQueryKeys.promotions.key('list', tenantId),
    queryFn: () => getPromotions(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const all = useMemo(() => query.data ?? [], [query.data]);
  const overview = useMemo(() => promotionsOverview(all, now), [all, now]);
  const shown = filterPromotions(all, { view, kind, search }, now);

  const filtersActive = Boolean(search.trim()) || view !== 'current' || kind !== 'any';
  const clearFilters = () => {
    setSearch('');
    setView('current');
    setKind('any');
  };
  /** A figure picks its view; picking it again goes back to every current one. */
  const pick = (next: PromotionsView) => setView((current) => (current === next ? 'current' : next));

  const header = (body: React.ReactNode) => (
    <EditorShell
      eyebrow="Customer engagement"
      title="Promotions"
      icon={<TicketPercent size={20} aria-hidden="true" />}
      subheader={<PromotionsTabs value="promotions" />}
      actions={
        canWrite && all.length > 0 ? (
          <Button className="h-9 gap-1.5" onClick={onNew}>
            <Plus size={15} aria-hidden="true" />
            <span className="hidden md:inline">New promotion</span>
          </Button>
        ) : undefined
      }
    >
      {body}
    </EditorShell>
  );

  if (query.isPending)
    return header(
      <div className="flex flex-col gap-5" aria-busy="true">
        <FactsSkeleton count={4} label="Loading promotion figures" className="gap-3 sm:grid-cols-2 xl:grid-cols-4" />
        <div className="flex flex-wrap items-center gap-2">
          <Bone className="h-9 min-w-56 flex-1" />
          <Bone className="h-9 w-40" />
          <Bone className="h-9 w-40" />
        </div>
        <ListSkeleton rows={5} label="Loading your promotions" />
      </div>,
    );

  if (query.isError)
    return header(<ErrorState className="flex-1" title="Couldn’t load your promotions" onRetry={() => void query.refetch()} />);

  if (all.length === 0)
    return header(
      <EmptyState
        className="flex-1"
        icon={TicketPercent}
        title={canWrite ? 'Create your first promo code' : 'No promotions yet'}
        description={
          canWrite
            ? 'A percentage or an amount off, or a free item — with dates, limits and a record of every use. The till honours it the moment it’s live.'
            : 'Promotions appear here once someone who can manage them creates one.'
        }
        action={canWrite ? { label: 'New promotion', onClick: onNew, icon: Plus } : undefined}
      />,
    );

  const viewCount = (value: PromotionsView) => all.filter((promotion) => inPromotionsView(promotion, value, now)).length;

  return header(
    // Outside the settings shell, so it brings the shell's stagger with it.
    <motion.div
      className="flex flex-col gap-5"
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
    >
      <motion.dl variants={SECTION_RISE} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Fact
          surface="page"
          icon={TicketPercent}
          label="Live"
          value={overview.live}
          hint={`of ${overview.current} ${overview.current === 1 ? 'promotion' : 'promotions'}`}
          selected={view === 'live'}
          onSelect={() => pick('live')}
        />
        <Fact
          surface="page"
          icon={Pause}
          label="Paused"
          value={overview.paused}
          hint={overview.paused > 0 ? 'Codes don’t work' : 'None paused'}
          selected={view === 'paused'}
          onSelect={overview.paused > 0 || view === 'paused' ? () => pick('paused') : undefined}
        />
        <Fact
          surface="page"
          icon={CalendarClock}
          label="Ended"
          value={overview.ended}
          hint={overview.ended > 0 ? 'Past their date or used up' : 'None ended'}
          selected={view === 'ended'}
          onSelect={overview.ended > 0 || view === 'ended' ? () => pick('ended') : undefined}
        />
        <Fact
          surface="page"
          icon={Coins}
          label="Discount given"
          value={formatMoney(Number(overview.discountGiven), 2)}
          hint={`over ${overview.uses.toLocaleString('en-GB')} ${overview.uses === 1 ? 'use' : 'uses'}`}
        />
      </motion.dl>

      <motion.section variants={SECTION_RISE} className="flex flex-col gap-3" aria-label="Promotions">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-56 flex-1">
            <Input
              type="search"
              aria-label="Find a promotion by name or code"
              placeholder="Name or code…"
              value={search}
              leftIcon={<Search size={14} aria-hidden="true" />}
              onChange={(event) => setSearch(event.target.value)}
              rightAction={
                search ? (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear search"
                    className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                ) : undefined
              }
            />
          </div>
          <Select
            value={view}
            onValueChange={(value) => setView(value as PromotionsView)}
            options={VIEWS.map((value) => ({ value, label: `${PROMOTIONS_VIEW_LABELS[value]} · ${viewCount(value)}` }))}
            ariaLabel="Which promotions"
            className="w-40"
          />
          <Select
            value={kind}
            onValueChange={(value) => setKind(value as PromotionKind | 'any')}
            options={[{ value: 'any', label: 'Any type' }, ...KINDS.map((value) => ({ value, label: KIND_LABELS[value] }))]}
            ariaLabel="Type of promotion"
            className="w-40"
          />
          <span className="ml-auto text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {filtersActive
              ? `${shown.length} of ${all.length}`
              : `${overview.current} ${overview.current === 1 ? 'promotion' : 'promotions'}`}
          </span>
        </div>

        {shown.length === 0 ? (
          <EmptyState
            icon={Search}
            kind="search"
            title="No promotion matches"
            description="Try a different search or filter."
            action={{ label: 'Clear filters', onClick: clearFilters }}
          />
        ) : (
          <ListRowGroup aria-label="Promotions">
            {shown.map((promotion) => (
              <PromotionRow key={promotion.id} promotion={promotion} now={now} onOpen={() => onOpen(promotion.id)} />
            ))}
          </ListRowGroup>
        )}
      </motion.section>
    </motion.div>,
  );
}

/** One promotion: tile, name and where it stands; its code and offer; its uses on the right. */
function PromotionRow({ promotion, now, onOpen }: { promotion: PromotionListItem; now: number; onOpen: () => void }) {
  const standing = promotionStanding(promotion, now);
  const more = promotion.codeCount - 1;
  return (
    <ListRow
      icon={TicketPercent}
      tone={STANDING_TONE[standing]}
      title={promotion.name}
      titleExtra={
        <Badge variant={STANDING_BADGE[standing]} className="shrink-0">
          {STANDING_LABELS[standing]}
        </Badge>
      }
      meta={
        <>
          {promotion.firstCode ? <span className="font-mono text-foreground">{promotion.firstCode}</span> : 'No code yet'}
          {more > 0 && ` +${more} more`} · {promotion.summary}
        </>
      }
      trailing={<span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">{usageLabel(promotion)}</span>}
      onClick={onOpen}
    />
  );
}
