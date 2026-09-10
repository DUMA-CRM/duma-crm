'use client';

import { ModelChoiceList } from '@/components/ai/ModelChoice';
import { SettingsSection as Section } from '@/components/settings/SettingsSection';

/**
 * Which model answers Ask DUMA on this device.
 *
 * The choice is a preference, not a restriction: whichever provider is picked
 * still hands over to the others when it runs out of capacity, so the agent
 * cannot be switched into a state where it stops answering. The same picker is
 * reachable from the chat panel — see `components/ai/ModelChoice.tsx`.
 */
export function AgentModelSettings() {
  return (
    <Section
      title="Ask DUMA model"
      description="Choose which AI model answers Ask DUMA. Whichever you pick, DUMA still falls back to the others when that model is out of capacity. You can also switch it inside the chat — ask “which models are available?”."
      footnote="Stored on this device only. Model keys live on the server — this setting changes which one is asked first, not which are available."
    >
      <ModelChoiceList />
    </Section>
  );
}
