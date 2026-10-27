'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { FieldRow, InfoRow, InfoRows } from '@/components/cms/rows';
import {
  AlertTriangle,
  Clock3,
  Database,
  ExternalLink,
  FileText,
  type IconComponent,
  ListChecks,
  Loader2,
  Mail,
  MailX,
  RefreshCw,
  Server,
  ShieldCheck,
  Table,
  UserPlus,
  Zap,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { StatCard, StatCardGrid } from '@/components/shared/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  type PlatformAdmin,
  collectPlatformDatabase,
  getPlatformAdmins,
  getPlatformDatabase,
  getPlatformHealth,
  grantPlatformAdmin,
  revokePlatformAdmin,
} from '@/lib/api/platform.service';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import {
  type HealthTone,
  cacheStatus,
  formatBytes,
  formatCount,
  freshness,
  tableFacts,
  workerStatus,
} from '@/lib/utils/platform-metrics';
import { useAuthStore } from '@/stores/authStore';

const QUEUES: Record<string, { label: string; icon: IconComponent; alarm: boolean }> = {
  deliveriesExhausted: { label: 'Emails that gave up', icon: MailX, alarm: true },
  deliveriesQueued: { label: 'Emails waiting to send', icon: Mail, alarm: false },
  workflowStepsFailed: { label: 'Workflow steps failed', icon: ListChecks, alarm: true },
  workflowStepsStalled: { label: 'Workflow steps stalled', icon: ListChecks, alarm: true },
};

const BADGE: Record<HealthTone, 'success' | 'warning' | 'destructive' | 'muted'> = {
  success: 'success',
  warning: 'warning',
  danger: 'destructive',
  muted: 'muted',
};

