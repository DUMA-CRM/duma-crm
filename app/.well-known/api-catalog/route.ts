import { apiCatalog } from '@/lib/marketing/api-catalog';

/** /.well-known/api-catalog — the public APIs as an RFC 9727 linkset. See lib/marketing/api-catalog.ts. */
export function GET() {
  return new Response(JSON.stringify(apiCatalog(), null, 2), {
    headers: { 'Content-Type': 'application/linkset+json; profile="https://www.rfc-editor.org/info/rfc9727"', 'Cache-Control': 'public, max-age=3600' },
  });
}
