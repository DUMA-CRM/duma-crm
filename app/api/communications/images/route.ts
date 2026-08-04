import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MANAGER_ROLES = new Set(['super_admin', 'franchise_owner', 'store_manager', 'marketing_manager']);
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
  if (!MANAGER_ROLES.has(profile.role)) {
    return NextResponse.json({ error: 'You do not have permission to edit communications.' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const tenantId = searchParams.get('tenantId')?.trim();
  if (!tenantId) return NextResponse.json({ error: 'A workspace is required.' }, { status: 400 });
  if (profile.role !== 'super_admin' && profile.tenantId !== tenantId) {
    return NextResponse.json({ error: 'You cannot upload images for this workspace.' }, { status: 403 });
  }

  const contentType = request.headers.get('content-type')?.split(';')[0] ?? '';
  if (!ACCEPTED_IMAGE_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'Use a PNG, JPG, WebP, or GIF image.' }, { status: 415 });
  }
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Images must be 5 MB or smaller.' }, { status: 413 });

  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return NextResponse.json({ error: 'The image is empty.' }, { status: 400 });
  if (bytes.byteLength > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Images must be 5 MB or smaller.' }, { status: 413 });

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
