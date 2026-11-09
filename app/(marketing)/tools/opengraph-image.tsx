import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/marketing/og-image';

// The tools index's own share card, so a shared link says what it opens.
export const alt = 'Free tools for cafés, restaurants and shops — DUMA';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({ eyebrow: 'Free tools', title: 'Calculators for the numbers that matter.' });
}
