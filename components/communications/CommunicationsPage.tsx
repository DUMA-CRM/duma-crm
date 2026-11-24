'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

import { AutomationEditorView, AutomationsTab, automationView, useEmailAutomations } from '@/components/automation/AutomationWorkspace';
import { DeliveryPreviewDrawer, EmailPreviewDrawer } from '@/components/communications/EmailPreviewDrawer';
import { HistoryPanel } from '@/components/communications/HistoryPanel';
import { OverviewPanel } from '@/components/communications/OverviewPanel';
import { SuppressionsPanel } from '@/components/communications/SuppressionsPanel';
import { TemplateEditorPage } from '@/components/communications/TemplateEditorPage';
import { TemplatesPanel } from '@/components/communications/TemplatesPanel';
import { useEmailAccess } from '@/components/communications/useEmailAccess';
import { Activity, CheckCircle2, FileText, MailX, Plus, Send, ShieldOff, TriangleAlert, Zap } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { useWorkspaceModules } from '@/lib/hooks/useWorkspaceContext';
import {
  type EmailDelivery,
  getEmailConnection,
  getEmailDeliveries,
  getEmailTemplates,
  getMarketingSuppressions,
} from '@/lib/modules/communications/client';
import type { ModuleId } from '@/lib/modules/manifest';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { type ConnectionState, connectionState } from '@/lib/utils/communications';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type Tab = 'overview' | 'templates' | 'automations' | 'history' | 'suppressions';

/** Automations belong to the automation module; every other tab to communications. */
const TAB_MODULE: Record<Tab, ModuleId> = {
  overview: 'communications',
  templates: 'communications',
  automations: 'automation',
  history: 'communications',
  suppressions: 'communications',
};

/** The mail account itself is a connector, so setting it up happens in Settings. */
const EMAIL_CONNECTOR = '/settings/connectors?connector=email';

export default function CommunicationsPage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={null}>
      <CommunicationsView />
    </Suspense>
  );
}

/**
 * Communications is URL-driven: the tab and whichever full-page editor is open both
 * live in the query string, so the browser back button closes an editor, links are
 * shareable, and a refresh keeps you where you were.
 */
