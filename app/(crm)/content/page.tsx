'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { CmsOverviewPanel } from '@/components/cms/CmsOverviewPanel';
import { ContentConfiguration } from '@/components/cms/ContentConfiguration';
import { ContentSettingsPanel } from '@/components/cms/ContentSettingsPanel';
import { EntriesPanel } from '@/components/cms/EntriesPanel';
import { EntryEditor } from '@/components/cms/EntryEditor';
import { ImportDialog } from '@/components/cms/ImportDialog';
import { LocalesPanel } from '@/components/cms/LocalesPanel';
import { MediaPanel } from '@/components/cms/MediaPanel';
import { ModelEditor } from '@/components/cms/ModelEditor';
import { ModelsPanel } from '@/components/cms/ModelsPanel';
import { NewEntryDialog } from '@/components/cms/NewEntryDialog';
import { ContentStorageUsage } from '@/components/cms/StorageUsage';
import { useCmsAccess } from '@/components/cms/useCmsAccess';
import { Languages, Layers, Plus, SlidersHorizontal, UploadCloud } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { Button } from '@/components/ui/button';

import { type ContentTab, contentLocation, contentNavigation } from '@/lib/utils/cms-navigation';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const CONTENT_TABS: SectionTab<ContentTab>[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'entries', label: 'Entries' },
  { value: 'media', label: 'Media' },
  { value: 'configure', label: 'Configure' },
];

/** The API docs and keys moved to Settings → Developers with every other public API; old links still land. */
const MOVED_TABS: Record<string, string> = { docs: '/settings/developers/docs', developers: '/settings/developers' };

export default function ContentPage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={null}>
      <ContentView />
    </Suspense>
  );
}

/**
 * Content is URL-driven like Communications: the tab, the open entry and the
 * open model all live in the query string, so back closes an editor, a link to
 * an entry can be shared, and a refresh keeps you where you were.
 */
