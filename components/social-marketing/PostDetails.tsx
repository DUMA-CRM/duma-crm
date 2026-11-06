'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import { useEffect, useState } from 'react';

import { BrandTile, InfoRow, InfoRows, RowMenu, type RowMenuItem, RowTile, RowWarning } from '@/components/cms/rows';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Pencil,
  Play,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { CONNECTOR_BRANDS } from '@/components/settings/connectors/brands';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { hasCapability } from '@/lib/auth/capabilities';
import {
  type Account,
  type Asset,
  LABELS,
  PLATFORMS,
  type Platform,
  type Post,
  type Target,
  assetSrc,
  cancelTarget,
  history,
  marketingKey,
  resolveTarget,
  retryTarget,
} from '@/lib/modules/marketing/client';
import { cn } from '@/lib/utils/cn';
import {
  type DestinationStep,
  destinationSummary,
  destinationTimeline,
  durationLabel,
  marketingStatusBadge,
  marketingStatusLabel,
  targetStatusLabel,
} from '@/lib/utils/marketing-status';
import { formatInstant } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { MediaViewer } from './MediaViewer';

type Outcome = 'published' | 'cancelled';

/** An account as a row's tile: its brand, or a plain tile when it's gone. */
export const accountTile = (account?: Account) => {
  const brand = account && CONNECTOR_BRANDS[account.provider];
  return brand ? <BrandTile brand={brand} /> : <RowTile icon={Send} />;
};

/** A brand's mark at text size, for the platform tabs. */
export function BrandMark({ platform }: { platform: Platform }) {
  const brand = CONNECTOR_BRANDS[platform];
  if (!brand) return null;
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-3.5 shrink-0" style={{ color: brand.background }}>
      <path d={brand.path} />
    </svg>
  );
}

