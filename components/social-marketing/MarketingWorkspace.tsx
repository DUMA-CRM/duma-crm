'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { InfoRow, PickerRow, RowTile } from '@/components/cms/rows';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  Copy,
  Eye,
  FileText,
  Globe,
  type IconComponent,
  LayoutGrid,
  Pencil,
  Play,
  Plug,
  Plus,
  RotateCcw,
  Trash2,
  Users,
} from '@/components/icons';
import { SECTION_RISE, SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { ChoiceCards } from '@/components/shared/FormParts';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger } from '@/components/ui/context-menu';

import { hasCapability } from '@/lib/auth/capabilities';
import {
  LABELS,
  PLATFORMS,
  type Platform,
  type Post,
  accounts,
  assetSrc,
  deletePost,
  marketingKey,
  posts,
} from '@/lib/modules/marketing/client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { canDeletePost, marketingStatusBadge, marketingStatusLabel } from '@/lib/utils/marketing-status';
import { calendarDays, moveDay } from '@/lib/utils/marketing-time';
import { formatInstant, resolvedTimeZone, workspaceDateKey } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { PostComposer } from './PostComposer';
import { BrandMark, PostDetails, accountTile } from './PostDetails';

type View = 'month' | 'week' | 'agenda';
type Filter = 'view' | 'platform' | 'account' | 'status';

const VIEWS: { value: View; label: string }[] = [
  { value: 'month', label: 'Month' },
  { value: 'week', label: 'Week' },
  { value: 'agenda', label: 'Agenda' },
];
const STATUSES = [
  'draft',
  'scheduled',
  'processing',
  'uploading',
  'published',
  'partially published',
  'failed',
  'blocked',
  'cancelled',
  'needs-reconciliation',
];

/** A row that opens something elsewhere, in the bleed list's rhythm. */
const LINK_ROW =
  'group flex items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring';

