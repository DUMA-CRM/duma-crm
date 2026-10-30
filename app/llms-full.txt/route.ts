import { llmsText } from '@/lib/blog/llms';

/** /llms-full.txt — /llms.txt plus the full text of every published post. See lib/blog/llms.ts. */
export async function GET() {
  return new Response(await llmsText(true), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
