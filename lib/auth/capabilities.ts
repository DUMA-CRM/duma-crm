// ---------------------------------------------------------------------------
// Client-side capability checks.
//
// The API authorises every request against a named capability (see
// `src/lib/capabilities.ts` in duma-api). This module is how the CRM decides
// what to *show*, so the two agree instead of the UI re-deriving permissions
// from a role rank that the server no longer uses.
//
// Two rules keep this honest:
//
//  1. The grants are never duplicated here. `GET /staff/me` returns the exact
//     list the server authorises on, and every check below reads that list.
//     A role's rights can change server-side with no frontend release.
//
//  2. Checks fail closed. An unknown or misspelled capability yields `false`,
//     which hides a feature rather than exposing one. If a nav item vanishes
//     unexpectedly, suspect a typo here before suspecting the grants.
//
// Only the capabilities the frontend actually gates on are named — this is
// deliberately not a mirror of the API's full vocabulary, because a partial
// copy that looks complete is worse than an obviously partial one.
// ---------------------------------------------------------------------------

import { FRONTEND_CAPABILITIES, type Capability } from '../modules/manifest.ts';

export { FRONTEND_CAPABILITIES };
export type { Capability };

/** A holder of capabilities — the staff profile, or a bare list. */
export type CapabilitySource = readonly string[] | { capabilities?: readonly string[] } | null | undefined;

// `Array.isArray` doesn't narrow a union whose other arm is an object type when
// the array arm is `readonly`, so test for the property instead.
const isProfileLike = (source: NonNullable<CapabilitySource>): source is { capabilities?: readonly string[] } =>
  !Array.isArray(source);

const listOf = (source: CapabilitySource): readonly string[] => {
  if (!source) return [];
  return isProfileLike(source) ? (source.capabilities ?? []) : source;
};

/** Does this profile hold the capability? Unknown input fails closed. */
export function hasCapability(source: CapabilitySource, capability: Capability): boolean {
  return listOf(source).includes(capability);
}

/** Does this profile hold at least one of these capabilities? */
export function hasAnyCapability(source: CapabilitySource, ...capabilities: Capability[]): boolean {
  const held = listOf(source);
  return capabilities.some((capability) => held.includes(capability));
}

/** Does this profile hold every one of these capabilities? */
export function hasAllCapabilities(source: CapabilitySource, ...capabilities: Capability[]): boolean {
  const held = listOf(source);
  return capabilities.every((capability) => held.includes(capability));
}
