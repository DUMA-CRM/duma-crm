/**
 * How DUMA Updates' editor words a post: where it stands, what still stops it
 * saving, and who it reaches. Pure, so the editor stays thin.
 */

import type { UpdateContent, UpdateDraft } from '@/lib/api/updates.service';

export type UpdateStatusTone = 'muted' | 'reference' | 'warning' | 'success';

/** Draft until published; Scheduled while its time is ahead; then Published, or Unpublished changes once the draft moves on. */
export function updateStatus(
  row: Pick<UpdateDraft, 'publishedAt' | 'draft' | 'published'>,
  now: number = Date.now(),
): { label: string; tone: UpdateStatusTone } {
  if (!row.publishedAt) return { label: 'Draft', tone: 'muted' };
  if (Date.parse(row.publishedAt) > now) return { label: 'Scheduled', tone: 'reference' };
  if (JSON.stringify(row.draft) !== JSON.stringify(row.published)) return { label: 'Unpublished changes', tone: 'warning' };
  return { label: 'Published', tone: 'success' };
}

/** What stops a draft saving: the three required parts, and a button with a label but no link (or the reverse). */
export function updateDraftCheck(draft: UpdateContent): { missing: string[]; buttonIncomplete: boolean; valid: boolean } {
  const missing = [
    !draft.title.trim() && 'Title',
    !draft.summary.trim() && 'Summary',
    !draft.body.trim() && 'What changed',
  ].filter((part): part is string => Boolean(part));
  const buttonIncomplete = Boolean(draft.actionLabel.trim()) !== Boolean(draft.actionUrl.trim());
  return { missing, buttonIncomplete, valid: missing.length === 0 && !buttonIncomplete };
}

/** "store_manager" / "qr-ordering" → "Store manager" / "Qr ordering". */
export function humanName(value: string): string {
  const words = value.replaceAll('_', ' ').replaceAll('-', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A filter in words: "Everyone" when empty, the names when one or two, a count beyond that. */
export function audienceLabel(selected: readonly string[], everyone = 'Everyone'): string {
  if (selected.length === 0) return everyone;
  if (selected.length <= 2) return selected.map(humanName).join(', ');
  return `${selected.length} selected`;
}
