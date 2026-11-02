import { authMd } from '@/lib/marketing/auth-md';

/** /auth.md — how an AI agent gets credentials for DUMA. See lib/marketing/auth-md.ts. */
export function GET() {
  return new Response(authMd(), { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
