// ─── What a booking's notes flag ─────────────────────────────────────────────
//
// Bookings have no allergy field: whatever the guest or the host typed is in the
// notes. This reads the notes for the UK's 14 named allergens, the words
// "allergy" / "allergic", and occasions worth a word at the door (a birthday, an
// anniversary), so the host panel can show a small marker. It only ever names
// what was written: the allergen words are the regulation's own (plus their
// singular or plural), never a guessed synonym, and the note itself stays the
// record the host reads.

/** The 14 allergens UK food law names, in its order, each with the words that name it. */
const ALLERGENS: readonly { name: string; words: readonly string[] }[] = [
  { name: 'Celery', words: ['celery'] },
  { name: 'Gluten', words: ['gluten'] },
  { name: 'Crustaceans', words: ['crustacean', 'crustaceans'] },
  { name: 'Eggs', words: ['egg', 'eggs'] },
  { name: 'Fish', words: ['fish'] },
  { name: 'Lupin', words: ['lupin', 'lupins'] },
  { name: 'Milk', words: ['milk'] },
  { name: 'Molluscs', words: ['mollusc', 'molluscs'] },
  { name: 'Mustard', words: ['mustard'] },
  { name: 'Tree nuts', words: ['tree nut', 'tree nuts', 'nut', 'nuts'] },
  { name: 'Peanuts', words: ['peanut', 'peanuts'] },
  { name: 'Sesame', words: ['sesame'] },
  { name: 'Soya', words: ['soya'] },
  { name: 'Sulphites', words: ['sulphite', 'sulphites', 'sulphur dioxide'] },
];

const ALLERGY_WORDS = ['allergy', 'allergies', 'allergic'];

const OCCASIONS: readonly { name: string; words: readonly string[] }[] = [
  { name: 'Birthday', words: ['birthday', 'birthdays', 'bday'] },
  { name: 'Anniversary', words: ['anniversary'] },
  { name: 'Engagement', words: ['engagement', 'engaged', 'proposal', 'proposing'] },
  { name: 'Honeymoon', words: ['honeymoon'] },
  { name: 'Graduation', words: ['graduation'] },
  { name: 'Celebration', words: ['celebration', 'celebrating'] },
];

export interface BookingMarkers {
  /** The named allergens mentioned, in the regulation's order. */
  allergens: string[];
  /** The notes mention an allergy — named or not. */
  allergy: boolean;
  /** Occasions mentioned. */
  occasions: string[];
}

const escape = (word: string) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wholeWord = (word: string) => new RegExp(`(?:^|[^\\p{L}])${escape(word).replace(/ /g, '\\s+')}(?=$|[^\\p{L}])`, 'iu');
const mentions = (text: string, words: readonly string[]) => words.some((word) => wholeWord(word).test(text));

/** "No allergies", "no known allergies", "not allergic": a note saying there's nothing to flag. */
const NONE = /(?:^|[^\p{L}])(?:no|nil|none|not)(?:\s+known)?\s+(?:allerg(?:y|ies)|allergic)(?=$|[^\p{L}])/giu;

/**
 * The markers a booking's notes carry, or null when there are none. "Nut" is
 * read as the tree nuts allergen but never inside "peanut" or "nutmeg"; a note
 * that says there are no allergies flags nothing unless it also names one.
 */
export function bookingMarkers(notes: string | null | undefined): BookingMarkers | null {
  const text = (notes ?? '').trim();
  if (!text) return null;
  // Peanuts are their own allergen: take them out before looking for tree nuts.
  const allergens = ALLERGENS.filter((allergen) =>
    mentions(allergen.name === 'Tree nuts' ? text.replace(/peanuts?/giu, ' ') : text, allergen.words),
  ).map((allergen) => allergen.name);
  const allergy = allergens.length > 0 || mentions(text.replace(NONE, ' '), ALLERGY_WORDS);
  const occasions = OCCASIONS.filter((occasion) => mentions(text, occasion.words)).map((occasion) => occasion.name);
  if (!allergy && occasions.length === 0) return null;
  return { allergens, allergy, occasions };
}

/** The marker's spoken and tooltip text: "Allergy: Peanuts, Milk · Birthday". */
export function markerLabel(markers: BookingMarkers): string {
  const parts: string[] = [];
  if (markers.allergy) parts.push(markers.allergens.length ? `Allergy: ${markers.allergens.join(', ')}` : 'Allergy');
  if (markers.occasions.length) parts.push(markers.occasions.join(', '));
  return parts.join(' · ');
}
