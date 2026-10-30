import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { mascotSvg } from '@/lib/mascot/still';

/**
 * The marketing site's share card, drawn in code: the warm ground, the logo,
 * a headline in Archivo and the coloured domain lanes from DESIGN.md. The
 * root app/opengraph-image.tsx uses it with the site-wide line; a module or
 * blog page adds its own `opengraph-image.tsx` and passes its own title, so
 * every shared link says what it points at.
 *
 * Satori, which draws these, needs static TTFs — the `next/font` files are
 * not readable from here — so Archivo's two weights live in assets/fonts
 * (SIL Open Font License). Its CSS subset is flexbox only: every element with
 * more than one child must say `display: flex`.
 */

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = 'image/png';

// DESIGN.md light palette. The logo stays forest, as the static logo files do.
const C = {
  ground: '#f4f0e7',
  field: '#fffcf7',
  ink: '#20372d',
  ink2: '#5c6c63',
  gridMajor: '#d7cfc1',
  brand: '#1f6146',
  forest: '#174c38',
  onBrand: '#fffaf4',
  apricot: '#b84e2d',
  periwinkle: '#505fb8',
  green: '#2b7355',
  saffron: '#8a5b02',
};

const LANES = [
  { label: 'Sales', color: C.green, width: 280 },
  { label: 'Bookings', color: C.periwinkle, width: 230 },
  { label: 'Stock', color: C.saffron, width: 270 },
  { label: 'Team', color: C.apricot, width: 200 },
  { label: 'Content', color: C.brand, width: 250 },
];

const fonts = Promise.all([
  readFile(join(process.cwd(), 'assets/fonts/Archivo-Medium.ttf')),
  readFile(join(process.cwd(), 'assets/fonts/Archivo-SemiBold.ttf')),
]);

function LogoMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="36" height="36" rx="7" fill={C.forest} />
      <path
        d="M31 25.3125C31 28.4536 28.4579 30.9999 25.3219 31L10.315 30.9993C3.71595 30.9995 3.03058 21.3436 9.56316 20.4087L18.6342 19.7697C22.4213 19.2276 23.249 14.118 19.8273 12.4044C16.1443 10.5599 17.4547 4.99982 21.5725 4.99982H26.0425C28.7805 4.99982 31 7.22298 31 9.96541V25.3125Z"
        fill="white"
      />
      <path
        d="M14.7773 15.9697C14.7773 14.4017 16.0485 13.126 17.6165 13.126C19.1845 13.126 20.4556 14.4017 20.4556 15.9697C20.4556 17.5377 19.1845 18.8135 17.6165 18.8135C16.0485 18.8135 14.7773 17.5377 14.7773 15.9697Z"
        fill="white"
      />
      <path
        d="M5.04297 7.97795C5.04297 6.33381 6.37581 5.00098 8.01994 5.00098H18.833L18.5072 5.21855C16.2036 6.75677 15.9644 10.0526 18.0218 11.9072L7.74162 10.9419C6.21204 10.7983 5.04297 9.51426 5.04297 7.97795Z"
        fill="white"
      />
    </svg>
  );
}

export async function renderOgImage({ eyebrow, title }: { eyebrow: string; title: string }) {
  const [medium, semibold] = await fonts;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          backgroundColor: C.ground,
          // The plot-field grid of BrandBackdrop, at its major step.
          backgroundImage: `linear-gradient(${C.gridMajor}66 1px, transparent 1px), linear-gradient(90deg, ${C.gridMajor}66 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          fontFamily: 'Archivo',
          color: C.ink,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', width: 720 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <LogoMark size={60} />
            <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em' }}>DUMA</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: C.ink2 }}>{eyebrow}</div>
            <div style={{ marginTop: 18, fontSize: 64, fontWeight: 600, lineHeight: 1.06, letterSpacing: '-0.03em' }}>{title}</div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex', padding: '10px 20px', borderRadius: 8, backgroundColor: C.brand, color: C.onBrand, fontSize: 24, fontWeight: 600 }}>Free to use</div>
            <div style={{ fontSize: 24, fontWeight: 500, color: C.ink2 }}>duma-business.com</div>
          </div>
        </div>

        {/* The domain lanes: one workspace, every part of the business side by side. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 22,
            position: 'absolute',
            right: 64,
            top: 96,
            bottom: 96,
            width: 360,
            padding: '0 32px',
            borderRadius: 14,
            border: `1px solid ${C.gridMajor}`,
            backgroundColor: C.field,
            boxShadow: '0 18px 40px rgba(32, 55, 45, 0.10)',
          }}
        >
          {LANES.map((lane) => (
            <div key={lane.label} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 600, color: C.ink2 }}>{lane.label}</div>
              <div style={{ display: 'flex', width: lane.width, height: 14, borderRadius: 7, backgroundColor: lane.color }} />
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Archivo', data: medium, style: 'normal', weight: 500 },
        { name: 'Archivo', data: semibold, style: 'normal', weight: 600 },
      ],
    },
  );
}

/** Long titles stop at a word, so the card never runs past three lines. */
export function cardTitle(title: string, max = 110) {
  const clean = title.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20)).replace(/[\s,;:.–—-]+$/, '')}…`;
}

/**
 * The share card for an entry, after seline.com's blog card: the logo, then
 * "DUMA · Blog" — the brand in ink, the label in grey — the title under it,
 * and the mascot rising from the bottom-right corner. Drawn for DUMA's own
 * posts (/blog/[slug]/og) and generated from the CMS editor for any entry.
 *
 * `brand` is DUMA for every workspace until workspaces have a logo of their
 * own; the name and the mark change together then.
 */
export async function renderShareCard({ brand = 'DUMA', label, title }: { brand?: string; label: string; title: string }) {
  const [medium, semibold] = await fonts;
  const mascot = `data:image/svg+xml;base64,${Buffer.from(mascotSvg({ size: 420, ink: C.forest })).toString('base64')}`;

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', backgroundColor: '#ffffff', fontFamily: 'Archivo', color: '#0a0a0a' }}>
        <div style={{ display: 'flex', flexDirection: 'column', padding: '64px 0 0 72px', width: 760 }}>
          <LogoMark size={72} />
          <div style={{ display: 'flex', alignItems: 'baseline', marginTop: 112, fontSize: 68, fontWeight: 600, letterSpacing: '-0.03em' }}>
            <span>{brand}</span>
            <span style={{ margin: '0 18px', color: '#c4c4c4' }}>·</span>
            <span style={{ color: '#c4c4c4' }}>{label}</span>
          </div>
          <div style={{ display: 'flex', marginTop: 26, fontSize: 38, fontWeight: 500, lineHeight: 1.32, letterSpacing: '-0.01em', color: '#6b6b6b' }}>{cardTitle(title)}</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori draws <img>, not next/image. */}
        <img src={mascot} width={420} height={420} alt="" style={{ position: 'absolute', right: 56, bottom: -150 }} />
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Archivo', data: medium, style: 'normal', weight: 500 },
        { name: 'Archivo', data: semibold, style: 'normal', weight: 600 },
      ],
    },
  );
}
