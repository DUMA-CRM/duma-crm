'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { InfoRow, InfoRows, RowTile } from '@/components/cms/rows';
import { Bell, Braces, ChevronRight, ClipboardList, Code, ListChecks, Plus, QrCode, Search } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { hasCapability } from '@/lib/auth/capabilities';
import { type FormListItem, getForms } from '@/lib/modules/forms/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type FormStanding, STANDING_LABELS, formStanding, responsesLabel } from '@/lib/utils/forms';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import type { EditorTab } from './FormEditor';
import { NewFormDialog, TemplateGallery } from './TemplateGallery';

type Filter = 'current' | 'archived';

export const STANDING_BADGE: Record<FormStanding, 'success' | 'reference' | 'warning' | 'muted'> = {
  draft: 'muted',
  live: 'success',
  scheduled_close: 'success',
  full: 'warning',
  ended: 'muted',
  closed: 'muted',
  archived: 'muted',
};

/**
 * The workspace's forms, laid out like Booking rules: one section of rows —
 * tile, name and where it stands, how many questions, when someone last
 * answered — with new responses called out. The aside counts what's live and
 * waiting, and says the three ways a form collects. With no forms yet, the
 * templates are the page.
 */
export function FormsList({ onOpen }: { onOpen: (id: string, tab?: EditorTab) => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'forms:write');
  const canReadResponses = hasCapability(capabilities, 'forms.responses:read');
  const reduceMotion = useReducedMotion();
  const [filter, setFilter] = useState<Filter>('current');
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
  const needle = search.trim().toLowerCase();
  const shown = all
    .filter((form) => (filter === 'archived' ? form.status === 'archived' : form.status !== 'archived'))
    .filter((form) => !needle || form.name.toLowerCase().includes(needle));

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

  if (query.isSuccess && all.length === 0) {
    return header(
      <div className="mx-auto w-full max-w-5xl py-4">
        <div className="mb-6 max-w-2xl">
          <h2 className="text-xl font-semibold tracking-title text-foreground">{canWrite ? 'Build your first form' : 'No forms yet'}</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {canWrite
              ? 'Enquiries, feedback, sign-ups, applications — share it as a link or QR code, put it on your website, or send answers straight to the API. Respondents can become customers.'
              : 'Forms appear here once someone who can build them makes one.'}
          </p>
        </div>
        {canWrite && <TemplateGallery onCreated={(id) => onOpen(id)} />}
      </div>,
    );
  }

  return header(
    <SettingsTabBody narrowAside aside={<FormsAside forms={all} loaded={query.isSuccess} now={now} />}>
      <SettingsSection
        title="Forms"
        actions={
          <SegmentedControl<Filter>
            value={filter}
            onChange={setFilter}
            ariaLabel="Which forms"
            options={[
              { value: 'current', label: 'Current' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        }
      >
        {query.isPending ? (
          <TilesSkeleton count={4} label="Loading forms" />
        ) : query.isError ? (
          <ErrorState title="Couldn’t load your forms" onRetry={() => void query.refetch()} />
        ) : (
          <div className="space-y-3">
            {all.length > 6 && (
              <Input
                aria-label="Find a form"
                placeholder="Find by name"
                value={search}
                leftIcon={<Search size={14} aria-hidden="true" />}
                onChange={(event) => setSearch(event.target.value)}
              />
            )}
            {shown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {needle ? `No form matches “${search.trim()}”.` : filter === 'archived' ? 'Nothing archived.' : 'Everything is archived.'}
              </p>
            ) : (
              <ul className="-mx-2 flex flex-col gap-0.5">
                {shown.map((form, index) => (
                  <motion.li
                    key={form.id}
                    initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0, transition: { delay: reduceMotion ? 0 : Math.min(index, 8) * 0.03 } }}
                  >
                    <FormRow
                      form={form}
                      now={now}
                      onOpen={() => onOpen(form.id, canReadResponses && form.newResponses > 0 ? 'responses' : 'build')}
                    />
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

/** One form: tile, name and standing; its questions and last response; new responses on the right. */
function FormRow({ form, now, onOpen }: { form: FormListItem; now: number; onOpen: () => void }) {
  const standing = formStanding(form, now);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
    >
      <RowTile
        icon={ClipboardList}
        tone={standing === 'live' || standing === 'scheduled_close' ? 'success' : standing === 'full' ? 'warning' : 'default'}
      />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{form.name}</span>
          <Badge variant={STANDING_BADGE[standing]} className="shrink-0">
            {STANDING_LABELS[standing]}
          </Badge>
          {form.hasUnpublishedChanges && standing !== 'draft' && (
            <Badge variant="outline" className="hidden shrink-0 sm:inline-flex">
              Unpublished changes
            </Badge>
          )}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {form.fieldCount} {form.fieldCount === 1 ? 'question' : 'questions'}
          {form.lastResponseAt ? (
            <>
              {' · last response '}
              <RelativeTime iso={form.lastResponseAt} />
            </>
          ) : (
            ' · no responses yet'
          )}
        </span>
      </span>
      <span className="hidden shrink-0 items-center gap-2 sm:flex">
        {form.newResponses > 0 && (
          <span className="rounded-full bg-momentum/12 px-2 py-0.5 text-xs font-semibold tabular-nums text-momentum">
            {form.newResponses} new
          </span>
        )}
        <span className="text-right text-xs tabular-nums text-muted-foreground">{responsesLabel(form.responseCount)}</span>
      </span>
      <ChevronRight
        size={16}
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  );
}

function FormsAside({ forms, loaded, now }: { forms: FormListItem[]; loaded: boolean; now: number }) {
  const current = forms.filter((form) => form.status !== 'archived');
  const live = current.filter((form) => ['live', 'scheduled_close'].includes(formStanding(form, now))).length;
  const fresh = current.reduce((sum, form) => sum + form.newResponses, 0);
  const total = current.reduce((sum, form) => sum + form.responseCount, 0);
  const figure = (value: React.ReactNode) => <span className="text-sm tabular-nums text-muted-foreground">{loaded ? value : '—'}</span>;
  return (
    <>
      <SettingsSection title="Overview">
        <InfoRows>
          <InfoRow icon={ClipboardList} title="Live now">
            {figure(
              <>
                <span className="text-foreground">{live}</span> of {current.length}
              </>,
            )}
          </InfoRow>
          <InfoRow icon={Bell} title="Waiting for a look" tone={fresh > 0 ? 'success' : undefined}>
            {figure(<span className={fresh > 0 ? 'font-semibold text-momentum' : undefined}>{fresh.toLocaleString('en-GB')}</span>)}
          </InfoRow>
          <InfoRow icon={ListChecks} title="Responses">
            {figure(total.toLocaleString('en-GB'))}
          </InfoRow>
        </InfoRows>
      </SettingsSection>
      <SettingsSection title="Three ways to collect">
        <ul className="space-y-3">
          {[
            { icon: QrCode, title: 'A link or QR code', text: 'DUMA hosts the page — on a table, a receipt, a social post.' },
            { icon: Code, title: 'On your website', text: 'Paste one snippet; it fits itself to the form.' },
            { icon: Braces, title: 'Through the API', text: 'Your own design posts the answers; DUMA checks and keeps them.' },
          ].map((way) => (
            <li key={way.title} className="flex gap-3">
              <RowTile icon={way.icon} />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{way.title}</span>
                <span className="block text-xs leading-relaxed text-muted-foreground">{way.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </SettingsSection>
    </>
  );
}
