import { normalizeWord, contentWords } from './textNormalize';

describe('textNormalize', () => {
  test('normalizeWord lowercases and strips non-alpha', () => {
    expect(normalizeWord("Don't!")).toBe('dont');   // apostrophe stripped -> "dont"
    expect(normalizeWord('CATS')).toBe('cat');
  });

  test('normalizeWord strips common inflections conservatively', () => {
    expect(normalizeWord('goes')).toBe('goe');       // trailing 's' rule
    expect(normalizeWord('going')).toBe('go');       // 'ing' rule, threshold >= 5
    expect(normalizeWord('watered')).toBe('water');  // 'ed' rule
    expect(normalizeWord('carries')).toBe('carrie'); // one trailing 's' stripped
    expect(normalizeWord('boss')).toBe('boss');      // double-s preserved
  });

  test('contentWords extracts normalized tokens >= 2 chars', () => {
    expect(contentWords('The CAT ran fast!')).toEqual(['the', 'cat', 'ran', 'fast']);
    expect(contentWords("don't")).toEqual(['dont']); // contraction kept as one token, then normalized
    expect(contentWords('a I')).toEqual([]);
  });
});