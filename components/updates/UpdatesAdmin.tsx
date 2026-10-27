'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import { MarkdownEditor } from '@/components/cms/MarkdownEditor';
import { ActionRow, ActionRows, FieldRow, InfoRow, InfoRows, PickerRow, RowTile } from '@/components/cms/rows';
import {
  AlertTriangle,
  AlignLeft,
  Boxes,
  CalendarClock,
  ChevronRight,
  Clock,
  Eye,
  Globe,
  Heading,
  Link2,
  Megaphone,
  Plus,
  Tag,
  Timer,
  Users,
  XCircle,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SaveBar, Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { ChoiceCards } from '@/components/shared/FormParts';
import { Modal } from '@/components/shared/Modal';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  type UpdateContent,
  type UpdateDraft,
  getUpdateDraft,
  getUpdateDrafts,
  publishUpdate,
  saveUpdateDraft,
  unpublishUpdate,
  updateKeys,
} from '@/lib/modules/identity/client';
import { MODULE_IDS } from '@/lib/modules/manifest';
import { toast } from '@/lib/toast';
import { audienceLabel, humanName, updateDraftCheck, updateStatus } from '@/lib/utils/product-updates';
import { useAuthStore } from '@/stores/authStore';

import { UPDATE_CATEGORIES, UpdateArticle } from './UpdateArticle';

const EMPTY: UpdateContent = {
  title: '',
  summary: '',
  body: '',
  category: 'new',
  targetRoles: [],
  targetModules: [],
  actionLabel: '',
  actionUrl: '',
};
const ROLES = ['super_admin', 'franchise_owner', 'store_manager', 'barista', 'hr_manager', 'marketing_manager', 'auditor'];
const CATEGORY_OPTIONS = UPDATE_CATEGORIES as { value: UpdateContent['category']; label: string }[];

/** The page's sections rise in one after another, as in Settings. */
function Rise({ children }: { children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="w-full"
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
    >
      {children}
    </motion.div>
  );
}

/**
 * DUMA Updates: product news written once and read by every workspace's staff.
 * The list of posts, each opening its editor; under DUMA Admin it is its own
 * page, under Content → Updates it sits beneath the Content tabs.
 */
export function UpdatesAdmin({ tabs }: { tabs?: ReactNode }) {
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const [editing, setEditing] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const list = useQuery({
    queryKey: [...updateKeys.all, user?.id, 'admin', page],
    queryFn: () => getUpdateDrafts(page),
    enabled: role === 'super_admin',
  });
  const detail = useQuery({
    queryKey: [...updateKeys.all, user?.id, 'admin-detail', editing],
    queryFn: () => getUpdateDraft(editing!),
    enabled: role === 'super_admin' && !!editing && editing !== 'new',
  });
  if (role !== 'super_admin') return <p className="text-sm text-muted-foreground">Superadmin access is required to manage updates.</p>;
  if (editing === 'new' || (editing && detail.data))
    return <UpdateEditor key={editing} initial={editing === 'new' ? null : detail.data!} onClose={() => setEditing(null)} />;

  const body = () => {
    if (list.isPending || (editing && detail.isPending)) return <Bone className="h-96 w-full rounded-lg" />;
    if (editing && detail.isError) return <ErrorState title="This update couldn’t be loaded" onRetry={() => void detail.refetch()} />;
    if (list.isError) return <ErrorState title="Updates couldn’t be loaded" onRetry={() => void list.refetch()} />;
    const rows = list.data.data;
    return (
      <SettingsTabBody
        narrowAside
        aside={
          <SettingsSection title="Where staff read them">
            <div className="-mx-2 flex flex-col gap-0.5">
              <Link
                href="/updates"
                className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring"
              >
                <RowTile icon={Globe} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">Updates page</span>
                  <span className="block truncate text-xs text-muted-foreground">Published posts, newest first</span>
                </span>
                <Chevron />
              </Link>
            </div>
            <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
              A post can also show once as a message on the next dashboard visit — you choose when you publish.
            </p>
          </SettingsSection>
        }
      >
        <SettingsSection
          title="DUMA Updates"
          description="Share product news across all DUMA workspaces. Drafts stay private until you publish them."
        >
          {rows.length === 0 && page === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your first update starts here. Explain what changed and why it helps — publish quietly, or show a one-time message on the next
              dashboard visit.
            </p>
          ) : (
            <div className="-mx-2 flex flex-col gap-0.5">
              {rows.map((row) => {
                const state = updateStatus(row);
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setEditing(row.id)}
                    className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <RowTile
                      icon={Megaphone}
                      tone={state.tone === 'warning' ? 'warning' : state.tone === 'success' ? 'success' : 'default'}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{row.draft.title || 'Untitled'}</span>
                      <span className="block truncate text-xs text-muted-foreground">{row.draft.summary}</span>
                    </span>
                    <Badge variant={state.tone}>{state.label}</Badge>
                    <Chevron />
                  </button>
                );
              })}
            </div>
          )}
          {(page > 0 || list.data.hasMore) && (
            <div className="mt-4 flex justify-between gap-2">
              <Button variant="outline" className="h-9" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button variant="outline" className="h-9" disabled={!list.data.hasMore} onClick={() => setPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </SettingsSection>
      </SettingsTabBody>
    );
  };

  return (
    <EditorShell
      eyebrow={tabs ? undefined : 'DUMA Admin'}
      title={tabs ? 'Content' : 'Updates'}
      icon={<Megaphone size={20} aria-hidden="true" />}
      subheader={tabs}
      actions={
        <Button className="h-9" onClick={() => setEditing('new')}>
          <Plus size={16} aria-hidden="true" />
          New update
        </Button>
      }
    >
      <Rise>{body()}</Rise>
    </EditorShell>
  );
}

