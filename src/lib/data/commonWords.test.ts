import { COMMON_WORD_SET, COMMON_WORD_LIST } from './commonWords';
import { normalizeWord } from './textNormalize';

describe('commonWords', () => {
  test('COMMON_WORD_LIST is non-empty and normalized', () => {
    expect(COMMON_WORD_LIST.length).toBeGreaterThan(150);
    for (const word of COMMON_WORD_LIST) {
      expect(word).toBe(normalizeWord(word));
    }
  });

  test('COMMON_WORD_SET answers membership for function + content words', () => {
    expect(COMMON_WORD_SET.has(normalizeWord('the'))).toBe(true);
    expect(COMMON_WORD_SET.has(normalizeWord('because'))).toBe(true);
    expect(COMMON_WORD_SET.has(normalizeWord('enormous'))).toBe(false);
  });
});
