import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The type ramp adds sizes Tailwind doesn't ship (app/globals.css). Unregistered,
// tailwind-merge reads `text-label` as a text colour and drops it the moment a
// real colour follows — which silently shrank or grew every coloured Badge.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['micro', 'label', 'metric'] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
