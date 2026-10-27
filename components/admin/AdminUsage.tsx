'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';

import { InfoRow, InfoRows } from '@/components/cms/rows';
import { Activity, Building2, Gauge, type IconComponent, Users } from '@/components/icons';
import { FOUNDATION_MODULES, moduleCopy } from '@/components/onboarding/modules';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';

import { type ActiveUsage, type PlatformMetric, getPlatformUsage } from '@/lib/api/platform.service';
import type { ModuleId } from '@/lib/modules/manifest';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { adoptionNote, freshness, metricText, share } from '@/lib/utils/platform-metrics';

const WINDOWS = [
  { key: 'd1', label: 'past day' },
  { key: 'd7', label: 'past 7 days' },
  { key: 'd30', label: 'past 30 days' },
] as const;

/**
 * Who uses DUMA, honestly. Active use comes from product analytics, counted
 * only from meaningful events in client workspaces by their own staff — never
 * page views, sign-ins, polling or our own support visits. When analytics is
 * not connected the figures say so instead of showing zero.
 *
 * Laid out like the other settings-style pages: module adoption in the main
 * column, active use as a rail of figures alongside.
 */
export function AdminUsage() {
  const reduceMotion = useReducedMotion();
  const usage = useQuery({ queryKey: moduleQueryKeys.identity.key('platform-usage'), queryFn: getPlatformUsage });

  const body = () => {
    if (usage.isPending) return <Bone className="h-96 w-full rounded-lg" />;
    if (usage.isError) return <ErrorState title="Usage couldn’t be loaded" onRetry={() => void usage.refetch()} />;
    const { active, adoption, activeCustomers } = usage.data;
    const modules =
      adoption.status === 'ok'
        ? [...adoption.value].filter((row) => !FOUNDATION_MODULES.has(row.moduleId as ModuleId)).sort((a, b) => b.enabled - a.enabled)
        : [];

    return (
      <SettingsTabBody
        narrowAside
        aside={
          <SettingsSection
            title="Active use"
            actions={active.status !== 'ok' && <Badge variant="muted">Unavailable</Badge>}
            footnote={
              <>
                {active.definition}
                {active.status === 'ok' &&
                  (active.value.earliestEventAt
                    ? ` Counting since events began carrying workspace context, ${freshness(active.value.earliestEventAt)}; longer windows are incomplete until then.`
                    : ' No events carry workspace context yet, so nothing can be counted.')}
                {active.status === 'ok' && ` Your own visits as a DUMA administrator never count. Measured ${freshness(active.collectedAt)}.`}
              </>
            }
          >
            {active.status === 'ok' ? (
              <div className="space-y-5">
                <ActiveRows icon={Users} noun="Staff" metric={active} of="staff" />
                <ActiveRows icon={Building2} noun="Workspaces" metric={active} of="workspaces" />
              </div>
            ) : (
              <>
                <InfoRow icon={Activity} title="Active staff and workspaces">
                  <span className="text-sm text-muted-foreground/70">Unavailable</span>
                </InfoRow>
                <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">{active.reason}</p>
              </>
            )}
          </SettingsSection>
        }
      >
        <SettingsSection
          title="Module adoption"
          description={`Active client workspaces with each module switched on, out of ${activeCustomers}.`}
          footnote="Enabled is not used. Real use per module needs domain events, which are being added."
        >
          {adoption.status !== 'ok' ? (
            <ErrorState title="Adoption couldn’t be measured" description={adoption.reason} onRetry={() => void usage.refetch()} />
          ) : modules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No modules to count yet. They appear here once they’re deployed.</p>
          ) : (
            <InfoRows>
              {modules.map((row) => {
                const copy = moduleCopy(row.moduleId);
                const percent = share(row.enabled, activeCustomers);
                return (
                  <InfoRow key={row.moduleId} icon={copy.icon} title={copy.name} description={adoptionNote(row.enabled, activeCustomers)}>
                    {percent !== null && (
                      <>
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-band sm:w-32" aria-hidden="true">
                          <span className="block h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                        </span>
                        <span className="w-10 text-right text-sm font-semibold tabular-nums text-foreground">{percent}%</span>
                      </>
                    )}
                  </InfoRow>
                );
              })}
            </InfoRows>
          )}
        </SettingsSection>
      </SettingsTabBody>
    );
  };

  return (
    <EditorShell eyebrow="DUMA Admin" title="Usage" icon={<Gauge size={18} aria-hidden="true" />}>
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

/** Staff (or workspaces) active over each window, one row a window. */
function ActiveRows({
  icon,
  noun,
  metric,
  of,
}: {
  icon: IconComponent;
  noun: string;
  metric: Extract<PlatformMetric<ActiveUsage>, { status: 'ok' }>;
  of: 'staff' | 'workspaces';
}) {
  return (
    <InfoRows>
      {WINDOWS.map((window) => (
        <InfoRow key={window.key} icon={icon} title={`${noun} · ${window.label}`}>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {metricText({ ...metric, value: metric.value[of][window.key] })}
          </span>
        </InfoRow>
      ))}
    </InfoRows>
  );
}
