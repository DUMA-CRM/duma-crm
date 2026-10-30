/**
 * Every product screenshot the marketing site shows, keyed by what it is.
 *
 * A screenshot is a file at `public/marketing/screenshots/<file>`. Until the
 * file exists its frame shows a labelled placeholder, so dropping the PNG in
 * is the whole job — no code change, no rebuild of this list.
 *
 * Capture: light theme, demo data only (no real customer names), at 2× —
 * 2880 × 1800 for `browser` (a 1440 × 900 window), 780 × 1688 for `phone`
 * (390 × 844). Frames crop from the top, so a taller full-page shot works too;
 * keep what matters in the first screenful.
 */

export type ScreenshotFrame = 'browser' | 'phone';

export type Screenshot = {
  file: string;
  frame: ScreenshotFrame;
  /** Describes what the image shows, for screen readers and image search. */
  alt: string;
  /** Shown in the browser frame's address bar. */
  url?: string;
};

export const SCREENSHOT_DIR = '/marketing/screenshots';

export const SCREENSHOTS = {
  dashboard: { file: 'dashboard.png', frame: 'browser', url: 'duma-business.com/dashboard', alt: "The DUMA dashboard: today's sales, orders and the team on shift" },
  pos: { file: 'pos.png', frame: 'browser', url: 'duma-business.com/pos', alt: 'The DUMA till with an order in progress' },
  qrOrdering: { file: 'qr-ordering.png', frame: 'phone', alt: "A customer ordering from a business's menu on their phone" },
  products: { file: 'products.png', frame: 'browser', url: 'duma-business.com/menu', alt: 'A product in DUMA with its price, recipe and margin' },
  inventory: { file: 'inventory.png', frame: 'browser', url: 'duma-business.com/inventory', alt: 'Stock levels in DUMA with low-stock items flagged' },
  bookings: { file: 'bookings.png', frame: 'browser', url: 'duma-business.com/reservations', alt: "A day's bookings in the DUMA calendar" },
  rota: { file: 'rota.png', frame: 'browser', url: 'duma-business.com/staff', alt: "A week's staff rota in DUMA" },
  orders: { file: 'orders.png', frame: 'browser', url: 'duma-business.com/orders', alt: 'Every order from every channel in one DUMA list' },
  customers: { file: 'customers.png', frame: 'browser', url: 'duma-business.com/customers', alt: 'A customer profile in DUMA with visits and spend' },
  content: { file: 'content.png', frame: 'browser', url: 'duma-business.com/content', alt: 'Editing a website page in the DUMA content editor' },
  kitchen: { file: 'kitchen.png', frame: 'browser', url: 'duma-business.com/kds', alt: 'Orders on the DUMA kitchen display' },
} as const satisfies Record<string, Screenshot>;

export type ScreenshotKey = keyof typeof SCREENSHOTS;

export function screenshotSrc(key: ScreenshotKey): string {
  return `${SCREENSHOT_DIR}/${SCREENSHOTS[key].file}`;
}
