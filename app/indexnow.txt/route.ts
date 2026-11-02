import { isIndexNowKey } from '@/lib/utils/indexnow';

/**
 * The IndexNow key file. Search engines fetch it to confirm a submission came
 * from this site; served at the root so it vouches for every URL here. See
 * lib/utils/indexnow.ts. Without INDEXNOW_KEY there is nothing to confirm.
 */
export function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!isIndexNowKey(key)) return new Response('Not found\n', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  return new Response(key, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
