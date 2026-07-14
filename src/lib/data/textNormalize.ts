/**
 * Shared word normalization. Used by BOTH materialProfile (building allowedSet)
 * and questionQuality (lexical-fit check) so the two sides are comparable.
 *
 * Apostrophes are stripped, so "don't" -> "dont". contentWords keeps apostrophes
 * attached during tokenization (so contractions are one token) then normalizes.
 * Conservative inflection stripping: going -> go, watered -> water, cats -> cat.
 * Irregular forms (went/gone) must appear in COMMON_WORD_LIST explicitly.
 */
function normalizeStep(w: string): string {
  // Strip '-ing' only when the remaining stem has a vowel, so base words
  // (thing, bring) are not over-stemmed while inflected forms align (going -> go).
  if (w.length >= 5 && w.endsWith('ing')) {
    const stem = w.slice(0, -3);
    if (stem.length >= 2 && /[aeiou]/.test(stem)) return stem;
  }
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function normalizeWord(input: string): string {
  let w = input.toLowerCase().replace(/[^a-z]/g, '');
  // Apply rules repeatedly until stable (fixed point). This guarantees the
  // function is idempotent even when one rule's output feeds another
  // (e.g. closed -> clos -> clo), which matters for set-membership checks.
  for (let i = 0; i < 3 && w.length > 0; i += 1) {
    const next = normalizeStep(w);
    if (next === w) break;
    w = next;
  }
  return w;
}

/**
 * Tokenize keeping apostrophes attached (so "don't" is one token), then normalize.
 * Returns tokens of length >= 2.
 */
export function contentWords(text: string): string[] {
  const matches = text.match(/[a-z']+/gi) || [];
  return matches.map(normalizeWord).filter((word) => word.length >= 2);
}