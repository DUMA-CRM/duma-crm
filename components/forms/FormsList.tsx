'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { Bell, ClipboardList, Clock, ListChecks, Plus, Search, Send, X } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Bone, FactsSkeleton, ListSkeleton } from '@/components/shared/Skeleton';
import type { Tone } from '@/components/shared/tone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import { type FormListItem, getForms } from '@/lib/modules/forms/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type FormStanding, STANDING_LABELS, formStanding, responsesLabel } from '@/lib/utils/forms';
import { FORMS_VIEW_LABELS, type FormsView, filterForms, formsOverview, inFormsView } from '@/lib/utils/forms-overview';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import type { EditorTab } from './FormEditor';
import { NewFormDialog, TemplateGallery } from './TemplateGallery';

export const STANDING_BADGE: Record<FormStanding, 'success' | 'reference' | 'warning' | 'muted'> = {
  draft: 'muted',
  live: 'success',
  scheduled_close: 'success',
  full: 'warning',
  ended: 'muted',
  closed: 'muted',
  archived: 'muted',
};

const STANDING_TONE: Record<FormStanding, Tone> = {
  draft: 'muted',
  live: 'success',
  scheduled_close: 'success',
  full: 'warning',
  ended: 'muted',
  closed: 'muted',
  archived: 'muted',
};

const VIEWS: readonly FormsView[] = ['current', 'live', 'draft', 'closed', 'archived'];

/**
 * The workspace's forms as a list: four figures, a search with the Show and
 * Responses selects beside it (as Content → Entries) and the count, then one row per form. A
 * row with new responses opens on them. With no forms yet, the templates are
 * the page.
 */
