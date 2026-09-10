import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AgentProviderPreference } from '@/lib/ai/provider-chain';

// Per-device Ask DUMA preferences (localStorage). Kept beside the other device
// settings rather than on the account: which model answers is a workstation
// choice — a back-office laptop can run the accurate one while the till stays on
// whatever is free — and the server still decides which providers exist at all.
interface AgentSettingsStore {
  /** Which configured provider answers first. `auto` keeps the server's order. */
  provider: AgentProviderPreference;
  setProvider: (provider: AgentProviderPreference) => void;
}

export const useAgentSettingsStore = create<AgentSettingsStore>()(
  persist(
    (set) => ({
      provider: 'auto',
      setProvider: (provider) => set({ provider }),
    }),
    { name: 'agent-settings' },
  ),
);
