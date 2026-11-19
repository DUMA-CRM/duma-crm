import type { KeyEntry } from '@/lib/utils/till-keys';
import type { PosLayout } from '@/stores/posSettingsStore';

import { apiFetch } from './client';

/**
 * A location's team till layout: the sell screen a manager published for every
 * till there. A starting point — a device that arranges its own keys keeps them
 * until it chooses the team layout again. The loyalty scanner is never part of
 * it; that is each device's hardware.
 */
export interface TillTeamLayout {
  version: 1;
  settings: PosLayout;
  pinned: string[];
  keys: Record<string, KeyEntry[]>;
}

export interface TillTeamLayoutResponse {
  layout: TillTeamLayout | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const getTillTeamLayout = (locationId: string) => apiFetch<TillTeamLayoutResponse>(`/till-layouts/${locationId}`);

export const publishTillTeamLayout = (locationId: string, layout: TillTeamLayout) =>
  apiFetch<TillTeamLayoutResponse>(`/till-layouts/${locationId}`, { method: 'PUT', body: JSON.stringify(layout) });
