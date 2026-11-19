/* The DUMA cat, as stickers: hand-drawn moments that make a screen feel looked
   after. Each is for one kind of moment, named for that moment, so a screen
   asks for "welcome", not for a file. The animated hexagon stays Ask DUMA's
   face and the empty states'; the cat marks the moments around the work:
   arriving, getting set up, looking into the figures, the day done well,
   something gone wrong, the first box of stock.

   Adding one: drop the drawing in public/stickers/, run `pnpm stickers`, then
   add it here. */

export const STICKERS = {
  /** Waving hello: arriving, first run, before the doors open. */
  welcome: { src: '/stickers/web/welcome.png', alt: 'The DUMA cat waving hello' },
  /** At the laptop: the day under way, something being set up. */
  working: { src: '/stickers/web/working.png', alt: 'The DUMA cat typing on a laptop' },
  /** Magnifier on a chart: looking into the figures, a slow day being watched. */
  analytics: { src: '/stickers/web/analytics.png', alt: 'The DUMA cat studying a chart' },
  /** Cheering in confetti: a real win as it happens — a target hit, a count finished. Keep it rare. */
  celebration: { src: '/stickers/web/celebration.png', alt: 'The DUMA cat cheering in confetti' },
  /** Holding a thank-you sign: a day closed well, a till balanced. */
  thanks: { src: '/stickers/web/thanks.png', alt: 'The DUMA cat holding a thank-you sign' },
  /** Sitting quietly: nothing here, a page that isn't. */
  cat: { src: '/stickers/web/cat.png', alt: 'The DUMA cat sitting quietly' },
  /** Peering into an empty box: there is data, but the search or filters hide it all. */
  searching: { src: '/stickers/web/searching_box.png', alt: 'The DUMA cat peering into an empty box' },
  /** Coffee in paw, clock behind: a break under way. */
  break: { src: '/stickers/web/break.png', alt: 'The DUMA cat on a coffee break' },
  /** Curled up asleep: closed for the day, signed out after a while away. */
  sleeping: { src: '/stickers/web/sleeping.png', alt: 'The DUMA cat asleep on a cushion' },
  /** Puzzled at the laptop with a warning: something didn't load or broke. */
  error: { src: '/stickers/web/error.png', alt: 'The DUMA cat puzzled by an error on its laptop' },
  /** Carrying a box: stock, deliveries and transfers, before the first one. */
  inventory: { src: '/stickers/web/inventory.png', alt: 'The DUMA cat carrying a box' },
} as const;

export type StickerId = keyof typeof STICKERS;
