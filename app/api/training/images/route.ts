import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

import { getCurrentStaffProfile } from '@/lib/auth/current-staff';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MANAGER_ROLES = new Set(['super_admin', 'franchise_owner', 'store_manager', 'hr_manager']);
const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const safeSegment = (value: string) => value
  .normalize('NFKD')
  .replace(/[^a-zA-Z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 100) || 'image';

export async function POST(request: Request) {
  const profile = await getCurrentStaffProfile();
  if (!profile) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  if (!MANAGER_ROLES.has(profile.role)) return NextResponse.json({ error: 'You do not have permission to edit training.' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const requestedTenantId = searchParams.get('tenantId')?.trim();
  if (!requestedTenantId) return NextResponse.json({ error: 'A workspace is required.' }, { status: 400 });
  if (profile.role !== 'super_admin' && profile.tenantId !== requestedTenantId) {
    return NextResponse.json({ error: 'You cannot upload images for this workspace.' }, { status: 403 });
  }

  const contentType = request.headers.get('content-type')?.split(';')[0] ?? '';
  if (!ACCEPTED_IMAGE_TYPES.has(contentType)) {
    return NextResponse.json({ error: 'Use a PNG, JPG, or WebP image.' }, { status: 415 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Images must be 4 MB or smaller.' }, { status: 413 });

  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return NextResponse.json({ error: 'The image is empty.' }, { status: 400 });
  if (bytes.byteLength > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Images must be 4 MB or smaller.' }, { status: 413 });

  const filename = safeSegment(searchParams.get('filename') ?? 'screenshot');
  const courseId = safeSegment(searchParams.get('courseId') ?? 'drafts');
  try {
    const blob = await put(`training/${safeSegment(requestedTenantId)}/${courseId}/${filename}`, bytes, {
      access: 'public',
      addRandomSuffix: true,
      contentType,
    });
    return NextResponse.json({ url: blob.url, pathname: blob.pathname });
  } catch (error) {
    console.error('Training image upload failed', error);
    return NextResponse.json({ error: 'The image could not be uploaded.' }, { status: 500 });
  }
}
