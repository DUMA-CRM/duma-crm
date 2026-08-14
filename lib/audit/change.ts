// Relative, extensioned, and free of the API client: this module is pure
// display logic and is unit-tested under the bare Node runner, which resolves
// neither path aliases nor extensionless imports. Same convention as lib/ai.
import type { AuditLog } from '../api/audit.service.ts';
import { parseJsonObject } from '../utils/json.ts';

/**
 * Turns an entry's stored payloads into the two things a person actually asks:
 * what changed, and what was this about.
 *
 * What the API gives us, verified in `duma-api/src/middleware/audit.ts`:
 *
 *  - `metadata` = handler-supplied detail + query params + the sanitised
 *    **request body**. So for most entries it is the *new* state only.
 *  - `response` = the sanitised response body.
 *  - Genuine before/after pairs exist in a handful of handlers, written as
 *    `previousStatus`/`newStatus` (orders) and `previousQuantity`/`newQuantity`
 *    (loss log).
 *
 * So a true diff is shown where one was recorded, and the fields that were set
 * are shown where one wasn't. Nothing is invented to fill the gap: an entry
 * whose payload says nothing says so.
 */

export interface AuditChange {
  label: string;
  /** Absent when the API recorded no prior value — most entries. */
  before?: string;
  after: string;
}

export interface AuditFact {
  label: string;
  value: string;
}

export interface AuditChangeSet {
  changes: AuditChange[];
  facts: AuditFact[];
  /** True when a payload existed but held nothing worth showing on its own. */
  hasPayload: boolean;
}

// ── Value formatting ──────────────────────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2})?/;
const MONEY_KEY = /amount|total|price|cost|subtotal|tax|refund|balance|pay$|value$/i;
const NOISE_KEYS = new Set(['query', 'body', 'truncated', 'bytes', 'id', 'createdAt', 'updatedAt']);

/** Enough of a UUID to compare two by eye, never enough to mistake for a name. */
export function shortId(value: string): string {
  return UUID.test(value) ? `${value.slice(0, 4)}…${value.slice(-4)}` : value;
}

const MONEY = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' });
const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

export function humaniseKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[._-]+/g, ' ')
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return MONEY_KEY.test(key) ? MONEY.format(value) : String(value);
  if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? 'item' : 'items'}`;
  if (typeof value === 'object') return `${Object.keys(value as object).length} fields`;

  const text = String(value);
  if (MONEY_KEY.test(key) && /^-?\d+(\.\d+)?$/.test(text)) return MONEY.format(Number(text));
  if (ISO_DATE.test(text)) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return DATE.format(date);
  }
  if (UUID.test(text)) return shortId(text);
  // Enum-ish values arrive as snake_case; they are read, not parsed.
  if (/^[a-z]+(_[a-z]+)+$/.test(text)) return text.replace(/_/g, ' ');
  return text;
}

// ── The human name of the record an entry is about ────────────────────────────

const SUBJECT_KEYS = [
  'reference',
  'orderNumber',
  'name',
  'fullName',
  'title',
  'displayName',
  'label',
  'toEmail',
  'email',
  'sku',
  'code',
  'slug',
  'period',
];

function candidate(source: Record<string, unknown> | null): string | null {
  if (!source) return null;
  for (const key of SUBJECT_KEYS) {
    const value = source[key];
    if (typeof value !== 'string') continue;
    const text = value.trim();
    // A UUID is not a name, and an essay is not a label.
    if (!text || UUID.test(text) || text.length > 60) continue;
    return text;
  }
  return null;
}

function nested(source: Record<string, unknown> | null, key: string): Record<string, unknown> | null {
  const value = source?.[key];
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/**
 * A readable name for the record, dug out of the entry's own payload.
 *
 * `orders` has no order number in the database — only a UUID — so there is
 * often nothing to find. Returning null then is correct: the row says
 * "cancelled an order" rather than dressing a UUID up as an identifier.
 */
export function auditSubject(log: AuditLog): string | null {
  const meta = parseJsonObject(log.metadata);
  const response = parseJsonObject(log.response);
  return candidate(meta) ?? candidate(nested(meta, 'body')) ?? candidate(response) ?? candidate(nested(response, 'data')) ?? null;
}

// ── What changed ──────────────────────────────────────────────────────────────

const PRIOR = /^(previous|prev|old|before)([A-Z_].*)$/;

function baseKey(match: RegExpMatchArray): string {
  return match[2].replace(/^_/, '');
}

function counterpartKeys(base: string): string[] {
  const lower = base.charAt(0).toLowerCase() + base.slice(1);
  return [`new${base}`, `after${base}`, `current${base}`, lower, base];
}

export function auditChangeSet(log: AuditLog): AuditChangeSet {
  const meta = parseJsonObject(log.metadata);
  const body = nested(meta, 'body');
  const changes: AuditChange[] = [];
  const facts: AuditFact[] = [];
  const consumed = new Set<string>();

  // 1. Real before → after pairs, where a handler recorded one.
  for (const [key, value] of Object.entries(meta ?? {})) {
    const match = key.match(PRIOR);
    if (!match) continue;
    const base = baseKey(match);
    const partner = counterpartKeys(base).find((name) => name !== key && meta && name in meta);
    if (!partner) continue;
    consumed.add(key);
    consumed.add(partner);
    changes.push({
      label: humaniseKey(base),
      before: formatValue(base, value),
      after: formatValue(base, meta?.[partner]),
    });
  }

  // 2. The request body is the state that was set — an after with no before.
  for (const [key, value] of Object.entries(body ?? {})) {
    if (NOISE_KEYS.has(key) || typeof value === 'object') continue;
    changes.push({ label: humaniseKey(key), after: formatValue(key, value) });
  }

  // 3. Everything else the handler attached: counts, reasons, references.
  for (const [key, value] of Object.entries(meta ?? {})) {
    if (consumed.has(key) || NOISE_KEYS.has(key)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value)) continue;
    facts.push({ label: humaniseKey(key), value: formatValue(key, value) });
  }

  return { changes, facts, hasPayload: Boolean(meta) || Boolean(parseJsonObject(log.response)) };
}