/** Whether the API, its database, cache and workers are answering — checked every 30 seconds. */
function HealthSection() {
  const health = useQuery({
    queryKey: moduleQueryKeys.identity.key('platform-health'),
    queryFn: getPlatformHealth,
    refetchInterval: 30_000,
  });
  const data = health.data;
  const cache = data ? cacheStatus(data.cache.status) : null;
  const overall: { label: string; tone: HealthTone } | null = !data
    ? null
    : data.database.status !== 'ok' || !data.workers.healthy
      ? { label: 'Needs attention', tone: 'danger' }
      : cache?.tone === 'warning'
        ? { label: 'Degraded', tone: 'warning' }
        : { label: 'Healthy', tone: 'success' };

  return (
    <>
      <SettingsSection
        title="Health"
        actions={overall && <Badge variant={BADGE[overall.tone]}>{overall.label}</Badge>}
        footnote={
          data && (
            <>
              Checked {freshness(data.collectedAt)}. Request and error rates are exported for monitoring at{' '}
              <code>{data.monitoring.metricsPath}</code>.
              {data.monitoring.dashboardUrl && (
                <>
                  {' '}
                  <a
                    href={data.monitoring.dashboardUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 font-semibold text-foreground underline underline-offset-2"
                  >
                    Open monitoring <ExternalLink size={12} aria-hidden="true" />
                  </a>
                </>
              )}
            </>
          )
        }
      >
        {health.isPending ? (
          <ListSkeleton rows={3} label="Checking health" />
        ) : health.isError ? (
          <ErrorState
            title="Health couldn’t be checked"
            description="The API may be down — which is itself the answer."
            onRetry={() => void health.refetch()}
          />
        ) : (
          <InfoRows>
            <StatusRow
              icon={Database}
              title="Database"
              note={health.data.database.status === 'ok' ? `Answering in ${health.data.database.latencyMs} ms` : 'Not answering'}
              status={health.data.database.status === 'ok' ? { label: 'Healthy', tone: 'success' } : { label: 'Down', tone: 'danger' }}
            />
            <StatusRow icon={Zap} title="Cache" note={`Reports “${health.data.cache.status}”`} status={cache!} />
            {health.data.workers.workers.length === 0 ? (
              <InfoRow icon={Clock3} title="Background workers" description="None run in this API process.">
                <Badge variant="muted">None</Badge>
              </InfoRow>
            ) : (
              health.data.workers.workers.map((worker) => {
                const state = workerStatus(worker);
                return <StatusRow key={worker.name} icon={Clock3} title={worker.name} note={state.note} status={state} />;
              })
            )}
          </InfoRows>
        )}
      </SettingsSection>

      {data && (
        <SettingsSection title="Queues">
          <InfoRows>
            {Object.entries(data.queues).map(([key, value]) => {
              const queue = QUEUES[key] ?? { label: key, icon: ListChecks, alarm: false };
              const alarming = queue.alarm && value > 0;
              return (
                <InfoRow key={key} icon={queue.icon} title={queue.label} tone={alarming ? 'danger' : undefined}>
                  <span className={alarming ? 'text-sm font-semibold tabular-nums text-exception' : 'text-sm font-semibold tabular-nums text-foreground'}>
                    {formatCount(value)}
                  </span>
                </InfoRow>
              );
            })}
          </InfoRows>
        </SettingsSection>
      )}
    </>
  );
}

function StatusRow({
  icon,
  title,
  note,
  status,
}: {
  icon: IconComponent;
  title: string;
  note: string;
  status: { label: string; tone: HealthTone };
}) {
  return (
    <InfoRow icon={icon} title={title} description={note} tone={status.tone === 'warning' || status.tone === 'danger' ? status.tone : undefined}>
      <Badge variant={BADGE[status.tone]}>{status.label}</Badge>
    </InfoRow>
  );
}

/** How big the database is and where the space goes, from PostgreSQL’s own statistics. */
function DatabaseSection() {
  const qc = useQueryClient();
  const database = useQuery({ queryKey: moduleQueryKeys.identity.key('platform-database'), queryFn: getPlatformDatabase });
  const collect = useMutation({
    mutationFn: collectPlatformDatabase,
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('platform-database') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('platform-overview') });
      if (!result.collected) toast('success', 'Measured less than a minute ago — showing that measurement.');
    },
    onError: (error) => toast('error', error.message),
  });
  const snapshot = database.data?.snapshot;
  const history = database.data?.history ?? [];

  return (
    <SettingsSection
      title="Database"
      actions={
        <Button variant="outline" className="h-9" onClick={() => collect.mutate()} disabled={collect.isPending}>
          {collect.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={14} aria-hidden="true" />}
          Measure now
        </Button>
      }
      footnote={
        snapshot &&
        database.data!.notes.length > 0 && (
          <span className="block space-y-1">
            {database.data!.notes.map((note) => (
              <span key={note} className="block">
                {note}
              </span>
            ))}
          </span>
        )
      }
    >
      {database.isPending ? (
        <ListSkeleton rows={6} label="Loading database measurement" />
      ) : database.isError ? (
        <ErrorState title="The database measurement couldn’t be loaded" onRetry={() => void database.refetch()} />
      ) : !snapshot ? (
        <p className="text-sm text-muted-foreground">
          Not measured yet. Measure now to read PostgreSQL’s own size and statistics — it doesn’t count rows.
        </p>
      ) : (
        <>
          {/* The three headline figures, one row from small screens up. */}
          <StatCardGrid columns={3} className="grid-cols-1 sm:grid-cols-3">
            <StatCard
              size="sm"
              icon={Database}
              accent="primary"
              label="Database size"
              value={formatBytes(snapshot.databaseBytes)}
              caption={`Measured ${freshness(snapshot.collectedAt)}`}
            />
            <StatCard
              size="sm"
              icon={FileText}
              accent="success"
              label="Business records"
              value={formatCount(snapshot.totals.business.estimatedRows, true)}
              caption="Rows · estimate"
            />
            <StatCard
              size="sm"
              icon={ListChecks}
              accent="neutral"
              label="Logs and queues"
              value={formatCount(snapshot.totals.operational.estimatedRows, true)}
              caption="Logs, sessions and queues · rows · estimate"
            />
          </StatCardGrid>
          {database.data.stale && (
            <Warning>This measurement is over an hour old. Measure now for today’s figures.</Warning>
          )}
          {history.length > 1 && (
            <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
              {history.length} measurements since {freshness(history[0]?.collectedAt)}: from {formatBytes(history[0]!.databaseBytes)} to{' '}
              {formatBytes(history.at(-1)!.databaseBytes)}.
            </p>
          )}

          <h3 className="mt-6 mb-3 text-sm font-semibold text-foreground">Largest tables</h3>
          <InfoRows>
            {snapshot.tables.slice(0, 15).map((table) => (
              <InfoRow key={table.table} icon={Table} title={table.table} description={tableFacts(table)}>
                {table.kind === 'operational' && <Badge variant="muted">Log</Badge>}
                <span className="text-sm font-semibold tabular-nums text-foreground">{formatBytes(table.totalBytes)}</span>
              </InfoRow>
            ))}
          </InfoRows>
        </>
      )}
    </SettingsSection>
  );
}

