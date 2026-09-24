import { describeProviders } from '@/lib/ai/agent-provider.server';
import { getMyStaffProfile } from '@/lib/modules/identity/client';

export const runtime = 'nodejs';

/**
 * The models Ask DUMA can answer with, so Settings can offer a real choice
 * rather than two hard-coded names that may not be configured on this
 * deployment.
 *
 * Returns ids and model names only — never a key, and nothing derived from one.
 * It still needs a session: which models a deployment runs on is infrastructure
 * detail, not public copy.
 */
export async function GET(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  if (!cookieHeader) return Response.json({ message: 'Your session has expired. Sign in again.' }, { status: 401 });

  try {
    const profile = await getMyStaffProfile(cookieHeader);
    if (!profile) return Response.json({ message: 'Your session has expired. Sign in again.' }, { status: 401 });
  } catch {
    return Response.json({ message: 'Could not confirm your session.' }, { status: 401 });
  }

  return Response.json({ providers: describeProviders() }, { headers: { 'Cache-Control': 'no-store' } });
}
