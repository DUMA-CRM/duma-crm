import type { AnalyticsConnectionInput, ExternalAnalyticsProvider } from '@/lib/api/analytics.service';

// ---------------------------------------------------------------------------
// The web analytics connector's setup, kept pure: which kind of account, which
// way it signs in, the step-by-step guide for finding each value, and the
// request that comes out the other end.
//
// Umami Cloud reads an API key from its own header at api.umami.is/v1. A
// self-hosted Umami serves its API at <address>/api and has API keys only from
// 3.4 — older ones sign in with a username and password. The API handles both;
// this file only decides what to ask for.
// ---------------------------------------------------------------------------

export type AnalyticsSetup = 'umami-cloud' | 'umami-self' | 'posthog';
export type UmamiSignIn = 'apiKey' | 'login';

export const UMAMI_CLOUD_API = 'https://api.umami.is/v1';
export const POSTHOG_US_API = 'https://us.posthog.com';

// One question per screen, like onboarding: provider, then (Umami) where it
// runs, then (self-hosted) how DUMA signs in.
export const PROVIDER_CHOICES = [
  { value: 'umami', label: 'Umami', hint: 'Simple, privacy-friendly website stats.' },
  { value: 'posthog', label: 'PostHog', hint: 'Product analytics — US, EU or self-hosted.' },
] as const satisfies readonly { value: ExternalAnalyticsProvider; label: string; hint: string }[];

export type UmamiHosting = 'cloud' | 'self';
export const HOSTING_CHOICES = [
  { value: 'cloud', label: 'Umami Cloud', hint: 'You sign in at cloud.umami.is.' },
  { value: 'self', label: 'Self-hosted', hint: 'Umami runs on your own server or domain.' },
] as const satisfies readonly { value: UmamiHosting; label: string; hint: string }[];

export const SIGN_IN_CHOICES = [
  { value: 'apiKey', label: 'API key', hint: 'Umami 3.4 or later — Settings has an “API keys” page.' },
  { value: 'login', label: 'Username and password', hint: 'Older Umami without API keys. Use a view-only user.' },
] as const satisfies readonly { value: UmamiSignIn; label: string; hint: string }[];

export function setupFrom(provider: ExternalAnalyticsProvider | null, hosting: UmamiHosting | null): AnalyticsSetup | null {
  if (provider === 'posthog') return 'posthog';
  if (provider === 'umami' && hosting) return hosting === 'cloud' ? 'umami-cloud' : 'umami-self';
  return null;
}

const SETUP_LABELS: Record<AnalyticsSetup, string> = { 'umami-cloud': 'Umami Cloud', 'umami-self': 'Umami, self-hosted', posthog: 'PostHog' };

export interface AnalyticsForm {
  displayName: string;
  siteId: string;
  apiUrl: string;
  apiKey: string;
  username: string;
  password: string;
}

export const EMPTY_ANALYTICS_FORM: AnalyticsForm = { displayName: '', siteId: '', apiUrl: '', apiKey: '', username: '', password: '' };

export const setupLabel = (setup: AnalyticsSetup) => SETUP_LABELS[setup];

/** How a saved connection was set up — cloud and self-hosted Umami share a provider. */
export function setupOf(connection: { provider: ExternalAnalyticsProvider; apiUrl: string }): AnalyticsSetup {
  if (connection.provider === 'posthog') return 'posthog';
  return connection.apiUrl.includes('api.umami.is') ? 'umami-cloud' : 'umami-self';
}

const signsIn = (setup: AnalyticsSetup, signIn: UmamiSignIn) => setup === 'umami-self' && signIn === 'login';

/** What's wrong with the API address as typed, or null. Empty is fine where there's a default. */
export function apiUrlProblem(setup: AnalyticsSetup, value: string): string | null {
  const raw = value.trim();
  if (!raw) return setup === 'umami-self' ? 'Enter the address you open Umami on.' : null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'Enter the full address, starting with https://';
  }
  if (url.protocol !== 'https:') return 'It must be an https:// address — DUMA won’t send keys over plain http.';
  if (url.port) return 'Remove the port. Put Umami behind a domain served on the normal HTTPS port.';
  if (url.hostname === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(url.hostname)) {
    return 'Use a public domain name — DUMA calls it from the internet, not your network.';
  }
  return null;
}

