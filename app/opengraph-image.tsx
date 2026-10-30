import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/marketing/og-image';

// The site-wide share card. File-based metadata outranks the `metadata`
// objects, so this is what every route shares until a segment adds its own.
export const alt = 'DUMA — run your whole business from one workspace. Free to use.';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOgImage({ eyebrow: 'The business OS', title: 'Run your whole business from one workspace.' });
}
