'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { SettingsSection } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/settings/controls';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';

import { type PositionWithStaff, getPositions, setPositionStaff } from '@/lib/api/rota.service';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';

export const positionsKey = moduleQueryKeys.workforce.key('rota-positions');

/**
 * The positions this person is trained for, on their record. A switch per
 * position for `scheduling:write`; a plain list otherwise. The API replaces a
 * position's whole staff list, so a toggle sends that list with this person
 * added or taken out.
 */
export function StaffPositions({ userId, canEdit }: { userId: string; canEdit: boolean }) {
  const qc = useQueryClient();
  const query = useQuery({ queryKey: positionsKey, queryFn: () => getPositions() });
  const toggle = useMutation({
    mutationFn: ({ position, on }: { position: PositionWithStaff; on: boolean }) =>
      setPositionStaff(position.id, on ? [...new Set([...position.staffIds, userId])] : position.staffIds.filter((id) => id !== userId)),
    onError: (error) => toast('error', (error as Error).message || 'That position wasn’t updated. Try again.'),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: positionsKey });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key('rota-planner') });
    },
  });

  // Inactive positions only show where this person still holds them.
  const positions = (query.data ?? [])
    .filter((position) => position.isActive || position.staffIds.includes(userId))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const held = positions.filter((position) => position.staffIds.includes(userId));
  const shown = canEdit ? positions : held;

  return (
    <SettingsSection id="record-positions" title="Positions">
      {query.isPending ? (
        <div role="status" aria-busy="true" aria-label="Loading positions" className="space-y-3">
          <Bone className="h-4 w-32" />
          <Bone className="h-4 w-24" />
        </div>
      ) : query.isError ? (
        <ErrorState className="py-6" title="Positions couldn’t be loaded" onRetry={() => void query.refetch()} />
      ) : shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {positions.length === 0 ? 'No positions set up yet. Add them on the rota.' : 'Not trained for any position yet.'}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((position) => {
            const on = position.staffIds.includes(userId);
            return (
              <li key={position.id} className="flex items-center justify-between gap-3">
                <span className={cn('min-w-0 truncate text-sm font-semibold', on ? 'text-foreground' : 'text-muted-foreground')}>
                  {position.name}
                  {!position.isActive && <span className="ml-1.5 text-xs font-normal text-muted-foreground">· archived</span>}
                </span>
                {canEdit && (
                  <Switch
                    checked={on}
                    disabled={toggle.isPending}
                    onChange={(next) => toggle.mutate({ position, on: next })}
                    label={`Trained for ${position.name}`}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </SettingsSection>
  );
}
