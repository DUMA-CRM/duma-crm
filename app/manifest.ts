import type { MetadataRoute } from 'next';

// Makes the app installable on shop tablets (Add to Home Screen) so the POS
// and Barista Display run as a standalone full-screen app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DUMA',
    short_name: 'DUMA',
    description: 'Run your café, restaurant or shop: till, orders, stock, staff and customers.',
    start_url: '/dashboard',
    display: 'standalone',
    // Must track the token layer by hand — a manifest cannot read a CSS var.
    // ground (--ground) and the forest shell (--sidebar), so the splash and the
    // tablet's system chrome match the app instead of the old default blue.
    background_color: '#f4f0e7',
    theme_color: '#163832',
    // Chrome's installability check wants explicit 192/512 sizes; SVG scales
    // to whatever size is declared, so the same file serves all entries.
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
