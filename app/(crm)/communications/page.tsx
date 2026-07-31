'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Loader2, Mail, MailX, Plug, Plus, RefreshCw, Send, ShieldOff, Sparkles } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';

import { AutomationEditorPage } from '@/components/communications/AutomationEditorPage';
import { AutomationsPanel } from '@/components/communications/AutomationsPanel';
import { ConnectionPanel } from '@/components/communications/ConnectionPanel';
import { DeliveryPreviewPage, EmailPreviewPage } from '@/components/communications/EmailPreviewPage';
import { HistoryPanel } from '@/components/communications/HistoryPanel';
import { SetupChecklist } from '@/components/communications/SetupChecklist';
import { SuppressionsPanel } from '@/components/communications/SuppressionsPanel';
import { TemplateEditorPage } from '@/components/communications/TemplateEditorPage';
import { TemplatesPanel } from '@/components/communications/TemplatesPanel';
import { AUTOMATION_PRESETS, TEMPLATE_PRESETS, presetPayload } from '@/components/communications/presets';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionTabs, type SectionTab } from '@/components/shared/SectionTabs';
import { Button } from '@/components/ui/button';

import {
  type EmailDelivery,
  getEmailAutomations,
  getEmailConnection,
  getEmailDeliveries,
  getEmailTemplates,
} from '@/lib/api/email.service';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type Tab = 'templates' | 'automations' | 'history' | 'suppressions' | 'connection';

