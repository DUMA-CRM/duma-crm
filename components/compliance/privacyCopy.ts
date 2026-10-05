import { Ban, Download, Eye, type IconComponent, Pause, Pencil, ShieldCheck, Trash2 } from '@/components/icons';

import type { PrivacyRequest, PrivacyRequestStatus, PrivacyRequestType } from '@/lib/modules/compliance/client';

/**
 * Privacy requests in the words a business owner uses. The legal names
 * ("rectification", "restriction of processing") stay available for the
 * record, but the queue leads with what the person actually asked for.
 */
export const REQUEST_TYPES: Record<PrivacyRequestType, { label: string; legal: string; detail: string; icon: IconComponent }> = {
  access: { label: 'A copy of their data', legal: 'Access request', detail: 'They want to see what you hold about them.', icon: Eye },
  portability: {
    label: 'Their data to take elsewhere',
    legal: 'Data portability',
    detail: 'A copy in a format another service can use.',
    icon: Download,
  },
  erasure: { label: 'Delete their data', legal: 'Erasure', detail: 'Remove their personal details for good.', icon: Trash2 },
  rectification: { label: 'Correct their data', legal: 'Rectification', detail: 'Something you hold about them is wrong.', icon: Pencil },
  restriction: {
    label: 'Pause using their data',
    legal: 'Restriction of processing',
    detail: 'Keep it, but stop using it for now.',
    icon: Pause,
  },
  objection: { label: 'Stop one use of their data', legal: 'Objection', detail: 'Often marketing — stop that one use.', icon: Ban },
};

export const TYPE_ORDER: PrivacyRequestType[] = ['access', 'erasure', 'rectification', 'portability', 'restriction', 'objection'];

export const CHANNELS = [
  { value: 'in_person', label: 'In person' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone' },
  { value: 'web', label: 'Website' },
  { value: 'staff', label: 'Noted by staff' },
];

export const channelLabel = (value: string) => CHANNELS.find((option) => option.value === value)?.label ?? value.replaceAll('_', ' ');

export const STATUS: Record<PrivacyRequestStatus, { label: string; tone: 'muted' | 'primary' | 'warning' | 'success' }> = {
  received: { label: 'New', tone: 'warning' },
  in_progress: { label: 'Working on it', tone: 'primary' },
  awaiting_identity: { label: 'Waiting for ID', tone: 'warning' },
  completed: { label: 'Completed', tone: 'success' },
  declined: { label: 'Declined', tone: 'muted' },
};

/** The steps a request can be moved between before it is closed. */
export const WORKING_STATUSES: Exclude<PrivacyRequestStatus, 'completed' | 'declined'>[] = ['received', 'in_progress', 'awaiting_identity'];

export function subjectName(request: PrivacyRequest): string | null {
  if (request.customer) return `${request.customer.firstName} ${request.customer.lastName}`.trim();
  return request.customerSnapshot?.name ?? request.employeeSnapshot?.name ?? null;
}

/** Where the person's own record lives, when they still have one. */
export function subjectHref(request: PrivacyRequest): string | null {
  if (request.subjectType === 'customer' && request.customerId) return `/customers/${request.customerId}`;
  if (request.subjectType === 'employee' && request.employeeUserId) return `/staff/${request.employeeUserId}`;
  return null;
}

/** A type the API added after this list was written still reads as words, not a crash. */
export function requestType(type: string | null | undefined) {
  return (
    REQUEST_TYPES[type as PrivacyRequestType] ?? {
      label: type ? type.replaceAll('_', ' ').replace(/^./, (first) => first.toUpperCase()) : 'Privacy request',
      legal: type ?? 'Unknown type',
      detail: '',
      icon: ShieldCheck,
    }
  );
}

export function requestStatus(status: string | null | undefined) {
  return STATUS[status as PrivacyRequestStatus] ?? { label: status ? status.replaceAll('_', ' ') : 'Unknown', tone: 'muted' as const };
}
