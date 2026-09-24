'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { AlertTriangle, Ban, CheckCircle2, Mail, Send, ShieldAlert } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { getEmailTemplates, sendEmail } from '@/lib/modules/communications/client';
import { getMarketingPreferences } from '@/lib/modules/customers/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

interface SendEmailModalProps {
  customerId?: string;
  orderId?: string;
  /** Who this is going to, in words. */
  recipientName: string;
  /** The address, when the caller knows it. Shown so it can be checked before sending. */
  recipientEmail?: string;
  onClose: () => void;
}

type Consent = 'opted_in' | 'opted_out' | 'suppressed' | 'unknown';

const CONSENT_COPY: Record<Exclude<Consent, 'unknown'>, { icon: typeof Mail; label: string; className: string }> = {
  opted_in: {
    icon: CheckCircle2,
    label: 'Opted in to marketing',
    className: 'border-momentum/30 bg-momentum/6 text-momentum',
  },
  opted_out: {
    icon: Ban,
    label: 'Opted out of marketing',
    className: 'border-warning/30 bg-warning/6 text-warning',
  },
  suppressed: {
    icon: ShieldAlert,
    label: 'Suppressed — do not contact',
    className: 'border-exception/30 bg-exception/8 text-exception',
  },
};

/**
 * Queue an email to a customer.
 *
 * The consent state is the new part, and it is not decoration. This dialog
 * previously let anyone queue a message to an address that had opted out or been
 * suppressed by an erasure, and the only feedback was a server error after the
 * fact. Now the state is named before the template is chosen: suppressed
 * addresses cannot be sent to at all, and an opt-out has to be acknowledged
 * deliberately — transactional mail is still legitimate, so this is a
 * checkpoint rather than a wall.
 */
export function SendEmailModal({ customerId, orderId, recipientName, recipientEmail, onClose }: SendEmailModalProps) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const [templateId, setTemplateId] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-templates', tenantId),
    queryFn: () => getEmailTemplates(tenantId ?? undefined),
    enabled: !!tenantId,
  });

  const { data: preferences, isLoading: consentLoading } = useQuery({
    queryKey: moduleQueryKeys.customers.key('marketing-preferences', customerId),
    queryFn: () => getMarketingPreferences(customerId!),
    enabled: !!customerId,
  });

  const consent: Consent = !customerId
    ? 'unknown'
    : consentLoading || !preferences
      ? 'unknown'
      : preferences.suppression
        ? 'suppressed'
        : preferences.marketingOptIn
          ? 'opted_in'
          : 'opted_out';

  const activeTemplates = templates.filter((template) => template.isActive);
  const effectiveTemplateId = activeTemplates.some((template) => template.id === templateId) ? templateId : (activeTemplates[0]?.id ?? '');
  const selected = activeTemplates.find((template) => template.id === effectiveTemplateId);

  const send = useMutation({
    mutationFn: () =>
      sendEmail({
        tenantId: tenantId ?? undefined,
        templateId: effectiveTemplateId,
        ...(customerId ? { customerId } : {}),
        ...(orderId ? { orderId } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moduleQueryKeys.communications.key('email-deliveries') });
      if (customerId) queryClient.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer-timeline', customerId) });
      toast('success', 'Email queued for delivery.');
      onClose();
    },
    onError: (error) => toast('error', error.message || 'The email wasn’t queued. Review it and try again.'),
  });

  const blocked = consent === 'suppressed';
  const needsAcknowledgement = consent === 'opted_out' && !acknowledged;
  const canSend = Boolean(effectiveTemplateId) && !isLoading && !send.isPending && !blocked && !needsAcknowledgement;

  return (
    <Modal
      title="Send email"
      description={`To ${recipientName}`}
      size="lg"
      onClose={onClose}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={send.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!canSend}
            onClick={() => send.mutate()}
            title={blocked ? 'This address is suppressed and cannot be emailed' : undefined}
          >
            <Send data-icon="inline-start" />
            {send.isPending ? 'Queueing…' : 'Queue email'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* ── Who, and whether you may ─────────────────────────────────── */}
        <div className="rounded-sm border border-rule bg-band/55 px-3 py-2.5">
          <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Recipient</p>
          <p className="mt-1 text-sm font-medium text-foreground">{recipientName}</p>
          {recipientEmail && <p className="truncate text-xs text-muted-foreground">{recipientEmail}</p>}
        </div>

        {consent !== 'unknown' && <ConsentNotice consent={consent} />}

        {consent === 'opted_out' && (
          <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-sm border border-warning/30 bg-warning/6 p-3 text-sm transition-colors hover:bg-warning/10">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span>
              <span className="block font-medium text-foreground">Send anyway — this is not marketing</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                An opt-out covers marketing. A receipt, a booking confirmation or a reply to their own question is still fine to send.
              </span>
            </span>
          </label>
        )}

        {/* ── What you are sending ─────────────────────────────────────── */}
        {activeTemplates.length ? (
          <>
            <div className="space-y-1.5">
              <label htmlFor="email-template" className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">
                Template
              </label>
              <Select
                id="email-template"
                value={effectiveTemplateId}
                onValueChange={setTemplateId}
                options={activeTemplates.map((template) => ({ value: template.id, label: template.name }))}
                ariaLabel="Email template"
                className="w-full"
                disabled={blocked}
              />
            </div>

            {selected && (
              <div className={cn('rounded-sm border border-rule bg-background p-3', blocked && 'opacity-50')}>
                <p className="text-xs font-semibold text-foreground">{selected.subject}</p>
                <iframe
                  title="Email template preview"
                  sandbox=""
                  srcDoc={selected.htmlBody}
                  className="mt-2.5 h-64 w-full rounded-sm border border-rule bg-white"
                />
                <p className="mt-2.5 text-xs text-muted-foreground">
                  This is the template, not the finished message — customer and order details are filled in when it is queued.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-sm border border-dashed border-rule p-6 text-center">
            <Mail className="mx-auto text-muted-foreground" size={22} aria-hidden="true" />
            <p className="mt-2 text-sm font-medium text-foreground">No active email templates</p>
            <p className="mt-1 text-xs text-muted-foreground">Create one in Communications before sending an email.</p>
          </div>
        )}
      </div>
    </Modal>
  );
}

function ConsentNotice({ consent }: { consent: Exclude<Consent, 'unknown'> }) {
  const { icon: Icon, label, className } = CONSENT_COPY[consent];

  return (
    <div
      className={cn('flex items-start gap-2.5 rounded-sm border px-3 py-2.5 text-sm', className)}
      role={consent === 'suppressed' ? 'alert' : undefined}
    >
      <Icon size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-semibold">{label}</p>
        {consent === 'suppressed' && (
          <p className="mt-0.5 text-xs">
            This address was suppressed — usually by a GDPR erasure or a hard bounce. Nothing can be sent to it, and that is deliberate.
          </p>
        )}
        {consent === 'opted_out' && (
          <p className="mt-0.5 text-xs">Marketing must not be sent. Tick below if this message is transactional.</p>
        )}
      </div>
      {consent === 'suppressed' && <AlertTriangle size={15} className="ml-auto mt-0.5 shrink-0" aria-hidden="true" />}
    </div>
  );
}
