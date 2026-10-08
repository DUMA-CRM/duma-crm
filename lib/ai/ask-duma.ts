/**
 * Open Ask DUMA from anywhere with a question already typed — a dashboard
 * tile, an empty state. It is filled in, not sent: the person reads it,
 * changes it if they like, and presses Enter, so nothing is spent unasked.
 */
export const ASK_DUMA_EVENT = 'duma:ask';

export interface AskDumaDetail {
  prompt: string;
}

export function askDuma(prompt: string) {
  window.dispatchEvent(new CustomEvent<AskDumaDetail>(ASK_DUMA_EVENT, { detail: { prompt } }));
}