const when = (at: string) => formatInstant(at, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * A post as its record: where it stands across every destination, the post
 * itself with its media, each destination with its status and the one thing to
 * do about it, then what publishing has tried. With more than one platform,
 * tabs narrow the destinations and activity to one. Every action is immediate;
 * cancelling and recording an outcome confirm first.
 */
export function PostDetails({
  post,
  accounts,
  onClose,
  onEdit,
  onDuplicate,
  onChange,
  onDelete,
}: {
  post: Post;
  accounts: Account[];
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onChange: () => void;
  /** Absent when this post can't be deleted now (being sent, or no permission). */
  onDelete?: () => void;
}) {
  const caps = useAuthStore((s) => s.capabilities),
    tid = useWorkspaceStore((s) => s.tenantId),
    canPublish = hasCapability(caps, 'marketing:publish'),
    canWrite = hasCapability(caps, 'marketing:write');
  const [action, setAction] = useState<{ id: string; outcome: Outcome | 'cancel' } | null>(null);
  const [tab, setTab] = useState<Platform | 'all'>('all');
  const [now] = useState(() => Date.now());
  // While anything is on its way, keep the timeline current; the calendar refreshes the post itself.
  const inFlight = post.targets.some((t) => ['uploading', 'processing'].includes(t.status));
  const q = useQuery({
    queryKey: marketingKey(tid, 'history', post.id),
    queryFn: () => history(post.id),
    refetchInterval: inFlight ? 5000 : false,
  });
  const cancel = useMutation({
    mutationFn: cancelTarget,
    onSuccess: () => {
      setAction(null);
      onChange();
    },
  });
  const retry = useMutation({ mutationFn: retryTarget, onSuccess: onChange });
  const resolve = useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: Outcome }) => resolveTarget(id, outcome),
    onSuccess: () => {
      setAction(null);
      onChange();
    },
  });

  const accountOf = (t?: Target) => accounts.find((a) => a.id === t?.connectionId);
  const platformOf = (t?: Target) => accountOf(t)?.provider;
  const platforms = PLATFORMS.filter((p) => post.targets.some((t) => platformOf(t) === p));
  const shown = tab === 'all' ? post.targets : post.targets.filter((t) => platformOf(t) === tab);
  const summary = destinationSummary(post.targets, now);
  const media = [...new Map(post.targets.flatMap((t) => t.assets).map((a) => [a.id, a])).values()];
  const failure = cancel.error ?? resolve.error ?? retry.error;
  const outLabel = summary.nextAt
    ? when(summary.nextAt)
    : summary.total && summary.published + summary.cancelled === summary.total
      ? 'All sent'
      : 'Not scheduled';

  return (
    <Drawer
      title={post.title}
      leading={
        platforms.length ? (
          <span className="flex -space-x-2">
            {platforms.slice(0, 3).map((p) => (
              <span key={p} className="rounded-md ring-2 ring-card">
                <BrandTile brand={CONNECTOR_BRANDS[p]!} />
              </span>
            ))}
          </span>
        ) : (
          <RowTile icon={Send} />
        )
      }
      description={
        <span className="flex items-center gap-2">
          <Badge variant={marketingStatusBadge(post.status)}>{marketingStatusLabel(post.status)}</Badge>
          <span className="text-xs text-muted-foreground">
            Edited {formatInstant(post.updatedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </span>
      }
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          {onDelete && (
            <Button variant="ghost" className="mr-auto text-exception hover:bg-exception/6 hover:text-exception" onClick={onDelete}>
              <Trash2 size={14} aria-hidden="true" />
              Delete
            </Button>
          )}
          {canWrite && (
            <Button variant="outline" onClick={onDuplicate}>
              <Copy size={14} aria-hidden="true" />
              Duplicate
            </Button>
          )}
          {canWrite && post.canEdit && (
            <Button onClick={onEdit}>
              <Pencil size={14} aria-hidden="true" />
              Edit post
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <SettingsSection className="bg-control" title="Where it stands">
          {summary.total > 0 && <ProgressBar summary={summary} />}
          <InfoRows>
            <InfoRow icon={Clock} title={summary.nextAt ? 'Next goes out' : 'Goes out'}>
              <span className={cn('truncate text-sm', summary.nextAt ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                {outLabel}
              </span>
            </InfoRow>
            <InfoRow icon={Send} title="Destinations">
              <span className="truncate text-sm font-semibold text-foreground">
                {summary.total === 0
                  ? 'None yet'
                  : `${summary.total} on ${platforms.length || 1} ${platforms.length === 1 ? 'platform' : 'platforms'}`}
              </span>
            </InfoRow>
          </InfoRows>
          {summary.attention > 0 && (
            <RowWarning className="mt-4">
              {summary.attention === 1 ? 'One destination needs you' : `${summary.attention} destinations need you`}. What to do is on each
              one below.
            </RowWarning>
          )}
        </SettingsSection>

        <SettingsSection
          className="bg-control"
          title="Post"
          actions={media.length > 0 && <Badge variant="muted">{media.length === 1 ? '1 file' : `${media.length} files`}</Badge>}
        >
          <Caption text={post.caption} />
          {media.length > 0 && <MediaStrip assets={media} />}
        </SettingsSection>

        <SettingsSection
          className="bg-control"
          title="Destinations"
          actions={<Badge variant="muted">{post.targets.length}</Badge>}
          footnote="Each destination publishes on its own, so one can fail while the others go out."
        >
          {platforms.length > 1 && (
            <PlatformTabs platforms={platforms} targets={post.targets} platformOf={platformOf} tab={tab} onTab={setTab} />
          )}
          {post.targets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No destinations yet. Edit the post to choose where it goes.</p>
          ) : (
            <div className="space-y-3">
              {shown.map((t) => (
                <Destination
                  key={t.id}
                  target={t}
                  account={accountOf(t)}
                  postCaption={post.caption}
                  canPublish={canPublish}
                  retrying={retry.isPending && retry.variables === t.id}
                  onRetry={() => retry.mutate(t.id)}
                  onAction={(outcome) => setAction({ id: t.id, outcome })}
                />
              ))}
            </div>
          )}
          {failure && <RowWarning className="mt-4">{failure.message}</RowWarning>}
        </SettingsSection>

        <SettingsSection
          className="bg-control"
          title="Activity"
          actions={tab !== 'all' && <Badge variant="muted">{LABELS[tab]}</Badge>}
          footnote={inFlight ? 'Updating every few seconds while a destination is on its way.' : undefined}
        >
          {q.isPending ? (
            <Bone className="h-28 w-full rounded-md" />
          ) : q.error ? (
            <ErrorState title="Couldn’t load the publishing history" onRetry={() => void q.refetch()} />
          ) : shown.length === 0 ? (
            <p className="text-sm text-muted-foreground">Add a destination and its way out appears here, step by step.</p>
          ) : (
            <div className="space-y-6">
              {shown.map((t) => (
                <DestinationActivity key={t.id} target={t} account={accountOf(t)} attempts={q.data.filter((h) => h.targetId === t.id)} />
              ))}
            </div>
          )}
        </SettingsSection>
      </div>
      {action && (
        <ConfirmModal
          title={action.outcome === 'cancel' ? 'Cancel this destination?' : 'Record what happened?'}
          message={
            action.outcome === 'cancel'
              ? 'It won’t be published there. The post’s other destinations aren’t affected, and you can edit or duplicate the post afterwards.'
              : action.outcome === 'published'
                ? 'Confirm that you checked the destination account and this post is published. DUMA will record your manual confirmation.'
                : 'Confirm that you checked the account and this post was not published. DUMA will cancel this destination; you can then edit or duplicate the post.'
          }
          confirmLabel={action.outcome === 'cancel' ? 'Cancel destination' : 'Record outcome'}
          isPending={action.outcome === 'cancel' ? cancel.isPending : resolve.isPending}
          onClose={() => setAction(null)}
          onConfirm={() => {
            const { id, outcome } = action;
            if (outcome === 'cancel') cancel.mutate(id);
            else resolve.mutate({ id, outcome });
          }}
        />
      )}
    </Drawer>
  );
}

/** One bar across every destination — sent, needs you, still to go, cancelled — with its counts underneath. */
function ProgressBar({ summary }: { summary: ReturnType<typeof destinationSummary> }) {
  const parts = [
    { count: summary.published, label: 'Published', bar: 'bg-momentum' },
    { count: summary.attention, label: 'Needs you', bar: 'bg-measured' },
    { count: summary.waiting, label: 'To go', bar: 'bg-primary/35' },
    { count: summary.cancelled, label: 'Cancelled', bar: 'bg-rule' },
  ].filter((p) => p.count > 0);
  return (
    <div className="mb-4 space-y-2">
      <div
        className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-band"
        role="img"
        aria-label={parts.map((p) => `${p.count} ${p.label.toLowerCase()}`).join(', ')}
      >
        {parts.map((p) => (
          <span key={p.label} className={p.bar} style={{ width: `${(p.count / summary.total) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
        {parts.map((p) => (
          <span key={p.label} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', p.bar)} />
            <span className="font-semibold text-foreground">{p.count}</span> {p.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** The caption, folded past six lines so a long one doesn't push the destinations out of view. */
function Caption({ text }: { text: string }) {
  const [full, setFull] = useState(false);
  if (!text.trim()) return <p className="text-sm text-muted-foreground">No caption.</p>;
  const long = text.length > 320 || text.split('\n').length > 6;
  return (
    <div>
      <p className={cn('whitespace-pre-wrap text-sm leading-relaxed text-foreground', long && !full && 'line-clamp-6')}>{text}</p>
      {long && (
        <button
          type="button"
          className="mt-1.5 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          onClick={() => setFull((v) => !v)}
        >
          {full ? 'Show less' : 'Show all'}
        </button>
      )}
    </div>
  );
}

/** The post's files as thumbnails; each opens large in the viewer, without leaving DUMA. */
function MediaStrip({ assets, className }: { assets: Asset[]; className?: string }) {
  const [viewing, setViewing] = useState<number | null>(null);
  return (
    <div className={cn('mt-4 grid grid-cols-4 gap-2', className)}>
      {assets.map((a, i) => (
        <button
          key={a.id}
          type="button"
          title={a.fileName}
          aria-label={`View ${a.fileName}`}
          onClick={() => setViewing(i)}
          className="group relative aspect-square overflow-hidden rounded-md border border-rule/60 bg-band/40 transition-[border-color] hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-ring"
        >
          {a.mimeType.startsWith('video/') ? (
            <>
              <video src={assetSrc(a)} preload="metadata" muted className="size-full object-cover" />
              <span className="absolute bottom-1 left-1 flex size-5 items-center justify-center rounded bg-black/55 text-white">
                <Play size={12} aria-hidden="true" />
              </span>
            </>
          ) : (
            <Image unoptimized width={160} height={160} src={assetSrc(a)} alt={a.fileName} className="size-full object-cover" />
          )}
        </button>
      ))}
      {viewing !== null && <MediaViewer assets={assets} start={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

/** With more than one platform: All, then each platform with its mark and how many destinations it has. */
function PlatformTabs({
  platforms,
  targets,
  platformOf,
  tab,
  onTab,
}: {
  platforms: Platform[];
  targets: Target[];
  platformOf: (t: Target) => Platform | undefined;
  tab: Platform | 'all';
  onTab: (tab: Platform | 'all') => void;
}) {
  const chip = (value: Platform | 'all', label: string, count: number) => (
    <button
      key={value}
      type="button"
      role="tab"
      aria-selected={tab === value}
      onClick={() => onTab(value)}
      className={cn(
        'flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
        tab === value
          ? 'border-primary bg-primary/5 text-foreground shadow-[inset_0_0_0_1px_var(--primary)]'
          : 'border-rule/70 bg-field text-muted-foreground hover:bg-band/45 hover:text-foreground',
      )}
    >
      {value !== 'all' && <BrandMark platform={value} />}
      {label}
      <span className="tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
  return (
    <div role="tablist" aria-label="Platform" className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
      {chip('all', 'All', targets.length)}
      {platforms.map((p) => chip(p, LABELS[p], targets.filter((t) => platformOf(t) === p).length))}
    </div>
  );
}

/**
 * One destination as a card: the account and format, when it goes out, its own
 * caption and files when they differ from the post's, what went wrong, and the
 * thing to do now as a button — the rest behind ⋯.
 */
function Destination({
  target: t,
  account,
  postCaption,
  canPublish,
  retrying,
  onRetry,
  onAction,
}: {
  target: Target;
  account?: Account;
  postCaption: string;
  canPublish: boolean;
  retrying: boolean;
  onRetry: () => void;
  onAction: (outcome: Outcome | 'cancel') => void;
}) {
  const [captionOpen, setCaptionOpen] = useState(false);
  const live = t.remoteUrl && /^https:\/\//.test(t.remoteUrl) ? t.remoteUrl : null;
  const cancellable = canPublish && ['draft', 'scheduled', 'blocked'].includes(t.status);
  const unconfirmed = canPublish && t.status === 'needs-reconciliation';
  const reconcile = canPublish && ['needs-reconciliation', 'failed'].includes(t.status);
  const ownCaption = t.caption.trim() && t.caption !== postCaption ? t.caption : null;
  const menu: RowMenuItem[] = [
    ...(reconcile && !unconfirmed
      ? [
          { icon: CheckCircle2, label: 'I checked: it’s published', onClick: () => onAction('published') },
          { icon: XCircle, label: 'I checked: it’s not published', onClick: () => onAction('cancelled') },
        ]
      : []),
    ...(cancellable ? [{ icon: XCircle, label: 'Cancel this destination', danger: true, onClick: () => onAction('cancel') }] : []),
  ];
  const warning = marketingStatusBadge(t.status) === 'warning';
  return (
    <article className={cn('rounded-lg border bg-field p-3', warning ? 'border-measured/40' : 'border-rule/60')}>
      <div className="flex items-center gap-3">
        {accountTile(account)}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{account ? account.name : 'Account unavailable'}</p>
          <p className="truncate text-xs text-muted-foreground">
            {account ? `${LABELS[account.provider]} · ` : ''}
            {marketingStatusLabel(t.format)}
          </p>
        </div>
        <Badge variant={marketingStatusBadge(t.status)}>{targetStatusLabel(t.status, t.options)}</Badge>
        {menu.length > 0 && <RowMenu label={`${account?.name ?? 'Destination'} actions`} items={menu} />}
      </div>

      <div className="mt-3 space-y-2 pl-11">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock size={13} className="shrink-0" aria-hidden="true" />
          {t.scheduledAt ? (
            <span className="truncate">
              <span className="font-medium text-foreground">{when(t.scheduledAt)}</span> · {t.timeZone}
            </span>
          ) : (
            'Not scheduled'
          )}
        </p>
        {(ownCaption || t.assets.length > 0) && (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {ownCaption && (
              <button
                type="button"
                aria-expanded={captionOpen}
                className="font-medium underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => setCaptionOpen((v) => !v)}
              >
                {captionOpen ? 'Hide its own caption' : 'Has its own caption'}
              </button>
            )}
            {t.assets.length > 0 && <span>{t.assets.length === 1 ? '1 file' : `${t.assets.length} files`}</span>}
          </p>
        )}
        {ownCaption && captionOpen && (
          <p className="whitespace-pre-wrap rounded-md bg-band/50 px-3 py-2 text-sm text-foreground">{ownCaption}</p>
        )}
        {t.error && <RowWarning>{t.error}</RowWarning>}
        {unconfirmed && (
          <p className="rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
            DUMA couldn’t confirm whether this went out. Check the account, then record what you found.
          </p>
        )}
        {(live || (canPublish && t.canRetry) || unconfirmed) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {live && (
              <Button variant="outline" size="sm" asChild>
                <a href={live} target="_blank" rel="noreferrer">
                  <ExternalLink size={13} aria-hidden="true" />
                  View on {account ? LABELS[account.provider] : 'the platform'}
                </a>
              </Button>
            )}
            {canPublish && t.canRetry && (
              <Button variant="outline" size="sm" disabled={retrying} onClick={onRetry}>
                <RefreshCw size={13} className={cn(retrying && 'animate-spin')} aria-hidden="true" />
                {retrying ? 'Retrying…' : 'Retry'}
              </Button>
            )}
            {unconfirmed && (
              <>
                <Button variant="outline" size="sm" onClick={() => onAction('published')}>
                  <CheckCircle2 size={13} aria-hidden="true" />
                  It’s published
                </Button>
                <Button variant="outline" size="sm" onClick={() => onAction('cancelled')}>
                  <XCircle size={13} aria-hidden="true" />
                  It’s not
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

/** The clock, ticking once a second while `active`; still otherwise. */
function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

const stepTime = (at: string) => formatInstant(at, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** One step's dot: ticked when done, pulsing while current, amber when it stopped there. */
function StepDot({ state }: { state: DestinationStep['state'] }) {
  if (state === 'done')
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-momentum text-white transition-colors duration-500">
        <Check size={12} aria-hidden="true" />
      </span>
    );
  if (state === 'stopped')
    return (
      <span className="flex size-5 items-center justify-center rounded-full bg-measured text-white">
        <AlertTriangle size={11} aria-hidden="true" />
      </span>
    );
  if (state === 'current')
    return (
      <span className="relative flex size-5 items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-primary/35 motion-safe:animate-ping" aria-hidden="true" />
        <span className="relative size-3 rounded-full bg-primary ring-4 ring-primary/20" />
      </span>
    );
  return <span className="size-5 rounded-full border-2 border-rule bg-control" />;
}

/**
 * A destination's way out — scheduled, sending, processing, published — with
 * the step it's on pulsing and a live clock for how long it has been there (or
 * how long until it goes). Every attempt the publisher made is one tap below.
 */
function DestinationActivity({
  target,
  account,
  attempts,
}: {
  target: Target;
  account?: Account;
  attempts: { id: string; status: string; message: string | null; createdAt: string }[];
}) {
  const [log, setLog] = useState(false);
  const live = ['scheduled', 'uploading', 'processing'].includes(target.status);
  const now = useNow(live);
  const { steps, clock } = destinationTimeline(target, attempts, now);
  const current = steps.find((s) => s.state === 'current' || s.state === 'stopped');
  const clockText = clock
    ? clock.mode === 'until'
      ? `Goes out in ${durationLabel(Date.parse(clock.at) - now)}`
      : target.status === 'scheduled'
        ? `Due ${durationLabel(now - Date.parse(clock.at))} ago — waiting for the publisher`
        : `${current?.label ?? 'In this step'} for ${durationLabel(now - Date.parse(clock.at))}`
    : null;
  return (
    <div>
      <div className="flex items-center gap-3">
        {accountTile(account)}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{account?.name ?? 'Account unavailable'}</p>
          <p className="truncate text-xs text-muted-foreground">
            {account ? `${LABELS[account.provider]} · ` : ''}
            {marketingStatusLabel(target.format)}
          </p>
        </div>
        <Badge variant={marketingStatusBadge(target.status)}>{targetStatusLabel(target.status, target.options)}</Badge>
      </div>

      <ol className="mt-4 grid grid-cols-4" aria-label="Publishing steps">
        {steps.map((step, i) => (
          <li
            key={step.key}
            className="relative flex flex-col items-center text-center"
            aria-current={step.state === 'current' ? 'step' : undefined}
          >
            {i < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute left-1/2 top-2.5 h-0.5 w-full -translate-y-1/2 transition-colors duration-700',
                  steps[i + 1]!.state === 'done' || (step.state === 'done' && steps[i + 1]!.state !== 'todo') ? 'bg-momentum' : 'bg-rule',
                )}
              />
            )}
            <span className="relative z-10 rounded-full bg-control p-0.5">
              <StepDot state={step.state} />
            </span>
            <span
              className={cn(
                'mt-1.5 text-xs font-medium',
                step.state === 'todo' ? 'text-muted-foreground' : step.state === 'stopped' ? 'text-measured' : 'text-foreground',
              )}
            >
              {step.label}
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">{step.at ? stepTime(step.at) : ' '}</span>
          </li>
        ))}
      </ol>

      {clockText && (
        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium tabular-nums text-foreground" aria-live="off">
          <Clock size={13} className="text-muted-foreground" aria-hidden="true" />
          {clockText}
        </p>
      )}
      {target.error && <RowWarning className="mt-3">{target.error}</RowWarning>}

      {attempts.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            aria-expanded={log}
            onClick={() => setLog((v) => !v)}
            className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {log ? 'Hide attempts' : `Every attempt (${attempts.length})`}
          </button>
          {log && (
            <ol className="mt-2 space-y-2 border-l border-rule/70 pl-4">
              {[...attempts]
                .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
                .map((h) => {
                  const warning = marketingStatusBadge(h.status) === 'warning';
                  return (
                    <li key={h.id} className="relative">
                      <span
                        aria-hidden="true"
                        className={cn('absolute -left-[1.3rem] top-1.5 size-2 rounded-full', warning ? 'bg-measured' : 'bg-rule')}
                      />
                      <p className="flex items-baseline justify-between gap-3 text-xs">
                        <span className={cn('font-semibold', warning ? 'text-measured' : 'text-foreground')}>
                          {marketingStatusLabel(h.status)}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{stepTime(h.createdAt)}</span>
                      </p>
                      {h.message && <p className="text-xs text-muted-foreground">{h.message}</p>}
                    </li>
                  );
                })}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
