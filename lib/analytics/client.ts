// Product analytics in the browser. Every export is a no-op until
// `initAnalytics` has run, so callers never check whether PostHog is configured.
import posthog from 'posthog-js';

import { ANALYTICS_PATH, isTrackedPath, posthogUiHost, scrubEventProperties } from '@/lib/utils/product-analytics';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

/** Called once from instrumentation-client.ts, before the app hydrates. */
export function initAnalytics() {
  if (!KEY || !isTrackedPath(window.location.pathname)) return;
  posthog.init(KEY, {
    // Same origin, so the CSP's `connect-src 'self'` holds and ad blockers
    // don't silently drop a whole team's usage.
    api_host: ANALYTICS_PATH,
    ui_host: posthogUiHost(HOST),
    defaults: '2026-08-30',
    // An anonymous visitor to the landing page gets no person profile.
    person_profiles: 'identified_only',
    // Clicks are recorded by element, never by what the element says: a table
    // row's text is a customer's name and their bill.
    mask_all_text: true,
    // Only what was asked for: page views, clicks, sign-ins and tool use. No
    // replay (it would film customer and payroll data), and no flags — DUMA
    // deliberately has no feature-flag service. Nothing loads from PostHog's
    // CDN, so the CSP needs no new script origin.
    disable_session_recording: true,
    disable_surveys: true,
    advanced_disable_flags: true,
    disable_external_dependency_loading: true,
    before_send: (event) => (event ? { ...event, properties: scrubEventProperties(event.properties) } : event),
  });
}

export function identifyUser(
  user: { id: string; email: string; name: string },
  workspace: { role: string | null; tenantId: string | null },
) {
  if (!posthog.__loaded) return;
  posthog.identify(user.id, { email: user.email, name: user.name });
  // Registered as event properties too, so any event can be broken down by role
  // or workspace without joining on the person.
  posthog.register({ role: workspace.role, tenant_id: workspace.tenantId });
}

export function track(event: string, properties?: Record<string, unknown>, options?: { beforeNavigation?: boolean }) {
  if (!posthog.__loaded) return;
  // A full-page navigation straight after would drop a batched event.
  posthog.capture(event, properties, options?.beforeNavigation ? { send_instantly: true, transport: 'sendBeacon' } : undefined);
}

/** On sign-out: the next person on a shared till must not inherit this identity. */
export function resetAnalytics() {
  if (!posthog.__loaded) return;
  posthog.reset();
}
