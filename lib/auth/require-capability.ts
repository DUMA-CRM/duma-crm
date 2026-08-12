import { redirect } from 'next/navigation';
import 'server-only';

import { getCurrentStaffProfile } from '@/lib/auth/current-staff';
import { type Capability, hasAllCapabilities, hasAnyCapability } from '@/lib/auth/capabilities';

/**
 * Guard a route segment on a capability the API also enforces.
 *
 * These guards exist to avoid rendering a page whose data the API will refuse —
 * they are a UX affordance, not the security boundary. The API is the boundary,
 * and it checks the same capability on every request the page makes.
 *
 * Sends the user to the dashboard rather than showing a 403, because every role
 * can reach the dashboard.
 */
export async function requireCapability(capability: Capability) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !hasAllCapabilities(profile, capability)) redirect('/dashboard');
  return profile;
}

/** Guard a segment on holding at least one of several capabilities. */
export async function requireAnyCapability(...capabilities: Capability[]) {
  const profile = await getCurrentStaffProfile();
  if (!profile || !hasAnyCapability(profile, ...capabilities)) redirect('/dashboard');
  return profile;
}
