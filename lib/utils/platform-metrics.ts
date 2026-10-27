/**
 * How DUMA Admin words a figure. Every figure says what it is, when it was
 * measured and whether it is an estimate; an unavailable one says why, and is
 * never drawn as a zero.
 */

export type MetricLike<T> =
  | { status: 'ok'; value: T; unit: string; definition: string; window: string | null; collectedAt: string; estimate: boolean }
  | { status: 'unavailable'; reason: string; definition: string; collectedAt: string };

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** 1536 → "1.5 KB". Binary multiples, one decimal under 10. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const digits = unit === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${BYTE_UNITS[unit]}`;
}

/** 12345 → "12,345"; an estimate reads "≈ 12,345". */
export function formatCount(value: number, estimate = false): string {
  const text = Number.isFinite(value) ? Math.round(value).toLocaleString('en-GB') : '—';
  return estimate ? `≈ ${text}` : text;
}

/** "just now", "4 min ago", "3 h ago", "2 days ago" — for "measured …". */
export function freshness(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return 'never';
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return 'unknown';
  const seconds = Math.max(0, Math.round((now - at) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

/** The figure as text, or null when it is unavailable — the caller then shows the reason, not a number. */
export function metricText(metric: MetricLike<number>, format: (value: number) => string = (value) => formatCount(value)): string | null {
  if (metric.status !== 'ok') return null;
  const text = format(metric.value);
  return metric.estimate && !text.startsWith('≈') ? `≈ ${text}` : text;
}

/** Share of a total as a whole percentage, or null with no total to share. */
export function share(part: number, total: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return null;
  return Math.round((part / total) * 100);
}

/**
 * The line under a figure: what it counts, over what window, when it was
 * measured and whether it is an estimate — or, when the source could not
 * answer, why. `unitLabel` replaces the unit when the value already carries it.
 */
export function metricNote(metric: MetricLike<unknown>, unitLabel?: string, now: number = Date.now()): string {
  if (metric.status !== 'ok') return metric.reason;
  return [unitLabel ?? metric.unit, metric.window, `measured ${freshness(metric.collectedAt, now)}`, metric.estimate ? 'estimate' : null]
    .filter(Boolean)
    .join(' · ');
}

const WORKSPACE_STATUS = { active: 'Active', winding_down: 'Winding down', inactive: 'Inactive' } as const;

/** "winding_down" → "Winding down". */
export function workspaceStatusLabel(status: keyof typeof WORKSPACE_STATUS): string {
  return WORKSPACE_STATUS[status] ?? status;
}

const counted = (value: number, one: string, many: string) => `${formatCount(value)} ${value === 1 ? one : many}`;

/** A workspace in one line: "2 locations · 1 staff member · 8 modules". */
export function workspaceFacts(row: { activeLocations: number; activeStaff: number; enabledModules: number }): string {
  return [
    counted(row.activeLocations, 'location', 'locations'),
    counted(row.activeStaff, 'staff member', 'staff'),
    counted(row.enabledModules, 'module', 'modules'),
  ].join(' · ');
}

/** A module's reach in words: "4 of 12 active clients", or that there is no one to count yet. */
export function adoptionNote(enabled: number, activeClients: number): string {
  if (activeClients <= 0) return 'No active clients yet';
  return `${formatCount(enabled)} of ${formatCount(activeClients)} active ${activeClients === 1 ? 'client' : 'clients'}`;
}

export type HealthTone = 'success' | 'warning' | 'danger' | 'muted';

/** A background worker's state in words, with how it should read: off, stalled, starting or when it last ran. */
export function workerStatus(
  worker: { enabled: boolean; stalled: boolean; starting: boolean; lastTickAt: string | null },
  now: number = Date.now(),
): { label: string; tone: HealthTone; note: string } {
  if (!worker.enabled) return { label: 'Off', tone: 'muted', note: 'Switched off in this API process' };
  if (worker.stalled) return { label: 'Stalled', tone: 'danger', note: `Last ran ${freshness(worker.lastTickAt, now)}` };
  if (worker.starting) return { label: 'Starting', tone: 'muted', note: 'Hasn’t run yet' };
  return { label: 'Running', tone: 'success', note: `Ran ${freshness(worker.lastTickAt, now)}` };
}

/** The cache's status from the health check: "ok" is healthy, "disabled" is off, anything else is degraded. */
export function cacheStatus(status: string): { label: string; tone: HealthTone } {
  if (status === 'ok') return { label: 'Healthy', tone: 'success' };
  if (status === 'disabled') return { label: 'Off', tone: 'muted' };
  return { label: 'Degraded', tone: 'warning' };
}

/** A table under its name: "≈ 12,345 rows · 1.5 KB indexes · analysed 3 h ago". */
export function tableFacts(
  table: { estimatedRows: number; indexBytes: number; statisticsAt: string | null },
  now: number = Date.now(),
): string {
  return [
    `${formatCount(table.estimatedRows, true)} rows`,
    `${formatBytes(table.indexBytes)} indexes`,
    table.statisticsAt ? `analysed ${freshness(table.statisticsAt, now)}` : 'never analysed',
  ].join(' · ');
}
