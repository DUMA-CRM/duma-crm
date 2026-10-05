const MAX_MEMORY = 6000;

type LearnedPreference = { label: string; value: string };

function explicitPreference(request: string): LearnedPreference[] {
  const text = request.trim();
  const preferences: LearnedPreference[] = [];
  const responseRequest = /\b(?:answer|respond|reply|explain|write|responses?|answers?)\b/i.test(text);

  if (responseRequest && /\b(?:more detailed|detailed|more detail|thorough|in[- ]depth|comprehensive)\b/i.test(text))
    preferences.push({ label: 'Response detail', value: 'Prefer detailed answers.' });
  if (responseRequest && /\b(?:short|shorter|brief|concise|to the point)\b/i.test(text))
    preferences.push({ label: 'Response detail', value: 'Prefer concise answers.' });
  if (/\b(?:prefer|use|format|show).{0,28}\b(?:bullet|bullets|bullet points)\b/i.test(text))
    preferences.push({ label: 'Formatting', value: 'Prefer bullet points when they make the answer clearer.' });
  if (/\b(?:prefer|use|format|show).{0,28}\b(?:table|tables)\b/i.test(text))
    preferences.push({ label: 'Formatting', value: 'Prefer tables for suitable comparisons.' });
  if (/\b(?:prefer|use|show|include).{0,28}\b(?:chart|charts|graph|graphs)\b/i.test(text))
    preferences.push({ label: 'Visuals', value: 'Prefer charts for suitable comparisons.' });
  if (/\b(?:prefer|use|keep).{0,24}\b(?:friendly|warm)\b/i.test(text))
    preferences.push({ label: 'Tone', value: 'Use a friendly, warm tone.' });
  if (/\b(?:prefer|use|keep).{0,24}\b(?:formal|professional)\b/i.test(text))
    preferences.push({ label: 'Tone', value: 'Use a professional tone.' });
  if (/\b(?:prefer|use|keep).{0,24}\b(?:direct|straightforward)\b/i.test(text))
    preferences.push({ label: 'Tone', value: 'Use a direct, straightforward tone.' });

  const remembered = /\bremember\s+(?:that\s+)?(.{3,300})/i.exec(text)?.[1]?.trim().replace(/[\s.]+$/, '');
  if (remembered) preferences.push({ label: 'User note', value: remembered });
  return preferences;
}

function replaceLabel(lines: string[], preference: LearnedPreference) {
  const prefix = `- ${preference.label}:`;
  const next = lines.filter((line) => !line.toLowerCase().startsWith(prefix.toLowerCase()));
  next.push(`${prefix} ${preference.value}`);
  return next;
}

/**
 * Learn only preferences the operator states explicitly. The result is plain,
 * inspectable text; it is never an authority or a source of business facts.
 */
export function learnAgentMemory(current: string, request: string): string | null {
  const learned = explicitPreference(request);
  if (!learned.length) return null;
  let lines = current.replace(/\r/g, '').split('\n').map((line) => line.trimEnd()).filter(Boolean);
  for (const preference of learned) lines = replaceLabel(lines, preference);
  const next = lines.join('\n').slice(0, MAX_MEMORY).trim();
  return next === current.trim() ? null : next;
}
