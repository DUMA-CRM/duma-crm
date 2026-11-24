// Product analytics in the browser. Every export is a no-op until
// `initAnalytics` has run, so callers never check whether PostHog is configured.
//
// posthog-js is imported on demand, and only when a key is set and the page is
// tracked: guest ordering, forms and the till never download it. Calls made
// while it loads wait for it, in order, so an identify still precedes the
// events after it.
import type { PostHog } from 'posthog-js';

import { ANALYTICS_PATH, isTrackedPath, posthogUiHost, scrubEventProperties } from '@/lib/utils/product-analytics';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com';

let client: Promise<PostHog | null> | null = null;

/** Runs `use` once PostHog has loaded; nothing at all when analytics is off. */
function withPosthog(use: (posthog: PostHog) => void) {
  if (!client) return;
  void client
    .then((posthog) => {
      if (posthog?.__loaded) use(posthog);
    })
    .catch(() => {
      // Analytics must never break the page it is measuring.
    });
}

/** Called once from instrumentation-client.ts, before the app hydrates. */
export function initAnalytics() {
  if (client || !KEY || !isTrackedPath(window.location.pathname)) return;
  const key = KEY;
  client = import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(key, {
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
      return posthog;
    })
    .catch(() => null);
}

export function identifyUser(user: { id: string; email: string; name: string }, account: { role: string | null }) {
  withPosthog((posthog) => {
    posthog.identify(user.id, { email: user.email, name: user.name });
    // Registered as an event property too, so any event can be broken down by role
    // without joining on the person. The workspace is not the account's: it is
    // this tab's context, registered by registerAnalyticsContext.
    posthog.register({ role: account.role });
  });
}

/**
 * The context every later event in this tab belongs to: platform or workspace,
 * which workspace and its classification, and whether the actor is the
 * workspace's staff or a platform administrator visiting it. Re-registered on
 * every switch. `tenant_id` mirrors `workspace_id` for existing insights.
 */
export function registerAnalyticsContext(properties: Record<string, string | null>) {
  withPosthog((posthog) => posthog.register({ ...properties, tenant_id: properties.workspace_id ?? null }));
}

export function track(event: string, properties?: Record<string, unknown>, options?: { beforeNavigation?: boolean }) {
  // A full-page navigation straight after would drop a batched event.
  withPosthog((posthog) =>
    posthog.capture(event, properties, options?.beforeNavigation ? { send_instantly: true, transport: 'sendBeacon' } : undefined),
  );
}

/** On sign-out: the next person on a shared till must not inherit this identity. */
export function resetAnalytics() {
  withPosthog((posthog) => posthog.reset());
}
