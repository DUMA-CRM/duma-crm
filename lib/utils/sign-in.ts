/**
 * Where to land after signing in. Honours `?next=` from the auth guard only
 * when it resolves to this origin — anything else is an open redirect.
 */
export function signInDestination(next: string | null, origin: string): string {
  if (!next?.startsWith('/')) return '/dashboard';
  try {
    const target = new URL(next, origin);
    if (target.origin === origin) return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    // Keep the dashboard as the safe fallback for malformed destinations.
  }
  return '/dashboard';
}

/**
 * What to say when Google sends someone back to /sign-in with `?error=CODE`.
 * Codes are better-auth's OAuth callback errors (see duma-api lib/auth.ts).
 */
export function googleSignInError(code: string | null): string | null {
  switch (code) {
    case null:
    case '':
      return null;
    case 'access_denied':
      return 'Google sign-in was cancelled.';
    // Sign-up through Google is disabled: access is by invitation only.
    case 'signup_disabled':
      return 'There’s no DUMA account for that Google address. Ask your manager for an invite, or create a workspace.';
    // A login with this address exists but its own email isn't confirmed yet.
    case 'account_not_linked':
      return 'Sign in with your password and confirm your email address first — then Google sign-in will work.';
    case 'state_mismatch':
    case 'please_restart_the_process':
    case 'invalid_code':
    case 'no_code':
      return 'Google sign-in timed out. Try again.';
    default:
      return 'Google sign-in didn’t work. Try again, or use your email and password.';
  }
}
