// The words Settings → Developers puts on its rows: what a key opens, when it
// was last used, whether a webhook is getting through. Pure, so the copy is
// tested rather than spread through the components.
import { type ApiKeyKind, type PublicApi, apiBase, apisOf } from '../developers/api-reference.ts';

import { relativeTime } from './relative-time.ts';

export const keyKindLabel = (kind: ApiKeyKind): string => (kind === 'secret' ? 'Secret' : 'Publishable');

/** "Secret · Store, Content" — the kind, then the APIs its scopes open. */
export function keySummary(key: { kind: ApiKeyKind; scopes: readonly string[] }): string {
  const apis = apisOf(key.scopes).map((api) => api.name.replace(/ API$/, ''));
  return apis.length > 0 ? `${keyKindLabel(key.kind)} · ${apis.join(', ')}` : keyKindLabel(key.kind);
}

/** "Used 3h ago", or "Never used" — the first thing to check when an integration stops. */
export const keyUsage = (lastUsedAt: string | null, now: number = Date.now()): string =>
  lastUsedAt ? `Used ${relativeTime(lastUsedAt, now)}` : 'Never used';

export type WebhookDelivery = { status: 'pending' | 'succeeded' | 'failed'; at: string } | null | undefined;

/** How a webhook is doing, from its last delivery: the word on its row, and how loudly to say it. */
export function webhookHealth(isActive: boolean, last: WebhookDelivery): { label: string; tone?: 'danger' | 'warning'; muted: boolean } {
  if (!isActive) return { label: 'Paused', muted: true };
  if (!last) return { label: 'Nothing sent yet', muted: true };
  if (last.status === 'failed') return { label: 'Failing', tone: 'danger', muted: false };
  if (last.status === 'pending') return { label: 'Retrying', tone: 'warning', muted: false };
  return { label: 'Delivering', muted: false };
}

/** A `.env` to paste into a project: each API's base URL and the two key slots. Never a real key. */
export function envTemplate(apiOrigin: string, apis: readonly PublicApi[]): string {
  const name: Record<string, string> = {
    content: 'DUMA_CMS_URL',
    manage: 'DUMA_CMS_MANAGE_URL',
    store: 'DUMA_STORE_URL',
    management: 'DUMA_MANAGE_URL',
  };
  return [
    ...apis.map((api) => `${name[api.id] ?? `DUMA_${api.id.toUpperCase()}_URL`}=${apiBase(apiOrigin, api)}`),
    'DUMA_PUBLISHABLE_KEY=   # dk_pub_… — safe in a browser',
    'DUMA_SECRET_KEY=        # dk_sec_… — your server only',
  ].join('\n');
}
