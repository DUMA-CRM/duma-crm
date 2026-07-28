'use client';

import { useState } from 'react';

import { EditorShell } from '@/components/shared/EditorShell';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Badge } from '@/components/ui/badge';

import type { EmailDelivery } from '@/lib/api/email.service';

import { deliveryBadge, labelClass } from './shared';

const PREVIEW_WIDTHS = [
  { value: 'desktop' as const, label: 'Desktop' },
  { value: 'mobile' as const, label: 'Mobile' },
];

/**
 * Full-page email preview — renders an email the way an inbox would, at desktop
 * or phone width. Used for template drafts (opened from the editor, which stays
 * mounted so the draft survives coming back) and for sent deliveries.
 */
export function EmailPreviewPage({
  eyebrow = 'Preview',
  title,
  subject,
  recipient,
  htmlBody,
  textBody,
  meta,
  note,
  actions,
  onClose,
}: {
  eyebrow?: string;
  title: string;
  subject: string;
  /** Shown under the subject in the inbox-style header. */
  recipient: React.ReactNode;
  htmlBody: string;
  /** When present, a Plain text tab shows the fallback recipients may see instead. */
  textBody?: string | null;
  /** Detail block above the email (delivery status, timestamps…). */
  meta?: React.ReactNode;
  note?: React.ReactNode;
  actions?: React.ReactNode;
  onClose: () => void;
}) {
  const [width, setWidth] = useState<'desktop' | 'mobile'>('desktop');
  const [format, setFormat] = useState<'html' | 'text'>('html');
  const hasText = Boolean(textBody?.trim());

  return (
    <EditorShell
      eyebrow={eyebrow}
      title={title}
      onClose={onClose}
      actions={
        <>
          {hasText && (
            <SegmentedControl
              options={[
                { value: 'html', label: 'Design' },
                { value: 'text', label: 'Plain text' },
              ]}
              value={format}
              onChange={setFormat}
            />
          )}
          {format === 'html' && <SegmentedControl options={PREVIEW_WIDTHS} value={width} onChange={setWidth} />}
          {actions}
        </>
      }
    >
      <div className="space-y-4">
        {meta}
        <div className="mx-auto w-full transition-[max-width] duration-200" style={{ maxWidth: width === 'mobile' ? 380 : 720 }}>
          <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
            {/* Inbox-style header */}
            <div className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-black">
              <p className="text-base font-semibold">{subject || 'Email subject'}</p>
              <p className="mt-1 text-xs text-gray-500">{recipient}</p>
            </div>
            {format === 'text' ? (
              <pre className="h-[calc(100vh-var(--header-height)-19rem)] min-h-96 w-full overflow-auto whitespace-pre-wrap bg-white p-5 font-mono text-xs text-black">
                {textBody}
              </pre>
            ) : (
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={htmlBody}
                className="h-[calc(100vh-var(--header-height)-19rem)] min-h-96 w-full border-0 bg-white"
              />
            )}
          </div>
          {note && <p className="mt-3 text-center text-xs text-muted-foreground">{note}</p>}
        </div>
      </div>
    </EditorShell>
  );
}

/** Full-page preview of one delivery, with its delivery details above the email. */
export function DeliveryPreviewPage({ delivery, onClose }: { delivery: EmailDelivery; onClose: () => void }) {
  return (
    <EmailPreviewPage
      eyebrow="Sent email"
      title={delivery.subject}
      subject={delivery.subject}
      recipient={`to ${delivery.toName ? `${delivery.toName} · ` : ''}${delivery.toEmail}`}
      htmlBody={delivery.htmlBody}
      textBody={delivery.textBody}
      onClose={onClose}
      note="This is the exact email that was sent — variables are already filled in."
      meta={
        <div className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className={labelClass}>Recipient</p>
            <p className="mt-1 text-sm font-medium text-foreground">
              {delivery.toName ? `${delivery.toName} · ` : ''}
              {delivery.toEmail}
            </p>
          </div>
          <div>
            <p className={labelClass}>Status</p>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={deliveryBadge[delivery.status]}>{delivery.status}</Badge>
              <span className="text-xs text-muted-foreground">
                attempt {delivery.attemptCount}/{delivery.maxAttempts}
              </span>
            </div>
          </div>
          <div>
            <p className={labelClass}>Created</p>
            <p className="mt-1 text-sm text-foreground">{new Date(delivery.createdAt).toLocaleString('en-GB')}</p>
          </div>
          <div>
            <p className={labelClass}>{delivery.sentAt ? 'Sent' : 'Template'}</p>
            <p className="mt-1 text-sm text-foreground">
              {delivery.sentAt
                ? new Date(delivery.sentAt).toLocaleString('en-GB')
                : (delivery.template?.name ?? delivery.trigger.replaceAll('_', ' '))}
            </p>
          </div>
          {delivery.lastError && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 sm:col-span-2 lg:col-span-4">
              <p className={labelClass}>Why it failed</p>
              <p className="mt-1 text-sm text-destructive">{delivery.lastError}</p>
            </div>
          )}
        </div>
      }
    />
  );
}
