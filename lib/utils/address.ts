// ---------------------------------------------------------------------------
// The DB stores a single `address` line, so the form composes "line1, city,
// postcode, country" and parses it back into the four fields for editing.
//
// Parsing takes a country off the end only when the last part *is* a country
// — before 2026-09-26 it always popped one, so "7 Mill Lane, London E2 8QT"
// opened with "London E2 8QT" in the Country select, and saving wrote it back
// as a country. Everything before the last parts stays in line 1, so a first
// line with its own commas ("Flat 2, 7 Mill Lane") round-trips.
// ---------------------------------------------------------------------------

// Relative, not aliased: the test runner has no path mapping.
import { COUNTRIES } from '../constants/countries.ts';

export interface AddressParts {
  line1: string;
  city: string;
  postcode: string;
  country: string;
}

const KNOWN = new Set<string>(COUNTRIES.map((country) => country.toLowerCase()));

export function combineAddress(p: AddressParts): string {
  return [p.line1, p.city, p.postcode, p.country]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(', ');
}

export function parseAddress(value: string | null | undefined): AddressParts {
  const segs = (value ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const country = segs.length > 1 && KNOWN.has(segs[segs.length - 1].toLowerCase()) ? (segs.pop() ?? '') : '';
  const postcode = segs.length >= 3 ? (segs.pop() ?? '') : '';
  const city = segs.length >= 2 ? (segs.pop() ?? '') : '';
  return { line1: segs.join(', '), city, postcode, country };
}
