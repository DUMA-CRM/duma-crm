/** The API supplies Better Auth's deadline; older APIs fall back to its guarded endpoint. */
export function canReadSessionList(
  current: { security?: { sessionFreshUntil: string | null } } | null | undefined,
  now = Date.now(),
): boolean {
  if (!current) return false;
  const deadline = current.security?.sessionFreshUntil;
  if (deadline === null || deadline === undefined) return true;
  const expires = Date.parse(deadline);
  return Number.isFinite(expires) && now < expires;
}
