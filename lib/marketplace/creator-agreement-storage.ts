import { apiFetch } from '@/lib/api/client';
import { agreementDocument, type Agreement, type AgreementLanguage } from './creator-agreement';

export type AgreementSummary = { id: string; campaign: string; createdAt: string; expiresAt: string | null };
export type AgreementSnapshot = { document: ReturnType<typeof agreementDocument>; language: AgreementLanguage };
export type SavedAgreement = Omit<AgreementSummary, 'campaign'> & {
  agreement: Agreement;
  document: AgreementSnapshot['document'];
};

const path = '/marketplace/creator-agreements';

export function listAgreements(workspaceId: string, offset: number) {
  return apiFetch<{ entries: AgreementSummary[]; hasMore: boolean }>(`${path}?offset=${offset}`, { workspaceId, cache: 'no-store' });
}

export function saveAgreement(workspaceId: string, agreement: Agreement) {
  return apiFetch<SavedAgreement>(path, {
    workspaceId, method: 'POST', body: JSON.stringify({ agreement, document: agreementDocument(agreement) }),
  });
}

export function getAgreement(workspaceId: string, id: string) {
  return apiFetch<SavedAgreement>(`${path}/${encodeURIComponent(id)}`, { workspaceId, cache: 'no-store' });
}

export function createAgreementLink(workspaceId: string, id: string) {
  return apiFetch<{ token: string; expiresAt: string }>(`${path}/${encodeURIComponent(id)}/share`, { workspaceId, method: 'POST' });
}

export function revokeAgreementLink(workspaceId: string, id: string) {
  return apiFetch<{ revoked: boolean }>(`${path}/${encodeURIComponent(id)}/share`, { workspaceId, method: 'DELETE' });
}

export function readSharedAgreement(token: string, signal: AbortSignal) {
  return apiFetch<AgreementSnapshot>(`${path}/shared`, {
    method: 'POST', body: JSON.stringify({ token }), signal, credentials: 'omit', cache: 'no-store',
  });
}
