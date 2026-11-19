import type { KeyEntry } from './till-keys.ts';

/**
 * Which layout a till shows, and what it publishes, when its location has a
 * team layout. The team layout is a starting point: a device that never
 * arranged its own follows it; one that did keeps its own until it chooses the
 * team layout again. While arranging, a device always edits its own copy.
 */

/** The sell-screen settings a team layout carries — everything but the device's hardware (the loyalty scanner). */
export const TEAM_SETTING_KEYS = [
  'showSearch',
  'showCategories',
  'menuLayout',
  'tileStyle',
  'favourites',
  'topCount',
  'stockHighlight',
  'swipeToRemove',
] as const;

export type TeamSettingKey = (typeof TEAM_SETTING_KEYS)[number];

export function tillSource(input: { hasTeam: boolean; own: boolean; arranging: boolean }): 'team' | 'device' {
  return input.hasTeam && !input.own && !input.arranging ? 'team' : 'device';
}

/** This device's layout for one workspace, as a team layout: its settings, that workspace's pins and keys, nothing else. */
export function teamLayoutFrom<S extends Record<TeamSettingKey, unknown>>(
  device: S & { pinned: Record<string, string[]>; keyLayouts: Record<string, Record<string, KeyEntry[]>> },
  tenantId: string,
): { version: 1; settings: Pick<S, TeamSettingKey>; pinned: string[]; keys: Record<string, KeyEntry[]> } {
  const settings = Object.fromEntries(TEAM_SETTING_KEYS.map((key) => [key, device[key]])) as Pick<S, TeamSettingKey>;
  return { version: 1, settings, pinned: device.pinned[tenantId] ?? [], keys: device.keyLayouts[tenantId] ?? {} };
}