function ContentView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const access = useCmsAccess();
  const [creating, setCreating] = useState<{ contentTypeId?: string } | null>(null);
  const [importing, setImporting] = useState(false);
  // Media renders its own header actions (Upload, storage) into this slot.
  const [mediaActions, setMediaActions] = useState<HTMLElement | null>(null);

  const requestedTab = searchParams.get('tab');
  const { tab, section: requestedSection } = contentLocation(requestedTab, searchParams.get('section'));
  const section = requestedSection === 'settings' && !access.canManageKeys ? null : requestedSection;
  const entryParam = searchParams.get('entry');
  const modelParam = searchParams.get('model');
  const movedTo = requestedTab ? MOVED_TABS[requestedTab] : undefined;

  useEffect(() => {
    if (movedTo) {
      router.replace(movedTo);
      return;
    }
    if (requestedTab && ['models', 'locales', 'settings'].includes(requestedTab)) {
      const next = new URLSearchParams(searchParams.toString());
      next.set('tab', 'configure');
      next.set('section', requestedTab);
      router.replace(`${pathname}?${next}`, { scroll: false });
    }
  }, [movedTo, requestedTab, searchParams, pathname, router]);

  const navigate = (patch: Record<string, string | null>, mode: 'push' | 'replace' = 'push') => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(contentNavigation(patch))) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router[mode](query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  if (!tenantId) {
    return (
      <EditorShell eyebrow="Website & apps" title="Content" icon={<Layers size={20} aria-hidden="true" />}>
        <EmptyState
          className="flex-1"
          icon={Layers}
          title="No workspace selected"
          description="Choose a workspace to manage its content."
        />
      </EditorShell>
    );
  }

  const openEntry = (id: string) => navigate({ entry: id, model: null });
  const openModel = (id: string) => navigate({ model: id, entry: null });

  if (entryParam) {
    return (
      <EntryEditor
        key={entryParam}
        entryId={entryParam}
        onClose={() => navigate({ entry: null })}
        onOpenEntry={(id) => navigate({ entry: id }, 'replace')}
        onOpenModel={openModel}
      />
    );
  }

  if (modelParam) {
    return (
      <ModelEditor
        key={modelParam}
        modelId={modelParam === 'new' ? null : modelParam}
        onClose={() => navigate({ model: null })}
        onSaved={(id) => navigate({ model: id }, 'replace')}
        onDeleted={() => navigate({ model: null, tab: 'models' }, 'replace')}
        onBrowseEntries={(id) => navigate({ model: null, tab: 'entries', type: id })}
      />
    );
  }

  const action =
    (tab === 'overview' || tab === 'entries') && access.canWrite
      ? { label: 'New entry', onClick: () => setCreating({}) }
      : tab === 'configure' && section === 'models' && access.canModel
        ? { label: 'New model', onClick: () => navigate({ model: 'new' }) }
        : null;

  const sectionTitle =
    section === 'models' ? 'Models' : section === 'locales' ? 'Locales' : section === 'settings' ? 'Privacy & export' : null;
  const HeaderIcon = section === 'locales' ? Languages : section === 'settings' ? SlidersHorizontal : Layers;

  return (
    <EditorShell
      eyebrow="Website & apps"
      title={sectionTitle ?? 'Content'}
      bodyClassName={tab === 'entries' || tab === 'media' ? 'pb-0 md:pb-0 lg:pb-0' : undefined}
      icon={<HeaderIcon size={20} aria-hidden="true" />}
      onClose={section ? () => navigate({ section: null }) : undefined}
      actions={
        tab === 'media' ? (
          <div ref={setMediaActions} className="flex items-center gap-1.5 md:gap-2" />
        ) : tab === 'overview' || action ? (
          <div className="flex items-center gap-1.5 md:gap-2">
            {tab === 'overview' && <ContentStorageUsage />}
            {tab === 'entries' && access.canWrite && (
              <Button variant="outline" className="h-9 gap-1.5" aria-label="Import entries" onClick={() => setImporting(true)}>
                <UploadCloud size={15} aria-hidden="true" />
                <span className="hidden md:inline">Import</span>
              </Button>
            )}
            {action && (
              <Button className="h-9 gap-1.5" aria-label={action.label} onClick={action.onClick}>
                <Plus size={15} aria-hidden="true" />
                <span className="hidden md:inline">{action.label}</span>
              </Button>
            )}
          </div>
        ) : undefined
      }
      subheader={
        <SectionTabs
          tabs={CONTENT_TABS}
          value={tab}
          onChange={(value) => navigate({ tab: value, section: null, folder: null }, 'replace')}
          ariaLabel="Content sections"
        />
      }
    >
      <div className="flex flex-1 flex-col gap-5">
        {tab === 'overview' && (
          <CmsOverviewPanel
            onOpenEntry={openEntry}
            onOpenTab={(value) => (value === 'developers' ? router.push('/settings/developers') : navigate({ tab: value }, 'replace'))}
            onNewModel={access.canModel ? () => navigate({ model: 'new' }) : undefined}
          />
        )}
        {tab === 'entries' && (
          <EntriesPanel
            typeId={searchParams.get('type') ?? ''}
            onOpenType={(id) => navigate({ type: id || null })}
            onOpenEntry={openEntry}
            onNewEntry={(contentTypeId) => setCreating({ contentTypeId })}
            onOpenModel={openModel}
          />
        )}
        {tab === 'configure' && !section && <ContentConfiguration canManageKeys={access.canManageKeys} />}
        {tab === 'configure' && section === 'models' && (
          <ModelsPanel
            onOpenModel={openModel}
            onNewModel={access.canModel ? () => navigate({ model: 'new' }) : undefined}
            onBrowseEntries={(id) => navigate({ tab: 'entries', type: id }, 'replace')}
          />
        )}
        {/* Storage is a connector (Settings → Connectors → Media storage); Media keeps the usage meter. */}
        {tab === 'media' && (
          <MediaPanel
            headerSlot={mediaActions}
            folder={searchParams.get('folder') || null}
            onOpenFolder={(path) => navigate({ folder: path })}
          />
        )}
        {tab === 'configure' && section === 'locales' && <LocalesPanel />}
        {tab === 'configure' && section === 'settings' && access.canManageKeys && <ContentSettingsPanel />}
      </div>

      {importing && <ImportDialog initialTypeId={searchParams.get('type') || undefined} onClose={() => setImporting(false)} />}
      {creating && (
        <NewEntryDialog
          initialTypeId={creating.contentTypeId}
          onClose={() => setCreating(null)}
          onCreated={(id) => {
            setCreating(null);
            openEntry(id);
          }}
          onNewModel={access.canModel ? () => navigate({ model: 'new' }) : undefined}
        />
      )}
    </EditorShell>
  );
}
