'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { BrandTile, FieldRow, InfoRow, PickerRow, RowTile, RowWarning } from '@/components/cms/rows';
import {
  AlignLeft,
  CalendarClock,
  Check,
  Clock,
  Eye,
  ImageIcon,
  LayoutGrid,
  Megaphone,
  PenLine,
  Plus,
  Repeat,
  Scissors,
  Send,
  Shield,
  Sparkles,
  Tag,
  Timer,
  Trash2,
  Type,
  UserRound,
  Users,
  Video,
  X,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { CONNECTOR_BRANDS } from '@/components/settings/connectors/brands';
import { Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { ChoiceCards } from '@/components/shared/FormParts';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { hasCapability } from '@/lib/auth/capabilities';
import {
  type Account,
  type Asset,
  FORMATS,
  LABELS,
  PLATFORMS,
  type Post,
  type TargetDraft,
  assetSrc,
  getCreator,
  marketingKey,
  savePost,
} from '@/lib/modules/marketing/client';
import { cn } from '@/lib/utils/cn';
import { destinationGaps } from '@/lib/utils/marketing-compose';
import { scheduleCandidates } from '@/lib/utils/marketing-time';
import { resolvedTimeZone, zonedParts } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { MediaLibrary } from './MediaLibrary';
import { BrandMark } from './PostDetails';

/** The control surface the settings pages use for a text input. */
const control =
  'w-full rounded-md border border-input bg-control px-3 py-2 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-measured focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-measured disabled:opacity-60';
interface Draft extends TargetDraft {
  media: Asset[];
  local: string;
  choice: string;
}
const localOf = (at: string | null, zone: string) => {
  if (!at) return '';
  const p = zonedParts(at, zone);
  return `${p.date}T${p.time}`;
};
const formatLabel = (f: string) => (f === 'short' ? 'YouTube Short' : f.charAt(0).toUpperCase() + f.slice(1));
/** A typed wall-clock time in words, read as-is (it is already in the destination's zone). */
const wallLabel = (local: string) =>
  local
    ? new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }).format(new Date(local + ':00Z'))
    : 'No time yet';
const offsetLabel = (at: string, zone: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' }).format(
    new Date(at),
  );

/** A small note under a control: why it matters, in one line. */
const Hint = ({ children }: { children: React.ReactNode }) => <p className="mt-1.5 text-xs text-muted-foreground">{children}</p>;

/** A text action beside a row's title, for "apply this to the others". */
const NoteButton = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button
    type="button"
    onClick={onClick}
    className="font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-ring"
  >
    {children}
  </button>
);