function CommunicationsView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const access = useEmailAccess();
  const canConfigure = access.canConfigure;

  // Until the workspace's modules are known, assume on: the layout has already
  // sent a member whose workspace has neither module away.
  const modules = useWorkspaceModules();
  const moduleOn = (id: ModuleId) => !modules || modules.some((state) => state.moduleId === id && state.status === 'enabled');
  const communicationsOn = moduleOn('communications');
  const automationOn = moduleOn('automation');
  const tabOn = (value: Tab) => (TAB_MODULE[value] === 'automation' ? automationOn : communicationsOn);

  const requestedTab = searchParams.get('tab') as Tab | null;
  const tab: Tab =
    requestedTab && Object.hasOwn(TAB_MODULE, requestedTab) && tabOn(requestedTab)
      ? requestedTab
      : communicationsOn
        ? 'overview'
        : 'automations';
  const view = automationView(searchParams.get('view'));
  const templateParam = communicationsOn ? searchParams.get('template') : null;
  const automationParam = automationOn ? searchParams.get('automation') : null;
  const previewParam = searchParams.get('preview');

  // Deliveries are paginated with no single-record endpoint, so the row hands the
  // record over. Nothing to put in the URL — a shared link could not resolve it.
  const [openedDelivery, setOpenedDelivery] = useState<EmailDelivery | null>(null);
  // Owned here so the masthead button can open the panel's dialog.
  const [addingSuppression, setAddingSuppression] = useState(false);

  const navigate = (patch: Record<string, string | null>, mode: 'push' | 'replace' = 'push') => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    const query = next.toString();
    router[mode](query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const closeEditors = () => navigate({ template: null, automation: null, preview: null, preset: null });
  const switchTab = (value: string) => navigate({ tab: value, status: null, view: null }, 'replace');
  const openAutomation = (id: string) => navigate({ tab: 'automations', automation: id });
  const openTemplates = () => navigate({ tab: 'templates', automation: null, view: null });

  const { data: templates = [], isFetched: templatesFetched } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-templates', tenantId),
    queryFn: () => getEmailTemplates(tenantId ?? undefined),
    enabled: !!tenantId && communicationsOn,
  });
  // Gated on its own capability: marketing and store managers run email but
  // can't read the SMTP settings, and a 403 must not read as "not set up".
  const { data: connection } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-connection', tenantId),
    queryFn: () => getEmailConnection(tenantId ?? undefined),
    enabled: !!tenantId && communicationsOn && access.canReadConnection,
    retry: false,
    meta: { silentForbidden: true },
  });
  const { data: deliveries } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-deliveries', tenantId, 1),
    queryFn: () => getEmailDeliveries(tenantId ?? undefined, 1),
    enabled: !!tenantId && communicationsOn,
    // Keeps the failure count on the History tab current while you work elsewhere.
    // (The history table shares this key and polls faster while it is open.)
    refetchInterval: 60_000,
  });
  // The Suppressions panel's own query (same key), read here only so the header
  // can step aside while the empty state offers "Add email" itself.
  const { data: suppressions } = useQuery({
    queryKey: moduleQueryKeys.communications.key('marketing-suppressions', tenantId),
    queryFn: () => getMarketingSuppressions(tenantId ?? undefined),
    enabled: Boolean(tenantId) && tab === 'suppressions',
  });
  // The automations list's own query (same key), read so the header can step
  // aside while its empty state offers "New workflow".
  const automations = useEmailAutomations(tenantId, tab === 'automations');
  const connectionStatus = connectionState(connection, access.canReadConnection);
  // Failures on the newest page — surfaced on the History tab so they aren't missed.
  const failedCount = (deliveries?.data ?? []).filter((delivery) => delivery.status === 'failed').length;

  const tabs = useMemo<SectionTab<Tab>[]>(() => {
    const all: SectionTab<Tab>[] = [
      { value: 'overview', label: 'Overview', icon: Activity },
      { value: 'templates', label: 'Templates', icon: FileText },
      // Zap is the trigger glyph inside the workflow editor, so an automation
      // wears the same mark in the tab as it does on its own canvas.
      { value: 'automations', label: 'Automations', icon: Zap },
      // Only failures are counted: a tab badge is for something waiting on
      // someone, and the live/template totals are already the Overview's tiles.
      {
        value: 'history',
        label: 'History',
        icon: Send,
        count: failedCount,
        countTone: 'danger',
        countLabel: `${failedCount} recent ${failedCount === 1 ? 'failure' : 'failures'}`,
      },
      { value: 'suppressions', label: 'Suppressions', icon: ShieldOff },
    ];
    return all.filter((entry) => (TAB_MODULE[entry.value] === 'automation' ? automationOn : communicationsOn));
  }, [failedCount, automationOn, communicationsOn]);

  if (!tenantId) {
    return (
      <EditorShell eyebrow="Customer engagement" title="Communications" icon={<Send size={20} aria-hidden="true" />}>
        <EmptyState icon={MailX} title="No workspace selected" description="Choose a workspace to manage its customer emails." />
      </EditorShell>
    );
  }

  // ── Full-page editors (replace the list; the app sidebar and header stay) ───

  if (templateParam) {
    const openConnection = canConfigure ? () => router.push(EMAIL_CONNECTOR) : undefined;
    if (templateParam === 'new') {
      return (
        <TemplateEditorPage
          onClose={closeEditors}
          onSaved={(saved) => navigate({ template: saved.id, preset: null }, 'replace')}
          onOpenConnection={openConnection}
        />
      );
    }
    if (!templatesFetched) return <LoadingShell label="Loading the template" onClose={closeEditors} />;
    const template = templates.find((item) => item.id === templateParam);
    if (!template) return <MissingShell title="Template not found" icon={FileText} onClose={closeEditors} />;
    return <TemplateEditorPage template={template} onClose={closeEditors} onOpenConnection={openConnection} />;
  }

  if (automationParam) {
    return (
      <AutomationEditorView
        // A workspace switch discards the old workspace's editor state.
        key={`${tenantId}:${automationParam}`}
        tenantId={tenantId}
        automationId={automationParam}
        onClose={closeEditors}
        onSaved={(saved) => navigate({ automation: saved.id }, 'replace')}
        onOpenTemplates={openTemplates}
      />
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────

  // One primary action, always in the same place — whatever the open tab is for.
  // An empty list offers it in its empty state instead, so it isn't there twice.
  const noTemplates = templatesFetched && !templates.some((template) => template.isActive);
  const noSuppressions = suppressions !== undefined && suppressions.length === 0;
  const noAutomations = automations.isSuccess && automations.data.length === 0;
  const action =
    tab === 'templates' && access.canWrite && !noTemplates
      ? { icon: Plus, label: 'New template', onClick: () => navigate({ template: 'new' }) }
      : tab === 'automations' && view === 'workflows' && access.canWrite && !noAutomations
        ? { icon: Plus, label: 'New workflow', onClick: () => openAutomation('new') }
        : tab === 'suppressions' && access.canSuppress && !noSuppressions
          ? { icon: Plus, label: 'Add email', onClick: () => setAddingSuppression(true) }
          : null;
  const ActionIcon = action?.icon;
  const actionControl =
    action && ActionIcon ? (
      <Button className="h-9 gap-1.5" aria-label={action.label} onClick={action.onClick}>
        <ActionIcon size={15} aria-hidden="true" />
        <span className="hidden md:inline">{action.label}</span>
      </Button>
    ) : null;
  const connectionBadge = (
    <ConnectionStatus state={connectionStatus} onOpenConnection={canConfigure ? () => router.push(EMAIL_CONNECTOR) : undefined} />
  );

  // Previewing a template keeps `?preview=` so the link is shareable; a bad id
  // simply opens nothing rather than taking over the page.
  const previewTemplate = previewParam ? templates.find((item) => item.id === previewParam) : undefined;

  return (
    <EditorShell
      eyebrow="Customer engagement"
      title="Communications"
      icon={<Send size={20} aria-hidden="true" />}
      meta={connectionBadge}
      actions={actionControl ?? undefined}
      subheader={
        <>
          {/* The masthead's meta is hidden below md, so the connection rides beside the section picker there. */}
          <div className="flex items-center gap-3 border-b border-border bg-field px-3 py-2 md:hidden">
            <Select
              value={tab}
              onValueChange={switchTab}
              options={tabs.map(({ value, label }) => ({ value, label }))}
              ariaLabel="Communications section"
              className="min-w-0 flex-1"
            />
            {connectionBadge}
          </div>
          <div className="hidden md:block">
            <SectionTabs tabs={tabs} value={tab} onChange={switchTab} ariaLabel="Communications sections" />
          </div>
        </>
      }
    >
      {/* A flex column, so a tab's empty state can fill the page and centre. */}
      <div className="flex flex-1 flex-col">
        {tab === 'overview' && (
          <OverviewPanel
            onOpenAutomations={() => switchTab('automations')}
            onOpenAutomation={openAutomation}
            onOpenFailures={() => navigate({ tab: 'history', status: 'failed' }, 'replace')}
            onOpenHistory={() => navigate({ tab: 'history', status: null }, 'replace')}
            onOpenTemplates={() => navigate({ tab: 'templates' }, 'replace')}
            onPreviewDelivery={setOpenedDelivery}
          />
        )}
        {tab === 'templates' && (
          <TemplatesPanel
            onEdit={({ template }) => navigate({ template: template?.id ?? 'new', preset: null })}
            onPreview={(template) => navigate({ preview: template.id })}
          />
        )}
        {tab === 'automations' && (
          <AutomationsTab
            tenantId={tenantId}
            view={view}
            onViewChange={(value) => navigate({ view: value === 'runs' ? 'runs' : null }, 'replace')}
            onOpenAutomation={openAutomation}
            onOpenTemplates={openTemplates}
          />
        )}
        {tab === 'history' && (
          <HistoryPanel
            // Keyed so a link into failures (?status=failed) starts on that filter.
            key={searchParams.get('status') ?? 'all'}
            initialStatus={searchParams.get('status') === 'failed' ? 'failed' : 'all'}
            onPreview={setOpenedDelivery}
          />
        )}
        {tab === 'suppressions' && <SuppressionsPanel adding={addingSuppression} onAddingChange={setAddingSuppression} />}
      </div>

      {previewTemplate && (
        <EmailPreviewDrawer
          description="Template preview"
          title={previewTemplate.name}
          subject={previewTemplate.subject}
          recipient={<span className="font-mono text-primary">{'{{brand.name}} · to {{customer.email}}'}</span>}
          htmlBody={previewTemplate.htmlBody}
          textBody={previewTemplate.textBody}
          note="Variables are filled in with real customer and order details when the email is sent."
          actions={
            access.canWrite ? (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => navigate({ preview: null, template: previewTemplate.id }, 'replace')}
              >
                Edit template
              </Button>
            ) : undefined
          }
          onClose={() => navigate({ preview: null })}
        />
      )}

      {openedDelivery && <DeliveryPreviewDrawer delivery={openedDelivery} onClose={() => setOpenedDelivery(null)} />}
    </EditorShell>
  );
}