type Row = 'category' | 'button' | 'roles' | 'modules';

/**
 * One update: the article, its optional button and its audience in the main
 * column; where it stands, previews and withdrawal alongside. Edited as a
 * draft and saved through the SaveBar; publishing (now, scheduled, with or
 * without a dashboard message) is its own step.
 */
function UpdateEditor({ initial, onClose }: { initial: UpdateDraft | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [current, setCurrent] = useState(initial);
  const [draft, setDraft] = useState<UpdateContent>(initial?.draft ?? EMPTY);
  const [open, setOpen] = useState<Row | null>(null);
  const [preview, setPreview] = useState<'article' | 'popup' | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [announce, setAnnounce] = useState(initial?.announcement ? false : true);
  const [schedule, setSchedule] = useState('');
  const [expiry, setExpiry] = useState('');
  const saved = current?.draft ?? EMPTY;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const patch = (values: Partial<UpdateContent>) => setDraft((previous) => ({ ...previous, ...values }));
  const check = updateDraftCheck(draft);
  const changed = () => {
    void qc.invalidateQueries({ queryKey: updateKeys.all });
  };
  const save = useMutation({
    mutationFn: () => saveUpdateDraft(draft, current),
    onSuccess: (row) => {
      setCurrent(row);
      setDraft(row.draft);
      changed();
      toast('success', 'Draft saved.');
    },
    onError: (error) => toast('error', error.message),
  });
  const publish = useMutation({
    mutationFn: async () => {
      const row = dirty || !current ? await saveUpdateDraft(draft, current) : current;
      setCurrent(row);
      setDraft(row.draft);
      return publishUpdate(row, {
        announce,
        ...(schedule ? { publishedAt: new Date(schedule).toISOString() } : {}),
        ...(announce && expiry ? { popupExpiresAt: new Date(expiry).toISOString() } : {}),
      });
    },
    onSuccess: (row) => {
      setCurrent(row);
      setPublishing(false);
      changed();
      toast('success', new Date(row.publishedAt!) > new Date() ? 'Update scheduled.' : 'Update published.');
    },
    onError: (error) => toast('error', error.message),
  });
  const unpublish = useMutation({
    mutationFn: () => unpublishUpdate(current!),
    onSuccess: (row) => {
      setCurrent(row);
      setRemoving(false);
      changed();
      toast('success', 'Update withdrawn. Your draft is kept.');
    },
    onError: (error) => toast('error', error.message),
  });
  const busy = save.isPending || publish.isPending || unpublish.isPending;
  const state = current ? updateStatus(current) : { label: 'Draft', tone: 'muted' as const };
  const scheduled = state.label === 'Scheduled';
  const toggle = (row: Row) => setOpen((now) => (now === row ? null : row));
  const button =
    draft.actionLabel.trim() || draft.actionUrl.trim() ? `${draft.actionLabel.trim() || '—'} → ${draft.actionUrl.trim() || '—'}` : 'None';

  return (
    <EditorShell
      eyebrow="DUMA Updates"
      title={current ? draft.title.trim() || 'Edit update' : 'New update'}
      icon={<Megaphone size={20} aria-hidden="true" />}
      onClose={onClose}
      dirty={dirty}
      actions={
        <Button
          className="h-9"
          disabled={!check.valid || busy}
          onClick={() => {
            publish.reset();
            setPublishing(true);
          }}
        >
          Publish…
        </Button>
      }
    >
      <Rise>
        <SettingsTabBody
          narrowAside
          aside={
            <>
              <SettingsSection title="Publication" actions={<Badge variant={state.tone}>{state.label}</Badge>}>
                {current ? (
                  <InfoRows>
                    {current.publishedAt && (
                      <InfoRow icon={Globe} title={scheduled ? 'Goes live' : 'Published'}>
                        <RelativeTime iso={current.publishedAt} className="text-sm text-foreground" />
                      </InfoRow>
                    )}
                    <InfoRow icon={Clock} title="Last saved">
                      <RelativeTime iso={current.updatedAt} className="text-sm text-foreground" />
                    </InfoRow>
                  </InfoRows>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Save the draft once and where it stands appears here. Visible across DUMA only when published.
                  </p>
                )}
                <div className="mt-4">
                  <ActionRows
                    danger={
                      current?.publishedAt ? (
                        <ActionRow
                          icon={XCircle}
                          label={scheduled ? 'Cancel scheduled update' : 'Withdraw update'}
                          danger
                          disabled={busy}
                          onClick={() => setRemoving(true)}
                        />
                      ) : undefined
                    }
                  >
                    <ActionRow icon={Eye} label="Preview article" onClick={() => setPreview('article')} />
                    <ActionRow icon={Megaphone} label="Preview dashboard message" onClick={() => setPreview('popup')} />
                  </ActionRows>
                </div>
              </SettingsSection>
              <SettingsSection
                title="Audience"
                description="Everyone with DUMA staff access unless you choose a filter. Matching users receive updates even if CMS is disabled."
                footnote="When both filters are set, users must match a selected role and have at least one selected module enabled in their home workspace."
              >
                <div className="space-y-3">
                  <PickerRow
                    icon={Users}
                    title="Roles"
                    value={audienceLabel(draft.targetRoles, 'Every role')}
                    muted={!draft.targetRoles.length}
                    open={open === 'roles'}
                    onToggle={() => toggle('roles')}
                  >
                    <Checklist options={ROLES} value={draft.targetRoles} onChange={(targetRoles) => patch({ targetRoles })} />
                  </PickerRow>
                  <PickerRow
                    icon={Boxes}
                    title="Enabled modules"
                    value={audienceLabel(draft.targetModules, 'Any module')}
                    muted={!draft.targetModules.length}
                    open={open === 'modules'}
                    onToggle={() => toggle('modules')}
                  >
                    <Checklist options={MODULE_IDS} value={draft.targetModules} onChange={(targetModules) => patch({ targetModules })} />
                  </PickerRow>
                </div>
              </SettingsSection>
            </>
          }
        >
          <SettingsSection
            title="Article"
            actions={
              check.missing.length > 0 ? (
                <Badge variant="warning">{check.missing.length} required left</Badge>
              ) : (
                <Badge variant="success">Required filled</Badge>
              )
            }
          >
            <div className="space-y-5">
              <FieldRow icon={Heading} title="Title" htmlFor="update-title">
                <Input
                  id="update-title"
                  maxLength={160}
                  value={draft.title}
                  onChange={(event) => patch({ title: event.target.value })}
                  placeholder="Menu management just got easier"
                  disabled={busy}
                />
              </FieldRow>
              <FieldRow icon={AlignLeft} title="Summary" htmlFor="update-summary">
                <Input
                  id="update-summary"
                  maxLength={400}
                  value={draft.summary}
                  onChange={(event) => patch({ summary: event.target.value })}
                  hint="The short message people see before opening the full update."
                  disabled={busy}
                />
              </FieldRow>
              <PickerRow
                icon={Tag}
                title="Category"
                value={CATEGORY_OPTIONS.find((option) => option.value === draft.category)?.label ?? draft.category}
                open={open === 'category'}
                onToggle={() => toggle('category')}
              >
                <ChoiceCards
                  appearance="settings"
                  columns={3}
                  value={draft.category}
                  options={CATEGORY_OPTIONS}
                  onChange={(category) => patch({ category })}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  The label above the article, so readers know what kind of news it is.
                </p>
              </PickerRow>
              <MarkdownEditor
                id="update-body"
                label="What changed"
                help="Use headings, images and clear steps. Images from Media become visible to this update’s audience when you publish."
                value={draft.body}
                onChange={(body) => patch({ body })}
                error={false}
                disabled={busy}
              />
            </div>
          </SettingsSection>

          <SettingsSection title="Button">
            <PickerRow
              icon={Link2}
              title="Button at the end"
              value={button}
              muted={button === 'None'}
              tone={check.buttonIncomplete ? 'warning' : undefined}
              open={open === 'button'}
              onToggle={() => toggle('button')}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Label"
                  value={draft.actionLabel}
                  maxLength={80}
                  onChange={(event) => patch({ actionLabel: event.target.value })}
                  placeholder="Open the menu"
                  disabled={busy}
                />
                <Input
                  label="Link"
                  value={draft.actionUrl}
                  maxLength={1000}
                  onChange={(event) => patch({ actionUrl: event.target.value })}
                  placeholder="/menu"
                  disabled={busy}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Optional. A DUMA page path or an https link, so readers can try it straight away.
              </p>
            </PickerRow>
            {check.buttonIncomplete && <Warning>A button needs both a label and a link. Add the missing one, or clear both.</Warning>}
          </SettingsSection>

          <SaveBar
            dirty={dirty}
            saving={save.isPending}
            saveLabel="Save draft"
            disabled={!check.valid || busy}
            message={check.valid ? 'Unsaved changes' : 'Fill the required parts to save'}
            onSave={() => save.mutate()}
            onDiscard={() => setDraft(saved)}
          />
        </SettingsTabBody>
      </Rise>

      {preview && (
        <Modal
          title={preview === 'popup' ? 'What’s new in DUMA' : 'Article preview'}
          size={preview === 'popup' ? 'md' : 'xl'}
          onClose={() => setPreview(null)}
        >
          {preview === 'article' ? (
            <UpdateArticle content={draft} />
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">{draft.title || 'Your update title'}</h2>
              <p className="text-sm text-muted-foreground">{draft.summary || 'Your short summary appears here.'}</p>
              <p className="text-xs text-muted-foreground">Preview only. Users can dismiss this message or open the full update.</p>
              <Button onClick={() => setPreview('article')}>Read update</Button>
            </div>
          )}
        </Modal>
      )}
      {publishing && (
        <Modal
          title="Publish this update"
          size="lg"
          onClose={() => !publish.isPending && setPublishing(false)}
          footer={
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" disabled={publish.isPending} onClick={() => setPublishing(false)}>
                Cancel
              </Button>
              <Button disabled={publish.isPending} onClick={() => publish.mutate()}>
                {publish.isPending ? 'Publishing…' : schedule ? 'Schedule update' : announce ? 'Publish & announce' : 'Publish update'}
              </Button>
            </div>
          }
        >
          <div className="space-y-5">
            <p className="rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
              {!draft.targetRoles.length && !draft.targetModules.length
                ? 'Audience: all DUMA staff users across all workspaces.'
                : 'Audience: users matching the role and module filters you chose.'}
            </p>
            <div>
              <InfoRow icon={Megaphone} title="Show once on the next dashboard visit">
                <Switch checked={announce} onChange={setAnnounce} label="Show once on the next dashboard visit" />
              </InfoRow>
              <p className="mt-1.5 text-xs text-muted-foreground">
                One message per session, after the dashboard is ready. It won’t interrupt POS or the kitchen screen.
              </p>
              {announce && !!current?.announcement && (
                <Warning>This is a new announcement. People who already saw this post can see the message again.</Warning>
              )}
              {!announce && !!current?.popupExpiresAt && (
                <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
                  Existing announcement delivery continues until its expiry. People who already saw it won’t see it again.
                </p>
              )}
            </div>
            <FieldRow icon={CalendarClock} title="Publish at" htmlFor="update-schedule" note="Optional">
              <Input
                id="update-schedule"
                type="datetime-local"
                value={schedule}
                onChange={(event) => setSchedule(event.target.value)}
                hint="Leave empty to publish now. Times use this device’s timezone. Scheduled content is frozen when you confirm."
              />
            </FieldRow>
            {announce && (
              <FieldRow icon={Timer} title="Stop showing the message" htmlFor="update-expiry" note="Optional">
                <Input
                  id="update-expiry"
                  type="datetime-local"
                  value={expiry}
                  onChange={(event) => setExpiry(event.target.value)}
                  hint="Defaults to 30 days after publication. The article stays in Updates."
                />
              </FieldRow>
            )}
            {publish.isError && (
              <p role="alert" className="text-sm text-destructive">
                {publish.error.message}
              </p>
            )}
          </div>
        </Modal>
      )}
      {removing && (
        <ConfirmModal
          title="Withdraw this update?"
          message="It will disappear from the Updates page and stop showing to users. Your draft and delivery history are kept."
          confirmLabel="Withdraw update"
          isPending={unpublish.isPending}
          onConfirm={() => unpublish.mutate()}
          onClose={() => !unpublish.isPending && setRemoving(false)}
        />
      )}
    </EditorShell>
  );
}

/** A filter's options as ticks; none ticked means no filter. */
function Checklist({ options, value, onChange }: { options: readonly string[]; value: string[]; onChange: (value: string[]) => void }) {
  return (
    <div className="grid max-h-60 gap-y-1 overflow-y-auto">
      {options.map((option) => (
        <label key={option} className="flex min-h-9 items-center gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={value.includes(option)}
            onChange={(event) => onChange(event.target.checked ? [...value, option] : value.filter((item) => item !== option))}
          />
          <span>{humanName(option)}</span>
        </label>
      ))}
    </div>
  );
}

function Chevron() {
  return (
    <ChevronRight
      size={14}
      className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
      aria-hidden="true"
    />
  );
}

/** Something that stops the update saving or behaving as expected. */
function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured">
      <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
