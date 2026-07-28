'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Send } from 'lucide-react';
import { useState } from 'react';

import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { getEmailTemplates, sendEmail } from '@/lib/api/email.service';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

interface SendEmailModalProps {
  customerId?: string;
  orderId?: string;
  recipientLabel: string;
  onClose: () => void;
}

export function SendEmailModal({ customerId, orderId, recipientLabel, onClose }: SendEmailModalProps) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const [templateId, setTemplateId] = useState('');
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates', tenantId],
    queryFn: () => getEmailTemplates(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const activeTemplates = templates.filter((template) => template.isActive);
  const effectiveTemplateId = activeTemplates.some((template) => template.id === templateId)
    ? templateId
    : (activeTemplates[0]?.id ?? '');
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
      queryClient.invalidateQueries({ queryKey: ['email-deliveries'] });
      toast('success', 'Email queued for delivery.');
      onClose();
    },
    onError: (error) => toast('error', error.message || 'Could not queue the email.'),
  });

  return (
    <Modal title="Send email" onClose={onClose} className="max-w-xl">
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-surface-offset/50 p-3">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recipient</p>
          <p className="mt-1 text-sm font-medium text-foreground">{recipientLabel}</p>
        </div>

        {activeTemplates.length ? (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Template</label>
              <Select
                value={effectiveTemplateId}
                onValueChange={setTemplateId}
                options={activeTemplates.map((template) => ({ value: template.id, label: template.name }))}
                ariaLabel="Email template"
                className="w-full"
              />
            </div>
            {selected && (
              <div className="rounded-xl border border-border bg-background p-4">
                <p className="text-xs font-semibold text-foreground">{selected.subject}</p>
                <iframe
                  title="Email template preview"
                  sandbox=""
                  srcDoc={selected.htmlBody}
                  className="mt-3 h-64 w-full rounded-lg border border-border bg-white"
                />
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Variables such as customer and order details are resolved when the message is queued.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center">
            <Mail className="mx-auto text-muted-foreground" size={22} />
            <p className="mt-2 text-sm font-medium">No active email templates</p>
            <p className="mt-1 text-xs text-muted-foreground">Create one in Communications before sending an email.</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!effectiveTemplateId || isLoading || send.isPending} onClick={() => send.mutate()}>
            <Send />
            {send.isPending ? 'Queueing…' : 'Queue email'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
