/** A post's or destination's status, in words, and the badge that says whether anyone needs to act. */

const WORDS: Record<string, string> = {
  'needs-reconciliation': 'Needs checking',
  'partially published': 'Partly published',
};

export const marketingStatusLabel = (status: string) => WORDS[status] ?? status.charAt(0).toUpperCase() + status.slice(1);

export const marketingStatusBadge = (status: string) =>
  status === 'published'
    ? ('success' as const)
    : ['failed', 'needs-reconciliation', 'blocked'].includes(status)
      ? ('warning' as const)
      : ('muted' as const);

const WAITING = ['draft', 'scheduled', 'processing', 'uploading'];

export interface DestinationSummary {
  total: number;
  published: number;
  /** Failed, blocked or unconfirmed: someone has to act. */
  attention: number;
  /** Not out yet and nothing wrong. */
  waiting: number;
  cancelled: number;
  /** The soonest destination still to go out, if any is scheduled after `now`. */
  nextAt: string | null;
}

/** Where a post's destinations stand, for the bar and facts at the top of its drawer. */
export function destinationSummary(targets: { status: string; scheduledAt: string | null }[], now: number): DestinationSummary {
  const summary: DestinationSummary = { total: targets.length, published: 0, attention: 0, waiting: 0, cancelled: 0, nextAt: null };
  for (const t of targets) {
    if (t.status === 'published') summary.published++;
    else if (t.status === 'cancelled') summary.cancelled++;
    else if (marketingStatusBadge(t.status) === 'warning') summary.attention++;
    else summary.waiting++;
    if (WAITING.includes(t.status) && t.scheduledAt && Date.parse(t.scheduledAt) > now) {
      if (!summary.nextAt || Date.parse(t.scheduledAt) < Date.parse(summary.nextAt)) summary.nextAt = t.scheduledAt;
    }
  }
  return summary;
}

export type StepState = 'done' | 'current' | 'todo' | 'stopped';
export interface DestinationStep {
  key: 'scheduled' | 'uploading' | 'processing' | 'published';
  label: string;
  state: StepState;
  /** When the step was reached, when known. */
  at: string | null;
}
export interface DestinationTimeline {
  steps: DestinationStep[];
  /** The clock beside the current step: counting down to the send, or up since the step began. */
  clock: { mode: 'until' | 'since'; at: string } | null;
}

const STEPS: [DestinationStep['key'], string][] = [
  ['scheduled', 'Scheduled'],
  ['uploading', 'Sending'],
  ['processing', 'Processing'],
  ['published', 'Published'],
];

/**
 * A destination's way out as four steps — scheduled, sending, processing,
 * published — from its status and its publishing attempts. The worker records
 * outcomes, not starts, so "sending" is timed from the scheduled time (or the
 * last attempt, on a retry) and "processing" from the first of the latest run
 * of processing checks. A failure stops the step it happened in.
 */
export function destinationTimeline(
  target: { status: string; scheduledAt: string | null },
  attempts: { status: string; createdAt: string }[],
  now: number,
): DestinationTimeline {
  const log = [...attempts].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const last = log.at(-1);
  let run: string | null = null;
  for (let i = log.length - 1; i >= 0 && log[i]!.status === 'processing'; i--) run = log[i]!.createdAt;
  const processed = log.some((a) => a.status === 'processing');
  const steps = STEPS.map(([key, label]): DestinationStep => ({ key, label, state: 'todo', at: null }));
  const upTo = (n: number) => steps.slice(0, n).forEach((s) => (s.state = 'done'));
  steps[0]!.at = target.scheduledAt;
  const { status } = target;

  if (status === 'draft') {
    steps[0] = { ...steps[0]!, label: 'Draft', state: 'current' };
    return { steps, clock: null };
  }
  if (status === 'scheduled') {
    steps[0]!.state = 'current';
    const due = target.scheduledAt;
    return { steps, clock: due ? { mode: Date.parse(due) > now ? 'until' : 'since', at: due } : null };
  }
  if (status === 'uploading') {
    upTo(1);
    steps[1]!.state = 'current';
    const began = last && target.scheduledAt && Date.parse(last.createdAt) > Date.parse(target.scheduledAt) ? last.createdAt : target.scheduledAt;
    return { steps, clock: began ? { mode: 'since', at: began } : null };
  }
  if (status === 'processing') {
    upTo(2);
    steps[2]!.state = 'current';
    steps[2]!.at = run;
    return { steps, clock: run ? { mode: 'since', at: run } : null };
  }
  if (status === 'published') {
    upTo(4);
    steps[2]!.at = log.find((a) => a.status === 'processing')?.createdAt ?? null;
    steps[3]!.at = log.findLast((a) => a.status === 'published')?.createdAt ?? null;
    return { steps, clock: null };
  }
  // Failed, blocked, unconfirmed or cancelled: it stopped in processing if it got there, else while sending.
  const stop = processed ? 2 : 1;
  upTo(stop);
  steps[stop] = { ...steps[stop]!, label: marketingStatusLabel(status), state: 'stopped', at: last?.createdAt ?? null };
  return { steps, clock: null };
}

/** A span of time in words: "45 s", "3 min", "1 h 5 min", "2 d 4 h". */
export function durationLabel(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

/**
 * Whether a post can be deleted from DUMA, as the API decides: never while a
 * destination is being sent or processed, and past a draft only with
 * publishing permission.
 */
export function canDeletePost(targets: { status: string }[], canPublish: boolean): boolean {
  if (targets.some((t) => t.status === 'uploading' || t.status === 'processing')) return false;
  return canPublish || targets.every((t) => t.status === 'draft');
}
