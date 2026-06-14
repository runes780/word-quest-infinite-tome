/**
 * Shared word normalization. Used by BOTH materialProfile (building allowedSet)
 * and questionQuality (lexical-fit check) so the two sides are comparable.
 *
 * Apostrophes are stripped, so "don't" -> "dont". contentWords keeps apostrophes
 * attached during tokenization (so contractions are one token) then normalizes.
 * Conservative inflection stripping: going -> go, watered -> water, cats -> cat.
 * Irregular forms (went/gone) must appear in COMMON_WORD_LIST explicitly.
 */
export function normalizeWord(input: string): string {
  const cleaned = input.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length === 0) return cleaned;
  if (cleaned.length >= 5 && cleaned.endsWith('ing')) return cleaned.slice(0, -3);
  if (cleaned.length > 4 && cleaned.endsWith('ed')) return cleaned.slice(0, -2);
  if (cleaned.length > 3 && cleaned.endsWith('s') && !cleaned.endsWith('ss')) {
    return cleaned.slice(0, -1);
  }
  return cleaned;
}

/**
 * Tokenize keeping apostrophes attached (so "don't" is one token), then normalize.
 * Returns tokens of length >= 2.
 */
export function contentWords(text: string): string[] {
  const matches = text.match(/[a-z']+/gi) || [];
  return matches.map(normalizeWord).filter((word) => word.length >= 2);
}