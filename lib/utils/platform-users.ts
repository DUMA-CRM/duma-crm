import type { PlatformUser } from '@/lib/api/platform.service';

/** What a better-auth provider id is called on screen. */
export function signInMethodLabel(providerId: string): string {
  if (providerId === 'credential') return 'Password';
  if (providerId === 'google') return 'Google';
  return providerId.charAt(0).toUpperCase() + providerId.slice(1);
}

/** "Chrome on macOS" from a user-agent string — enough to recognise a device, never more. */
export function describeDevice(userAgent: string | null): { label: string; mobile: boolean } {
  if (!userAgent) return { label: 'Unknown device', mobile: false };
  const ua = userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\/|Opera/.test(ua) ? 'Opera'
      : /Firefox\//.test(ua) ? 'Firefox'
        : /Chrome\//.test(ua) ? 'Chrome'
          : /Safari\//.test(ua) ? 'Safari'
            : /node|undici|curl|python|okhttp/i.test(ua) ? 'An API client'
              : null;
  const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
      : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
        : /Windows/.test(ua) ? 'Windows'
          : /CrOS/.test(ua) ? 'ChromeOS'
            : /Linux/.test(ua) ? 'Linux'
              : null;
  const mobile = /Mobi|iPhone|Android/.test(ua);
  if (browser && os) return { label: `${browser} on ${os}`, mobile };
  return { label: browser ?? os ?? 'Unknown device', mobile };
}

export type AccountStatus = { label: string; tone: 'success' | 'warning' | 'destructive' | 'muted' };

/**
 * One status per account, most serious first: a suspension outranks a staff
 * deactivation, which outranks an invite not yet accepted.
 */
export function accountStatus(user: Pick<PlatformUser, 'suspendedAt' | 'memberActive' | 'activationPending'>): AccountStatus {
  if (user.suspendedAt) return { label: 'Suspended', tone: 'destructive' };
  if (user.memberActive === false) return { label: 'Deactivated', tone: 'muted' };
  if (user.activationPending) return { label: 'Invited', tone: 'warning' };
  return { label: 'Active', tone: 'success' };
}
