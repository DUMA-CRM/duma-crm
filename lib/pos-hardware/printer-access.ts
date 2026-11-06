import { MAX_PRINTER_ORIGINS, PRINTER_COOKIE, parsePrinterOrigins } from './network-policy';

/**
 * The printer origins this page's CSP allows: the cookie as it was when the
 * document loaded. Read once, before anything here can rewrite the cookie —
 * the till hardware store imports this module, so it is evaluated first.
 */
const PAGE_ORIGINS: readonly string[] = typeof document === 'undefined' ? [] : readCookie();

function readCookie(): string[] {
  const raw = document.cookie
    .split('; ')
    .find((part) => part.startsWith(`${PRINTER_COOKIE}=`))
    ?.slice(PRINTER_COOKIE.length + 1);
  if (!raw) return [];
  try {
    return parsePrinterOrigins(decodeURIComponent(raw));
  } catch {
    return [];
  }
}

/** Whether a fetch to this printer will pass this page's CSP. */
export function printerReachableNow(origin: string): boolean {
  return PAGE_ORIGINS.includes(origin);
}

/**
 * Tell the proxy which printers this browser's tills use, for the next page
 * load's CSP. Returns whether that differs from what this page allows.
 */
export function rememberPrinterOrigins(origins: readonly (string | undefined)[]): boolean {
  if (typeof document === 'undefined') return false;
  const list = parsePrinterOrigins(origins.filter(Boolean).join(',')).slice(0, MAX_PRINTER_ORIGINS);
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = list.length
    ? `${PRINTER_COOKIE}=${encodeURIComponent(list.join(','))}; Path=/; Max-Age=34560000; SameSite=Lax${secure}`
    : `${PRINTER_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
  return list.some((origin) => !PAGE_ORIGINS.includes(origin));
}
