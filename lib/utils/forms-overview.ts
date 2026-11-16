import { type FormStanding, type FormStatus, formStanding } from './forms.ts';

/**
 * The Forms list's arithmetic: which view a form falls in, the list a search
 * and the filters leave, and the four figures above it. Kept out of the
 * component so the rules (a full or past-its-date form is "closed", archived
 * forms count for nothing) are pinned by a test.
 */

/** What the list shows: the forms in use, one standing, or the archive. */
export type FormsView = 'current' | 'live' | 'draft' | 'closed' | 'archived';

export const FORMS_VIEW_LABELS: Record<FormsView, string> = {
  current: 'Current',
  live: 'Live',
  draft: 'Drafts',
  closed: 'Closed',
  archived: 'Archived',
};

/** Taking responses (with or without a closing date) is live; closed by hand, past its date or full is closed. */
const VIEW_OF: Record<FormStanding, Exclude<FormsView, 'current'>> = {
  live: 'live',
  scheduled_close: 'live',
  draft: 'draft',
  closed: 'closed',
  ended: 'closed',
  full: 'closed',
  archived: 'archived',
};

export interface FormsListRow {
  name: string;
  status: FormStatus;
  closesAt: string | null;
  responseLimit: number | null;
  responseCount: number;
  newResponses: number;
  lastResponseAt: string | null;
}

export function inFormsView(form: FormsListRow, view: FormsView, now: number): boolean {
  if (view === 'current') return form.status !== 'archived';
  return VIEW_OF[formStanding(form, now)] === view;
}

/** The forms a view, the "new responses only" switch and a name search leave, in the order given. */
export function filterForms<T extends FormsListRow>(
  forms: readonly T[],
  { view, onlyNew, search }: { view: FormsView; onlyNew: boolean; search: string },
  now: number,
): T[] {
  const needle = search.trim().toLowerCase();
  return forms.filter(
    (form) => inFormsView(form, view, now) && (!onlyNew || form.newResponses > 0) && (!needle || form.name.toLowerCase().includes(needle)),
  );
}

/** The figures over the list. Archived forms are out of use, so none of them count. */
export function formsOverview(forms: readonly FormsListRow[], now: number) {
  const current = forms.filter((form) => form.status !== 'archived');
  let live = 0;
  let fresh = 0;
  let total = 0;
  let waiting = 0;
  let lastResponseAt: string | null = null;
  for (const form of current) {
    if (VIEW_OF[formStanding(form, now)] === 'live') live += 1;
    fresh += form.newResponses;
    total += form.responseCount;
    if (form.newResponses > 0) waiting += 1;
    if (form.lastResponseAt && (!lastResponseAt || Date.parse(form.lastResponseAt) > Date.parse(lastResponseAt)))
      lastResponseAt = form.lastResponseAt;
  }
  return { current: current.length, live, fresh, waiting, total, lastResponseAt };
}

const DAY = 86_400_000;

/**
 * Every day from the first response to the last — at most the last `span`
 * days — with the quiet ones as zeros, so a gap shows as a gap rather than
 * vanishing from the chart. Dates are the API's `YYYY-MM-DD` workspace days.
 */
export function fillResponseDays(byDay: readonly { date: string; total: number }[], span = 60): { date: string; total: number }[] {
  if (byDay.length === 0) return [];
  const totals = new Map(byDay.map((day) => [day.date, day.total]));
  const end = Date.parse(`${byDay.at(-1)!.date}T00:00:00Z`);
  const start = Math.max(Date.parse(`${byDay[0]!.date}T00:00:00Z`), end - (span - 1) * DAY);
  const out: { date: string; total: number }[] = [];
  for (let at = start; at <= end; at += DAY) {
    const date = new Date(at).toISOString().slice(0, 10);
    out.push({ date, total: totals.get(date) ?? 0 });
  }
  return out;
}
