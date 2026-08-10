/**
 * Turns a thrown error into something an operator can act on.
 *
 * Two facts shape this file:
 *
 * 1. In production Next.js strips the message off anything thrown during a
 *    server render and replaces it with a generic sentence plus a `digest`
 *    hash. So sniffing the message only ever pays off for errors thrown on the
 *    client — a server throw always lands in `kind: 'server'`, where the
 *    reference is the only thing the user can usefully hand to support.
 * 2. We are describing an error nobody has seen before, so each branch may
 *    only claim what its match actually proves. "The connection dropped" is
 *    fair for a failed fetch; "your order wasn't saved" is not — we don't know
 *    that. When in doubt the copy says what to do next, not what went wrong.
 */

export type ErrorKind =
  | 'offline'
  | 'update'
  | 'network'
  | 'timeout'
  | 'session'
  | 'permission'
  | 'missing'
  | 'busy'
  | 'server'
  | 'unknown';

/** What the primary button on the error screen should do. */
export type ErrorAction = 'retry' | 'reload' | 'sign-in';

export interface ErrorDescription {
  kind: ErrorKind;
  title: string;
  body: string;
  action: ErrorAction;
  /** Label for the primary button. */
  actionLabel: string;
  /** Whether the support reference is worth showing for this kind. */
  showReference: boolean;
}

interface Rule {
  match: RegExp;
  description: ErrorDescription;
}

const OFFLINE: ErrorDescription = {
  kind: 'offline',
  title: 'You’re offline',
  body: 'This device has lost its connection. Check the wifi or mobile signal — the page will load once you’re back online.',
  action: 'retry',
  actionLabel: 'Try again',
  showReference: false,
};

const UNKNOWN: ErrorDescription = {
  kind: 'unknown',
  title: 'This page couldn’t load',
  body: 'Something unexpected stopped this section from loading. Nothing else in DUMA is affected — try again, and quote the reference below if it keeps happening.',
  action: 'retry',
  actionLabel: 'Try again',
  showReference: true,
};

// Ordered: the first match wins, so narrow patterns come before broad ones.
const RULES: Rule[] = [
  {
    // Next.js replaces the real message with this in production builds.
    match: /omitted in production|server components render/,
    description: {
      kind: 'server',
      title: 'Something went wrong on our side',
      body: 'This isn’t something you did. Trying again often works — if it doesn’t, quote the reference below to support and it points us straight at the cause.',
      action: 'retry',
      actionLabel: 'Try again',
      showReference: true,
    },
  },
  {
    // A deploy replaced the JS bundles this tab was told to load.
    match: /chunkloaderror|loading chunk|dynamically imported module|module script failed/,
    description: {
      kind: 'update',
      title: 'DUMA was updated while this tab was open',
      body: 'This tab is running an older version of the app and can’t load the rest of it. Reloading picks up the current version.',
      action: 'reload',
      actionLabel: 'Reload DUMA',
      showReference: false,
    },
  },
  {
    match: /\b401\b|unauthori[sz]ed|not authenticated|session (has )?expired|invalid (session|token)/,
    description: {
      kind: 'session',
      title: 'Your session has expired',
      body: 'You’ve been signed out — sessions end after a period of inactivity. Signing in again brings you straight back here.',
      action: 'sign-in',
      actionLabel: 'Sign in',
      showReference: false,
    },
  },
  {
    match: /\b403\b|forbidden|permission denied|access denied|not allowed/,
    description: {
      kind: 'permission',
      title: 'You don’t have access to this',
      body: 'Your role doesn’t cover this section. A manager or owner can change your permissions in Settings → Staff.',
      action: 'retry',
      actionLabel: 'Try again',
      showReference: false,
    },
  },
  {
    match: /\b429\b|rate limit|too many requests/,
    description: {
      kind: 'busy',
      title: 'Too many requests',
      body: 'This section was asked for more times than we allow in a short window. Wait about a minute, then try again.',
      action: 'retry',
      actionLabel: 'Try again',
      showReference: false,
    },
  },
  {
    match: /timeout|timed out|etimedout|aborterror|operation was aborted/,
    description: {
      kind: 'timeout',
      title: 'This took too long to load',
      body: 'The server didn’t answer in time. That’s usually a slow connection or a busy moment — trying again is normally enough.',
      action: 'retry',
      actionLabel: 'Try again',
      showReference: true,
    },
  },
  {
    match: /failed to fetch|fetch failed|network(error| request failed)|load failed|econnrefused|enotfound|err_(connection|network|internet)/,
    description: {
      kind: 'network',
      title: 'Couldn’t reach the server',
      body: 'The connection dropped partway through loading this page. Check the till’s network, then try again.',
      action: 'retry',
      actionLabel: 'Try again',
      showReference: true,
    },
  },
  {
    match: /\b404\b|not found|no such/,
    description: {
      kind: 'missing',
      title: 'This record no longer exists',
      body: 'It was probably deleted or merged while the page was open. Go back and open it again from the list.',
      action: 'retry',
      actionLabel: 'Try again',
      showReference: false,
    },
  },
  {
    match: /\b50[0234]\b|internal server error|bad gateway|service unavailable|database|econnreset/,
    description: {
      kind: 'server',
      title: 'Something went wrong on our side',
      body: 'The server couldn’t complete this request. Trying again often works — if it doesn’t, quote the reference below to support.',
      action: 'retry',
      actionLabel: 'Try again',
      showReference: true,
    },
  },
];

/**
 * @param online Pass `false` when the browser reports no connection; every
 *   other signal is unreliable once the network is gone, so it wins outright.
 */
export function describeError(error: { name?: string; message?: string } | null | undefined, options: { online?: boolean } = {}): ErrorDescription {
  if (options.online === false) return OFFLINE;

  const haystack = `${error?.name ?? ''} ${error?.message ?? ''}`.toLowerCase();
  return RULES.find((rule) => rule.match.test(haystack))?.description ?? UNKNOWN;
}
