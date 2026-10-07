'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

import { CmsOverviewPanel } from '@/components/cms/CmsOverviewPanel';
import { DevelopersPanel } from '@/components/cms/DevelopersPanel';
import { DocsPanel } from '@/components/cms/DocsPanel';
import { EntriesPanel } from '@/components/cms/EntriesPanel';
import { EntryEditor } from '@/components/cms/EntryEditor';
import { ImportDialog } from '@/components/cms/ImportDialog';
import { LocalesPanel } from '@/components/cms/LocalesPanel';
import { MediaPanel } from '@/components/cms/MediaPanel';
import { ModelEditor } from '@/components/cms/ModelEditor';
import { ModelsPanel } from '@/components/cms/ModelsPanel';
import { NewEntryDialog } from '@/components/cms/NewEntryDialog';
import { useCmsAccess } from '@/components/cms/useCmsAccess';
import { Activity, BookOpen, Code, FileText, ImageIcon, Languages, Layers, Plus, UploadCloud } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { Button } from '@/components/ui/button';

import { useWorkspaceStore } from '@/stores/workspaceStore';

type Tab = 'overview' | 'entries' | 'models' | 'media' | 'locales' | 'docs' | 'developers';
const TAB_VALUES: Tab[] = ['overview', 'entries', 'models', 'media', 'locales', 'docs', 'developers'];

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
  const tab: Tab = TAB_VALUES.includes(requestedTab as Tab) ? (requestedTab as Tab) : 'overview';
  const entryParam = searchParams.get('entry');
  const modelParam = searchParams.get('model');

  const navigate = (patch: Record<string, string | null>, mode: 'push' | 'replace' = 'push') => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router[mode](query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const tabs = useMemo<SectionTab<Tab>[]>(
    () => [
      { value: 'overview', label: 'Overview', icon: Activity },
      { value: 'entries', label: 'Entries', icon: FileText },
      { value: 'models', label: 'Models', icon: Layers },
      { value: 'media', label: 'Media', icon: ImageIcon },
      { value: 'locales', label: 'Locales', icon: Languages },
      // Documentation holds no secrets, so everyone who can see content can
      // read it — including the developer who builds the website.
      { value: 'docs', label: 'API docs', icon: BookOpen },
      // Keys and webhooks are credentials; people who cannot manage them get
      // no tab rather than a tab of 403s.
      ...(access.canManageKeys ? [{ value: 'developers' as const, label: 'API & webhooks', icon: Code }] : []),
    ],
    [access.canManageKeys],
  );

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
      : tab === 'models' && access.canModel
        ? { label: 'New model', onClick: () => navigate({ model: 'new' }) }
        : null;

  return (
    <EditorShell
      eyebrow="Website & apps"
      title="Content"
      icon={<Layers size={20} aria-hidden="true" />}
      actions={
        tab === 'media' ? (
          <div ref={setMediaActions} className="flex items-center gap-1.5 md:gap-2" />
        ) : action ? (
          <div className="flex items-center gap-1.5 md:gap-2">
            {tab === 'entries' && access.canWrite && (
              <Button variant="outline" className="h-9 gap-1.5" aria-label="Import entries" onClick={() => setImporting(true)}>
                <UploadCloud size={15} aria-hidden="true" />
                <span className="hidden md:inline">Import</span>
              </Button>
            )}
            <Button className="h-9 gap-1.5" onClick={action.onClick}>
              <Plus size={15} aria-hidden="true" />
              <span className="hidden md:inline">{action.label}</span>
            </Button>
          </div>
        ) : undefined
      }
      subheader={
        <SectionTabs tabs={tabs} value={tab} onChange={(value) => navigate({ tab: value }, 'replace')} ariaLabel="Content sections" />
      }
    >
      <div className="flex flex-1 flex-col gap-5">
        {tab === 'overview' && (
          <CmsOverviewPanel
            onOpenEntry={openEntry}
            onOpenTab={(value) => navigate({ tab: value }, 'replace')}
            onNewModel={access.canModel ? () => navigate({ model: 'new' }) : undefined}
          />
        )}
        {tab === 'entries' && (
          <EntriesPanel
            initialTypeId={searchParams.get('type') ?? ''}
            onTypeChange={(id) => navigate({ type: id || null }, 'replace')}
            onOpenEntry={openEntry}
            onNewEntry={(contentTypeId) => setCreating({ contentTypeId })}
          />
        )}
        {tab === 'models' && (
          <ModelsPanel
            onOpenModel={openModel}
            onNewModel={access.canModel ? () => navigate({ model: 'new' }) : undefined}
            onBrowseEntries={(id) => navigate({ tab: 'entries', type: id }, 'replace')}
          />
        )}
        {/* Storage is a connector (Settings → Connectors → Media storage); Media keeps the usage meter. */}
        {tab === 'media' && <MediaPanel headerSlot={mediaActions} />}
        {tab === 'locales' && <LocalesPanel />}
        {tab === 'docs' && <DocsPanel onOpenKeys={() => navigate({ tab: 'developers' }, 'replace')} />}
        {tab === 'developers' && access.canManageKeys && <DevelopersPanel onOpenDocs={() => navigate({ tab: 'docs' }, 'replace')} />}
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
