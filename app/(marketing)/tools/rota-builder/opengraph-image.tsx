import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/marketing/og-image';

// The rota builder's own share card, so a shared link says what it opens.
export const alt = 'Free staff rota builder, ready to print — DUMA';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({ eyebrow: 'Free tool', title: 'Staff rota builder, ready to print.' });
}
