import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/marketing/og-image';

// The calculator's own share card, so a shared link says what it opens.
export const alt = 'Free cash-up calculator for your till — DUMA';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({ eyebrow: 'Free tool', title: 'Cash-up calculator: over, short, and what to bank.' });
}
