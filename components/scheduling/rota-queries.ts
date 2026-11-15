import type { QueryClient } from '@tanstack/react-query';

import { moduleQueryKeys } from '@/lib/modules/query-keys';

/** The week planner bundle — one call for the whole grid. */
export const plannerKey = (locationId: string | null, weekStart: string) =>
  moduleQueryKeys.workforce.key('rota-planner', locationId, weekStart);

/**
 * Everything a rota change can move: the planner, the older scheduled-shift
 * lists (My rota, the staff record), variance, requests, templates and
 * positions. Prefix keys, so every week and location goes stale together.
 */
export function invalidateRota(qc: QueryClient) {
  for (const resource of ['rota-planner', 'scheduled-shifts', 'variance', 'rota-requests', 'rota-templates', 'rota-positions'] as const)
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.workforce.key(resource) });
}
