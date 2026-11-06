/**
 * Which network printers the till may talk to.
 *
 * A business types its printer's address in Settings. The address is kept
 * with this browser's till (localStorage) and mirrored into a cookie, so the
 * proxy can name exactly those origins in this browser's CSP `connect-src`
 * (proxy.ts). The cookie is the browser's own claim, so it is held to the same
 * rule as the address field: HTTPS on a local network only. A tampered cookie
 * can never open the policy to a public host.
 */

export const PRINTER_COOKIE = 'duma-till-printers';
/** One browser drives a handful of tills at most; the cap keeps the header small. */
export const MAX_PRINTER_ORIGINS = 8;

const PRIVATE_SUFFIXES = ['.local', '.lan', '.home.arpa', '.internal'];

/** Private-network hosts only: RFC 1918 and link-local IPv4, unique-local IPv6, local names. */
export function isLocalNetworkHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (ipv4.slice(1).some((part) => Number(part) > 255)) return false;
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
  }
  if (host.startsWith('[')) return /^\[f[cd][0-9a-f]{0,2}:/.test(host);
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(host)) return false;
  return !host.includes('.') || PRIVATE_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * A typed or pasted printer address as the origin the till will call, or null.
 * Accepts "192.168.1.20", "printer.local:8043", or a URL copied from the
 * printer's own web page ("http://192.168.1.20/webconfig/") — only the origin
 * is kept, and a portless http:// address is taken as its https:// one.
 * Refuses credentials, other schemes and anything off the local network.
 */
export function normalisePrinterAddress(input: string): string | null {
  let value = input.trim();
  if (!value) return null;
  const scheme = value.match(/^([a-z][a-z0-9+.-]*):\/\//i)?.[1]?.toLowerCase();
  if (scheme === 'http') {
    // A port names a specific plain-HTTP service, so there is no https twin to assume.
    if (/^http:\/\/(\[[^\]]+\]|[^/?#:@]+):\d/i.test(value)) return null;
    value = `https${value.slice(4)}`;
  } else if (scheme && scheme !== 'https') return null;
  try {
    const url = new URL(/^https:\/\//i.test(value) ? value : `https://${value}`);
    if (url.username || url.password) return null;
    if (/[*%]/.test(url.hostname) || !isLocalNetworkHost(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** A comma-separated list (the cookie) as exact origins: anything not already a clean origin is dropped. */
export function parsePrinterOrigins(value: string): string[] {
  const origins = value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => /^https:\/\//i.test(entry) && normalisePrinterAddress(entry) === entry.replace(/\/$/, ''))
    .map((entry) => entry.replace(/\/$/, ''));
  return [...new Set(origins)].slice(0, MAX_PRINTER_ORIGINS);
}

export function epsonEndpoint(origin: string, deviceId: string): string {
  if (!origin || normalisePrinterAddress(origin) !== origin)
    throw new Error('Enter the printer’s HTTPS address on your local network, such as 192.168.1.20.');
  if (typeof deviceId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(deviceId)) throw new Error('Enter a valid printer device ID.');
  const endpoint = new URL('/cgi-bin/epos/service.cgi', origin);
  endpoint.searchParams.set('devid', deviceId);
  endpoint.searchParams.set('timeout', '10000');
  return endpoint.href;
}
