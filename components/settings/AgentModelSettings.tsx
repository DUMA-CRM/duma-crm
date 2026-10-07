'use client';

import { useState } from 'react';

import { ModelChoiceList } from '@/components/ai/ModelChoice';
import { BookMarked, Pencil } from '@/components/icons';
import { AgentMemoryDrawer } from '@/components/settings/AgentMemoryDrawer';
import { SettingsSection as Section } from '@/components/settings/SettingsSection';
import { SettingRow } from '@/components/settings/controls';
import { Button } from '@/components/ui/button';

/**
 * Which model answers Ask DUMA on this device.
 *
 * The choice is a preference, not a restriction: whichever provider is picked
 * still hands over to the others when it runs out of capacity, so the agent
 * cannot be switched into a state where it stops answering. The same picker is
 * reachable from the chat panel — see `components/ai/ModelChoice.tsx`.
 */
export function AgentModelSettings() {
  const [memoryOpen, setMemoryOpen] = useState(false);
  return (
    <Section title="Ask DUMA">
      <SettingRow icon={BookMarked} title="Ask DUMA memory">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Edit memory"
          aria-label="Edit Ask DUMA memory"
          onClick={() => setMemoryOpen(true)}
        >
          <Pencil aria-hidden="true" />
        </Button>
      </SettingRow>
      <ModelChoiceList />
      {memoryOpen && <AgentMemoryDrawer onClose={() => setMemoryOpen(false)} />}
    </Section>
  );
}
