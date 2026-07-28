import { apiFetch } from './client';

export type EmailSecurity = 'tls' | 'starttls' | 'none';
export type EmailTrigger =
  | 'manual'
  | 'order_created'
  | 'order_ready'
  | 'order_completed'
  | 'order_cancelled'
  | 'customer_created'
  | 'customer_birthday'
  | 'customer_inactive';
export type EmailDeliveryStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'cancelled';

export interface EmailConnection {
  id: string;
  tenantId: string;
  host: string;
  port: number;
  security: EmailSecurity;
  username: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string | null;
  isEnabled: boolean;
  hasPassword: boolean;
  lastTestedAt?: string | null;
  lastTestSucceeded?: boolean | null;
  lastTestError?: string | null;
}

export interface EmailConnectionPayload {
  tenantId?: string;
  host: string;
  port: number;
  security: EmailSecurity;
  username: string;
  password?: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string | null;
  isEnabled: boolean;
}

export interface EmailTemplate {
  id: string;
  tenantId: string;
  name: string;
  category: string;
  subject: string;
  htmlBody: string;
  textBody?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EmailTemplatePayload = Omit<EmailTemplate, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'> & { tenantId?: string };

export interface EmailAutomation {
  id: string;
  tenantId: string;
  templateId: string;
  locationId?: string | null;
  name: string;
  trigger: Exclude<EmailTrigger, 'manual'>;
  offsetDays: number;
  timezone: string;
  isEnabled: boolean;
  lastEvaluatedAt?: string | null;
  template?: Pick<EmailTemplate, 'id' | 'name'>;
  location?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export type EmailAutomationPayload = Pick<EmailAutomation, 'templateId' | 'name' | 'trigger' | 'offsetDays' | 'timezone' | 'isEnabled'> & {
  tenantId?: string;
  locationId?: string | null;
};

export interface EmailDelivery {
  id: string;
  tenantId: string;
  templateId?: string | null;
  automationId?: string | null;
  customerId?: string | null;
  orderId?: string | null;
  trigger: EmailTrigger;
  status: EmailDeliveryStatus;
  toEmail: string;
  toName?: string | null;
  subject: string;
  htmlBody: string;
  textBody?: string | null;
  attemptCount: number;
  maxAttempts: number;
  sentAt?: string | null;
  providerMessageId?: string | null;
  lastError?: string | null;
  createdAt: string;
  template?: Pick<EmailTemplate, 'id' | 'name'> | null;
  customer?: { id: string; firstName: string; lastName: string } | null;
}

export interface EmailDeliveriesResponse {
  data: EmailDelivery[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

const tenantQuery = (tenantId?: string) => (tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '');

export const getEmailConnection = (tenantId?: string) => apiFetch<EmailConnection | null>(`/email/connection${tenantQuery(tenantId)}`);
export const saveEmailConnection = (data: EmailConnectionPayload) =>
  apiFetch<EmailConnection>('/email/connection', { method: 'PUT', body: JSON.stringify(data) });
export const testEmailConnection = (data: { tenantId?: string; toEmail?: string }) =>
  apiFetch<{ ok: boolean; testedAt: string; error?: string }>('/email/connection/test', {
    method: 'POST',
    body: JSON.stringify(data),
  });

export const getEmailVariables = () => apiFetch<string[]>('/email/variables');
export const getEmailTemplates = (tenantId?: string) => apiFetch<EmailTemplate[]>(`/email/templates${tenantQuery(tenantId)}`);
export const createEmailTemplate = (data: EmailTemplatePayload) =>
  apiFetch<EmailTemplate>('/email/templates', { method: 'POST', body: JSON.stringify(data) });
export const updateEmailTemplate = (id: string, data: Partial<EmailTemplatePayload>) =>
  apiFetch<EmailTemplate>(`/email/templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const archiveEmailTemplate = (id: string, tenantId?: string) =>
  apiFetch<EmailTemplate>(`/email/templates/${id}${tenantQuery(tenantId)}`, { method: 'DELETE' });

export const getEmailAutomations = (tenantId?: string) => apiFetch<EmailAutomation[]>(`/email/automations${tenantQuery(tenantId)}`);
export const createEmailAutomation = (data: EmailAutomationPayload) =>
  apiFetch<EmailAutomation>('/email/automations', { method: 'POST', body: JSON.stringify(data) });
export const updateEmailAutomation = (id: string, data: Partial<EmailAutomationPayload>) =>
  apiFetch<EmailAutomation>(`/email/automations/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteEmailAutomation = (id: string, tenantId?: string) =>
  apiFetch<void>(`/email/automations/${id}${tenantQuery(tenantId)}`, { method: 'DELETE' });

export const sendEmail = (data: {
  tenantId?: string;
  templateId: string;
  customerId?: string;
  orderId?: string;
  toEmail?: string;
  toName?: string;
}) => apiFetch<EmailDelivery>('/email/send', { method: 'POST', body: JSON.stringify(data) });

export const getEmailDeliveries = (tenantId?: string, page = 1) => {
  const qs = new URLSearchParams({ page: String(page), limit: '25' });
  if (tenantId) qs.set('tenantId', tenantId);
  return apiFetch<EmailDeliveriesResponse>(`/email/deliveries?${qs}`);
};
export const retryEmailDelivery = (id: string, tenantId?: string) =>
  apiFetch<EmailDelivery>(`/email/deliveries/${id}/retry${tenantQuery(tenantId)}`, { method: 'POST' });
