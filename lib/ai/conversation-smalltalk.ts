/**
 * Tiny conversational turns do not need a model or business-data tools. Keeping
 * them deterministic makes the reply instant and prevents a greeting from being
 * expanded into an operations briefing.
 */
export function smallTalkResponse(input: string): string | null {
  const text = input.trim().toLocaleLowerCase('en-GB').replace(/[!?.]+$/g, '').trim();

  if (/^(?:hi|hello|hey|hiya|morning|afternoon|evening|good morning|good afternoon|good evening)(?: duma)?$/.test(text)) {
    return 'Hi! What can I help you with?';
  }

  if (/^(?:thanks|thank you|cheers|thanks duma|thank you duma)$/.test(text)) return 'You’re welcome.';

  if (/^(?:how are you|how are you doing)$/.test(text)) return 'I’m ready to help. What would you like to check?';

  return null;
}
