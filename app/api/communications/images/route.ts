import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

import { hasCapability } from '@/lib/auth/capabilities';
import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

import { isUuid, readCappedBody } from '../../_lib/request-guards';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const safeSegment = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || 'image';

export async function POST(request: Request) {
  const profile = await getCurrentStaffProfile();
  if (!profile) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  // The capability that saves an email template — the only place these images go.
  if (!hasCapability(profile, 'email:write')) {
    return NextResponse.json({ error: 'You do not have permission to edit communications.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId')?.trim();
  if (!isUuid(tenantId)) return NextResponse.json({ error: 'A workspace is required.' }, { status: 400 });
  // A role says nothing about which workspace: `super_admin` is a workspace
  // role now, and platform authority is `platform` (duma-api platform-identity).
  if (!profile.platform && profile.tenantId !== tenantId) {
    return NextResponse.json({ error: 'You cannot upload images for this workspace.' }, { status: 403 });
  }

  const contentType = request.headers.get('content-type')?.split(';')[0] ?? '';
  if (!ACCEPTED_IMAGE_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'Use a PNG, JPG, WebP, or GIF image.' }, { status: 415 });
  }
  const body = await readCappedBody(request, MAX_IMAGE_BYTES);
  if (!body.ok && body.reason === 'too-large') return NextResponse.json({ error: 'Images must be 5 MB or smaller.' }, { status: 413 });
  if (!body.ok) return NextResponse.json({ error: 'The image is empty.' }, { status: 400 });
  const bytes = body.bytes;

  try {
    const blob = await put(`communications/${safeSegment(tenantId)}/${safeSegment(searchParams.get('filename') ?? 'image')}`, bytes, {
      access: 'public',
      addRandomSuffix: true,
      contentType,
    });
    return NextResponse.json({ url: blob.url, pathname: blob.pathname });
  } catch (error) {
    console.error('Communication image upload failed', error);
    return NextResponse.json({ error: 'The image could not be uploaded.' }, { status: 500 });
  }
}
