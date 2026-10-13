import { CSP_IMAGE_HOSTS, viaApiProxy } from './image-src.ts';

// An email's images live in two places at once: in the recipient's inbox, which
// needs an absolute public address, and in this app's editor, whose CSP only
// loads images from this origin and a fixed list (proxy.ts). These helpers keep
// the two apart.

/**
 * The address an email should carry for a media-library image: absolute, since
 * an inbox has no origin to resolve a path against. An API built without
 * PUBLIC_API_URL writes its delivery paths relative; they get the API's origin.
 */
export function emailImageUrl(url: string, apiOrigin: string): string {
  if (url.startsWith('/') && !url.startsWith('//')) return `${apiOrigin.replace(/\/$/, '')}${url}`;
  return url;
}

/**
 * Where the editor can load an email image from, or null when the CSP would
 * refuse it — any external host. A Media image (an API delivery URL) goes
 * through the `/be` proxy. Null means "show a placeholder", never "broken".
 */
export function previewImageSrc(
  url: string | null | undefined,
  apiOrigin: string,
  prefix: string,
  allowedHosts: readonly string[] = CSP_IMAGE_HOSTS,
): string | null {
  const src = viaApiProxy(url?.trim(), apiOrigin, prefix);
  if (!src) return null;
  if (/^(data|blob):/i.test(src)) return src;
  if (src.startsWith('/') && !src.startsWith('//')) return src;
  try {
    const parsed = new URL(src);
    return parsed.protocol === 'https:' && allowedHosts.includes(parsed.host) ? src : null;
  } catch {
    return null;
  }
}

/** The host to name on a placeholder: "images.example.com". */
export function imageHost(url: string): string | null {
  try {
    return new URL(url).host || null;
  } catch {
    return null;
  }
}

/** A grey frame with an image glyph, as a data URI — the one image source the CSP always allows. */
export const IMAGE_PLACEHOLDER_SRC = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 240">' +
    '<rect width="600" height="240" fill="#f3f1ed"/>' +
    '<g fill="none" stroke="#a8a29a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="264" y="84" width="72" height="60" rx="8"/>' +
    '<circle cx="286" cy="104" r="7"/>' +
    '<path d="m336 128-18-18-40 34"/>' +
    '</g>' +
    '<text x="300" y="178" text-anchor="middle" font-family="system-ui,sans-serif" font-size="16" fill="#8a847c">Image shows in the inbox</text>' +
    '</svg>',
)}`;

const decodeAttribute = (value: string) =>
  value.replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
const encodeAttribute = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

/**
 * The email HTML as the editor's preview frame should draw it: each `<img>`
 * the CSP would block swapped for a placeholder, and each Media image sent
 * through `/be`. Only for showing — the HTML that is saved and sent keeps the
 * real addresses.
 */
export function previewEmailHtml(html: string, toPreviewSrc: (url: string) => string | null): string {
  return html.replace(/<img\b[^>]*>/gi, (tag) =>
    tag.replace(/\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i, (_whole, _value, double, single, bare) => {
      const url = decodeAttribute(double ?? single ?? bare ?? '');
      return ` src="${encodeAttribute(toPreviewSrc(url) ?? IMAGE_PLACEHOLDER_SRC)}"`;
    }),
  );
}
