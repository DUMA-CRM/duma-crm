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
