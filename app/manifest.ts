import type { MetadataRoute } from 'next';

// Makes the app installable on shop tablets (Add to Home Screen) so the POS
// and Barista Display run as a standalone full-screen app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DUMA Coffee CRM',
    short_name: 'DUMA',
    description: 'All-in-one coffee shop management — POS, orders, inventory, staff.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f7f5f0',
    theme_color: '#e8590c',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-maskable.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
