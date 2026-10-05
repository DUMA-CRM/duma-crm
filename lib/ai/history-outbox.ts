import type { SavedAgentTurn } from '@/lib/api/agent-conversations.service';
import { createAgentConversation, saveAgentTurn } from '@/lib/api/agent-conversations.service';

const STORAGE_KEY = 'ask-duma-history-outbox-v1';

export interface PendingAgentTurn {
  id: string;
  groupId: string;
  conversationId?: string;
  title: string;
  tenantId: string | null;
  locationId: string | null;
  turn: SavedAgentTurn;
}

function read(): PendingAgentTurn[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(value) ? value.slice(-100) : [];
  } catch {
    return [];
  }
}

function write(items: PendingAgentTurn[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-100)));
}

export function queueAgentTurn(input: Omit<PendingAgentTurn, 'id'>) {
  const items = read();
  if (items.some((item) => item.turn.requestId === input.turn.requestId)) return;
  write([...items, { ...input, id: crypto.randomUUID() }]);
}

/** Retry in order and keep only entries that still could not be stored. */
export async function flushAgentHistoryOutbox() {
  const pending = read();
  if (!pending.length) return { saved: 0, remaining: 0 };
  const unresolved: PendingAgentTurn[] = [];
  const conversations = new Map<string, string>();
  let saved = 0;
  for (const item of pending) {
    try {
      let conversationId = item.conversationId ?? conversations.get(item.groupId);
      if (!conversationId) {
        const conversation = await createAgentConversation(item.title, item.tenantId, item.locationId);
        conversationId = conversation.id;
        conversations.set(item.groupId, conversationId);
      }
      await saveAgentTurn(conversationId, item.turn);
      saved += 1;
    } catch {
      unresolved.push(item);
    }
  }
  write(unresolved);
  return { saved, remaining: unresolved.length };
}

export function pendingAgentHistoryCount() {
  return read().length;
}
