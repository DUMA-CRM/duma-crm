'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useMemo, useState } from 'react';

import { AutomationEditorPage } from '@/components/communications/AutomationEditorPage';
import { AutomationsPanel } from '@/components/communications/AutomationsPanel';
import { DeliveryPreviewDrawer, EmailPreviewDrawer } from '@/components/communications/EmailPreviewDrawer';
import { HistoryPanel } from '@/components/communications/HistoryPanel';
import { SetupChecklist } from '@/components/communications/SetupChecklist';
import { SuppressionsPanel } from '@/components/communications/SuppressionsPanel';
import { TemplateEditorPage } from '@/components/communications/TemplateEditorPage';
import { TemplatesPanel } from '@/components/communications/TemplatesPanel';
import { CheckCircle2, Loader2, Mail, MailX, Plug, Plus, RefreshCw, Send, ShieldOff, Sparkles, TriangleAlert } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { Button } from '@/components/ui/button';

import {
  type EmailDelivery,
  getEmailAutomations,
  getEmailConnection,
  getEmailDeliveries,
  getEmailTemplates,
  getMarketingSuppressions,
} from '@/lib/api/email.service';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type Tab = 'templates' | 'automations' | 'history' | 'suppressions';

const TAB_VALUES: Tab[] = ['templates', 'automations', 'history', 'suppressions'];

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
  const queryClient = useQueryClient();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const role = useAuthStore((state) => state.role);
  const canConfigure = role === 'super_admin' || role === 'franchise_owner';

  const requestedTab = searchParams.get('tab');
  const tab: Tab = TAB_VALUES.includes(requestedTab as Tab) ? (requestedTab as Tab) : 'templates';
  const templateParam = searchParams.get('template');
  const automationParam = searchParams.get('automation');
  const previewParam = searchParams.get('preview');

  // Deliveries are paginated with no single-record endpoint, so the row hands the
  // record over. Nothing to put in the URL — a shared link could not resolve it.
  const [openedDelivery, setOpenedDelivery] = useState<EmailDelivery | null>(null);

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
  // Shares its cache key with SuppressionsPanel — fetched here only for the tab count.
  const { data: suppressions = [] } = useQuery({
    queryKey: ['marketing-suppressions', tenantId],
    queryFn: () => getMarketingSuppressions(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const emailReady = Boolean(connection?.isEnabled && connection?.lastTestSucceeded);
  const activeTemplates = useMemo(() => templates.filter((template) => template.isActive), [templates]);
  const sendingCount = automations.filter((automation) => automation.isEnabled).length;
  // Failures on the newest page — surfaced on the History tab so they aren't missed.
  const failedCount = (deliveries?.data ?? []).filter((delivery) => delivery.status === 'failed').length;

  const tabs = useMemo<SectionTab<Tab>[]>(
    () => [
      {
        value: 'templates',
        label: 'Templates',
        icon: Mail,
        count: activeTemplates.length,
        countLabel: `${activeTemplates.length} templates`,
      },
      {
        value: 'automations',
        label: 'Automations',
        icon: Sparkles,
        count: sendingCount,
        countLabel: `${sendingCount} sending`,
      },
      {
        value: 'history',
        label: 'History',
        icon: Send,
        count: failedCount,
        countTone: 'danger',
        countLabel: `${failedCount} recent ${failedCount === 1 ? 'failure' : 'failures'}`,
      },
      {
        value: 'suppressions',
        label: 'Suppressions',
        icon: ShieldOff,
        count: suppressions.length,
        countLabel: `${suppressions.length} suppressed ${suppressions.length === 1 ? 'address' : 'addresses'}`,
      },
    ],
    [activeTemplates.length, sendingCount, failedCount, suppressions.length],
  );

  if (!tenantId) {
    return (
      <EditorShell eyebrow="Customer engagement" title="Communications" icon={<Mail size={20} aria-hidden="true" />}>
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
    tab === 'templates'
      ? { icon: Plus, label: 'New template', onClick: () => navigate({ template: 'new' }) }
      : tab === 'automations'
        ? {
            icon: Plus,
            label: 'New automation',
            onClick: () => navigate({ automation: 'new' }),
            disabled: activeTemplates.length === 0,
            title: activeTemplates.length === 0 ? 'Create a ready-to-use template first' : undefined,
          }
        : tab === 'history'
          ? {
              icon: RefreshCw,
              label: 'Refresh',
              variant: 'outline' as const,
              onClick: () => queryClient.invalidateQueries({ queryKey: ['email-deliveries'] }),
            }
          : canConfigure
            ? { icon: Plug, label: 'Email setup', variant: 'outline' as const, onClick: () => router.push(EMAIL_CONNECTOR) }
            : null;
  const ActionIcon = action?.icon;

  // Previewing a template keeps `?preview=` so the link is shareable; a bad id
  // simply opens nothing rather than taking over the page.
  const previewTemplate = previewParam ? templates.find((item) => item.id === previewParam) : undefined;

  return (
    <EditorShell
      eyebrow="Customer engagement"
      title="Communications"
      icon={<Mail size={20} aria-hidden="true" />}
      actions={
        action && ActionIcon ? (
          <Button
            className="h-9 gap-1.5"
            variant={action.variant}
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
        <SetupChecklist
          emailConnected={emailReady}
          hasTemplate={templates.some((template) => template.isActive)}
          hasEnabledAutomation={automations.some((automation) => automation.isEnabled)}
          hasDeliveries={Boolean(deliveries?.total)}
          canConfigure={canConfigure}
          onOpenConnection={() => router.push(EMAIL_CONNECTOR)}
          onNewTemplate={() => navigate({ tab: 'templates', template: 'new' })}
          onNewAutomation={() => navigate({ tab: 'automations' }, 'replace')}
          onOpenHistory={() => navigate({ tab: 'history' }, 'replace')}
        />

        {tab === 'templates' && (
          <TemplatesPanel
            onEdit={({ template }) => navigate({ template: template?.id ?? 'new', preset: null })}
            onPreview={(template) => navigate({ preview: template.id })}
          />
        )}
        {tab === 'automations' && (
          <AutomationsPanel
            onEdit={({ automation }) => navigate({ automation: automation?.id ?? 'new', preset: null })}
            onOpenTemplates={() => navigate({ tab: 'templates' }, 'replace')}
          />
        )}
        {tab === 'history' && <HistoryPanel onPreview={setOpenedDelivery} />}
        {tab === 'suppressions' && <SuppressionsPanel />}
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
 * Whether email can actually leave the building — the one fact that decides if
 * anything on this page has an effect, so it sits under the title on every tab.
 */
function ConnectionStatus({ ready, onOpenConnection }: { ready: boolean; onOpenConnection?: () => void }) {
  const Icon = ready ? CheckCircle2 : TriangleAlert;
  const body = (
    <>
      <Icon size={12} aria-hidden="true" />
      {ready ? 'Email connected' : 'Email not verified'}
    </>
  );
  const className = `inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 text-xs font-semibold ${
    ready ? 'bg-success/6 text-success' : 'bg-warning/6 text-warning'
  }`;

  // Only owners and admins can act on it, so only they get a button.
  if (!onOpenConnection) return <span className={className}>{body}</span>;
  return (
    <button
      type="button"
      onClick={onOpenConnection}
      className={`${className} transition-opacity hover:opacity-80`}
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
