/**
 * The outside hosts this app's CSP lets images load from (proxy.ts `img-src`).
 * Mirrors `images.remotePatterns` in next.config.ts — change both together.
 */
export const CSP_IMAGE_HOSTS: readonly string[] = [
  'mdm-assets.integration.costacoffee.com',
  'duma-coffee.vercel.app',
  // Media storage: a workspace's Content assets redirect from /v1/cms/delivery to
  // its Vercel Blob store, whose subdomain is per store — so a wildcard.
  '*.public.blob.vercel-storage.com',
];

/** Whether an image host is on the list — exact, or under a `*.` entry (one level or more, as CSP matches). */
export function isAllowedImageHost(host: string, hosts: readonly string[] = CSP_IMAGE_HOSTS): boolean {
  const name = host.toLowerCase();
  return hosts.some((entry) => (entry.startsWith('*.') ? name.endsWith(entry.slice(1)) && name.length > entry.length - 1 : name === entry));
}

/**
 * An image address the browser may load on this app's pages.
 *
 * The CSP allows images from this origin (and a fixed list), not from the
 * API's own domain — so an API address (an asset served by
 * /v1/cms/delivery/…, a product's main photo) is rewritten through the `/be`
 * proxy, the way every other API call goes. Anything else is left as it is.
 */
export function viaApiProxy(url: string | null | undefined, apiOrigin: string, prefix: string): string | null {
  if (!url) return null;
  const origin = apiOrigin.replace(/\/$/, '');
  if (origin && url.startsWith(`${origin}/`)) return `${prefix}${url.slice(origin.length)}`;
  // An API built without PUBLIC_API_URL writes its own paths relative.
  if (url.startsWith('/v1/')) return `${prefix}${url}`;
  return url;
}

/**
 * The address to store for a media-library image picked for a record (an
 * inventory item's photo): the API's keyless delivery path for the asset.
 *
 * Not `asset.url` — for a bucket with its own public URL that points at the
 * tenant's CDN, which this app's CSP refuses. The delivery path works for
 * every storage backend, goes through `/be` via `viaApiProxy`, and never
 * goes stale: an asset's file does not change under the same id.
 */
export function mediaImagePath(asset: { id: string; fileName: string }): string {
  return `/v1/cms/delivery/assets/${encodeURIComponent(asset.id)}/file/${encodeURIComponent(asset.fileName)}`;
}
