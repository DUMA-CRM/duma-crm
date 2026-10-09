import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

import { hasCapability } from '@/lib/auth/capabilities';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

// ---------------------------------------------------------------------------
// POST /api/notes/images — a picture pasted or dropped into a note. Anyone who
// can write notes may add one (unlike Communications' manager-only upload).
// Stored in the workspace's blob folder; the note keeps the URL. Images
// arrive already re-encoded by the browser (UI-ADR-024).
// ---------------------------------------------------------------------------

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACCEPTED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const safeSegment = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'image';

export async function POST(request: Request) {
  const profile = await getCurrentStaffProfile().catch(() => null);
  if (!profile) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!hasCapability(profile, 'notes:write')) return NextResponse.json({ error: 'You can’t add images to notes.' }, { status: 403 });
  const tenantId = profile.tenantId;
  if (!tenantId) return NextResponse.json({ error: 'Choose a workspace first.' }, { status: 400 });

  const contentType = request.headers.get('content-type')?.split(';')[0] ?? '';
  if (!ACCEPTED.has(contentType)) return NextResponse.json({ error: 'Use a PNG, JPG, WebP or GIF image.' }, { status: 415 });
  const declared = Number(request.headers.get('content-length') ?? 0);
  if (declared > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Images must be 8 MB or smaller.' }, { status: 413 });
  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return NextResponse.json({ error: 'The image is empty.' }, { status: 400 });
  if (bytes.byteLength > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Images must be 8 MB or smaller.' }, { status: 413 });

  const filename = new URL(request.url).searchParams.get('filename') ?? 'image';
  try {
    const blob = await put(`notes/${safeSegment(tenantId)}/${safeSegment(filename)}`, bytes, {
      access: 'public',
      addRandomSuffix: true,
      contentType,
    });
    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('Note image upload failed', error);
    return NextResponse.json({ error: 'The image could not be uploaded.' }, { status: 500 });
  }
}