export function analyticsFormReady(setup: AnalyticsSetup | null, signIn: UmamiSignIn, form: AnalyticsForm) {
  if (!setup || !form.displayName.trim() || !form.siteId.trim() || apiUrlProblem(setup, form.apiUrl)) return false;
  return signsIn(setup, signIn) ? Boolean(form.username.trim() && form.password) : Boolean(form.apiKey.trim());
}

export function analyticsConnectionInput(setup: AnalyticsSetup, signIn: UmamiSignIn, form: AnalyticsForm): AnalyticsConnectionInput {
  const provider = setup === 'posthog' ? 'posthog' : 'umami';
  const apiUrl = setup === 'umami-cloud' ? UMAMI_CLOUD_API : form.apiUrl.trim() || (setup === 'posthog' ? POSTHOG_US_API : '');
  const base = { provider, displayName: form.displayName.trim(), siteId: form.siteId.trim(), apiUrl } as const;
  return signsIn(setup, signIn)
    ? { ...base, username: form.username.trim(), apiKey: form.password }
    : { ...base, apiKey: form.apiKey.trim() };
}

// ── Where to find each value ────────────────────────────────────────────────

export interface FieldHelp {
  /** Menu path to click through, shown as breadcrumbs. */
  path?: string[];
  text: string;
}

export interface AnalyticsHelp {
  /** What the mascot says above the fields. */
  intro: string;
  link?: { href: string; label: string };
  address?: FieldHelp;
  siteId: FieldHelp;
  /** The API key, or the username and password. */
  credential: FieldHelp;
}

const UMAMI_WEBSITE_ID: FieldHelp = {
  path: ['Settings', 'Websites', 'your website'],
  text: 'A long code like 4f9a…e21c — also the data-website-id in your tracking snippet.',
};

export function analyticsHelp(setup: AnalyticsSetup, signIn: UmamiSignIn): AnalyticsHelp {
  if (setup === 'umami-cloud') {
    return {
      intro: 'Open Umami Cloud next to this tab. I’ll test what you paste before saving.',
      link: { href: 'https://cloud.umami.is', label: 'Open cloud.umami.is' },
      siteId: UMAMI_WEBSITE_ID,
      credential: { path: ['Settings', 'API keys', 'Create key'], text: 'Copy it straight away — Umami shows it only once.' },
    };
  }
  if (setup === 'umami-self') {
    return {
      intro:
        signIn === 'apiKey'
          ? 'Open your Umami next to this tab. I’ll test what you paste before saving.'
          : 'Give DUMA its own view-only user rather than your admin. I’ll test it before saving.',
      address: { text: 'The address you open Umami on. It must be https, on a public domain, without a :port.' },
      siteId: UMAMI_WEBSITE_ID,
      credential:
        signIn === 'apiKey'
          ? { path: ['Settings', 'API keys', 'Create key'], text: 'It starts with umami_ and is shown only once.' }
          : {
              path: ['Settings', 'Users', 'Create user'],
              text: 'On Umami 3 it’s Admin → Users. Pick the View only role, add it to the team that owns the website, and leave two-factor off.',
            },
    };
  }
  return {
    intro: 'Open PostHog next to this tab. I’ll test what you paste before saving.',
    address: { text: 'Use https://eu.posthog.com for EU Cloud, or your own address if self-hosted.' },
    siteId: { path: ['Settings', 'Project'], text: 'The number shown near the top.' },
    credential: { path: ['Settings', 'Personal API keys', 'Create'], text: 'Limit it to this project with only the Query: Read scope.' },
  };
}

// ── The data preview ────────────────────────────────────────────────────────

export function formatVisitDuration(seconds: number | null) {
  if (seconds === null) return '—';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
}

export const formatRate = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);
