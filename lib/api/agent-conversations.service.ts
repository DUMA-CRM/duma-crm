import type { AgentChatMessage } from '@/lib/ai/agent-types';

import { apiFetch } from './client';

export interface AgentConversation {
  id: string;
  title: string;
  tenantId: string;
  locationId: string | null;
  updatedAt: string;
}
export interface SavedAgentTurn {
  id?: string;
  requestId: string;
  question: string;
  answer: string;
  model: string;
  evidence: string[];
  presentation?: Pick<AgentChatMessage, 'cards' | 'scope' | 'refused' | 'followUps' | 'fallbackModel' | 'generatedAt'>;
  createdAt?: string;
}
export interface AgentConversationDetail extends AgentConversation {
  turns: SavedAgentTurn[];
}
export interface AgentMemory {
  content: string;
  updatedAt: string | null;
}
export function listAgentConversations(tenantId: string | null, locationId: string | null) {
  const query = new URLSearchParams();
  if (tenantId) query.set('tenantId', tenantId);
  if (locationId) query.set('locationId', locationId);
  return apiFetch<AgentConversation[]>(`/agent/conversations?${query}`, { cache: 'no-store' });
}
export function createAgentConversation(title: string, tenantId: string | null, locationId: string | null) {
  return apiFetch<AgentConversation>('/agent/conversations', {
    method: 'POST',
    timeoutMs: 4000,
    body: JSON.stringify({ title: title.slice(0, 100), tenantId: tenantId ?? undefined, locationId: locationId ?? undefined }),
  });
}
export function getAgentConversation(id: string, cookieHeader?: string) {
  return apiFetch<AgentConversationDetail>(`/agent/conversations/${encodeURIComponent(id)}`, { cookieHeader, cache: 'no-store' });
}
export function saveAgentTurn(id: string, turn: SavedAgentTurn, cookieHeader?: string) {
  return apiFetch<Required<Pick<SavedAgentTurn, 'id'>> & SavedAgentTurn>(`/agent/conversations/${encodeURIComponent(id)}/turns`, {
    method: 'POST',
    timeoutMs: 4000,
    cookieHeader,
    body: JSON.stringify(turn),
  });
}
export function getAgentMemory(tenantId: string | null, cookieHeader?: string) {
  const query = new URLSearchParams();
  if (tenantId) query.set('tenantId', tenantId);
  return apiFetch<AgentMemory>(`/agent/conversations/memory?${query}`, { cookieHeader, cache: 'no-store' });
}
export function saveAgentMemory(content: string, tenantId: string | null, cookieHeader?: string) {
  return apiFetch<AgentMemory>('/agent/conversations/memory', {
    method: 'PUT', cookieHeader, body: JSON.stringify({ content, tenantId: tenantId ?? undefined }),
  });
}
export function clearAgentMemory(tenantId: string | null) {
  const query = new URLSearchParams();
  if (tenantId) query.set('tenantId', tenantId);
  return apiFetch<void>(`/agent/conversations/memory?${query}`, { method: 'DELETE' });
}
export function deleteAgentConversation(id: string) {
  return apiFetch<void>(`/agent/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
