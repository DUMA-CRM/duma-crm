// What a customer card says about someone at a glance — kept here so it is testable.

const DAY_MS = 86_400_000;

export type VisitTone = 'active' | 'lapsed' | 'never' | 'idle';

/**
 * Green within 30 days, grey up to 60, "Lapsed" after that (the
 * list's own win-back threshold), or "Never visited".
 */
export function visitStatus(lastVisitAt: string | null | undefined, now: number): { tone: VisitTone; label: string } {
  if (!lastVisitAt) return { tone: 'never', label: 'Never visited' };
  const days = Math.max(0, Math.floor((now - Date.parse(lastVisitAt)) / DAY_MS));
  const ago = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  if (days <= 30) return { tone: 'active', label: days === 0 ? 'In today' : `Visited ${ago}` };
  if (days <= 60) return { tone: 'idle', label: `Visited ${ago}` };
  return { tone: 'lapsed', label: `Lapsed · last in ${days} days ago` };
}

/** Birthday falls in the current month — the moment a birthday email makes sense. */
export function birthdayThisMonth(dob: string | null | undefined, now: number): boolean {
  if (!dob) return false;
  const month = Number(dob.slice(5, 7));
  return month === new Date(now).getMonth() + 1;
}

/**
 * Days until their next birthday, by the local calendar — 0 on the day. A 29
 * February birthday falls on the 28th in other years. Null without a date.
 */
export function daysUntilBirthday(dob: string | null | undefined, now: number): number | null {
  if (!dob || !/^\d{4}-\d{2}-\d{2}/.test(dob)) return null;
  const month = Number(dob.slice(5, 7)) - 1;
  const day = Number(dob.slice(8, 10));
  const today = new Date(now);
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const on = (year: number) => {
    const leap = new Date(year, 1, 29).getMonth() === 1;
    return new Date(year, month, month === 1 && day === 29 && !leap ? 28 : day);
  };
  let next = on(start.getFullYear());
  if (next < start) next = on(start.getFullYear() + 1);
  return Math.round((next.getTime() - start.getTime()) / 86_400_000);
}

/** "Birthday today", "Birthday tomorrow", "Birthday in 12 days" — or null when it is more than a month off. */
export function birthdayHint(days: number | null): string | null {
  if (days === null || days > 31) return null;
  if (days === 0) return 'Birthday today';
  if (days === 1) return 'Birthday tomorrow';
  return `Birthday in ${days} days`;
}

/** "Tree nuts, Milk" or "Tree nuts, Milk +2" — named, so staff don't have to open the record. */
export function allergySummary(allergies: readonly string[] | null | undefined, max = 2): string | null {
  if (!allergies?.length) return null;
  const words = allergies.map((allergy) => {
    const text = allergy.replaceAll('_', ' ');
    return text.charAt(0).toUpperCase() + text.slice(1);
  });
  return words.length > max ? `${words.slice(0, max).join(', ')} +${words.length - max}` : words.join(', ');
}
