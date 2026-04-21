// Auth service — Single Responsibility: auth operations only.
//
// Uses better-auth's standard REST endpoints.
// The server sets/clears the session cookie automatically — we never touch
// tokens directly, which keeps the client XSS-safe.

import { apiFetch } from './client';

// ---------------------------------------------------------------------------
// Types — mirrors what better-auth returns on the server.
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
}

export interface AuthSession {
  user: User;
  session: Session;
}

// ---------------------------------------------------------------------------
// Auth operations
// ---------------------------------------------------------------------------

// Sign in with email + password.
// On success the server sets the `better-auth.session_token` cookie.
export async function signIn(email: string, password: string): Promise<AuthSession> {
  return apiFetch<AuthSession>('/auth/sign-in/email', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

// Sign out — the server clears the session cookie.
export async function signOut(): Promise<void> {
  return apiFetch<void>('/auth/sign-out', { method: 'POST' });
}

// Get the current session.
// Pass `cookieHeader` when calling from a Server Component so the session
// cookie is forwarded to the API (browsers do this automatically).
// Returns null if the session is missing or expired.
export async function getSession(cookieHeader?: string): Promise<AuthSession | null> {
  try {
    return await apiFetch<AuthSession>('/auth/get-session', { cookieHeader });
  } catch {
    // Any error (401, network, etc.) means no valid session.
    return null;
  }
}