function TikTokFields({
  target,
  account,
  onChange,
}: {
  target: Draft;
  account: Account;
  onChange: (options: Record<string, unknown>) => void;
}) {
  const tid = useWorkspaceStore((s) => s.tenantId);
  const q = useQuery({
    queryKey: marketingKey(tid, 'creator', account.id),
    queryFn: () => getCreator(account.id),
    staleTime: 0,
    retry: false,
  });
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const o = target.options;
  if (q.isPending) return <Bone className="h-40 w-full rounded-md" />;
  if (q.error)
    return (
      <RowWarning>
        {q.error.message}{' '}
        <button className="underline underline-offset-2" onClick={() => void q.refetch()}>
          Try again
        </button>
      </RowWarning>
    );
  const privacyWords = (v: string) => {
    const words = v.replaceAll('_', ' ').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
  };
  const toggle = (key: string, icon: React.ComponentProps<typeof InfoRow>['icon'], title: string, disabled = false) => (
    <InfoRow icon={icon} title={title} description={disabled ? 'Turned off on this TikTok account' : undefined}>
      <Switch
        checked={!disabled && o[key] === true}
        disabled={disabled}
        label={title}
        onChange={(next) => onChange({ ...o, [key]: next })}
      />
    </InfoRow>
  );
  return (
    <div className="space-y-3">
      <InfoRow icon={UserRound} title="Publishing as">
        <span className="truncate text-sm font-semibold text-foreground">{q.data.creator_nickname}</span>
      </InfoRow>
      <InfoRow icon={Timer} title="Longest video">
        <span className="text-sm text-muted-foreground">{q.data.max_video_post_duration_sec} s</span>
      </InfoRow>
      <PickerRow
        icon={Eye}
        title="Who can see it"
        value={o.privacy ? privacyWords(String(o.privacy)) : 'Choose'}
        tone={o.privacy ? undefined : 'warning'}
        open={privacyOpen}
        onToggle={() => setPrivacyOpen((v) => !v)}
      >
        <ChoiceCards
          appearance="settings"
          options={q.data.privacy_level_options.map((v) => ({ value: v, label: privacyWords(v) }))}
          value={String(o.privacy ?? '')}
          onChange={(v) => {
            onChange({ ...o, privacy: v });
            setPrivacyOpen(false);
          }}
        />
      </PickerRow>
      {toggle('allowComment', Users, 'Allow comments', q.data.comment_disabled)}
      {toggle('allowDuet', Repeat, 'Allow duets', q.data.duet_disabled)}
      {toggle('allowStitch', Scissors, 'Allow stitches', q.data.stitch_disabled)}
      {toggle('ownBrand', Megaphone, 'Promotes my own brand')}
      {toggle('brandedContent', Tag, 'Paid partnership')}
      {(o.ownBrand === true || o.brandedContent === true) && (
        <p className="rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
          TikTok will label this {o.brandedContent ? '“Paid partnership”' : '“Promotional content”'}.
        </p>
      )}
      <label
        className={cn(
          'flex items-start gap-3 rounded-md border px-3 py-2.5 text-sm',
          o.consent === true ? 'border-rule/60 bg-band/30' : 'border-measured/40 bg-measured/5',
        )}
      >
        <input
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-primary"
          checked={o.consent === true}
          onChange={(e) => onChange({ ...o, consent: e.target.checked })}
        />
        <span className="text-foreground">
          I consent to uploading this content at the selected time. By posting, I agree to TikTok’s{' '}
          <a
            className="underline underline-offset-2"
            href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en"
            target="_blank"
            rel="noreferrer"
          >
            Music Usage Confirmation
          </a>
          {o.brandedContent === true && (
            <>
              {' '}
              and{' '}
              <a
                className="underline underline-offset-2"
                href="https://www.tiktok.com/legal/page/global/bc-policy/en"
                target="_blank"
                rel="noreferrer"
              >
                Branded Content Policy
              </a>
            </>
          )}
          .
        </span>
      </label>
    </div>
  );
}

/**
 * Write a post once, then tailor it per destination. The post's title and
 * caption on top; the accounts it goes to as tabs, each saying what it still
 * needs; the open destination's format, caption, media, time and platform
 * questions as rows underneath. Saved as a draft or scheduled from the footer.
 */
