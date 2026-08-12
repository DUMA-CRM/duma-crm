'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

import { AutomationEditorPage } from '@/components/communications/AutomationEditorPage';
import { AutomationsPanel } from '@/components/communications/AutomationsPanel';
import { DeliveryPreviewDrawer, EmailPreviewDrawer } from '@/components/communications/EmailPreviewDrawer';
import { HistoryPanel } from '@/components/communications/HistoryPanel';
import { OverviewPanel } from '@/components/communications/OverviewPanel';
import { SuppressionsPanel } from '@/components/communications/SuppressionsPanel';
import { TemplateEditorPage } from '@/components/communications/TemplateEditorPage';
import { TemplatesPanel } from '@/components/communications/TemplatesPanel';
import { Activity, CheckCircle2, FileText, Loader2, MailX, Plus, Send, ShieldOff, TriangleAlert, Zap } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';

import {
  type EmailDelivery,
  getEmailAutomations,
  getEmailConnection,
  getEmailDeliveries,
  getEmailTemplates,
} from '@/lib/api/email.service';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Four tabs that were never peers.
 *
 * History was *evidence about* automations, suppressions were *settings*, and
 * templates are *components of* automations — a flat list of four things that
 * have a hierarchy is why everything felt scattered. Overview is now the front
 * door (is this working?), automations are the centre of gravity, templates are
 * the parts they are built from, and the compliance plumbing sits in settings
 * where it is looked at twice a year rather than every visit.
 */
type Tab = 'overview' | 'automations' | 'templates' | 'history' | 'suppressions';

