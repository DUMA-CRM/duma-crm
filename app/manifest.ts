import type { MetadataRoute } from 'next';

// Makes the app installable on shop tablets (Add to Home Screen) so the POS
// and Barista Display run as a standalone full-screen app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DUMA — All in one business app',
    short_name: 'DUMA',
    description: 'All-in-one coffee shop management — POS, orders, inventory, staff.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f7f5f0',
    theme_color: '#e8590c',
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
