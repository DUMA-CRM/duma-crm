import { NextRequest } from 'next/server';

import { MARKDOWN_RENDER_HEADER, estimateTokens, htmlToMarkdown, servesMarkdown } from '@/lib/utils/markdown-for-agents';

/**
 * The Markdown version of a public page, for agents that ask for
 * `Accept: text/markdown`. proxy.ts rewrites those requests from /<page> to
 * /md/<page>; this fetches the page's own HTML from this origin and converts
 * it (lib/utils/markdown-for-agents.ts). Requested directly, /md is behind the
 * sign-in redirect like any other app path.
 */
// Params typed by hand: Next's global `RouteContext` exists only after `next dev`/`next build`
// generates it, and CI type-checks before building.
export async function GET(req: NextRequest, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const pageUrl = new URL(`/${path.join('/')}${req.nextUrl.search}`, req.nextUrl.origin);
  if (!servesMarkdown(pageUrl.pathname)) {
    return new Response('Not found\n', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  // The header tells the proxy this is the conversion's own fetch, so it serves HTML whatever Accept says.
  const page = await fetch(pageUrl, { headers: { Accept: 'text/html', [MARKDOWN_RENDER_HEADER]: '1' }, redirect: 'manual' });

  // A redirect is passed on as it is: the agent follows it and negotiates again.
  if (page.status >= 300 && page.status < 400) {
    return new Response(null, { status: page.status, headers: { Location: page.headers.get('Location') ?? '/', Vary: 'Accept' } });
  }

  const markdown = htmlToMarkdown(await page.text(), pageUrl.href);
  return new Response(markdown, {
    status: page.status,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Cache-Control': page.ok ? 'public, max-age=3600' : 'no-store',
      Vary: 'Accept',
      'x-markdown-tokens': String(estimateTokens(markdown)),
    },
  });
}
