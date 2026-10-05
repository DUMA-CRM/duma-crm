import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { EMPTY_DRAFT, type OnboardingDraft } from '@/lib/onboarding/flow';

interface ProvisionedWorkspace {
  tenantId: string;
  locationId: string;
}

interface OnboardingState {
  draft: OnboardingDraft;
  /** Memory only — see `partialize`. A refresh sends the owner back to the password step. */
  password: string;
  /**
   * The workspace-sign-up Idempotency-Key, keyed to the payload it was minted
   * for. Persisted so a refresh mid-submit replays the same command instead of
   * provisioning a second workspace.
   */
  command: { fingerprint: string; key: string } | null;
  /** Set once the workspace exists, so a retry resumes at module activation. */
  provisioned: ProvisionedWorkspace | null;
  update: (patch: Partial<OnboardingDraft>) => void;
  setPassword: (password: string) => void;
  commandFor: (fingerprint: string) => string;
  setProvisioned: (workspace: ProvisionedWorkspace) => void;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get) => ({
      draft: EMPTY_DRAFT,
      password: '',
      command: null,
      provisioned: null,
      update: (patch) => set((state) => ({ draft: { ...state.draft, ...patch } })),
      setPassword: (password) => set({ password }),
      commandFor: (fingerprint) => {
        const current = get().command;
        if (current?.fingerprint === fingerprint) return current.key;
        const key = crypto.randomUUID();
        set({ command: { fingerprint, key } });
        return key;
      },
      setProvisioned: (provisioned) => set({ provisioned }),
      reset: () => set({ draft: EMPTY_DRAFT, password: '', command: null, provisioned: null }),
    }),
    {
      name: 'duma-onboarding',
      version: 1,
      // Never write the password to storage.
      partialize: ({ draft, command, provisioned }) => ({ draft, command, provisioned }),
      // Fields added to the draft later start from their defaults instead of undefined.
      merge: (persisted, current) => {
        const saved = persisted as Partial<OnboardingState> | undefined;
        return { ...current, ...saved, draft: { ...EMPTY_DRAFT, ...saved?.draft } };
      },
    },
  ),
);