const TAB_VALUES: Tab[] = ['overview', 'automations', 'templates', 'history', 'suppressions'];

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
  const role = useAuthStore((state) => state.role);
  const canConfigure = role === 'super_admin' || role === 'franchise_owner';

  const requestedTab = searchParams.get('tab');
  const tab: Tab = TAB_VALUES.includes(requestedTab as Tab) ? (requestedTab as Tab) : 'overview';
  const templateParam = searchParams.get('template');
  const automationParam = searchParams.get('automation');
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

  const { data: templates = [], isFetched: templatesFetched } = useQuery({
    queryKey: ['email-templates', tenantId],
    queryFn: () => getEmailTemplates(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: automations = [], isFetched: automationsFetched } = useQuery({
    queryKey: ['email-automations', tenantId],
    queryFn: () => getEmailAutomations(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: connection } = useQuery({
    queryKey: ['email-connection', tenantId],
    queryFn: () => getEmailConnection(tenantId ?? undefined),
    enabled: !!tenantId,
    retry: false,
  });
  const { data: deliveries } = useQuery({
    queryKey: ['email-deliveries', tenantId, 1],
    queryFn: () => getEmailDeliveries(tenantId ?? undefined, 1),
    enabled: !!tenantId,
    // Keeps the failure count on the History tab current while you work elsewhere.
    // (The history table shares this key and polls faster while it is open.)
    refetchInterval: 60_000,
  });
  const emailReady = Boolean(connection?.isEnabled && connection.lastTestSucceeded);
  const activeTemplates = useMemo(() => templates.filter((template) => template.isActive), [templates]);
  const sendingCount = automations.filter((automation) => automation.isEnabled).length;
  // Failures on the newest page — surfaced on the History tab so they aren't missed.
  const failedCount = (deliveries?.data ?? []).filter((delivery) => delivery.status === 'failed').length;

  const tabs = useMemo<SectionTab<Tab>[]>(
    () => [
      { value: 'overview', label: 'Overview', icon: Activity },
      // Zap is the trigger glyph inside the workflow editor, so an automation
      // wears the same mark in the nav as it does on its own canvas.
      {
        value: 'automations',
        label: 'Automations',
        icon: Zap,
        count: sendingCount,
        countLabel: `${sendingCount} sending`,
      },
      {
        value: 'templates',
        label: 'Templates',
        icon: FileText,
        count: activeTemplates.length,
        countLabel: `${activeTemplates.length} templates`,
      },
      {
        value: 'history',
        label: 'History',
        icon: Send,
        count: failedCount,
        countTone: 'danger',
        countLabel: `${failedCount} recent ${failedCount === 1 ? 'failure' : 'failures'}`,
      },
      { value: 'suppressions', label: 'Suppressions', icon: ShieldOff },
    ],
    [activeTemplates.length, sendingCount, failedCount],
  );

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
    if (!templatesFetched) return <LoadingShell onClose={closeEditors} />;
    const template = templates.find((item) => item.id === templateParam);
    if (!template) return <MissingShell title="Template not found" onClose={closeEditors} />;
    return <TemplateEditorPage template={template} onClose={closeEditors} onOpenConnection={openConnection} />;
  }

  if (automationParam) {
    const shared = {
      onClose: closeEditors,
      onOpenTemplates: () => navigate({ tab: 'templates', automation: null, preset: null }),
      onOpenConnection: canConfigure ? () => router.push(EMAIL_CONNECTOR) : undefined,
    };
    if (automationParam === 'new') {
      return <AutomationEditorPage {...shared} onSaved={(saved) => navigate({ automation: saved.id, preset: null }, 'replace')} />;
    }
    if (!automationsFetched) return <LoadingShell onClose={closeEditors} />;
    const automation = automations.find((item) => item.id === automationParam);
    if (!automation) return <MissingShell title="Automation not found" onClose={closeEditors} />;
    return <AutomationEditorPage automation={automation} {...shared} />;
  }

  // ── List view ──────────────────────────────────────────────────────────────

  // One primary action, always in the same place — whatever the open tab is for.
  const action =
    tab === 'automations'
      ? {
          icon: Plus,
          label: 'New automation',
          onClick: () => navigate({ automation: 'new' }),
          disabled: activeTemplates.length === 0,
          title: activeTemplates.length === 0 ? 'Create a ready-to-use template first' : undefined,
        }
      : tab === 'templates'
        ? { icon: Plus, label: 'New template', onClick: () => navigate({ template: 'new' }) }
        : tab === 'suppressions'
          ? { icon: Plus, label: 'Add email', onClick: () => setAddingSuppression(true) }
          : null;
  const ActionIcon = action?.icon;

  // Previewing a template keeps `?preview=` so the link is shareable; a bad id
  // simply opens nothing rather than taking over the page.
  const previewTemplate = previewParam ? templates.find((item) => item.id === previewParam) : undefined;

  return (
    <EditorShell
      eyebrow="Customer engagement"
      title="Communications"
      icon={<Send size={20} aria-hidden="true" />}
      meta={
        <ConnectionStatus
          ready={emailReady}
          configured={Boolean(connection)}
          onOpenConnection={canConfigure ? () => router.push(EMAIL_CONNECTOR) : undefined}
        />
      }
      actions={
        action && ActionIcon ? (
          <Button
            className="h-9 gap-1.5"
            disabled={action.disabled}
            title={action.title}
            onClick={action.onClick}
          >
            <ActionIcon size={15} aria-hidden="true" />
            <span className="hidden md:inline">{action.label}</span>
          </Button>
        ) : undefined
      }
      subheader={
        <SectionTabs
          tabs={tabs}
          value={tab}
          onChange={(value) => navigate({ tab: value }, 'replace')}
          ariaLabel="Communications sections"
        />
      }
    >
      <div className="space-y-5">
        {tab === 'overview' && (
          <OverviewPanel
            onOpenAutomations={() => navigate({ tab: 'automations' }, 'replace')}
            onOpenTemplates={() => navigate({ tab: 'templates' }, 'replace')}
            onOpenFailures={() => navigate({ tab: 'history' }, 'replace')}
          />
        )}
        {tab === 'automations' && (
          <AutomationsPanel
            onEdit={({ automation }) => navigate({ automation: automation?.id ?? 'new', preset: null })}
            onOpenTemplates={() => navigate({ tab: 'templates' }, 'replace')}
          />
        )}
        {tab === 'templates' && (
          <TemplatesPanel
            onEdit={({ template }) => navigate({ template: template?.id ?? 'new', preset: null })}
            onPreview={(template) => navigate({ preview: template.id })}
          />
        )}
        {tab === 'history' && <HistoryPanel onPreview={setOpenedDelivery} />}
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
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate({ preview: null, template: previewTemplate.id }, 'replace')}
            >
              Edit template
            </Button>
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
function ConnectionStatus({
  ready,
  configured,
  onOpenConnection,
}: {
  ready: boolean;
  configured: boolean;
  onOpenConnection?: () => void;
}) {
  const Icon = ready ? CheckCircle2 : TriangleAlert;
  const label = ready ? 'Email connected' : configured ? 'Email not verified' : 'Email not set up';
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

  // Only owners and admins can act on it, so only they get a button.
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

function LoadingShell({ onClose }: { onClose: () => void }) {
  return (
    <EditorShell title="Loading…" onClose={onClose}>
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 size={22} className="animate-spin" />
      </div>
    </EditorShell>
  );
}

function MissingShell({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <EditorShell title={title} onClose={onClose}>
      <div className="mx-auto max-w-md rounded-sm border border-rule bg-card shadow-sm p-6 text-center">
        <p className="text-sm text-muted-foreground">It may have been deleted, or the link is out of date.</p>
        <Button variant="outline" className="mt-4" onClick={onClose}>
          Back to Communications
        </Button>
      </div>
    </EditorShell>
  );
}
