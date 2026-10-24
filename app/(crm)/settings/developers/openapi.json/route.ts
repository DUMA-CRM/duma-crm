import source from '@/openapi.json';
import { requireAnyCapability } from '@/lib/auth/require-capability';
import { integrationSpec } from '@/lib/developers/integration-spec';

export async function GET() {
  await requireAnyCapability('settings:write', 'cms.keys:write');
  return Response.json(integrationSpec(source, process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7777'), {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
