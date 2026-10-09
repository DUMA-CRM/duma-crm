'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { InfoRow, InfoRows, RowTile, SectionInfo } from '@/components/cms/rows';
import { ChevronRight, Plus, Search, TicketPercent, Users } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { hasCapability } from '@/lib/auth/capabilities';
import { type PromotionListItem, getPromotions } from '@/lib/modules/promotions/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type PromotionStanding, STANDING_LABELS, promotionStanding, usageLabel } from '@/lib/utils/promotions';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { PromotionsTabs } from './PromotionsTabs';

type Filter = 'current' | 'archived';

export const STANDING_BADGE: Record<PromotionStanding, 'success' | 'reference' | 'warning' | 'muted'> = {
  live: 'success',
  scheduled: 'reference',
  paused: 'warning',
  used_up: 'muted',
  ended: 'muted',
  archived: 'muted',
};

/**
 * The promotions, in the Content lists' vocabulary: one card of rows — tile,
 * name and code, what it takes off, where it stands, how much it's been used —
 * and the totals in the aside. "New promotion" lives in the page header.
 */
export function PromotionsList({ onOpen, onNew }: { onOpen: (id: string) => void; onNew: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'promotions:write');
  const reduceMotion = useReducedMotion();
  const formatMoney = useFormatMoney();
  const [filter, setFilter] = useState<Filter>('current');
  const [search, setSearch] = useState('');
  // Pinned on mount so "Live" doesn't flip under a render.
  const [now] = useState(() => Date.now());

  const query = useQuery({
    queryKey: moduleQueryKeys.promotions.key('list', tenantId),
    queryFn: () => getPromotions(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const all = useMemo(() => query.data ?? [], [query.data]);
  const needle = search.trim().toLowerCase();
  const shown = all
    .filter((promotion) => (filter === 'archived' ? promotion.status === 'archived' : promotion.status !== 'archived'))
    .filter((promotion) => !needle || promotion.name.toLowerCase().includes(needle) || promotion.firstCode?.toLowerCase().includes(needle));

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

  if (query.isSuccess && all.length === 0)
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

  return header(
    <SettingsTabBody narrowAside aside={<PromotionsAside promotions={all} loaded={query.isSuccess} now={now} formatMoney={formatMoney} />}>
      <SettingsSection
        title="Promotions"
        actions={
          <SegmentedControl<Filter>
            value={filter}
            onChange={setFilter}
            ariaLabel="Which promotions"
            options={[
              { value: 'current', label: 'Current' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        }
      >
        {query.isPending ? (
          <TilesSkeleton count={4} label="Loading promotions" />
        ) : query.isError ? (
          <ErrorState title="Couldn’t load your promotions" onRetry={() => void query.refetch()} />
        ) : (
          <div className="space-y-3">
            {all.length > 6 && (
              <Input
                aria-label="Find a promotion"
                placeholder="Find by name or code"
                value={search}
                leftIcon={<Search size={14} aria-hidden="true" />}
                onChange={(event) => setSearch(event.target.value)}
              />
            )}
            {shown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {needle
                  ? `No promotion matches “${search.trim()}”.`
                  : filter === 'archived'
                    ? 'Nothing archived.'
                    : 'Everything is archived.'}
              </p>
            ) : (
              <ul className="space-y-2">
                {shown.map((promotion, index) => (
                  <motion.li
                    key={promotion.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: reduceMotion ? 0 : Math.min(index, 8) * 0.03 } }}
                  >
                    <PromotionRow promotion={promotion} now={now} onOpen={() => onOpen(promotion.id)} />
                  </motion.li>
                ))}
              </ul>
            )}
          </div>
        )}
      </SettingsSection>
    </SettingsTabBody>,
  );
}

/** One promotion: tile, name and code; its usage and standing on the right. */
function PromotionRow({ promotion, now, onOpen }: { promotion: PromotionListItem; now: number; onOpen: () => void }) {
  const standing = promotionStanding(promotion, now);
  const codes = promotion.codeCount;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-lg border border-rule/50 bg-control px-3 py-2.5 text-left transition-colors hover:border-rule focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      <RowTile icon={TicketPercent} tone={standing === 'live' ? 'success' : 'default'} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{promotion.name}</span>
          <Badge variant={STANDING_BADGE[standing]} className="shrink-0">
            {STANDING_LABELS[standing]}
          </Badge>
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {promotion.firstCode ? <span className="font-mono text-foreground">{promotion.firstCode}</span> : 'No code yet'}
          {codes > 1 && ` +${codes - 1} more`} · {promotion.summary}
        </span>
      </span>
      <span className="hidden shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:block">{usageLabel(promotion)}</span>
      <ChevronRight
        size={16}
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}

function PromotionsAside({
  promotions,
  loaded,
  now,
  formatMoney,
}: {
  promotions: PromotionListItem[];
  loaded: boolean;
  now: number;
  formatMoney: (value: number, digits?: number) => string;
}) {
  const live = promotions.filter((promotion) => promotionStanding(promotion, now) === 'live').length;
  const uses = promotions.reduce((sum, promotion) => sum + promotion.redemptionCount, 0);
  const given = promotions.reduce((sum, promotion) => sum + Number(promotion.discountTotal), 0);
  const figure = (value: React.ReactNode) => <span className="text-sm tabular-nums text-muted-foreground">{loaded ? value : '—'}</span>;
  return (
    <>
      <SettingsSection title="Overview">
        <InfoRows>
          <InfoRow icon={TicketPercent} title="Live now">
            {figure(
              <>
                <span className="text-foreground">{live}</span> of{' '}
                {promotions.filter((promotion) => promotion.status !== 'archived').length}
              </>,
            )}
          </InfoRow>
          <InfoRow icon={Users} title="Uses">
            {figure(uses.toLocaleString())}
          </InfoRow>
          <InfoRow icon={TicketPercent} title="Discount given">
            {figure(formatMoney(given, 2))}
          </InfoRow>
        </InfoRows>
      </SettingsSection>
      <SettingsSection
        title="How codes work"
        actions={
          <SectionInfo label="A code is checked when it's typed and again as the order is placed, so a limit can't be beaten by two tills at once. Cancelling or fully refunding the order gives the use back." />
        }
      >
        <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground">
          <li>The till takes the code on the whole order, after any loyalty reward.</li>
          <li>Codes that are once per customer, or for a first order, need a customer on the sale.</li>
          <li>Every use is recorded — open a promotion to see who used it.</li>
        </ul>
      </SettingsSection>
    </>
  );
}
