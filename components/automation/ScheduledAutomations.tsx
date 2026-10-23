'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

import { RowTile } from '@/components/cms/rows';
import { CalendarClock, ChevronRight, FileText, type IconComponent, Wallet } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';

import { hasCapability } from '@/lib/auth/capabilities';
import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled';
import { getCmsEntries } from '@/lib/modules/cms/client';
import { getPayrollSchedule } from '@/lib/modules/payroll/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { fmtDateTime } from '@/lib/utils/format';
import { PERIOD_LABEL, payDayInWords } from '@/lib/utils/payroll-periods';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/** Shown entries before the list hands over to Content. */
const ENTRY_LIMIT = 4;

/**
 * The jobs that run on a timer outside workflows: payroll's automatic
 * finalisation and content publishing. A rail card on the Workflows tab, read
 * only. Each row opens the feature that owns the schedule. Nothing renders for
 * a role that can see neither.
 */
export function ScheduledAutomations() {
  const capabilities = useAuthStore((state) => state.capabilities);
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const payrollEnabled = useModuleEnabled('payroll');
  const cmsEnabled = useModuleEnabled('cms');
  const canPayroll = payrollEnabled && hasCapability(capabilities, 'hr.payroll:read');
  const canContent = cmsEnabled && hasCapability(capabilities, 'cms:read');
  const payroll = useQuery({
    queryKey: moduleQueryKeys.payroll.key('schedule', tenantId),
    queryFn: getPayrollSchedule,
    enabled: !!tenantId && canPayroll,
  });
  const content = useQuery({
    queryKey: moduleQueryKeys.cms.key('scheduled-entries', tenantId),
    queryFn: () => getCmsEntries({ status: 'scheduled' }, tenantId ?? undefined),
    enabled: !!tenantId && canContent,
  });
  if (!canPayroll && !canContent) return null;

  return (
    <SettingsSection title="Scheduled jobs">
      <div className="-mx-2 flex flex-col gap-0.5">
        {canPayroll &&
          (payroll.isPending ? (
            <Bone className="mx-2 h-11 rounded-md" />
          ) : payroll.isError ? (
            <LoadFailed what="the payroll schedule" onRetry={() => void payroll.refetch()} />
          ) : (
            <JobRow
              href="/staff/payroll"
              icon={Wallet}
              title="Payroll auto-finalisation"
              subtitle={
                payroll.data.payrollAutoFinalise
                  ? `${PERIOD_LABEL[payroll.data.payrollPeriod].name} · ${payDayInWords(payroll.data)}`
                  : 'Runs are finalised by hand'
              }
              badge={
                <Badge variant={payroll.data.payrollAutoFinalise ? 'success' : 'muted'}>
                  {payroll.data.payrollAutoFinalise ? 'On' : 'Off'}
                </Badge>
              }
            />
          ))}
        {canContent &&
          (content.isPending ? (
            <Bone className="mx-2 h-11 rounded-md" />
          ) : content.isError ? (
            <LoadFailed what="scheduled content" onRetry={() => void content.refetch()} />
          ) : !content.data.data.length ? (
            <JobRow href="/content" icon={FileText} title="Content publishing" subtitle="Nothing scheduled to publish or unpublish" />
          ) : (
            <>
              {content.data.data.slice(0, ENTRY_LIMIT).map((entry) => (
                <JobRow
                  key={entry.id}
                  href={`/content?entry=${encodeURIComponent(entry.id)}`}
                  icon={CalendarClock}
                  title={entry.title || entry.slug || 'Untitled entry'}
                  subtitle={[
                    entry.scheduledPublishAt && `Publishes ${fmtDateTime(entry.scheduledPublishAt)}`,
                    entry.scheduledUnpublishAt && `Unpublishes ${fmtDateTime(entry.scheduledUnpublishAt)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              ))}
              {content.data.total > ENTRY_LIMIT && (
                <JobRow href="/content" icon={FileText} title={`All ${content.data.total} scheduled entries`} subtitle="Open Content" />
              )}
            </>
          ))}
      </div>
      {canPayroll && payroll.data?.payrollAutoFinalise && (
        <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
          Payslips still need issuing after a run is finalised.
        </p>
      )}
    </SettingsSection>
  );
}

/** One scheduled thing: the whole row opens where its schedule is changed. */
function JobRow({
  href,
  icon,
  title,
  subtitle,
  badge,
}: {
  href: string;
  icon: IconComponent;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <RowTile icon={icon} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>
      </span>
      {badge}
      <ChevronRight
        size={14}
        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

/** A row-sized error with a retry, so one failed query doesn't take the card down. */
function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <p className="flex items-center justify-between gap-3 px-2 py-1.5 text-xs text-muted-foreground">
      <span>Couldn’t load {what}.</span>
      <button type="button" onClick={onRetry} className="shrink-0 font-semibold text-foreground underline underline-offset-2">
        Try again
      </button>
    </p>
  );
}