const TAB_VALUES: Tab[] = ['templates', 'automations', 'history', 'suppressions', 'connection'];

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
  const presetParam = searchParams.get('preset');
  const deliveryParam = searchParams.get('delivery');

  // Deliveries are paginated with no single-record endpoint, so the row hands the
  // record over when it opens the preview.
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

  const closeEditors = () => navigate({ template: null, automation: null, preview: null, preset: null, delivery: null });

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

  const emailReady = Boolean(connection?.isEnabled && connection?.lastTestSucceeded);
  const activeTemplates = useMemo(() => templates.filter((template) => template.isActive), [templates]);
  const sendingCount = automations.filter((automation) => automation.isEnabled).length;
  // Failures on the newest page — surfaced on the History tab so they aren't missed.
  const failedCount = (deliveries?.data ?? []).filter((delivery) => delivery.status === 'failed').length;

  const tabs = useMemo<SectionTab<Tab>[]>(
    () => [
      { value: 'templates', label: 'Templates', icon: Mail, count: templates.length, countLabel: `${templates.length} templates` },
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
      { value: 'suppressions', label: 'Suppressions', icon: ShieldOff },
      ...(canConfigure ? [{ value: 'connection' as const, label: 'Email setup', icon: Plug }] : []),
    ],
    [canConfigure, templates.length, sendingCount, failedCount],
  );

  // A delivery link with no record behind it (refresh, shared link) falls back to
  // the list instead of showing an empty preview.
  useEffect(() => {
    if (!deliveryParam || openedDelivery) return;
    const next = new URLSearchParams(searchParams.toString());
    next.delete('delivery');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [deliveryParam, openedDelivery, pathname, router, searchParams]);

  if (!tenantId) {
    return (
      <EditorShell eyebrow="Customer engagement" title="Communications" icon={<Mail size={20} aria-hidden="true" />}>
        <EmptyState icon={MailX} title="No workspace selected" description="Choose a workspace to manage its customer emails." />
      </EditorShell>
    );
  }

  // ── Full-page views (replace the list; the app sidebar and header stay) ─────

  if (deliveryParam && openedDelivery) {
    return (
      <DeliveryPreviewPage
        delivery={openedDelivery}
        onClose={() => {
          setOpenedDelivery(null);
          navigate({ delivery: null });
        }}
      />
    );
  }

  if (previewParam) {
    if (!templatesFetched) return <LoadingShell onClose={closeEditors} />;
    const template = templates.find((item) => item.id === previewParam);
    if (!template) return <MissingShell title="Template not found" onClose={closeEditors} />;
    return (
      <EmailPreviewPage
        eyebrow="Template preview"
        title={template.name}
        subject={template.subject}
        recipient={<span className="font-mono">{'{{brand.name}} · to {{customer.email}}'}</span>}
        htmlBody={template.htmlBody}
        textBody={template.textBody}
        note="Variables are filled in with real customer and order details when the email is sent."
        actions={
          <Button variant="outline" onClick={() => navigate({ preview: null, template: template.id }, 'replace')}>
            Edit template
          </Button>
        }
        onClose={closeEditors}
      />
    );
  }

  if (templateParam) {
    const preset = presetParam ? TEMPLATE_PRESETS.find((item) => item.key === presetParam) : undefined;
    const openConnection = canConfigure ? () => navigate({ tab: 'connection', template: null, preset: null }) : undefined;
    if (templateParam === 'new') {
      return (
        <TemplateEditorPage
          initial={preset ? presetPayload(preset) : undefined}
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
    const preset = presetParam ? AUTOMATION_PRESETS.find((item) => item.key === presetParam) : undefined;
    const shared = {
      onClose: closeEditors,
      onPreviewTemplate: (templateId: string) => navigate({ automation: null, preset: null, preview: templateId }),
      onOpenTemplates: () => navigate({ tab: 'templates', automation: null, preset: null }),
      onOpenConnection: canConfigure ? () => navigate({ tab: 'connection', automation: null, preset: null }) : undefined,
    };
    if (automationParam === 'new') {
      return (
        <AutomationEditorPage
          initial={preset?.initial}
          suggestedTemplateName={preset?.suggestedTemplate}
          {...shared}
          onSaved={(saved) => navigate({ automation: saved.id, preset: null }, 'replace')}
        />
      );
    }
    if (!automationsFetched) return <LoadingShell onClose={closeEditors} />;
    const automation = automations.find((item) => item.id === automationParam);
    if (!automation) return <MissingShell title="Automation not found" onClose={closeEditors} />;
    return <AutomationEditorPage automation={automation} {...shared} />;
  }

  // ── List view ──────────────────────────────────────────────────────────────

  return (
    <EditorShell
      eyebrow="Customer engagement"
      title="Communications"
      icon={<Mail size={20} aria-hidden="true" />}
      meta={
        canConfigure ? (
          <button
            type="button"
            onClick={() => navigate({ tab: 'connection' }, 'replace')}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
              emailReady
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-warning/40 bg-warning/10 text-warning hover:bg-warning/20'
            }`}
          >
            {emailReady ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            {emailReady ? 'Email connected' : 'Email not set up'}
          </button>
        ) : undefined
      }
      // One primary action, always in the same place — whatever the open tab is for.
      actions={
        tab === 'templates' ? (
          <Button className="h-10 gap-1.5" onClick={() => navigate({ template: 'new' })}>
            <Plus size={15} />
            <span className="hidden md:inline">New template</span>
          </Button>
        ) : tab === 'automations' ? (
          <Button
            className="h-10 gap-1.5"
            disabled={activeTemplates.length === 0}
            title={activeTemplates.length === 0 ? 'Create a ready-to-use template first' : undefined}
            onClick={() => navigate({ automation: 'new' })}
          >
            <Plus size={15} />
            <span className="hidden md:inline">New automation</span>
          </Button>
        ) : tab === 'history' ? (
          <Button
            variant="outline"
            className="h-10 gap-1.5"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['email-deliveries'] })}
          >
            <RefreshCw size={15} />
            <span className="hidden md:inline">Refresh</span>
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
        {tab !== 'connection' && (
          <SetupChecklist
            emailConnected={emailReady}
            hasTemplate={templates.some((template) => template.isActive)}
            hasEnabledAutomation={automations.some((automation) => automation.isEnabled)}
            hasDeliveries={Boolean(deliveries?.total)}
            canConfigure={canConfigure}
            onOpenConnection={() => navigate({ tab: 'connection' }, 'replace')}
            onNewTemplate={() => navigate({ tab: 'templates', template: 'new' })}
            onNewAutomation={() => navigate({ tab: 'automations' }, 'replace')}
            onOpenHistory={() => navigate({ tab: 'history' }, 'replace')}
          />
        )}

        {tab === 'templates' && (
          <TemplatesPanel
            onEdit={({ template, presetKey }) => navigate({ template: template?.id ?? 'new', preset: presetKey ?? null })}
            onPreview={(template) => navigate({ preview: template.id })}
          />
        )}
        {tab === 'automations' && (
          <AutomationsPanel
            onEdit={({ automation, presetKey }) => navigate({ automation: automation?.id ?? 'new', preset: presetKey ?? null })}
            onOpenTemplates={() => navigate({ tab: 'templates' }, 'replace')}
          />
        )}
        {tab === 'history' && (
          <HistoryPanel
            onPreview={(delivery) => {
              setOpenedDelivery(delivery);
              navigate({ delivery: delivery.id });
            }}
          />
        )}
        {tab === 'suppressions' && <SuppressionsPanel />}
        {tab === 'connection' && canConfigure && <ConnectionPanel />}
      </div>
    </EditorShell>
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
      <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">It may have been deleted or archived, or the link is out of date.</p>
        <Button variant="outline" className="mt-4" onClick={onClose}>
          Back to Communications
        </Button>
      </div>
    </EditorShell>
  );
}
