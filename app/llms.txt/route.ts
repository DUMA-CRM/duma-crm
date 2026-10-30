import { llmsText } from '@/lib/blog/llms';

/** /llms.txt — a plain-text map of the site for AI assistants (llmstxt.org). See lib/blog/llms.ts. */
export async function GET() {
  return new Response(await llmsText(false), { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
}
