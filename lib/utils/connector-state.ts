/**
 * Which section of Settings → Connections a connection sits in. Each rule
 * reads only the fields it needs, so it is testable without the API types.
 * `attention` covers anything that used to work and no longer does — the only
 * state that needs someone to act today.
 */
export type ConnectorState = 'connected' | 'configured' | 'attention' | 'paused' | 'disconnected' | 'unavailable';

/** A connection that has never delivered a test still needs someone to look at it. */
export function telegramConnectorState(
  connection: { lastError: string | null; isEnabled: boolean; lastTestedAt: string | null } | null | undefined,
): ConnectorState {
  if (!connection) return 'disconnected';
  if (connection.lastError) return 'attention';
  if (!connection.isEnabled) return 'paused';
  return connection.lastTestedAt ? 'connected' : 'attention';
}

/** A failed check outranks pausing: a paused mailbox that also fails still needs fixing. */
export function emailConnectorState(
  connection: { lastTestSucceeded?: boolean | null; isEnabled: boolean } | null | undefined,
): ConnectorState {
  if (!connection) return 'disconnected';
  if (connection.lastTestSucceeded === false) return 'attention';
  if (!connection.isEnabled) return 'paused';
  return 'connected';
}

/** Paused readers still count as set up, so a paused-only location offers Manage, not Connect. */
export function paymentsConnectorState(methods: { isActive?: boolean }[] | undefined): ConnectorState {
  if (!methods || methods.length === 0) return 'disconnected';
  return methods.some((method) => method.isActive !== false) ? 'connected' : 'paused';
}

/** DUMA's own storage is the default, not a connection; only a bucket receiving uploads counts. */
export function storageConnectorState(
  storage: { connections: { isActive: boolean; lastError: string | null }[] } | undefined,
): ConnectorState {
  const active = storage?.connections.find((connection) => connection.isActive);
  if (!active) return 'disconnected';
  return active.lastError ? 'attention' : 'connected';
}

/**
 * A saved till is set up, whichever connection it uses — "no printer, manual
 * drawer" is a choice, not a missing step.
 */
export function tillHardwareState(settings: object | undefined): ConnectorState {
  return settings ? 'connected' : 'disconnected';
}
