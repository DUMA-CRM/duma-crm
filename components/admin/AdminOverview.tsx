'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';

import { InfoRow, InfoRows, RowTile } from '@/components/cms/rows';
import {
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Database,
  HeartHandshake,
  type IconComponent,
  LayoutDashboard,
  MapPin,
  Pause,
  Sparkles,
  Users,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone, ListSkeleton } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { type PlatformMetric, getPlatformOverview, getPlatformWorkspaces } from '@/lib/api/platform.service';
import { useWorkspaceSwitch } from '@/lib/hooks/useWorkspaceSwitch';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import {
  formatBytes,
  formatCount,
  freshness,
  metricNote,
  metricText,
  workspaceFacts,
  workspaceStatusLabel,
} from '@/lib/utils/platform-metrics';

/**
 * DUMA Admin's home, laid out like the other settings-style pages: what needs
 * attention and the newest client workspaces in the main column; the figures
 * alongside, each a row that says what it counts and when it was measured.
 * Trends appear only where history has actually been collected
 * (System → Database), never as a drawn guess.
 */
export function AdminOverview() {
  const reduceMotion = useReducedMotion();
  const overview = useQuery({
    queryKey: moduleQueryKeys.identity.key('platform-overview'),
    queryFn: getPlatformOverview,
    refetchInterval: 120_000,
  });
  const directory = useQuery({ queryKey: moduleQueryKeys.identity.key('platform-workspaces'), queryFn: getPlatformWorkspaces });
  const switchTo = useWorkspaceSwitch();

  const recent = [...(directory.data?.workspaces ?? [])]
    .filter((row) => row.classification === 'customer')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  const body = () => {
    if (overview.isPending) return <Bone className="h-96 w-full rounded-lg" />;
    if (overview.isError) return <ErrorState title="Platform figures couldn’t be loaded" onRetry={() => void overview.refetch()} />;
    const data = overview.data;
    const summary = data.workspaces.status === 'ok' ? data.workspaces.value : null;
    const excluded = summary ? summary.excluded.internal + summary.excluded.demo : 0;

    return (
      <SettingsTabBody
        narrowAside
        aside={
          <>
            <SettingsSection
              title="Clients"
              footnote={
                summary &&
                excluded > 0 &&
                `Excludes ${summary.excluded.internal} internal and ${summary.excluded.demo} demo ${excluded === 1 ? 'workspace' : 'workspaces'}.`
              }
            >
              <InfoRows>
                {data.workspaces.status === 'ok' ? (
                  <MetricRow
                    icon={Building2}
                    title="Client workspaces"
                    metric={{ ...data.workspaces, value: data.workspaces.value.customers }}
                  />
                ) : (
                  <MetricRow icon={Building2} title="Client workspaces" metric={data.workspaces} />
                )}
                {summary && (
                  <>
                    <FactRow icon={CheckCircle2} title="Active" value={summary.byStatus.active} />
                    <FactRow icon={Pause} title="Winding down" value={summary.byStatus.winding_down} />
                    <FactRow icon={Ban} title="Inactive" value={summary.byStatus.inactive} />
                    <FactRow icon={Sparkles} title="Trialling" value={summary.byBilling.trialing} />
                    <FactRow icon={CreditCard} title="Paying" value={summary.byBilling.active} />
                  </>
                )}
              </InfoRows>
              {summary && (summary.onboarding.inProgress > 0 || summary.onboarding.notReadyToGoLive > 0) && (
                <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
                  Onboarding: {summary.onboarding.inProgress} in progress, {summary.onboarding.notReadyToGoLive} with required setup left,{' '}
                  {summary.onboarding.withBlockers} blocked.
                </p>
              )}
            </SettingsSection>

            <SettingsSection title="Across the platform">
              <InfoRows>
                <MetricRow icon={MapPin} title="Active locations" metric={data.locations} />
                <MetricRow icon={Users} title="Active staff" metric={data.staff} />
                <MetricRow icon={HeartHandshake} title="Their customers" metric={data.customerProfiles} />
                <MetricRow icon={Database} title="Database size" metric={data.database} format={formatBytes} unitLabel="whole database" />
              </InfoRows>
            </SettingsSection>
          </>
        }
      >
        <SettingsSection
          title="Needs attention"
          actions={
            data.attention.length === 0 ? (
              <Badge variant="success">All clear</Badge>
            ) : (
              <Badge variant="warning">{data.attention.length} to look at</Badge>
            )
          }
        >
          {data.attention.length === 0 ? (
            <InfoRow
              icon={CheckCircle2}
              tone="success"
              title="Nothing needs attention"
              description="No failed sign-ups, blocked setups or stalled workers."
            >
              {null}
            </InfoRow>
          ) : (
            <div className="-mx-2 flex flex-col gap-0.5">
              {data.attention.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <RowTile icon={AlertTriangle} tone="warning" />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{item.label}</span>
                  <Badge variant="warning" className="tabular-nums">
                    {formatCount(item.count)}
                  </Badge>
                  <Chevron />
                </Link>
              ))}
            </div>
          )}
        </SettingsSection>

        <SettingsSection
          title="Newest client workspaces"
          actions={
            <Button variant="outline" className="h-9" asChild>
              <Link href="/admin/workspaces">All workspaces</Link>
            </Button>
          }
          footnote={
            directory.data &&
            recent.length > 0 &&
            `Opening one switches this tab into that workspace. Measured ${freshness(directory.data.collectedAt)}.`
          }
        >
          {directory.isPending ? (
            <ListSkeleton rows={4} label="Loading workspaces" />
          ) : directory.isError ? (
            <ErrorState title="Workspaces couldn’t be loaded" onRetry={() => void directory.refetch()} />
          ) : recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No client workspaces yet. They appear here as businesses sign up, newest first.
            </p>
          ) : (
            <div className="-mx-2 flex flex-col gap-0.5">
              {recent.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => void switchTo({ kind: 'workspace', tenantId: row.id, locationId: null })}
                  className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <RowTile icon={Building2} tone={row.blockedTasks > 0 ? 'warning' : 'default'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      <span className="sr-only">Open </span>
                      {row.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">{workspaceFacts(row)}</span>
                  </span>
                  {row.blockedTasks > 0 && <Badge variant="warning">Setup blocked</Badge>}
                  <Badge variant={row.status === 'active' ? 'success' : row.status === 'winding_down' ? 'warning' : 'muted'}>
                    {workspaceStatusLabel(row.status)}
                  </Badge>
                  <Chevron />
                </button>
              ))}
            </div>
          )}
        </SettingsSection>
      </SettingsTabBody>
    );
  };

  return (
    <EditorShell eyebrow="DUMA Admin" title="Overview" icon={<LayoutDashboard size={18} aria-hidden="true" />}>
      <motion.div
        className="w-full"
        initial={reduceMotion ? false : 'hidden'}
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
      >
        {body()}
      </motion.div>
    </EditorShell>
  );
}