/** Who holds platform access, granting it to an existing account, and revoking it. */
function AdministratorsSection() {
  const qc = useQueryClient();
  const me = useAuthStore((state) => state.user?.id);
  const admins = useQuery({ queryKey: moduleQueryKeys.identity.key('platform-admins'), queryFn: getPlatformAdmins });
  const [email, setEmail] = useState('');
  const [revoking, setRevoking] = useState<PlatformAdmin | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('platform-admins') });
  const grant = useMutation({
    mutationFn: () => grantPlatformAdmin(email.trim()),
    onSuccess: (result) => {
      refresh();
      setEmail('');
      toast('success', result.granted ? 'Platform access granted.' : 'They already have platform access.');
    },
    onError: (error) => toast('error', error.message),
  });
  const revoke = useMutation({
    mutationFn: (admin: PlatformAdmin) => revokePlatformAdmin(admin.id, 'Revoked from DUMA Admin'),
    onSuccess: () => {
      refresh();
      setRevoking(null);
      toast('success', 'Platform access revoked. The record is kept.');
    },
    onError: (error) => toast('error', error.message),
  });
  const active = admins.data?.admins.filter((admin) => admin.status === 'active') ?? [];

  return (
    <SettingsSection
      title="Platform administrators"
      description="Platform access belongs to a person’s account, not to any workspace. Workspace roles — even an owner’s — never grant it."
    >
      {admins.isPending ? (
        <ListSkeleton rows={2} label="Loading administrators" />
      ) : admins.isError ? (
        <ErrorState title="Administrators couldn’t be loaded" onRetry={() => void admins.refetch()} />
      ) : admins.data.admins.length === 0 ? (
        <p className="text-sm text-muted-foreground">No one holds platform access. Grant it to an existing account below.</p>
      ) : (
        <InfoRows>
          {admins.data.admins.map((admin) => (
            <InfoRow
              key={admin.id}
              icon={ShieldCheck}
              tone={admin.status === 'active' ? 'success' : undefined}
              title={admin.name}
              description={admin.email}
            >
              <Badge variant={admin.status === 'active' ? 'success' : 'muted'}>{admin.status === 'active' ? 'Active' : 'Revoked'}</Badge>
              {admin.status === 'active' && admin.userId !== me && active.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setRevoking(admin)}>
                  Revoke
                </Button>
              )}
            </InfoRow>
          ))}
        </InfoRows>
      )}

      <div className="mt-5">
        <FieldRow icon={UserPlus} title="Grant to an existing account" htmlFor="grant-platform-admin">
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              grant.mutate();
            }}
          >
            <div className="min-w-56 flex-1">
              <Input
                id="grant-platform-admin"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@duma.example"
              />
            </div>
            <Button type="submit" className="h-9" disabled={!email.includes('@') || grant.isPending}>
              {grant.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Grant access
            </Button>
          </form>
        </FieldRow>
      </div>

      {revoking && (
        <ConfirmModal
          title={`Revoke ${revoking.name}’s platform access?`}
          message="They keep any workspace membership they have. The grant and its revocation stay on record."
          confirmLabel="Revoke access"
          isPending={revoke.isPending}
          onConfirm={() => revoke.mutate(revoking)}
          onClose={() => setRevoking(null)}
        />
      )}
    </SettingsSection>
  );
}

/**
 * DUMA Admin → System, laid out like the other settings-style pages: the
 * database and who administers the platform in the main column; live health
 * and queues alongside. Each section loads, fails and retries on its own.
 */
export function AdminSystem() {
  const reduceMotion = useReducedMotion();
  return (
    <EditorShell eyebrow="DUMA Admin" title="System" icon={<Server size={18} aria-hidden="true" />}>
      <motion.div
        className="w-full"
        initial={reduceMotion ? false : 'hidden'}
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
      >
        <SettingsTabBody narrowAside aside={<HealthSection />}>
          <DatabaseSection />
          <AdministratorsSection />
        </SettingsTabBody>
      </motion.div>
    </EditorShell>
  );
}

/** Something that makes a figure unreliable, with what to do about it. */
function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured">
      <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