/**
 * Whether email can actually leave the building — the one fact that decides
 * whether anything on this page has an effect. It rides in the masthead rather
 * than as a banner on the body: it is true of the whole feature, not of the tab
 * you happen to have open, and a full-width banner repeating it on every tab was
 * the loudest thing on a page whose job is the work underneath.
 */
function ConnectionStatus({ state, onOpenConnection }: { state: ConnectionState; onOpenConnection?: () => void }) {
  // Unreadable (no email.connections:read) is not the same as missing — say nothing.
  if (state === 'unknown') return null;
  const ready = state === 'ready';
  const Icon = ready ? CheckCircle2 : TriangleAlert;
  const label = ready ? 'Email connected' : state === 'unverified' ? 'Email not verified' : 'Email not set up';
  const className = cn(
    'inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-xs font-semibold',
    ready ? 'border-momentum/40 bg-momentum/6 text-momentum' : 'border-warning/40 bg-warning/6 text-warning',
  );
  const body = (
    <>
      <Icon size={12} aria-hidden="true" />
      {label}
    </>
  );

  // Only people who can change the connector get a button.
  if (!onOpenConnection) return <span className={className}>{body}</span>;
  return (
    <button
      type="button"
      onClick={onOpenConnection}
      className={cn(className, 'transition-opacity hover:opacity-80')}
      title={ready ? 'Review the email connection' : 'Set up email sending'}
    >
      {body}
    </button>
  );
}

function LoadingShell({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <EditorShell title="Loading…" onClose={onClose}>
      <LoadingState label={label} className="flex-1" />
    </EditorShell>
  );
}

function MissingShell({ title, icon, onClose }: { title: string; icon: IconComponent; onClose: () => void }) {
  return (
    <EditorShell title={title} onClose={onClose}>
      <EmptyState
        icon={icon}
        title={title}
        description="It may have been deleted, or the link is out of date."
        kind="gone"
        action={{ label: 'Back to Communications', onClick: onClose }}
        compact
      />
    </EditorShell>
  );
}