export function FormsList({ onOpen }: { onOpen: (id: string, tab?: EditorTab) => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'forms:write');
  const canReadResponses = hasCapability(capabilities, 'forms.responses:read');
  const reduceMotion = useReducedMotion();
  const [view, setView] = useState<FormsView>('current');
  const [onlyNew, setOnlyNew] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  // Pinned on mount so "Live" doesn't flip under a render.
  const [now] = useState(() => Date.now());

  const query = useQuery({
    queryKey: moduleQueryKeys.forms.key('list', tenantId),
    queryFn: () => getForms(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const all = useMemo(() => query.data ?? [], [query.data]);
  const overview = useMemo(() => formsOverview(all, now), [all, now]);
  const shown = filterForms(all, { view, onlyNew, search }, now);

  const filtersActive = Boolean(search.trim()) || view !== 'current' || onlyNew;
  const clearFilters = () => {
    setSearch('');
    setView('current');
    setOnlyNew(false);
  };

  const header = (body: React.ReactNode) => (
    <EditorShell
      eyebrow="Customer engagement"
      title="Forms"
      icon={<ClipboardList size={20} aria-hidden="true" />}
      actions={
        canWrite && all.length > 0 ? (
          <Button className="h-9 gap-1.5" onClick={() => setCreating(true)}>
            <Plus size={15} aria-hidden="true" />
            <span className="hidden md:inline">New form</span>
          </Button>
        ) : undefined
      }
    >
      {body}
      {creating && <NewFormDialog onClose={() => setCreating(false)} onCreated={(id) => onOpen(id)} />}
    </EditorShell>
  );

  if (query.isPending)
    return header(
      <div className="flex flex-col gap-5" aria-busy="true">
        <FactsSkeleton count={4} label="Loading form figures" className="gap-3 sm:grid-cols-2 xl:grid-cols-4" />
        <div className="flex flex-wrap items-center gap-2">
          <Bone className="h-9 min-w-56 flex-1" />
          <Bone className="h-9 w-40" />
          <Bone className="h-9 w-40" />
        </div>
        <ListSkeleton rows={5} label="Loading your forms" />
      </div>,
    );

  if (query.isError) return header(<ErrorState className="flex-1" title="Couldn’t load your forms" onRetry={() => void query.refetch()} />);

  // No forms yet: making one is the page.
  if (all.length === 0)
    return header(
      canWrite ? (
        <div className="mx-auto w-full max-w-2xl">
          <motion.div initial={reduceMotion ? false : 'hidden'} animate="shown">
            <RecordGroup id="forms-start" title="Start a form" footnote="Change the name and every question afterwards.">
              <TemplateGallery onCreated={(id) => onOpen(id)} />
            </RecordGroup>
          </motion.div>
        </div>
      ) : (
        <EmptyState
          className="flex-1"
          icon={ClipboardList}
          title="No forms yet"
          description="Forms appear here once someone who can build them makes one."
        />
      ),
    );

  const viewCount = (value: FormsView) => all.filter((form) => inFormsView(form, value, now)).length;

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
          icon={Send}
          label="Live"
          value={overview.live}
          hint={`of ${overview.current} ${overview.current === 1 ? 'form' : 'forms'}`}
          onSelect={() => setView('live')}
        />
        <Fact
          surface="page"
          icon={Bell}
          label="New responses"
          value={overview.fresh.toLocaleString('en-GB')}
          hint={overview.waiting > 0 ? `on ${overview.waiting} ${overview.waiting === 1 ? 'form' : 'forms'}` : 'All looked at'}
          onSelect={overview.fresh > 0 ? () => setOnlyNew(true) : undefined}
        />
        <Fact surface="page" icon={ListChecks} label="Responses" value={overview.total.toLocaleString('en-GB')} hint="All time" />
        <Fact
          surface="page"
          icon={Clock}
          label="Last response"
          value={overview.lastResponseAt ? <RelativeTime iso={overview.lastResponseAt} /> : '—'}
          hint={overview.lastResponseAt ? undefined : 'None yet'}
        />
      </motion.dl>

      <motion.section variants={SECTION_RISE} className="flex flex-col gap-3" aria-label="Forms">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-56 flex-1">
            <Input
              type="search"
              aria-label="Find a form by name"
              placeholder="Form name…"
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
            onValueChange={(value) => setView(value as FormsView)}
            options={VIEWS.map((value) => ({ value, label: `${FORMS_VIEW_LABELS[value]} · ${viewCount(value)}` }))}
            ariaLabel="Which forms"
            className="w-40"
          />
          <Select
            value={onlyNew ? 'new' : 'any'}
            onValueChange={(value) => setOnlyNew(value === 'new')}
            options={[
              { value: 'any', label: 'Any responses' },
              { value: 'new', label: `New responses · ${overview.waiting}` },
            ]}
            ariaLabel="Forms with new responses"
            className="w-40"
          />
          <span className="ml-auto text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {filtersActive ? `${shown.length} of ${all.length}` : `${overview.current} ${overview.current === 1 ? 'form' : 'forms'}`}
          </span>
        </div>

        {shown.length === 0 ? (
          <EmptyState
            icon={Search}
            kind="search"
            title="No form matches"
            description="Try a different search or filter."
            action={{ label: 'Clear filters', onClick: clearFilters }}
          />
        ) : (
          <ListRowGroup aria-label="Forms">
            {shown.map((form) => (
              <FormRow
                key={form.id}
                form={form}
                now={now}
                onOpen={() => onOpen(form.id, canReadResponses && form.newResponses > 0 ? 'responses' : 'build')}
              />
            ))}
          </ListRowGroup>
        )}
      </motion.section>
    </motion.div>,
  );
}

/** One form: tile and name with where it stands; its questions and last response; new responses on the right. */
function FormRow({ form, now, onOpen }: { form: FormListItem; now: number; onOpen: () => void }) {
  const standing = formStanding(form, now);
  return (
    <ListRow
      icon={ClipboardList}
      tone={STANDING_TONE[standing]}
      title={form.name}
      titleExtra={
        <>
          <Badge variant={STANDING_BADGE[standing]} className="shrink-0">
            {STANDING_LABELS[standing]}
          </Badge>
          {form.hasUnpublishedChanges && standing !== 'draft' && (
            <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
              Unpublished changes
            </Badge>
          )}
        </>
      }
      meta={
        <>
          {form.fieldCount} {form.fieldCount === 1 ? 'question' : 'questions'}
          {form.lastResponseAt ? (
            <>
              {' · last response '}
              <RelativeTime iso={form.lastResponseAt} />
            </>
          ) : (
            ' · no responses yet'
          )}
        </>
      }
      trailing={
        <>
          {form.newResponses > 0 && (
            <Badge variant="success" className="tabular-nums">
              {form.newResponses} new
            </Badge>
          )}
          <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">{responsesLabel(form.responseCount)}</span>
        </>
      }
      onClick={onOpen}
    />
  );
}
