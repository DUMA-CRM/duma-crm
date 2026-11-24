'use client';

import { useQueries, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { Flag, ModuleReading, NeedRows, Parts } from '@/components/dashboard/ModuleCards';
import { Widget } from '@/components/dashboard/widget/Widget';
import { ClipboardList, Megaphone, Plug, TicketPercent } from '@/components/icons';

import { firstWords, formResponsesSummary, promotionsCardSummary, recentUses, socialPostsSummary } from '@/lib/dashboard/engagement-cards';
import { type FormListItem, getForms } from '@/lib/modules/forms/client';
import { LABELS, type Post, type Target, accounts, marketingKey, posts } from '@/lib/modules/marketing/client';
import { type PromotionListItem, getPromotionRedemptions, getPromotions } from '@/lib/modules/promotions/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { plural } from '@/lib/utils/format';
import { marketingStatusLabel } from '@/lib/utils/marketing-status';
import { usageLabel } from '@/lib/utils/promotions';
import { relativeTime } from '@/lib/utils/relative-time';
import { formatInstant } from '@/lib/utils/workspace-time';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/* The engagement cards: promotions, form responses and social posts. Each
 * reads its screen's own query — same key, same cache — so a change made on
 * that screen shows here without a refresh of its own. */

const DAY = 86_400_000;

// ── Promotions ───────────────────────────────────────────────────────────────

/** Past this many live promotions the week's uses aren't fetched one by one; the card shows total uses instead. */
const USES_FAN_OUT = 12;

export function PromotionsCard() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  // Pinned on mount so "live" doesn't flip under a render.
  const [now] = useState(() => Date.now());
  // The Promotions list's own query, invalidated by every change made there.
  const list = useQuery({
    queryKey: moduleQueryKeys.promotions.key('list', tenantId),
    queryFn: () => getPromotions(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const summary = useMemo(() => promotionsCardSummary(list.data ?? [], now), [list.data, now]);

  return (
    <Widget
      title="Promotions"
      icon={TicketPercent}
      tint="brand"
      surface="plain"
      href="/promotions"
      hrefLabel="Open promotions"
      loading={Boolean(tenantId) && list.isPending}
      error={list.isError}
      onRetry={() => void list.refetch()}
      empty={
        !tenantId
          ? { title: 'Choose a workspace' }
          : list.data && summary.total === 0
            ? { title: 'No promotions yet', detail: 'Create a code in Promotions.' }
            : undefined
      }
    >
      {list.data && summary.total > 0 && <PromotionsReading summary={summary} tenantId={tenantId} now={now} />}
    </Widget>
  );
}

/**
 * The live codes as the figure, the promotions as one split — live,
 * scheduled, paused, ended — then the live ones, anything ending within a
 * week first, each with its uses this week.
 */
function PromotionsReading({
  summary,
  tenantId,
  now,
}: {
  summary: ReturnType<typeof promotionsCardSummary<PromotionListItem>>;
  tenantId: string | null;
  now: number;
}) {
  const counted = summary.live.length <= USES_FAN_OUT ? summary.live : [];
  // Each promotion's first page of uses — the editor's own key, newest first.
  const pages = useQueries({
    queries: counted.map((promotion) => ({
      queryKey: moduleQueryKeys.promotions.key('redemptions', promotion.id, 1, tenantId),
      queryFn: () => getPromotionRedemptions(promotion.id, 1, tenantId ?? undefined),
    })),
  });
  const usesOf = new Map(
    counted.flatMap((promotion, index) => {
      const page = pages[index]?.data;
      return page ? [[promotion.id, recentUses(page, now)] as const] : [];
    }),
  );
  // Only a sum over every live promotion is a weekly figure; one missing page would make it short.
  const week =
    summary.live.length > 0 && usesOf.size === summary.live.length
      ? [...usesOf.values()].reduce((sum, uses) => ({ uses: sum.uses + uses.uses, capped: sum.capped || uses.capped }), {
          uses: 0,
          capped: false,
        })
      : null;
  const weekLabel = week
    ? `${week.uses.toLocaleString('en-GB')}${week.capped ? '+' : ''} ${week.uses === 1 && !week.capped ? 'use' : 'uses'} this week`
    : null;
  // Until the week is counted (or past the fan-out), the live codes' uses so far.
  const usesLine =
    weekLabel ??
    (summary.live.length === 0
      ? 'Nothing live'
      : `${plural(
          summary.live.reduce((sum, promotion) => sum + promotion.redemptionCount, 0),
          'use',
        )} so far`);
  const share = (value: number) => value / Math.max(summary.total, 1);
  const soon = summary.endingSoon > 0 && (
    <Flag key="soon" tone="warning">
      {summary.endingSoon} ending soon
    </Flag>
  );

  return (
    <ModuleReading
      value={summary.live.length.toLocaleString('en-GB')}
      unit="live"
      noun={['promotion', 'promotions']}
      caption={weekLabel ? `live · ${weekLabel}` : `live · ${plural(summary.total, 'promotion')}`}
      status={<Parts>{[soon, usesLine]}</Parts>}
      slimStatus={soon || usesLine}
      segments={[
        {
          key: 'live',
          label: 'Live',
          value: summary.live.length,
          share: share(summary.live.length),
          fill: 'bg-momentum',
          legend: summary.live.length,
        },
        {
          key: 'scheduled',
          label: 'Scheduled',
          value: summary.scheduled,
          share: share(summary.scheduled),
          fill: 'bg-reference',
          legend: summary.scheduled,
        },
        {
          key: 'paused',
          label: 'Paused',
          value: summary.paused,
          share: share(summary.paused),
          fill: 'bg-measured',
          legend: summary.paused,
        },
        {
          key: 'ended',
          label: 'Ended',
          value: summary.ended,
          share: share(summary.ended),
          fill: 'bg-muted-foreground/40',
          legend: summary.ended,
        },
      ]}
      listTitle="Live codes"
      list={(capacity, detailed) => (
        <NeedRows
          capacity={capacity}
          detailed={detailed}
          clear="No promotions live right now"
          items={summary.live.map((promotion) => {
            const ending = promotion.endsAt !== null && Date.parse(promotion.endsAt) - now <= 7 * DAY;
            const uses = usesOf.get(promotion.id);
            return {
              key: promotion.id,
              href: `/promotions?promotion=${promotion.id}`,
              tone: ending ? 'warning' : 'success',
              toneLabel: ending ? 'Ending soon' : 'Live',
              title: promotion.name,
              meta: [promotion.firstCode, usageLabel(promotion)].filter(Boolean).join(' · '),
              value: ending ? (
                <Flag tone="warning">Ends {relativeTime(promotion.endsAt, now)}</Flag>
              ) : uses ? (
                <span className="font-normal text-muted-foreground">{`${uses.uses}${uses.capped ? '+' : ''} this week`}</span>
              ) : undefined,
            };
          })}
        />
      )}
    />
  );
}

// ── Forms ────────────────────────────────────────────────────────────────────

export function FormResponsesCard() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  // The Forms list's own query: a response marked reviewed there invalidates every forms key, this one too.
  const forms = useQuery({
    queryKey: moduleQueryKeys.forms.key('list', tenantId),
    queryFn: () => getForms(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });

  return (
    <Widget
      title="Form responses"
      icon={ClipboardList}
      tint="brand"
      surface="plain"
      href="/forms"
      hrefLabel="Open forms"
      loading={Boolean(tenantId) && forms.isPending}
      error={forms.isError}
      onRetry={() => void forms.refetch()}
      empty={
        !tenantId
          ? { title: 'Choose a workspace' }
          : forms.data?.length === 0
            ? { title: 'No forms yet', detail: 'Build one in Forms to start collecting responses.' }
            : undefined
      }
    >
      {forms.data && forms.data.length > 0 && <FormResponsesReading forms={forms.data} />}
    </Widget>
  );
}

/** New responses as the figure, new against seen as one split, then the forms they came in on, the newest first. */
function FormResponsesReading({ forms }: { forms: FormListItem[] }) {
  const [now] = useState(() => Date.now());
  const { fresh, seen, stored, waiting } = formResponsesSummary(forms);
  const share = (value: number) => value / Math.max(stored, 1);

  return (
    <ModuleReading
      value={fresh.toLocaleString('en-GB')}
      unit="new"
      noun={['response', 'responses']}
      caption={fresh > 0 ? `new · ${plural(waiting.length, 'form')}` : 'new responses'}
      status={fresh > 0 ? `${plural(fresh, 'response')} to look at` : 'All caught up'}
      slimStatus={fresh > 0 ? `${plural(waiting.length, 'form')}` : 'All caught up'}
      segments={[
        { key: 'new', label: 'New', value: fresh, share: share(fresh), fill: 'bg-reference', legend: fresh },
        { key: 'seen', label: 'Seen', value: seen, share: share(seen), fill: 'bg-momentum', legend: seen },
      ]}
      listTitle="Newest responses"
      list={(capacity, detailed) => (
        <NeedRows
          capacity={capacity}
          detailed={detailed}
          clear="No new responses"
          items={waiting.map((form) => ({
            key: form.id,
            href: `/forms?form=${form.id}&tab=responses`,
            tone: 'info',
            toneLabel: 'New responses',
            title: form.name,
            meta: form.lastResponseAt ? `Latest ${relativeTime(form.lastResponseAt, now)}` : undefined,
            value: `${form.newResponses.toLocaleString('en-GB')} new`,
          }))}
        />
      )}
    />
  );
}

// ── Social marketing ─────────────────────────────────────────────────────────

const WHEN: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };

export function SocialPostsCard() {
  const tid = useWorkspaceStore((state) => state.tenantId);
  // Two weeks back for anything that didn't go out, twelve ahead for what will — inside the API's 100-day limit.
  // Rounded to the day so the key holds still; every marketing change invalidates the whole `marketingKey(tid)`.
  const [range] = useState(() => {
    const today = Math.floor(Date.now() / DAY) * DAY;
    return { from: new Date(today - 14 * DAY).toISOString(), to: new Date(today + 84 * DAY).toISOString() };
  });
  const [now] = useState(() => Date.now());
  const list = useQuery({
    queryKey: marketingKey(tid, 'posts', range.from, range.to, 1),
    queryFn: () => posts(range.from, range.to, 1),
    enabled: Boolean(tid),
  });
  // The Marketing page's accounts, for each destination's channel.
  const connected = useQuery({ queryKey: marketingKey(tid, 'accounts'), queryFn: accounts, enabled: Boolean(tid) });
  const summary = useMemo(() => socialPostsSummary<Target, Post>(list.data?.data ?? [], now), [list.data, now]);
  const nothing = summary.attention.length + summary.upcoming.length + summary.published === 0;

  return (
    <Widget
      title="Social posts"
      icon={Megaphone}
      tint="brand"
      surface="plain"
      href="/marketing"
      hrefLabel="Open marketing"
      loading={Boolean(tid) && (list.isPending || connected.isPending)}
      error={list.isError || connected.isError}
      onRetry={() => {
        void list.refetch();
        void connected.refetch();
      }}
      empty={
        !tid
          ? { title: 'Choose a workspace' }
          : connected.data?.length === 0 && nothing
            ? { icon: Plug, title: 'No social accounts connected', detail: 'Connect one in Settings, then plan posts in Marketing.' }
            : list.data && nothing
              ? { title: 'Nothing scheduled', detail: 'Plan a post in Marketing.' }
              : undefined
      }
    >
      {list.data && !nothing && <SocialPostsReading summary={summary} channels={connected.data ?? []} now={now} />}
    </Widget>
  );
}

/**
 * What is scheduled as the figure, the window's destinations as one split —
 * to go, published, needing someone — then the ones that didn't go out,
 * followed by what goes out next, soonest first.
 */
function SocialPostsReading({
  summary,
  channels,
  now,
}: {
  summary: ReturnType<typeof socialPostsSummary<Target, Post>>;
  channels: { id: string; provider: keyof typeof LABELS; name: string }[];
  now: number;
}) {
  const { attention, upcoming, published, next } = summary;
  const total = attention.length + upcoming.length + published;
  const share = (value: number) => value / Math.max(total, 1);
  const channelOf = (connectionId: string) => {
    const account = channels.find((channel) => channel.id === connectionId);
    return account ? `${LABELS[account.provider]} · ${account.name}` : 'Social';
  };
  const flagged = attention.length > 0 && (
    <Flag key="attention" tone="exception">
      {attention.length} need checking
    </Flag>
  );
  const nextLine = next ? `Next ${relativeTime(next, now)}` : 'Nothing else scheduled';

  return (
    <ModuleReading
      value={upcoming.length.toLocaleString('en-GB')}
      unit="scheduled"
      caption={next ? `scheduled · next ${formatInstant(next, WHEN)}` : 'scheduled'}
      status={<Parts>{[flagged, nextLine]}</Parts>}
      slimStatus={flagged || nextLine}
      segments={[
        {
          key: 'scheduled',
          label: 'Scheduled',
          value: upcoming.length,
          share: share(upcoming.length),
          fill: 'bg-reference',
          legend: upcoming.length,
        },
        { key: 'published', label: 'Published', value: published, share: share(published), fill: 'bg-momentum', legend: published },
        {
          key: 'attention',
          label: 'Needs checking',
          value: attention.length,
          share: share(attention.length),
          fill: 'bg-exception',
          legend: attention.length,
        },
      ]}
      listTitle={attention.length > 0 ? 'To check, then next out' : 'Next out'}
      list={(capacity, detailed) => (
        <NeedRows
          capacity={capacity}
          detailed={detailed}
          clear="Nothing scheduled to go out"
          items={[
            ...attention.map(({ post, target }) => ({
              key: target.id,
              href: '/marketing',
              tone: 'exception' as const,
              toneLabel: marketingStatusLabel(target.status),
              title: firstWords(target.caption || post.caption || post.title || 'Untitled post'),
              meta: [channelOf(target.connectionId), target.error].filter(Boolean).join(' · '),
              value: <Flag tone="exception">{marketingStatusLabel(target.status)}</Flag>,
            })),
            ...upcoming.map(({ post, target }) => ({
              key: target.id,
              href: '/marketing',
              tone: 'info' as const,
              toneLabel: 'Scheduled',
              title: firstWords(target.caption || post.caption || post.title || 'Untitled post'),
              meta: channelOf(target.connectionId),
              value: <span className="font-normal text-muted-foreground">{formatInstant(target.scheduledAt, WHEN)}</span>,
            })),
          ]}
        />
      )}
    />
  );
}
