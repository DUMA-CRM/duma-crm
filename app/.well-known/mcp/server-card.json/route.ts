import { mcpServerCard } from '@/lib/marketing/mcp-server-card';

/** /.well-known/mcp/server-card.json — the DUMA MCP server's card. See lib/marketing/mcp-server-card.ts. */
export function GET() {
  return Response.json(mcpServerCard(), { headers: { 'Cache-Control': 'public, max-age=3600', 'Access-Control-Allow-Origin': '*' } });
}
