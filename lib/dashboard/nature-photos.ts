/**
 * The Nature photo widget's curated set: calm landscapes, one a day, served from
 * `public/dashboard/nature/` so the CSP's `img-src` needn't open to another host.
 *
 * Add a photo by saving it there (webp, about 1600px wide) and listing it here
 * with its photographer and the page it came from — Unsplash's licence doesn't
 * require credit, but the widget gives it. With the list empty the widget stays
 * out of the gallery.
 */
export interface NaturePhoto {
  /** Under `/dashboard/nature/`. */
  file: string;
  alt: string;
  photographer: string;
  /** The photo's page, for the credit link. */
  source: string;
}

export const NATURE_PHOTOS: readonly NaturePhoto[] = [];
