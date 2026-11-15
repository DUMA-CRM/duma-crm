/* The opening row and its facts moved to `components/shared/DetailRow` once a
   second screen (privacy requests) needed them; re-exported for this folder. */
export { DetailRow, Facts } from '@/components/shared/DetailRow';

/** How long a create button shows its "done" tick before the secret takes over. */
export const DONE_BEAT_MS = 650;
