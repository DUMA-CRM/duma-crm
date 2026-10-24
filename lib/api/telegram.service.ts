import { apiFetch } from './client';

export interface TelegramConnection {
  id: string;
  botUsername: string;
  chatId: string;
  chatTitle: string;
  isEnabled: boolean;
  lastTestedAt: string | null;
  lastError: string | null;
}
export const telegramQueryKey = (tenantId: string | null) => ['telegram-connection', tenantId] as const;
const tenantQuery = (tenantId: string) => `?tenantId=${encodeURIComponent(tenantId)}`;
export const getTelegramConnection = (tenantId: string) =>
  apiFetch<TelegramConnection | null>(`/telegram-connections${tenantQuery(tenantId)}`);
export const saveTelegramConnection = (tenantId: string, input: { botToken?: string; chatId: string; isEnabled: boolean }) =>
  apiFetch<TelegramConnection>(`/telegram-connections${tenantQuery(tenantId)}`, { method: 'PUT', body: JSON.stringify(input) });
export const testTelegramConnection = (tenantId: string) =>
  apiFetch<TelegramConnection>(`/telegram-connections/test${tenantQuery(tenantId)}`, { method: 'POST' });
export const deleteTelegramConnection = (tenantId: string) =>
  apiFetch<void>(`/telegram-connections${tenantQuery(tenantId)}`, { method: 'DELETE' });

export const findTelegramChats = (tenantId: string, botToken?: string) =>
  apiFetch<{ id: string; title: string }[]>(`/telegram-connections/chats${tenantQuery(tenantId)}`, {
    method: 'POST',
    body: JSON.stringify(botToken ? { botToken } : {}),
  });
