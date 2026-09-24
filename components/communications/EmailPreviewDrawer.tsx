'use client';

import { Drawer } from '@/components/shared/Drawer';

import type { EmailDelivery } from '@/lib/modules/communications/client';

/**
 * Email preview slide-over — renders an email the way an inbox would. It docks
 * over whatever opened it, so the template editor keeps its draft on screen
 * behind the preview instead of being replaced by it.
 */
export function EmailPreviewDrawer({
  title,
  description = 'Preview',
  subject,
  recipient,
  htmlBody,
  meta,
  note,
  actions,
  onClose,
}: {
  title: string;
  /** Sub-line in the drawer header — what kind of preview this is. */
  description?: string;
  subject: string;
  /** Shown under the subject in the inbox-style header. */
  recipient: React.ReactNode;
  htmlBody: string;
  /** Kept with the preview contract for test/debug surfaces; the inbox frame renders HTML. */
  textBody?: string | null;
  /** Detail block above the email (delivery status, timestamps…). */
  meta?: React.ReactNode;
  note?: React.ReactNode;
  /** Pinned in the footer (e.g. Edit template, Send test). */
  actions?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <Drawer title={title} description={description} onClose={onClose} className="max-w-3xl" footer={actions}>
      <div className="space-y-4">
        {meta}

        {/* The white frame is the email itself — it keeps light colours in either theme. */}
        <div className="overflow-hidden rounded-sm border border-rule bg-white shadow-sm">
          <div className="border-b border-gray-200 bg-gray-50 px-5 py-4 text-black">
            <p className="text-base font-semibold">{subject || 'Email subject'}</p>
            <p className="mt-1 text-xs text-gray-500">{recipient}</p>
          </div>
          <iframe title="Email preview" sandbox="" srcDoc={htmlBody} className="h-[calc(100dvh-17rem)] min-h-80 w-full border-0 bg-white" />
        </div>

        {note && <p className="text-center text-xs text-muted-foreground">{note}</p>}
      </div>
    </Drawer>
  );
}

/** Preview of one sent delivery — the exact email that went out. */
export function DeliveryPreviewDrawer({ delivery, onClose }: { delivery: EmailDelivery; onClose: () => void }) {
  return (
    <EmailPreviewDrawer
      description="Sent email"
      title={delivery.subject}
      subject={delivery.subject}
      recipient={`to ${delivery.toName ? `${delivery.toName} · ` : ''}${delivery.toEmail}`}
      htmlBody={delivery.htmlBody}
      onClose={onClose}
      note="This is the exact email that was sent — variables are already filled in."
    />
  );
}
