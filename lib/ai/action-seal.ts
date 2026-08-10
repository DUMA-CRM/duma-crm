import { createHmac, timingSafeEqual } from 'node:crypto';

import { isIsoDate, round, text, toNumber } from './agent-format.ts';
import type { AgentActionSubmission, AgentField, AgentFieldType, AgentPendingAction } from './agent-types';

/**
 * Approval sealing.
 *
 * The card the agent proposes is editable, so by the time it comes back it is
 * untrusted input. Instead of trusting the returned payload — or refusing edits
 * altogether — the draft is signed as a set of *constraints*: which ids may be
 * chosen, which fields may move, and between which bounds. Replaying an edit
 * can then only ever produce something the draft already authorised; anything
 * else silently falls back to what the agent originally proposed.
 */

export type FieldValue = string | number | null;

const DEFAULT_TTL_MS = 15 * 60 * 1_000;

interface SealedField {
  t: AgentFieldType;
  v: FieldValue;
  o?: string[];
  min?: number;
  max?: number;
  opt?: boolean;
  ro?: boolean;
}

interface Seal {
  k: string;
  f: Record<string, SealedField>;
  l?: {
    allow: string[];
    tpl: Record<string, SealedField>;
    vals: Record<string, Record<string, FieldValue>>;
    min: number;
    max: number;
  };
  exp: number;
}

export interface ResolvedLine {
  id: string;
  values: Record<string, FieldValue>;
}

export interface ResolvedAction {
  kind: string;
  fields: Record<string, FieldValue>;
  lines: ResolvedLine[];
}

export class ApprovalError extends Error {}

function sealField(source: AgentField): SealedField {
  return {
    t: source.type,
    v: source.value,
    ...(source.options ? { o: source.options.map((option) => option.value) } : {}),
    ...(source.min == null ? {} : { min: source.min }),
    ...(source.max == null ? {} : { max: source.max }),
    ...(source.optional ? { opt: true } : {}),
    ...(source.readOnly ? { ro: true } : {}),
  };
}

function sealFields(fields: AgentField[]) {
  return Object.fromEntries(fields.map((source) => [source.key, sealField(source)]));
}

function approvalSecret() {
  const secret = process.env.AI_AGENT_APPROVAL_SECRET || process.env.GEMINI_API_KEY;
  if (!secret) throw new ApprovalError('Ask DUMA is missing its server approval secret.');
  return secret;
}

function sign(payload: string) {
  return createHmac('sha256', approvalSecret()).update(payload).digest('base64url');
}

/** Attach the signed constraint seal that an approval will be replayed against. */
export function sealAction(action: AgentPendingAction, ttlMs = DEFAULT_TTL_MS): AgentPendingAction {
  const group = action.lineGroup;
  const seal: Seal = {
    k: action.kind,
    f: sealFields(action.fields),
    ...(group
      ? {
          l: {
            allow: [...new Set([...group.lines.map((line) => line.id), ...group.options.map((option) => option.value)])],
            tpl: sealFields(group.template),
            vals: Object.fromEntries(
              group.lines.map((line) => [line.id, Object.fromEntries(line.fields.map((lineField) => [lineField.key, lineField.value]))]),
            ),
            min: group.minLines,
            max: group.maxLines,
          },
        }
      : {}),
    exp: Date.now() + ttlMs,
  };
  const payload = Buffer.from(JSON.stringify(seal)).toString('base64url');
  return { ...action, approvalToken: `${payload}.${sign(payload)}` };
}

function openSeal(token: string | undefined): Seal {
  const [payload, signature, extra] = token?.split('.') ?? [];
  const expired = new ApprovalError('This approval has expired. Ask DUMA to prepare the action again.');
  if (!payload || !signature || extra) throw expired;
  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new ApprovalError('This approval could not be verified. Ask DUMA to prepare the action again.');
  }
  let seal: Seal;
  try {
    seal = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Seal;
  } catch {
    throw expired;
  }
  if (!seal?.k || !seal.f || !seal.exp || seal.exp < Date.now()) throw expired;
  return seal;
}

/** Coerce one edited value into the shape the draft authorised, falling back to the drafted value. */
function acceptValue(sealed: SealedField, raw: unknown): FieldValue {
  if (sealed.ro) return sealed.v;
  switch (sealed.t) {
    case 'select':
    case 'time': {
      const value = typeof raw === 'string' ? raw.trim() : '';
      if (!value) return sealed.opt ? '' : sealed.v;
      if (sealed.o && !sealed.o.includes(value)) return sealed.v;
      return value;
    }
    case 'number':
    case 'money': {
      if (raw === '' || raw == null) return sealed.opt ? 0 : sealed.v;
      const parsed = toNumber(raw, Number.NaN);
      if (!Number.isFinite(parsed)) return sealed.v;
      const clamped = Math.min(sealed.max ?? Number.MAX_SAFE_INTEGER, Math.max(sealed.min ?? -Number.MAX_SAFE_INTEGER, parsed));
      return round(clamped, sealed.t === 'money' ? 2 : 3);
    }
    case 'date':
      return isIsoDate(raw) ? raw : raw === '' && sealed.opt ? '' : sealed.v;
    default:
      return text(raw, sealed.t === 'textarea' ? 1_000 : 200);
  }
}

/** Replay the operator's edits against the sealed draft. */
export function resolveSealedSubmission(submission: AgentActionSubmission): ResolvedAction {
  const seal = openSeal(submission.approvalToken);
  const edits = submission.fields && typeof submission.fields === 'object' ? submission.fields : {};

  const fields: Record<string, FieldValue> = {};
  for (const [key, sealed] of Object.entries(seal.f)) fields[key] = acceptValue(sealed, edits[key]);

  const lines: ResolvedLine[] = [];
  if (seal.l) {
    const allowed = new Set(seal.l.allow);
    const seen = new Set<string>();
    for (const raw of submission.lines ?? []) {
      const id = typeof raw?.id === 'string' ? raw.id : '';
      // An id the draft never offered is dropped rather than trusted.
      if (!id || seen.has(id) || !allowed.has(id)) continue;
      seen.add(id);
      const drafted = seal.l.vals[id] ?? {};
      const values: Record<string, FieldValue> = {};
      for (const [key, sealed] of Object.entries(seal.l.tpl)) {
        values[key] = acceptValue({ ...sealed, v: drafted[key] ?? sealed.v }, raw.values?.[key]);
      }
      lines.push({ id, values });
      if (lines.length >= seal.l.max) break;
    }
    if (lines.length < seal.l.min) {
      throw new ApprovalError(`This action needs at least ${seal.l.min} item${seal.l.min === 1 ? '' : 's'}. Add one and confirm again.`);
    }
  }

  const unanswered = Object.entries(seal.f).some(
    ([key, sealed]) => !sealed.opt && (sealed.t === 'select' || sealed.t === 'date') && !fields[key],
  );
  if (unanswered) throw new ApprovalError('One of the choices on the card is still empty. Pick a value and confirm again.');

  return { kind: seal.k, fields, lines };
}