export function MarketingWorkspace() {
  const tid = useWorkspaceStore((s) => s.tenantId),
    caps = useAuthStore((s) => s.capabilities),
    client = useQueryClient(),
    zone = resolvedTimeZone(),
    reduceMotion = useReducedMotion();
  const canRead = hasCapability(caps, 'marketing:read'),
    canWrite = hasCapability(caps, 'marketing:write'),
    canPublish = hasCapability(caps, 'marketing:publish');
  const [anchor, setAnchor] = useState(() => workspaceDateKey()),
    [view, setView] = useState<View>('month'),
    [platform, setPlatform] = useState('all'),
    [accountFilter, setAccountFilter] = useState('all'),
    [status, setStatus] = useState('all'),
    [page, setPage] = useState(1);
  // One filter open at a time; a tap on the open one closes it.
  const [open, setOpen] = useState<Filter | null>(null);
  // What the right-click landed on: a day, and the post on it if any.
  const [menuAt, setMenuAt] = useState<{ day: string; post?: Post } | null>(null);
  const [opened, setOpened] = useState<string | null>(null),
    [compose, setCompose] = useState<{ post?: Post; duplicate?: boolean; day: string } | null>(null);
  const days = calendarDays(anchor, view),
    from = moveDay(days[0], -1) + 'T00:00:00Z',
    to = moveDay(days[days.length - 1], 2) + 'T00:00:00Z';
  const q = useQuery({
    queryKey: marketingKey(tid, 'posts', from, to, page),
    queryFn: () => posts(from, to, page),
    enabled: !!tid && canRead,
    refetchInterval: 15000,
  });
  const aq = useQuery({ queryKey: marketingKey(tid, 'accounts'), queryFn: accounts, enabled: !!tid && canRead });
  const all = q.data?.data ?? [],
    as = aq.data ?? [];
  const filtered = all.filter(
    (p) =>
      (status === 'all' || p.status === status) &&
      (platform === 'all' || p.targets.some((t) => as.find((a) => a.id === t.connectionId)?.provider === platform)) &&
      (accountFilter === 'all' || p.targets.some((t) => t.connectionId === accountFilter)),
  );
  const filtering = platform !== 'all' || accountFilter !== 'all' || status !== 'all';
  /** A filter: what it's set to on the row, the choices underneath; picking one closes it. */
  const pickerRow = <T extends string>(
    row: Filter,
    icon: IconComponent,
    title: string,
    shown: string,
    muted: boolean,
    options: { value: T; label: string }[],
    value: T,
    onChange: (next: T) => void,
  ) => (
    <PickerRow
      icon={icon}
      title={title}
      value={shown}
      muted={muted}
      open={open === row}
      onToggle={() => setOpen((current) => (current === row ? null : row))}
    >
      <ChoiceCards
        appearance="settings"
        columns={options.length === 3 ? 3 : 2}
        options={options}
        value={value}
        onChange={(next) => {
          onChange(next);
          setOpen(null);
        }}
      />
    </PickerRow>
  );
  const drafts = filtered.filter((p) => !p.targets.length || p.targets.every((t) => !t.scheduledAt));
  const current = all.find((p) => p.id === opened);
  const [deleting, setDeleting] = useState<Post | null>(null);
  const remove = useMutation({
    mutationFn: deletePost,
    onSuccess: () => {
      setDeleting(null);
      setOpened(null);
      toast('success', 'Post deleted from DUMA.');
      invalidate();
    },
    onError: (error) => toast('error', error.message),
  });
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: marketingKey(tid) });
  };
  const move = (delta: number) => {
    setPage(1);
    if (view !== 'month') setAnchor(moveDay(anchor, delta * 7));
    else {
      const d = new Date(anchor.slice(0, 7) + '-01T12:00:00Z');
      d.setUTCMonth(d.getUTCMonth() + delta);
      setAnchor(d.toISOString().slice(0, 10));
    }
  };
  const heading = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(anchor + 'T12:00:00Z'),
  );
  const platformsOf = (post: Post) =>
    [...new Set(post.targets.map((t) => as.find((a) => a.id === t.connectionId)?.provider).filter(Boolean))]
      .map((p) => LABELS[p!])
      .join(' · ') || 'No destinations';
  /**
   * A post on the calendar: its time and platforms on one line,
   * the title, and the status in words only when it isn't simply "Scheduled".
   * A small thumbnail leads when the post has media.
   */
  const card = (post: Post, day?: string) => {
    const target = post.targets.find((t) => t.scheduledAt && workspaceDateKey(t.scheduledAt, zone) === day);
    const providers = PLATFORMS.filter((p) => post.targets.some((t) => as.find((a) => a.id === t.connectionId)?.provider === p));
    const tone = marketingStatusBadge(post.status);
    const label = marketingStatusLabel(post.status);
    const media = post.targets.flatMap((t) => t.assets)[0];
    return (
      <button
        key={post.id}
        type="button"
        data-post={post.id}
        title={`${post.title} · ${label}`}
        className="group relative flex w-full min-w-0 items-center gap-2 overflow-hidden rounded-md border border-rule/50 bg-field p-1.5 text-left transition-[border-color,box-shadow] hover:border-rule hover:shadow-sm focus-visible:outline-2 focus-visible:outline-ring"
        onClick={() => setOpened(post.id)}
      >
        {media && (
          <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded bg-band/60 text-muted-foreground">
            {media.mimeType.startsWith('image/') ? (
              <Image unoptimized width={64} height={64} src={assetSrc(media)} alt="" className="size-full object-cover" />
            ) : (
              <Play size={12} aria-hidden="true" />
            )}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[11px] leading-4 text-muted-foreground">
            {target?.scheduledAt && (
              <span className="font-semibold tabular-nums text-foreground">
                {formatInstant(target.scheduledAt, { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <span className="flex items-center gap-0.5">
              {providers.map((p) => (
                <BrandMark key={p} platform={p} />
              ))}
            </span>
          </span>
          <span className="block truncate text-xs font-semibold leading-4 text-foreground">{post.title}</span>
          {post.status !== 'scheduled' && (
            <span
              className={cn(
                'block truncate text-[11px] leading-4',
                tone === 'warning' ? 'font-medium text-measured' : tone === 'success' ? 'text-momentum' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          )}
        </span>
      </button>
    );
  };
  const dayPosts = (day: string) =>
    filtered.filter((p) =>
      p.targets.some(
        (t) =>
          t.scheduledAt &&
          workspaceDateKey(t.scheduledAt, zone) === day &&
          (platform === 'all' || as.find((a) => a.id === t.connectionId)?.provider === platform) &&
          (accountFilter === 'all' || t.connectionId === accountFilter),
      ),
    );
  const dayLabel = (day: string) =>
    new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
      new Date(day + 'T12:00:00Z'),
    );
  /** A tap anywhere on a day that isn't one of its posts starts a post for that day. */
  const onDayClick = (day: string) => (event: React.MouseEvent) => {
    if (canWrite && !(event.target as HTMLElement).closest('[data-post]')) setCompose({ day });
  };
  const onMenu = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement;
    const day = target.closest<HTMLElement>('[data-day]')?.dataset.day;
    const post = all.find((p) => p.id === target.closest<HTMLElement>('[data-post]')?.dataset.post);
    // Nothing to offer: read-only on an empty day, or between days.
    if (!day || (!post && !canWrite)) {
      event.preventDefault();
      setMenuAt(null);
      return;
    }
    setMenuAt({ day, post });
  };
  if (!canRead)
    return (
      <ErrorState title="Marketing access is required" description="Ask your workspace administrator for access to the marketing module." />
    );
  return (
    <EditorShell
      title="Marketing"
      eyebrow="Social publishing"
      icon={<CalendarDays size={20} />}
      actions={
        <div className="flex gap-2">
          {canWrite && (
            <Button onClick={() => setCompose({ day: workspaceDateKey() })}>
              <Plus size={16} />
              New post
            </Button>
          )}
        </div>
      }
    >
      <motion.div initial={reduceMotion ? false : 'hidden'} animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
        <SettingsTabBody
          narrowAside
          aside={
            <>
              <SettingsSection
                className="bg-control"
                title="Showing"
                // Holds the title line at the Reset button's height, so it appearing doesn't push the rows down.
                alignActionsToTitle
                actions={
                  filtering && (
                    <Button
                      variant="ghost"
                      className="h-9"
                      onClick={() => {
                        setPlatform('all');
                        setAccountFilter('all');
                        setStatus('all');
                        setOpen(null);
                      }}
                    >
                      <RotateCcw size={14} aria-hidden="true" />
                      Reset
                    </Button>
                  )
                }
              >
                <div className="space-y-3">
                  {pickerRow('view', LayoutGrid, 'View', VIEWS.find((v) => v.value === view)!.label, false, VIEWS, view, (v) => {
                    setView(v);
                    setPage(1);
                  })}
                  {pickerRow(
                    'platform',
                    Globe,
                    'Platform',
                    platform === 'all' ? 'All platforms' : LABELS[platform as Platform],
                    platform === 'all',
                    [{ value: 'all', label: 'All platforms' }, ...PLATFORMS.map((p) => ({ value: p, label: LABELS[p] }))],
                    platform,
                    setPlatform,
                  )}
                  {pickerRow(
                    'account',
                    Users,
                    'Account',
                    as.find((a) => a.id === accountFilter)?.name ?? 'All accounts',
                    accountFilter === 'all',
                    [{ value: 'all', label: 'All accounts' }, ...as.map((a) => ({ value: a.id, label: a.name }))],
                    accountFilter,
                    setAccountFilter,
                  )}
                  {pickerRow(
                    'status',
                    CircleDot,
                    'Status',
                    status === 'all' ? 'All statuses' : marketingStatusLabel(status),
                    status === 'all',
                    [{ value: 'all', label: 'All statuses' }, ...STATUSES.map((s) => ({ value: s, label: marketingStatusLabel(s) }))],
                    status,
                    setStatus,
                  )}
                  <InfoRow icon={Clock} title="Times shown in">
                    <span className="truncate text-sm text-muted-foreground">{zone}</span>
                  </InfoRow>
                </div>
              </SettingsSection>
              <SettingsSection
                className="bg-control"
                title="Unscheduled drafts"
                actions={!q.isPending && !q.error && <Badge variant="muted">{drafts.length}</Badge>}
                footnote="Each destination publishes on its own. Open a post to see failures or its live link."
              >
                {q.isPending ? (
                  <Bone className="h-16 w-full rounded-md" />
                ) : q.error ? (
                  <p className="text-sm text-muted-foreground">Drafts appear once the calendar loads.</p>
                ) : drafts.length ? (
                  <div className="-mx-2 flex flex-col gap-0.5">
                    {drafts.map((p) => (
                      <button key={p.id} type="button" className={LINK_ROW} onClick={() => setOpened(p.id)}>
                        <RowTile icon={FileText} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{p.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{platformsOf(p)}</span>
                        </span>
                        <ChevronRight
                          size={14}
                          className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Save ideas here, then choose when and where to publish.</p>
                )}
              </SettingsSection>
              <SettingsSection className="bg-control" title="Accounts">
                {aq.isPending ? (
                  <Bone className="h-16 w-full rounded-md" />
                ) : aq.error ? (
                  <ErrorState title="Couldn’t load your accounts" onRetry={() => void aq.refetch()} />
                ) : (
                  <div className="-mx-2 flex flex-col gap-0.5">
                    {as.map((a) => (
                      <Link key={a.id} href={`/settings/connectors?connector=${a.provider}`} className={LINK_ROW}>
                        {accountTile(a)}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{a.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{LABELS[a.provider]}</span>
                        </span>
                        <Badge variant={a.state === 'connected' ? 'success' : 'warning'}>
                          {a.state === 'connected' ? 'Connected' : 'Reconnect'}
                        </Badge>
                      </Link>
                    ))}
                    <Link href="/settings/connectors" className={LINK_ROW}>
                      <RowTile icon={Plug} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground">
                          {as.length ? 'Connect another account' : 'Connect an account'}
                        </span>
                        {!as.length && (
                          <span className="block truncate text-xs text-muted-foreground">YouTube, Facebook, Instagram or TikTok</span>
                        )}
                      </span>
                      <ChevronRight
                        size={14}
                        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </Link>
                  </div>
                )}
              </SettingsSection>
            </>
          }
        >
          <motion.section variants={SECTION_RISE} aria-label={heading} className="min-w-0">
            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold tracking-title text-foreground">{heading}</h2>
              <div className="flex items-center gap-2">
                <Button size="icon" variant="outline" className="size-9" aria-label="Previous period" onClick={() => move(-1)}>
                  <ChevronLeft />
                </Button>
                <Button
                  variant="outline"
                  className="h-9"
                  onClick={() => {
                    setAnchor(workspaceDateKey());
                    setPage(1);
                  }}
                >
                  Today
                </Button>
                <Button size="icon" variant="outline" className="size-9" aria-label="Next period" onClick={() => move(1)}>
                  <ChevronRight />
                </Button>
              </div>
            </header>
            {q.isPending ? (
              <Bone className="h-96 w-full rounded-lg" />
            ) : q.error ? (
              <ErrorState title="Couldn’t load your calendar" onRetry={() => void q.refetch()} />
            ) : (
              <>
                <ContextMenu>
                  <ContextMenuTrigger asChild onContextMenu={onMenu}>
                    <div>
                      <div className={view === 'agenda' ? 'hidden' : 'hidden md:block'}>
                        <div className="overflow-hidden rounded-md border border-rule/60 bg-control">
                          <div className="grid grid-cols-7 border-b border-rule/60 bg-band/30">
                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                              <div key={d} className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                {d}
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 [&>*:nth-child(7n)]:border-r-0 [&>*:nth-last-child(-n+7)]:border-b-0">
                            {days.map((day) => (
                              <div
                                key={day}
                                data-day={day}
                                onClick={onDayClick(day)}
                                className={`group/day min-h-36 min-w-0 space-y-1.5 border-b border-r border-rule/60 p-1.5 transition-colors ${day.slice(0, 7) !== anchor.slice(0, 7) && view === 'month' ? 'bg-band/30' : ''} ${canWrite ? 'cursor-pointer hover:bg-band/40' : ''}`}
                              >
                                {/* The keyboard way in; a click on it bubbles to the day like any other. */}
                                <button
                                  type="button"
                                  className={`rounded-md px-2 py-1 text-xs font-medium ${day === workspaceDateKey() ? 'bg-primary text-primary-foreground' : 'text-muted-foreground group-hover/day:text-foreground'}`}
                                  aria-label={`Create post on ${dayLabel(day)}`}
                                  disabled={!canWrite}
                                >
                                  {Number(day.slice(-2))}
                                </button>
                                {dayPosts(day).map((p) => card(p, day))}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className={view === 'agenda' ? 'space-y-5' : 'space-y-5 md:hidden'}>
                        {days.map((day) => (
                          <section key={day} data-day={day} className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <h3 className="text-sm font-semibold text-foreground">{dayLabel(day)}</h3>
                              {canWrite && (
                                <Button size="sm" variant="ghost" onClick={() => setCompose({ day })}>
                                  <Plus size={14} aria-hidden="true" />
                                  Add post
                                </Button>
                              )}
                            </div>
                            {dayPosts(day).length ? (
                              dayPosts(day).map((p) => card(p, day))
                            ) : (
                              <p className="text-xs text-muted-foreground">No posts planned</p>
                            )}
                          </section>
                        ))}
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    {menuAt?.post && (
                      <>
                        <ContextMenuItem icon={Eye} onSelect={() => setOpened(menuAt.post!.id)}>
                          Open post
                        </ContextMenuItem>
                        {canWrite && menuAt.post.canEdit && (
                          <ContextMenuItem icon={Pencil} onSelect={() => setCompose({ post: menuAt.post, day: anchor })}>
                            Edit post
                          </ContextMenuItem>
                        )}
                        {canWrite && (
                          <ContextMenuItem icon={Copy} onSelect={() => setCompose({ post: menuAt.post, duplicate: true, day: anchor })}>
                            Duplicate
                          </ContextMenuItem>
                        )}
                        {canWrite && <ContextMenuSeparator />}
                      </>
                    )}
                    {menuAt && canWrite && (
                      <ContextMenuItem icon={Plus} onSelect={() => setCompose({ day: menuAt.day })}>
                        New post on {dayLabel(menuAt.day)}
                      </ContextMenuItem>
                    )}
                    {menuAt?.post && canWrite && canDeletePost(menuAt.post.targets, canPublish) && (
                      <>
                        <ContextMenuSeparator />
                        <ContextMenuItem icon={Trash2} danger onSelect={() => setDeleting(menuAt.post!)}>
                          Delete post
                        </ContextMenuItem>
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
                {filtered.length === 0 && (
                  <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
                    {all.length
                      ? 'No posts match what’s showing. Reset the filters to see the rest.'
                      : canWrite
                        ? 'Nothing planned for this period. Click a day, or right-click it, to add a post.'
                        : 'Nothing planned for this period.'}
                  </p>
                )}
                {(page > 1 || q.data.hasMore) && (
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-band/60 px-3 py-2">
                    <span className="text-xs text-muted-foreground">Page {page} · the calendar shows this page’s posts</span>
                    <div className="flex gap-2">
                      <Button variant="outline" className="h-9" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                        Previous posts
                      </Button>
                      <Button variant="outline" className="h-9" disabled={!q.data.hasMore} onClick={() => setPage((p) => p + 1)}>
                        More posts
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.section>
        </SettingsTabBody>
      </motion.div>
      {current && !compose && (
        <PostDetails
          post={current}
          accounts={as}
          onClose={() => setOpened(null)}
          onChange={invalidate}
          onEdit={() => setCompose({ post: current, day: anchor })}
          onDuplicate={() => setCompose({ post: current, duplicate: true, day: anchor })}
          onDelete={canWrite && canDeletePost(current.targets, canPublish) ? () => setDeleting(current) : undefined}
        />
      )}
      {deleting && (
        <ConfirmModal
          title="Delete this post from DUMA?"
          message={
            deleting.targets.some((t) => t.status === 'published' || t.status === 'needs-reconciliation')
              ? 'It disappears from your calendar, with its publishing history. Anything already posted stays on the platform — delete it there too if it’s still up. Its media stay in your library.'
              : deleting.targets.some((t) => t.status === 'scheduled')
                ? 'Its scheduled destinations won’t go out, and it disappears from your calendar. Its media stay in your library.'
                : 'It disappears from your calendar. Its media stay in your library.'
          }
          confirmLabel="Delete post"
          pendingLabel="Deleting…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
      {compose && (
        <PostComposer
          key={`${compose.post?.id ?? 'new'}:${compose.duplicate ?? false}:${tid}`}
          {...compose}
          accounts={as}
          onClose={() => setCompose(null)}
          onSaved={() => {
            setCompose(null);
            setOpened(null);
            invalidate();
          }}
        />
      )}
    </EditorShell>
  );
}