export function PostComposer({
  post,
  duplicate = false,
  day,
  accounts,
  onClose,
  onSaved,
}: {
  post?: Post;
  duplicate?: boolean;
  day: string;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [requestId] = useState(() => crypto.randomUUID());
  const zone = resolvedTimeZone(),
    canPublish = hasCapability(
      useAuthStore((s) => s.capabilities),
      'marketing:publish',
    );
  const [title, setTitle] = useState(post ? `${post.title}${duplicate ? ' (copy)' : ''}` : ''),
    [caption, setCaption] = useState(post?.caption ?? '');
  const [targets, setTargets] = useState<Draft[]>(
    () =>
      post?.targets.map((t) => ({
        connectionId: t.connectionId,
        format: t.format,
        caption: t.caption,
        assetIds: t.assets.map((a) => a.id),
        options: { ...t.options, ...(duplicate ? { consent: false } : {}) },
        scheduledAt: duplicate ? null : t.scheduledAt,
        timeZone: t.timeZone,
        media: t.assets,
        local: duplicate ? '' : localOf(t.scheduledAt, t.timeZone),
        choice: duplicate ? '' : (t.scheduledAt ?? ''),
      })) ?? [],
  );
  const [active, setActiveIndex] = useState(0),
    [library, setLibrary] = useState(false),
    [dirty, setDirty] = useState(false),
    [discard, setDiscard] = useState(false),
    [confirm, setConfirm] = useState<'schedule' | 'now' | null>(null),
    [error, setError] = useState('');
  // One row open at a time; switching destination closes it.
  const [open, setOpen] = useState<'format' | 'privacy' | 'kids' | null>(null);
  const setActive = (i: number) => {
    setActiveIndex(i);
    setOpen(null);
  };
  const toggle = (row: NonNullable<typeof open>) => setOpen((current) => (current === row ? null : row));
  const t = targets[active],
    account = t ? accounts.find((a) => a.id === t.connectionId) : undefined;
  const patch = (values: Partial<Draft>) => {
    setDirty(true);
    setTargets((list) =>
      list.map((item, i) => (i === active ? { ...item, ...values, options: values.options ?? { ...item.options, consent: false } } : item)),
    );
  };
  const save = useMutation({
    // `now` ignores the typed times: the API stamps every destination on its own clock.
    mutationFn: (mode: 'draft' | 'schedule' | 'now') => {
      setError('');
      const schedule = mode !== 'draft',
        now = mode === 'now';
      const data = targets.map((t) => {
        if (now)
          return {
            connectionId: t.connectionId,
            format: t.format,
            caption: t.caption,
            assetIds: t.media.map((a) => a.id),
            options: t.options,
            scheduledAt: null,
            timeZone: t.timeZone,
          };
        const choices = scheduleCandidates(t.local, t.timeZone);
        const at = choices.length === 1 ? choices[0] : choices.includes(t.choice) ? t.choice : null;
        if (t.local && !at)
          throw new Error(
            choices.length
              ? 'Choose which occurrence of the repeated time to use.'
              : 'This local time does not exist. Choose another time.',
          );
        if (schedule && !at) throw new Error('Choose a publish time for every destination.');
        return {
          connectionId: t.connectionId,
          format: t.format,
          caption: t.caption,
          assetIds: t.media.map((a) => a.id),
          options: t.options,
          scheduledAt: at ?? null,
          timeZone: t.timeZone,
        };
      });
      return savePost(duplicate ? undefined : post?.id, {
        requestId,
        title,
        caption,
        targets: data,
        schedule,
        ...(now ? { publishNow: true } : {}),
        ...(!duplicate && post ? { version: post.version } : {}),
      });
    },
    onSuccess: onSaved,
    onError: (e) => setError(e.message),
  });
  const add = (a: Account) => {
    setDirty(true);
    setTargets((list) => [
      ...list,
      {
        connectionId: a.id,
        format: FORMATS[a.provider][0],
        caption,
        assetIds: [],
        options: {},
        scheduledAt: null,
        timeZone: zone,
        media: [],
        local: `${day}T09:00`,
        choice: '',
      },
    ]);
    setActive(targets.length);
  };
  const remove = () => {
    setTargets((list) => list.filter((_, i) => i !== active));
    setActive(0);
    setDirty(true);
  };
  const close = () => {
    if (save.isPending) return;
    if (dirty) setDiscard(true);
    else onClose();
  };
  const candidates = t ? scheduleCandidates(t.local, t.timeZone) : [];
  const gapsOf = (target: Draft) => {
    const a = accounts.find((item) => item.id === target.connectionId);
    return destinationGaps({ ...target, mediaCount: target.media.length }, a?.provider ?? '', a?.state === 'connected');
  };
  const available = accounts.filter((a) => !targets.some((t) => t.connectionId === a.id));
  const platforms = PLATFORMS.filter((p) => targets.some((t) => accounts.find((a) => a.id === t.connectionId)?.provider === p));
  const gaps = t ? gapsOf(t) : [];
  const todo = targets.filter((target) => gapsOf(target).length > 0).length;

  return (
    <Drawer
      title={duplicate ? 'Duplicate post' : post ? 'Edit post' : 'New post'}
      description="Write it once, then tailor it for each destination."
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
          <RowTile icon={PenLine} />
        )
      }
      onClose={close}
      className="sm:max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {targets.length > 0 && (
            <span className="mr-auto text-xs text-muted-foreground">
              {todo === 0
                ? `${targets.length === 1 ? 'Destination' : `All ${targets.length} destinations`} ready`
                : `${todo} of ${targets.length} still need something`}
            </span>
          )}
          <Button variant="outline" disabled={save.isPending} onClick={close}>
            Close
          </Button>
          <Button variant="outline" disabled={save.isPending || !title.trim()} onClick={() => save.mutate('draft')}>
            {save.isPending ? 'Saving…' : 'Save draft'}
          </Button>
          {canPublish && (
            <>
              <Button variant="outline" disabled={save.isPending || !title.trim() || !targets.length} onClick={() => setConfirm('now')}>
                <Send size={14} aria-hidden="true" />
                Post now
              </Button>
              <Button disabled={save.isPending || !title.trim() || !targets.length} onClick={() => setConfirm('schedule')}>
                <CalendarClock size={14} aria-hidden="true" />
                Schedule
              </Button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <SettingsSection className="bg-control" title="Post">
          <div className="space-y-4">
            <FieldRow icon={Type} title="Title" htmlFor="post-title" note="Only your team sees this">
              <Input
                id="post-title"
                value={title}
                maxLength={200}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
                placeholder="A new season at DUMA"
              />
            </FieldRow>
            <FieldRow
              icon={AlignLeft}
              title="Caption"
              htmlFor="post-caption"
              note={caption.length ? `${caption.length} characters` : undefined}
            >
              <textarea
                id="post-caption"
                className={control}
                rows={4}
                value={caption}
                maxLength={10000}
                onChange={(e) => {
                  setCaption(e.target.value);
                  setDirty(true);
                }}
                placeholder="Write the story behind this post…"
              />
              <Hint>Each destination you add starts with this caption; tailor it there.</Hint>
            </FieldRow>
          </div>
        </SettingsSection>

        <SettingsSection
          className="bg-control"
          title="Destinations"
          actions={targets.length > 0 && <Badge variant="muted">{targets.length}</Badge>}
        >
          {targets.length > 0 && (
            <div role="tablist" aria-label="Post destinations" className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {targets.map((target, i) => {
                const a = accounts.find((item) => item.id === target.connectionId);
                const missing = gapsOf(target).length;
                return (
                  <button
                    key={target.connectionId}
                    type="button"
                    role="tab"
                    aria-selected={i === active}
                    onClick={() => setActive(i)}
                    className={cn(
                      'flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                      i === active
                        ? 'border-primary bg-primary/5 text-foreground shadow-[inset_0_0_0_1px_var(--primary)]'
                        : 'border-rule/70 bg-field text-muted-foreground hover:bg-band/45 hover:text-foreground',
                    )}
                  >
                    {a && <BrandMark platform={a.provider} />}
                    <span className="max-w-36 truncate">{a ? a.name : 'Unavailable account'}</span>
                    {missing ? (
                      <span className="flex size-4 items-center justify-center rounded-full bg-measured/15 text-[10px] font-semibold text-measured">
                        {missing}
                        <span className="sr-only"> still to do</span>
                      </span>
                    ) : (
                      <Check size={13} className="text-momentum" aria-label="Ready" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {available.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{targets.length ? 'Add another' : 'Choose where it goes'}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {available.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => add(a)}
                    className="group flex min-w-0 items-center gap-3 rounded-lg border border-rule/70 bg-field px-3 py-2.5 text-left transition-colors hover:border-rule hover:bg-band/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <BrandTile brand={CONNECTOR_BRANDS[a.provider]!} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{a.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{LABELS[a.provider]}</span>
                    </span>
                    {a.state === 'connected' ? (
                      <Plus size={16} className="shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
                    ) : (
                      <Badge variant="warning">Reconnect</Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            !accounts.length && (
              <p className="text-sm text-muted-foreground">
                Save an idea now, or{' '}
                <Link className="underline underline-offset-2" href="/settings/connectors">
                  connect a social account
                </Link>{' '}
                to add destinations.
              </p>
            )
          )}
        </SettingsSection>

        {t && !account && (
          <SettingsSection className="bg-control" title="Unavailable account" actions={<RemoveButton onClick={remove} />}>
            <RowWarning>
              This account is no longer connected to DUMA. Remove it here, or reconnect it in{' '}
              <Link href="/settings/connectors" className="underline underline-offset-2">
                Settings → Connections
              </Link>
              .
            </RowWarning>
          </SettingsSection>
        )}

        {t && account && (
          <SettingsSection
            className="bg-control"
            title={`On ${LABELS[account.provider]}`}
            description={account.name}
            alignActionsToTitle
            actions={<RemoveButton onClick={remove} />}
            footnote="Video processing may delay visibility. If a scheduled time is missed by more than 15 minutes, DUMA pauses the post for review."
          >
            <div className="space-y-4">
              <PickerRow
                icon={LayoutGrid}
                title="Format"
                value={formatLabel(t.format)}
                open={open === 'format'}
                onToggle={() => toggle('format')}
              >
                <ChoiceCards
                  appearance="settings"
                  columns={FORMATS[account.provider].length === 3 ? 3 : 2}
                  options={FORMATS[account.provider].map((f) => ({ value: f, label: formatLabel(f) }))}
                  value={t.format}
                  onChange={(f) => {
                    patch({ format: f });
                    setOpen(null);
                  }}
                />
              </PickerRow>

              {account.provider === 'youtube' && (
                <FieldRow icon={Video} title="Video title" htmlFor="yt-title" note={`${String(t.options.title ?? '').length}/100`}>
                  <Input
                    id="yt-title"
                    value={String(t.options.title ?? '')}
                    maxLength={100}
                    onChange={(e) => patch({ options: { ...t.options, title: e.target.value } })}
                  />
                </FieldRow>
              )}

              <FieldRow
                icon={AlignLeft}
                title={account.provider === 'youtube' ? 'Description' : 'Caption'}
                htmlFor="target-caption"
                note={
                  t.caption !== caption ? (
                    <NoteButton onClick={() => patch({ caption })}>Use the post’s caption</NoteButton>
                  ) : (
                    'Same as the post'
                  )
                }
              >
                <textarea
                  id="target-caption"
                  rows={4}
                  className={control}
                  value={t.caption}
                  onChange={(e) => patch({ caption: e.target.value })}
                />
              </FieldRow>

              {t.format !== 'text' && (
                <FieldRow
                  icon={ImageIcon}
                  title="Media"
                  note={
                    targets.length > 1 && t.media.length > 0 ? (
                      <NoteButton
                        onClick={() => {
                          setTargets((list) =>
                            list.map((item) => ({ ...item, media: t.media, options: { ...item.options, consent: false } })),
                          );
                          setDirty(true);
                        }}
                      >
                        Use for every destination
                      </NoteButton>
                    ) : t.format === 'carousel' ? (
                      'Add several, in order'
                    ) : undefined
                  }
                >
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {t.media.map((a) => (
                      <div key={a.id} className="group relative aspect-square overflow-hidden rounded-md border border-rule/60 bg-band/40">
                        {a.mimeType.startsWith('video/') ? (
                          <video controls preload="metadata" src={assetSrc(a)} className="size-full object-cover" />
                        ) : (
                          <Image
                            unoptimized
                            width={240}
                            height={240}
                            src={assetSrc(a)}
                            alt={a.fileName}
                            className="size-full object-cover"
                          />
                        )}
                        <button
                          type="button"
                          aria-label={`Remove ${a.fileName}`}
                          onClick={() => patch({ media: t.media.filter((m) => m.id !== a.id) })}
                          className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-90 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
                        >
                          <X size={13} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => setLibrary(true)}
                      className="flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed border-rule bg-field text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <Plus size={16} aria-hidden="true" />
                      {t.media.length && t.format !== 'carousel' ? 'Replace' : 'Add'}
                    </button>
                  </div>
                </FieldRow>
              )}

              <FieldRow
                icon={Clock}
                title="Goes out"
                htmlFor="target-time"
                note={
                  targets.length > 1 ? (
                    <NoteButton
                      onClick={() => {
                        setTargets((list) =>
                          list.map((item) => ({
                            ...item,
                            local: t.local,
                            choice: t.choice,
                            timeZone: t.timeZone,
                            options: { ...item.options, consent: false },
                          })),
                        );
                        setDirty(true);
                      }}
                    >
                      Use for every destination
                    </NoteButton>
                  ) : (
                    t.timeZone
                  )
                }
              >
                <input
                  id="target-time"
                  type="datetime-local"
                  className={control}
                  value={t.local}
                  onChange={(e) => patch({ local: e.target.value, choice: '' })}
                />
                {targets.length > 1 && <Hint>In {t.timeZone}.</Hint>}
                {t.local && candidates.length === 0 && (
                  <RowWarning className="mt-2">The clocks skip this time in {t.timeZone}. Choose another time.</RowWarning>
                )}
                {candidates.length > 1 && (
                  <div className="mt-3">
                    <p className="mb-2 text-xs font-medium text-foreground">The clocks go back, so this time happens twice. Which one?</p>
                    <ChoiceCards
                      appearance="settings"
                      options={candidates.map((at) => ({ value: at, label: offsetLabel(at, t.timeZone) }))}
                      value={t.choice}
                      onChange={(choice) => patch({ choice })}
                    />
                  </div>
                )}
              </FieldRow>

              {account.provider === 'youtube' && (
                <>
                  <PickerRow
                    icon={Eye}
                    title="Who can see it"
                    value={t.options.privacy ? formatLabel(String(t.options.privacy)) : 'Choose'}
                    tone={t.options.privacy ? undefined : 'warning'}
                    open={open === 'privacy'}
                    onToggle={() => toggle('privacy')}
                  >
                    <ChoiceCards
                      appearance="settings"
                      columns={3}
                      options={[
                        { value: 'public', label: 'Public' },
                        { value: 'unlisted', label: 'Unlisted' },
                        { value: 'private', label: 'Private' },
                      ]}
                      value={String(t.options.privacy ?? '')}
                      onChange={(privacy) => {
                        patch({ options: { ...t.options, privacy } });
                        setOpen(null);
                      }}
                    />
                  </PickerRow>
                  <PickerRow
                    icon={Shield}
                    title="Made for kids"
                    value={t.options.madeForKids === undefined ? 'Choose' : t.options.madeForKids ? 'Yes' : 'No'}
                    tone={t.options.madeForKids === undefined ? 'warning' : undefined}
                    open={open === 'kids'}
                    onToggle={() => toggle('kids')}
                  >
                    <ChoiceCards
                      appearance="settings"
                      options={[
                        { value: 'false', label: 'No, not made for kids' },
                        { value: 'true', label: 'Yes, made for kids' },
                      ]}
                      value={t.options.madeForKids === undefined ? '' : String(t.options.madeForKids)}
                      onChange={(v) => {
                        patch({ options: { ...t.options, madeForKids: v === 'true' } });
                        setOpen(null);
                      }}
                    />
                    <Hint>YouTube asks this of every video; it changes who sees comments and ads.</Hint>
                  </PickerRow>
                </>
              )}

              {['youtube', 'tiktok'].includes(account.provider) && (
                <InfoRow icon={Sparkles} title="Altered or AI-made media" description="Realistic content that’s been changed or generated">
                  <Switch
                    checked={t.options.synthetic === true}
                    label="Contains realistic altered or synthetic media"
                    onChange={(synthetic) => patch({ options: { ...t.options, synthetic, consent: false } })}
                  />
                </InfoRow>
              )}
            </div>

            {account.state !== 'connected' && (
              <RowWarning className="mt-4">
                This account needs reconnecting before it can be scheduled. Reconnect it in{' '}
                <Link href={`/settings/connectors?connector=${account.provider}`} className="underline underline-offset-2">
                  Settings → Connections
                </Link>
                .
              </RowWarning>
            )}
            {gaps.filter((g) => g !== 'Reconnect the account').length > 0 && (
              <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Still to do here: </span>
                {gaps.filter((g) => g !== 'Reconnect the account').join(' · ')}
              </p>
            )}
          </SettingsSection>
        )}

        {t && account?.provider === 'tiktok' && (
          <SettingsSection className="bg-control" title="TikTok settings" description="TikTok asks for these on every post.">
            <TikTokFields
              target={t}
              account={account}
              onChange={(options) =>
                patch({
                  options: {
                    ...options,
                    consent:
                      JSON.stringify({ ...options, consent: false }) === JSON.stringify({ ...t.options, consent: false })
                        ? options.consent
                        : false,
                  },
                })
              }
            />
          </SettingsSection>
        )}

        {error && <RowWarning>{error}</RowWarning>}
      </div>
      {library && (
        <MediaLibrary
          selectedIds={t?.media.map((m) => m.id)}
          onClose={() => setLibrary(false)}
          onPick={(a) => {
            if (t) patch({ media: t.media.some((m) => m.id === a.id) ? t.media : t.format === 'carousel' ? [...t.media, a] : [a] });
          }}
        />
      )}
      {discard && (
        <ConfirmModal
          title="Discard unsaved changes?"
          message="Your changes have not been saved."
          confirmLabel="Discard"
          onConfirm={onClose}
          onClose={() => setDiscard(false)}
        />
      )}
      {confirm && (
        <ConfirmModal
          title={confirm === 'now' ? 'Post to these destinations now?' : 'Schedule these destinations?'}
          message={
            <span className="block space-y-2">
              {targets.map((t) => {
                const a = accounts.find((item) => item.id === t.connectionId);
                return (
                  <span className="flex items-center gap-2" key={t.connectionId}>
                    {a && <BrandMark platform={a.provider} />}
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{a?.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {confirm === 'now' ? `${a ? `${LABELS[a.provider]} · ` : ''}now` : `${wallLabel(t.local)} · ${t.timeZone}`}
                    </span>
                  </span>
                );
              })}
            </span>
          }
          confirmLabel={confirm === 'now' ? 'Post now' : 'Schedule posts'}
          pendingLabel={confirm === 'now' ? 'Posting…' : 'Scheduling…'}
          isPending={save.isPending}
          onConfirm={() => {
            const mode = confirm;
            setConfirm(null);
            save.mutate(mode);
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </Drawer>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" className="h-9 text-exception hover:bg-exception/6 hover:text-exception" onClick={onClick}>
      <Trash2 size={14} aria-hidden="true" />
      Remove
    </Button>
  );
}
