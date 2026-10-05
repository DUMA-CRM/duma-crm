'use client';

import { useEffect, useState } from 'react';

import type { ExpressionId } from '@/lib/mascot/engine/expressions';
import type { StateId } from '@/lib/mascot/engine/states';

import type { MascotFeeling } from './Mascot';

export type AgentPhase =
  | 'resting'
  | 'listening'
  | 'thinking'
  | 'working'
  | 'writing'
  | 'delivered'
  | 'asking'
  | 'completed'
  | 'declined'
  | 'blocked'
  | 'stopped'
  | 'failed';
export interface AgentMood {
  state: StateId;
  expression: ExpressionId;
  feeling: MascotFeeling;
  caption: string;
  gesture?: 'wave' | 'celebrate';
}
const MOODS: Record<AgentPhase, AgentMood> = {
  resting: { state: 'idle', expression: 'neutre', feeling: 'neutral', caption: 'Ready when you are' },
  listening: { state: 'idle', expression: 'attentif', feeling: 'curious', caption: 'Listening' },
  thinking: { state: 'pondering', expression: 'curieux', feeling: 'curious', caption: 'Reading your request' },
  working: { state: 'scanning', expression: 'attentif', feeling: 'curious', caption: 'Checking your workspace' },
  writing: { state: 'idle', expression: 'attentif', feeling: 'happy', caption: 'Writing your answer' },
  delivered: { state: 'notify', expression: 'surpris', feeling: 'happy', caption: 'Answer ready' },
  asking: { state: 'idle', expression: 'curieux', feeling: 'curious', caption: 'Review the proposed action' },
  completed: { state: 'idle', expression: 'surpris', feeling: 'happy', caption: 'Action completed', gesture: 'celebrate' },
  declined: { state: 'idle', expression: 'confus', feeling: 'curious', caption: 'Try a workspace question' },
  blocked: { state: 'idle', expression: 'colere', feeling: 'angry', caption: 'This action needs permission' },
  stopped: { state: 'idle', expression: 'neutre', feeling: 'neutral', caption: 'Stopped' },
  failed: { state: 'idle', expression: 'triste', feeling: 'sad', caption: 'Could not complete the request' },
};

export function agentMoodForPhase(phase: AgentPhase): AgentMood {
  return MOODS[phase];
}

/** One shared mood clock for the launcher and chat. Short result reactions settle back to neutral. */
export function useAgentMood(phase: AgentPhase): AgentMood {
  const [cycle, setCycle] = useState({ phase, settled: false });
  if (cycle.phase !== phase) setCycle({ phase, settled: false });
  const reaction = ['delivered', 'completed', 'stopped', 'declined'].includes(phase);
  useEffect(() => {
    if (!reaction) return;
    const timer = setTimeout(() => setCycle((current) => ({ ...current, settled: true })), 3000);
    return () => clearTimeout(timer);
  }, [phase, reaction]);
  const currentCycle = cycle.phase === phase ? cycle : { phase, settled: false };
  if (reaction && currentCycle.settled) return agentMoodForPhase('resting');
  return agentMoodForPhase(phase);
}