/**
 * One platform figure as a row: the number on the right, what it counts and
 * when it was measured underneath the title, its definition behind the number.
 * An unavailable source says so (and why), never 0.
 */
function MetricRow({
  icon,
  title,
  metric,
  format,
  unitLabel,
}: {
  icon: IconComponent;
  title: string;
  metric: PlatformMetric<number>;
  format?: (value: number) => string;
  unitLabel?: string;
}) {
  const text = metricText(metric, format);
  const label = metric.status === 'ok' ? metric.definition : `${metric.reason}. ${metric.definition}`;
  return (
    <InfoRow icon={icon} title={title} description={metricNote(metric, unitLabel)}>
      <Tooltip label={label} side="top" align="end" wrap>
        <span
          tabIndex={0}
          aria-label={`${title}: ${text ?? 'unavailable'}. ${label}`}
          className={cn(
            'cursor-help text-sm tabular-nums',
            text === null ? 'font-normal text-muted-foreground/70' : 'font-semibold text-foreground',
          )}
        >
          {text ?? 'Unavailable'}
        </span>
      </Tooltip>
    </InfoRow>
  );
}

/** A plain count from the client summary. */
function FactRow({ icon, title, value }: { icon: IconComponent; title: string; value: number }) {
  return (
    <InfoRow icon={icon} title={title}>
      <span className="text-sm font-semibold tabular-nums text-foreground">{formatCount(value)}</span>
    </InfoRow>
  );
}

function Chevron() {
  return (
    <ChevronRight size={14} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
  );
}
