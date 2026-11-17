'use client';

import { useQuery } from '@tanstack/react-query';

import { CalendarClock, FileText, RefreshCw, TriangleAlert, Wallet } from '@/components/icons';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

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
 * finalisation and content publishing. A titled list under the workflows,
 * read only; each row opens the feature that owns the schedule. Nothing
 * renders for a role that can see neither.
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
    <RecordGroup
      id="automation-scheduled"
      title="Scheduled jobs"
      footnote={canPayroll && payroll.data?.payrollAutoFinalise ? 'Payslips still need issuing after a run is finalised.' : undefined}
    >
      <ListRowGroup aria-label="Scheduled jobs">
        {canPayroll &&
          (payroll.isPending ? (
            <RowLoading />
          ) : payroll.isError ? (
            <LoadFailed what="the payroll schedule" onRetry={() => void payroll.refetch()} />
          ) : (
            <ListRow
              href="/staff/payroll"
              icon={Wallet}
              tone={payroll.data.payrollAutoFinalise ? 'success' : 'muted'}
              title="Payroll auto-finalisation"
              meta={
                payroll.data.payrollAutoFinalise
                  ? `${PERIOD_LABEL[payroll.data.payrollPeriod].name} · ${payDayInWords(payroll.data)}`
                  : 'Runs are finalised by hand'
              }
              trailing={
                <Badge variant={payroll.data.payrollAutoFinalise ? 'success' : 'muted'}>
                  {payroll.data.payrollAutoFinalise ? 'On' : 'Off'}
                </Badge>
              }
            />
          ))}
        {canContent &&
          (content.isPending ? (
            <RowLoading />
          ) : content.isError ? (
            <LoadFailed what="scheduled content" onRetry={() => void content.refetch()} />
          ) : !content.data.data.length ? (
            <ListRow
              href="/content"
              icon={FileText}
              tone="muted"
              title="Content publishing"
              meta="Nothing scheduled to publish or unpublish"
            />
          ) : (
            <>
              {content.data.data.slice(0, ENTRY_LIMIT).map((entry) => (
                <ListRow
                  key={entry.id}
                  href={`/content?entry=${encodeURIComponent(entry.id)}`}
                  icon={CalendarClock}
                  tone="info"
                  title={entry.title || entry.slug || 'Untitled entry'}
                  meta={[
                    entry.scheduledPublishAt && `Publishes ${fmtDateTime(entry.scheduledPublishAt)}`,
                    entry.scheduledUnpublishAt && `Unpublishes ${fmtDateTime(entry.scheduledUnpublishAt)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                />
              ))}
              {content.data.total > ENTRY_LIMIT && (
                <ListRow
                  href="/content"
                  icon={FileText}
                  tone="muted"
                  title={`All ${content.data.total} scheduled entries`}
                  meta="Open Content"
                />
              )}
            </>
          ))}
      </ListRowGroup>
    </RecordGroup>
  );
}

function RowLoading() {
  return (
    <li className="flex items-center gap-3 px-3.5 py-3" aria-busy="true">
      <Bone className="size-9 rounded-md" />
      <span className="flex-1 space-y-1.5">
        <Bone className="h-3.5 w-1/3" />
        <Bone className="h-3 w-1/2" />
      </span>
    </li>
  );
}

/** A row-sized error with a retry, so one failed query doesn't take the list down. */
function LoadFailed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <ListRow
      icon={TriangleAlert}
      tone="exception"
      title={`Couldn’t load ${what}`}
      control={
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
          <RefreshCw aria-hidden="true" /> Try again
        </Button>
      }
    />
  );
}
