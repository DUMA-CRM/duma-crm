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
    // Google itself has not verified this address, so DUMA won't link it.
    case 'account_not_linked':
      return 'Google hasn’t verified that address, so it can’t be used to sign in. Use your email and password.';
    // A suspended account (DUMA Admin) cannot be linked or signed into.
    case 'unable_to_link_account':
      return 'That account can’t be signed into with Google. Contact DUMA support.';
    case 'state_mismatch':
    case 'please_restart_the_process':
    case 'invalid_code':
    case 'no_code':
      return 'Google sign-in timed out. Try again.';
    default:
      return 'Google sign-in didn’t work. Try again, or use your email and password.';
  }
}

/**
 * What to say when connecting Google from Settings → Security comes back with
 * `?error=CODE` (better-auth's link callback errors).
 */
export function googleLinkError(code: string | null): string | null {
  switch (code) {
    case null:
    case '':
      return null;
    case 'access_denied':
      return 'Connecting Google was cancelled.';
    case 'account_already_linked_to_different_user':
      return 'That Google account already signs in to another DUMA account. Disconnect it there first.';
    case 'unable_to_link_account':
      return 'Google hasn’t verified that address, so it can’t be connected.';
    case 'state_mismatch':
    case 'please_restart_the_process':
    case 'invalid_code':
    case 'no_code':
      return 'Connecting Google timed out. Try again.';
    default:
      return 'Google couldn’t be connected. Try again.';
  }
}
