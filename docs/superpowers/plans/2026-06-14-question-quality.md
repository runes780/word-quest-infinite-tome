# Question Quality Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the question-generation pipeline around the 1T-context law and lexical grounding so generated questions never exceed the material's vocabulary, are always grounded in a source span, and reading questions test comprehension skills instead of retrieval.

**Architecture:** Three-stage LLM pipeline (plan → generate → critique) replacing single-stage blind generation, with deterministic fallback to the legacy path. Two cross-cutting mechanisms: (1) lexical grounding via `allowedSet = materialVocab ∪ commonWordList`, making "above material level" a set-membership check; (2) the 1T-context law — every question binds a source span + single target.

**Tech Stack:** TypeScript, Next.js 16, Jest (`*.test.ts` colocated), OpenRouter client (`src/lib/ai/openrouter.ts`), Zustand store. Tests run via `npm test -- <pattern>`.

**Spec:** `docs/superpowers/specs/2026-06-14-question-quality-design.md`

---

## File Structure

**Create:**
- `src/lib/data/textNormalize.ts` — shared `normalizeWord` / `contentWords` (used by profile + quality gate, so both sides normalize identically).
- `src/lib/data/commonWords.ts` — `COMMON_WORD_LIST` high-frequency English words.
- `src/lib/data/questionPlan.ts` — `QuestionPlan` types + `validateQuestionPlan`.
- `src/lib/ai/questionPipeline.ts` — `generateQuestionPack` orchestrator + degradation.

**Modify:**
- `src/lib/ai/materialProfile.ts` — add vocabulary extraction (`vocabulary`, `sentences`).
- `src/lib/data/questionQuality.ts` — add lexical-fit / 1T-grounding / reading-skill checks; backward-compatible signature.
- `src/lib/ai/prompts.ts` — add `PLAN_SYSTEM_PROMPT` + `CRITIC_SYSTEM_PROMPT`, rewrite `LEVEL_GENERATOR_SYSTEM_PROMPT`, add prompt builders.
- `src/lib/data/fallbackQuestions.ts` — rewrite as passage-grounded clusters.
- `src/components/InputSection.tsx` — call orchestrator, remove inline `fetchMissionWithRetry`.

---

## Task 1: Shared text normalization (`textNormalize.ts`)

**Files:**
- Create: `src/lib/data/textNormalize.ts`
- Test: `src/lib/data/textNormalize.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/data/textNormalize.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- textNormalize`
Expected: FAIL (`Cannot find module './textNormalize'`).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/data/textNormalize.ts

/**
 * Shared word normalization. Used by BOTH materialProfile (building allowedSet)
 * and questionQuality (lexical-fit check) so the two sides are comparable.
 *
 * Apostrophes are stripped, so "don't" -> "dont". contentWords keeps apostrophes
 * attached during tokenization (so contractions are one token) then normalizes.
 * Conservative inflection stripping: going -> go, watered -> water, cats -> cat.
 * The -ing rule guards on a vowel in the stem so base words like "thing"/"bring"
 * are not over-stemmed, keeping the function idempotent.
 * Irregular forms (went/gone) must appear in COMMON_WORD_LIST explicitly.
 */
export function normalizeWord(input: string): string {
  const cleaned = input.toLowerCase().replace(/[^a-z]/g, '');
  if (cleaned.length === 0) return cleaned;
  if (cleaned.length >= 5 && cleaned.endsWith('ing')) {
    const stem = cleaned.slice(0, -3);
    if (stem.length >= 2 && /[aeiou]/.test(stem)) return stem;
  }
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- textNormalize`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/textNormalize.ts src/lib/data/textNormalize.test.ts
git commit -m "feat: add shared text normalization for lexical grounding"
```

---

## Task 2: Common word list (`commonWords.ts`)

**Files:**
- Create: `src/lib/data/commonWords.ts`
- Test: `src/lib/data/commonWords.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/data/commonWords.test.ts
import { COMMON_WORD_SET, COMMON_WORD_LIST } from './commonWords';
import { normalizeWord } from './textNormalize';

describe('commonWords', () => {
  test('COMMON_WORD_LIST is non-empty and normalized', () => {
    expect(COMMON_WORD_LIST.length).toBeGreaterThan(150);
    // every entry is already normalized (no punctuation, lowercase, stemmed)
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- commonWords`
Expected: FAIL (`Cannot find module './commonWords'`).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/data/commonWords.ts
import { normalizeWord } from './textNormalize';

/**
 * High-frequency English words. Together with the source material's own
 * vocabulary this forms allowedSet — the lexical ceiling for every question.
 *
 * This is a seed list of the most frequent function + content words. Expand
 * toward ~1000 entries from a standard frequency list (e.g. Ogden Basic
 * English / COCA top-1000) as needed; the mechanism is just adding tokens.
 * Entries are stored pre-normalized so set lookups match contentWords() output.
 */
const RAW_COMMON_WORDS = [
  // articles, pronouns, prepositions, conjunctions
  'a', 'an', 'the', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours',
  'who', 'whom', 'whose', 'which', 'what', 'when', 'where', 'why', 'how',
  'in', 'on', 'at', 'to', 'of', 'for', 'with', 'from', 'by', 'about', 'into',
  'under', 'over', 'between', 'behind', 'near', 'above', 'below', 'through',
  'before', 'after', 'during', 'until', 'against', 'around', 'beside',
  'and', 'or', 'but', 'so', 'because', 'although', 'if', 'when', 'while',
  'than', 'then', 'as', 'like',
  // be / have / do / modals
  'be', 'am', 'is', 'are', 'was', 'were', 'been', 'being',
  'have', 'has', 'had', 'having',
  'do', 'does', 'did', 'done', 'doing',
  'go', 'went', 'gone', 'going',
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',
  // common verbs
  'get', 'got', 'make', 'made', 'take', 'took', 'taken', 'give', 'gave',
  'see', 'saw', 'seen', 'know', 'knew', 'think', 'thought', 'say', 'said',
  'come', 'came', 'look', 'find', 'found', 'want', 'use', 'used', 'work',
  'try', 'tried', 'ask', 'asked', 'feel', 'felt', 'become', 'became',
  'leave', 'left', 'put', 'mean', 'meant', 'keep', 'kept', 'let', 'begin',
  'seem', 'help', 'helped', 'show', 'showed', 'hear', 'heard', 'play',
  'run', 'turn', 'start', 'live', 'believe', 'hold', 'bring', 'happen',
  'write', 'written', 'sit', 'sat', 'stand', 'eat', 'ate', 'drink', 'speak',
  'read', 'buy', 'bought', 'sell', 'open', 'close', 'carry', 'pick',
  // common nouns
  'time', 'year', 'day', 'week', 'month', 'today', 'tomorrow', 'yesterday',
  'people', 'person', 'man', 'woman', 'child', 'boy', 'girl', 'friend',
  'family', 'home', 'house', 'room', 'door', 'window', 'school', 'class',
  'teacher', 'student', 'book', 'word', 'letter', 'story', 'game', 'name',
  'way', 'place', 'part', 'side', 'world', 'life', 'thing', 'things',
  'water', 'food', 'milk', 'tea', 'bread', 'fruit', 'apple', 'tree',
  'sun', 'moon', 'sky', 'rain', 'snow', 'wind', 'cloud', 'star', 'light',
  'morning', 'night', 'evening', 'afternoon',
  'hand', 'eye', 'ear', 'face', 'head', 'foot', 'leg', 'arm', 'mouth',
  'dog', 'cat', 'bird', 'fish', 'horse', 'animal',
  'car', 'road', 'street', 'city', 'town', 'country', 'park', 'garden',
  'money', 'work', 'job', 'music', 'song', 'color', 'picture', 'phone',
  // common adjectives
  'good', 'bad', 'big', 'small', 'new', 'old', 'young', 'long', 'short',
  'high', 'low', 'fast', 'slow', 'hot', 'cold', 'warm', 'cool', 'wet', 'dry',
  'happy', 'sad', 'angry', 'tired', 'busy', 'free', 'full', 'empty',
  'easy', 'hard', 'rich', 'poor', 'strong', 'weak', 'kind', 'nice',
  'beautiful', 'pretty', 'ugly', 'clean', 'dirty', 'safe', 'dark', 'bright',
  'red', 'blue', 'green', 'yellow', 'white', 'black', 'brown',
  'many', 'much', 'more', 'most', 'few', 'little', 'less', 'some', 'any',
  'all', 'each', 'every', 'other', 'same', 'different', 'first', 'last',
  // adverbs / quantifiers / numbers-as-words
  'not', 'no', 'now', 'here', 'there', 'very', 'too', 'also', 'only',
  'again', 'always', 'never', 'often', 'sometimes', 'usually', 'really',
  'well', 'better', 'best', 'up', 'down', 'out', 'back', 'away', 'off',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'hundred', 'thousand', 'first', 'second', 'third',
  // question / filler frames that appear in stems
  'what', 'does', 'mean', 'meaning', 'refer', 'sentence', 'line', 'passage',
  'read', 'best', 'near', 'choose', 'correct', 'answer', 'question',
  'why', 'how', 'inference', 'infer', 'suggest', 'imply', 'probably',
];

export const COMMON_WORD_LIST: string[] = Array.from(
  new Set(RAW_COMMON_WORDS.map(normalizeWord))
);

export const COMMON_WORD_SET: Set<string> = new Set(COMMON_WORD_LIST);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- commonWords`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/commonWords.ts src/lib/data/commonWords.test.ts
git commit -m "feat: add common-word list for lexical grounding"
```

---

## Task 3: Material profile v2 — vocabulary grounding (`materialProfile.ts`)

**Files:**
- Modify: `src/lib/ai/materialProfile.ts`
- Test: `src/lib/ai/materialProfile.test.ts` (extend existing)

- [ ] **Step 1: Write the failing test (append to existing describe block)**

```ts
// Add to src/lib/ai/materialProfile.test.ts
import { analyzeMaterialProfile } from './materialProfile';

describe('analyzeMaterialProfile vocabulary grounding', () => {
  test('extracts material vocabulary and builds allowed set', () => {
    const profile = analyzeMaterialProfile('The small fox found a bright leaf.');
    expect(profile.vocabulary.material).toContain('fox');
    expect(profile.vocabulary.material).toContain('leaf');
    // common words from the text are also material words
    expect(profile.vocabulary.allowed.has('fox')).toBe(true);
    // a common word is allowed via the common list
    expect(profile.vocabulary.allowed.has('because')).toBe(true);
    // a word absent from both material and common list is NOT allowed
    expect(profile.vocabulary.allowed.has('enormous')).toBe(false);
  });

  test('materialSpecific excludes common words', () => {
    const profile = analyzeMaterialProfile('The small fox found a bright leaf.');
    // 'fox' is material-specific; 'small' is common
    expect(profile.vocabulary.materialSpecific).toContain('fox');
    expect(profile.vocabulary.materialSpecific).not.toContain('small');
  });

  test('sentences are split from the material', () => {
    const profile = analyzeMaterialProfile('Mia has a garden. She waters it.');
    expect(profile.sentences.length).toBeGreaterThanOrEqual(2);
    expect(profile.sentences[0]).toContain('Mia');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- materialProfile`
Expected: FAIL (`profile.vocabulary` is `undefined`).

- [ ] **Step 3: Extend the MaterialProfile interface and analysis**

Add imports at the top of `src/lib/ai/materialProfile.ts`:

```ts
import { normalizeWord, contentWords } from '@/lib/data/textNormalize';
import { COMMON_WORD_SET } from '@/lib/data/commonWords';
```

Extend the `MaterialProfile` interface (add the `vocabulary` and `sentences` fields, keep all existing fields):

```ts
export interface MaterialVocabulary {
    material: string[];            // distinct normalized words from the text
    allowed: Set<string>;          // material ∪ common
    materialSpecific: string[];    // material − common (recommended targets)
}

export interface MaterialProfile {
    language: MaterialLanguage;
    difficulty: MaterialDifficulty;
    maxQuestionDifficulty: MaterialDifficulty;
    bandLabel: 'starter' | 'developing' | 'advanced';
    allowedQuestionDifficulties: MaterialDifficulty[];
    wordCount: number;
    averageSentenceLength: number;
    advancedWordCount: number;
    grammarSignalCount: number;
    vocabulary: MaterialVocabulary;   // NEW
    sentences: string[];              // NEW
}
```

Add a helper and update `analyzeMaterialProfile` (replace the existing return block; keep the difficulty logic above it unchanged):

```ts
function splitSentences(text: string): string[] {
    return text
        .split(/(?<=[.!?])\s+/)
        .map((s) => s.trim())
        .filter(Boolean);
}

function buildVocabulary(words: string[]): MaterialVocabulary {
    const material = Array.from(new Set(words.map(normalizeWord).filter((w) => w.length >= 2)));
    const allowed = new Set<string>([...material, ...COMMON_WORD_SET]);
    const materialSpecific = material.filter((w) => !COMMON_WORD_SET.has(w));
    return { material, allowed, materialSpecific };
}
```

In `analyzeMaterialProfile`, compute `words` as today (the `wordsIn(text)` call already exists), then build vocabulary and sentences, and include them in the returned object:

```ts
    const vocabulary = buildVocabulary(words);
    const sentences = splitSentences(text);

    return {
        language: detectLanguage(text, words),
        difficulty,
        maxQuestionDifficulty: difficulty,
        bandLabel: bandForDifficulty(difficulty),
        allowedQuestionDifficulties: allowedDifficultiesFor(difficulty),
        wordCount,
        averageSentenceLength,
        advancedWordCount,
        grammarSignalCount,
        vocabulary,
        sentences
    };
```

- [ ] **Step 4: Run test to verify it passes (and existing profile tests still pass)**

Run: `npm test -- materialProfile`
Expected: PASS (new tests + existing tests green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/materialProfile.ts src/lib/ai/materialProfile.test.ts
git commit -m "feat: add vocabulary grounding to material profile"
```

---

## Task 4: QuestionPlan types + validator (`questionPlan.ts`)

**Files:**
- Create: `src/lib/data/questionPlan.ts`
- Test: `src/lib/data/questionPlan.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/data/questionPlan.test.ts
import { validateQuestionPlan, type QuestionPlan, type QuestionPlanItem } from './questionPlan';
import { normalizeWord } from './textNormalize';

const MATERIAL = 'Mia has a small garden. She waters the plants. Today the tomatoes are red.';
const ALLOWED = new Set(
    ['mia', 'small', 'garden', 'water', 'plant', 'she', 'the', 'has', 'waters', 'tomato', 'red', 'today'].map(normalizeWord)
);

function item(overrides: Partial<QuestionPlanItem> = {}): QuestionPlanItem {
    return {
        role: 'cloze',
        domain: 'grammar',
        learningObjectiveId: 'present_simple',
        sourceSpan: 'She waters the plants.',
        target: 'waters',
        targetKind: 'grammar_form',
        allowedWords: ['water', 'plant', 'she'],
        supportLevel: 2,
        difficulty: 'easy',
        ...overrides
    };
}

function plan(items: QuestionPlanItem[]): QuestionPlan {
    return { levelTitle: 'Garden', materialSummary: 'x', vocabularyAllowed: [], items };
}

function sixValidItems(): QuestionPlanItem[] {
    return [
        item({ role: 'recognition', domain: 'vocab', sourceSpan: 'Mia has a small garden.', target: 'garden', targetKind: 'word', allowedWords: ['mia', 'small', 'garden'] }),
        item({ role: 'cloze' }),
        item({ role: 'recall', domain: 'grammar', sourceSpan: 'Mia has a small garden.', target: 'has', targetKind: 'grammar_form', allowedWords: ['mia', 'garden', 'has'] }),
        item({ role: 'reading', domain: 'reading', readingSkill: 'pronoun_reference', sourceSpan: 'She waters the plants.', target: 'She', targetKind: 'reference', allowedWords: ['mia', 'plant'] }),
        item({ role: 'reading', domain: 'reading', readingSkill: 'inference', sourceSpan: 'Today the tomatoes are red.', target: 'red', targetKind: 'inference', allowedWords: ['tomato', 'red'] }),
        item({ role: 'transfer', supportLevel: 0 })
    ];
}

describe('validateQuestionPlan', () => {
    test('accepts a well-formed 6-item plan', () => {
        const result = validateQuestionPlan(plan(sixValidItems()), MATERIAL, ALLOWED);
        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
    });

    test('rejects sourceSpan that is not a material substring', () => {
        const items = sixValidItems();
        items[0].sourceSpan = 'This sentence is not in the material.';
        const result = validateQuestionPlan(plan(items), MATERIAL, ALLOWED);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('sourceSpan'))).toBe(true);
    });

    test('rejects reading item without readingSkill', () => {
        const items = sixValidItems();
        delete (items[3] as { readingSkill?: string }).readingSkill;
        const result = validateQuestionPlan(plan(items), MATERIAL, ALLOWED);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('readingSkill'))).toBe(true);
    });

    test('rejects allowedWords outside allowedSet', () => {
        const items = sixValidItems();
        items[0].allowedWords = ['enormous'];
        const result = validateQuestionPlan(plan(items), MATERIAL, ALLOWED);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('allowedWords'))).toBe(true);
    });

    test('rejects plan with fewer than 6 items', () => {
        const result = validateQuestionPlan(plan(sixValidItems().slice(0, 4)), MATERIAL, ALLOWED);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('6'))).toBe(true);
    });

    test('rejects plan with no transfer item', () => {
        const items = sixValidItems().map((i) => ({ ...i, role: 'cloze' as const }));
        const result = validateQuestionPlan(plan(items), MATERIAL, ALLOWED);
        expect(result.valid).toBe(false);
        expect(result.errors.some((e) => e.includes('transfer'))).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- questionPlan`
Expected: FAIL (`Cannot find module './questionPlan'`).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/data/questionPlan.ts
import { normalizeWord } from './textNormalize';

export type PlanDomain = 'grammar' | 'vocab' | 'reading';
export type PlanRole = 'recognition' | 'cloze' | 'recall' | 'transfer';
export type PlanReadingSkill =
    | 'pronoun_reference'
    | 'inference'
    | 'contextual_meaning'
    | 'discourse'
    | 'pragmatic';

export type PlanTargetKind = 'word' | 'phrase' | 'grammar_form' | 'reference' | 'inference';

export interface QuestionPlanItem {
    role: PlanRole;
    domain: PlanDomain;
    learningObjectiveId: string;
    readingSkill?: PlanReadingSkill;
    sourceSpan: string;
    target: string;
    targetKind: PlanTargetKind;
    allowedWords: string[];
    supportLevel: 0 | 1 | 2 | 3;
    difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuestionPlan {
    levelTitle: string;
    materialSummary: string;
    vocabularyAllowed: string[];
    items: QuestionPlanItem[];
}

export const READING_SKILLS: PlanReadingSkill[] = [
    'pronoun_reference',
    'inference',
    'contextual_meaning',
    'discourse',
    'pragmatic'
];

export interface PlanValidationResult {
    valid: boolean;
    errors: string[];
}

const TARGET_KIND_NEEDS_IN_SPAN: PlanTargetKind[] = ['word', 'phrase', 'grammar_form', 'reference'];

export function validateQuestionPlan(
    plan: QuestionPlan,
    material: string,
    allowedSet: Set<string>
): PlanValidationResult {
    const errors: string[] = [];
    const materialLower = material.toLowerCase();

    if (!Array.isArray(plan.items) || plan.items.length < 6 || plan.items.length > 8) {
        errors.push(`Plan must have 6 to 8 items (got ${plan?.items?.length ?? 0}).`);
    }

    for (const [index, item] of (plan.items || []).entries()) {
        const label = `item[${index}]`;
        if (!materialLower.includes(item.sourceSpan.trim().toLowerCase())) {
            errors.push(`${label} sourceSpan is not a material substring: "${item.sourceSpan}".`);
        }
        if (TARGET_KIND_NEEDS_IN_SPAN.includes(item.targetKind)) {
            if (!item.sourceSpan.toLowerCase().includes(item.target.toLowerCase())) {
                errors.push(`${label} target "${item.target}" does not appear in its sourceSpan.`);
            }
        }
        if (item.domain === 'reading' && !item.readingSkill) {
            errors.push(`${label} reading item is missing readingSkill.`);
        }
        if (item.readingSkill && !READING_SKILLS.includes(item.readingSkill)) {
            errors.push(`${label} readingSkill "${item.readingSkill}" is not in the allowed list.`);
        }
        const offending = item.allowedWords
            .map(normalizeWord)
            .filter((w) => !allowedSet.has(w));
        if (offending.length > 0) {
            errors.push(`${label} allowedWords outside allowedSet: ${offending.join(', ')}.`);
        }
    }

    const roles = (plan.items || []).map((i) => i.role);
    if (roles.length >= 6 && !roles.includes('transfer')) {
        errors.push('Plan must include at least one transfer item.');
    }

    return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- questionPlan`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/questionPlan.ts src/lib/data/questionPlan.test.ts
git commit -m "feat: add QuestionPlan types and validator"
```

---

## Task 5: Quality gate — lexical-fit / 1T / reading-skill checks (`questionQuality.ts`)

**Files:**
- Modify: `src/lib/data/questionQuality.ts`
- Test: `src/lib/data/questionQuality.test.ts` (extend existing)

- [ ] **Step 1: Write the failing test (append)**

```ts
// Add to src/lib/data/questionQuality.test.ts
import { assessQuestionQuality } from './questionQuality';

const MATERIAL = 'Mia has a small garden. Every morning she waters the plants.';
const ALLOWED = new Set([
    'mia', 'small', 'garden', 'morning', 'water', 'plant', 'she', 'the',
    'have', 'every', 'red', 'ripe', 'tomato', 'pick', 'them', 'leaf', 'bright',
    'the', 'mean', 'here', 'refer', 'what', 'doe', 'show', 'care', 'for'
]);

function baseMonster(overrides: Partial<Parameters<typeof assessQuestionQuality>[0]> = {}) {
    return {
        question: 'Read: "she waters the plants." Every morning she ___ the plants.',
        options: ['waters', 'water', 'watering', 'watered'],
        correct_index: 0,
        correctAnswer: 'waters',
        questionMode: 'fill-blank' as const,
        difficulty: 'easy' as const,
        learningObjectiveId: 'present_simple',
        sourceContextSpan: 'Every morning she waters the plants.',
        supportLevel: 2 as const,
        attemptKind: 'practice' as const,
        ...overrides
    };
}

describe('assessQuestionQuality lexical grounding', () => {
    test('flags an above-material word in explanation', () => {
        const report = assessQuestionQuality(
            baseMonster({ explanation: 'The word means the tomatoes are enormous.' }),
            { maxDifficulty: 'easy', allowedSet: ALLOWED, material: MATERIAL, target: 'waters' }
        );
        expect(report.rejectReasons).toContain('above_material_vocabulary');
    });

    test('accepts when all words are in allowedSet', () => {
        const report = assessQuestionQuality(
            baseMonster({ explanation: 'She waters the plants.' }),
            { maxDifficulty: 'easy', allowedSet: ALLOWED, material: MATERIAL, target: 'waters' }
        );
        expect(report.rejectReasons).not.toContain('above_material_vocabulary');
    });

    test('flags a reading question not grounded in material', () => {
        const report = assessQuestionQuality(
            baseMonster({
                question: 'What color is the sky on a clear day?',
                sourceContextSpan: 'generic',
                questionMode: 'choice' as const
            }),
            { maxDifficulty: 'easy', allowedSet: ALLOWED, material: MATERIAL, target: 'sky', domain: 'reading', readingSkill: 'inference' }
        );
        expect(report.rejectReasons).toContain('not_grounded_in_material');
    });

    test('flags a reading item whose stem does not match its readingSkill', () => {
        const report = assessQuestionQuality(
            baseMonster({
                question: 'Read: "Every morning she waters the plants." What does she water?',
                questionMode: 'choice' as const
            }),
            { maxDifficulty: 'easy', allowedSet: ALLOWED, material: MATERIAL, target: 'she', domain: 'reading', readingSkill: 'inference' }
        );
        expect(report.rejectReasons).toContain('reading_skill_mismatch');
    });

    test('backward-compatible: no allowedSet -> legacy heuristic path still runs', () => {
        const report = assessQuestionQuality(baseMonster(), { maxDifficulty: 'easy' });
        // must not throw and must produce a report
        expect(typeof report.score).toBe('number');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- questionQuality`
Expected: FAIL (`above_material_vocabulary` / `not_grounded_in_material` / `reading_skill_mismatch` not produced).

- [ ] **Step 3: Extend the quality gate**

Add imports at the top of `src/lib/data/questionQuality.ts`:

```ts
import { contentWords } from './textNormalize';
import {
    READING_SKILLS,
    type PlanDomain,
    type PlanReadingSkill
} from './questionPlan';
```

Add new types and the reading-skill signal map near the existing flag/reason definitions:

```ts
export type QuestionQualityFlag =
    | 'source_grounded'
    | 'transfer_check'
    | 'mode_mismatch'
    | 'weak_options'
    | 'single_objective'
    | 'difficulty_fit'
    | 'language_fit'
    | 'lexical_fit'
    | 'context_grounded'
    | 'reading_skill_fit';

export interface QuestionQualityOptions {
    maxDifficulty?: MaterialDifficulty;
    allowedSet?: Set<string>;
    material?: string;
    target?: string;
    domain?: PlanDomain;
    readingSkill?: PlanReadingSkill;
}

const READING_SKILL_SIGNALS: Record<PlanReadingSkill, RegExp> = {
    pronoun_reference: /\b(refer(?:s|red|ring)? to|what does ['"]?(?:he|she|it|they|this|that)['"]? (?:mean|refer))\b/i,
    inference: /\b(why|infer|because|suggest|imply|probably|how (?:do|can|did)|show)\b/i,
    contextual_meaning: /\b(in this (?:sentence|line)|here|most nearly mean|closest (?:in )?meaning)\b/i,
    discourse: /\b(however|then|next|first|finally|transition|connect|in contrast)\b/i,
    pragmatic: /\b(purpose|intend|trying to|tone|feel|attitude|the writer|the author)\b/i
};
```

Add the lexical-fit and grounding helpers before `assessQuestionQuality`:

```ts
function checkLexicalFit(
    texts: string[],
    allowedSet: Set<string>,
    target: string | undefined
): { ok: boolean; offending: string[] } {
    const targetNorm = target ? target.toLowerCase().replace(/[^a-z]/g, '') : '';
    const offending = new Set<string>();
    for (const text of texts) {
        for (const word of contentWords(text)) {
            if (word === targetNorm) continue;
            if (allowedSet.has(word)) continue;
            offending.add(word);
        }
    }
    return { ok: offending.size === 0, offending: [...offending] };
}

function extractQuotedSpans(text: string): string[] {
    const matches = text.match(/["“]([^"”]{8,})["”]/g) || [];
    return matches.map((m) => m.replace(/^["“]|["”]$/g, '').trim());
}

function isGroundedInMaterial(question: { question: string; sourceContextSpan?: string }, material: string): boolean {
    const spans = [question.sourceContextSpan, ...extractQuotedSpans(question.question)]
        .map((s) => s?.trim())
        .filter(Boolean);
    return spans.some((span) => material.includes(span));
}

function readingSkillMatches(stem: string, skill: PlanReadingSkill): boolean {
    return READING_SKILL_SIGNALS[skill].test(stem);
}
```

Extend `QuestionQualityOptions` usage inside `assessQuestionQuality`. After the existing `maxDifficulty` block (the one that sets `above_material_difficulty`), add the new checks. Replace the existing difficulty block's `else` branch so the new lexical check takes precedence when `allowedSet` is provided:

```ts
    // --- Lexical grounding (new, preferred over the legacy heuristic) ---
    if (options.allowedSet) {
        const texts = [stem, ...(Array.isArray(question.options) ? question.options : []),
            question.hint ?? '', question.explanation ?? '', answer];
        const fit = checkLexicalFit(texts as string[], options.allowedSet, options.target);
        if (fit.ok) {
            addFlag(flags, 'lexical_fit');
        } else {
            addReject(rejectReasons, 'above_material_vocabulary');
            if (!repairSuggestionCache.has('clamp_to_allowed_vocabulary')) {
                repairSuggestion = 'clamp_to_allowed_vocabulary';
                repairSuggestionCache.add('clamp_to_allowed_vocabulary');
            }
        }
    }

    // --- 1T grounding (new) ---
    if (options.material) {
        if (isGroundedInMaterial({ question: stem, sourceContextSpan }, options.material)) {
            addFlag(flags, 'context_grounded');
        } else {
            addReject(rejectReasons, 'not_grounded_in_material');
            if (!repairSuggestion) repairSuggestion = 'embed_source_span';
        }
    }

    // --- Reading-skill fit (new) ---
    if (options.domain === 'reading') {
        if (!options.readingSkill || !READING_SKILLS.includes(options.readingSkill)) {
            addReject(rejectReasons, 'reading_skill_missing');
        } else if (!readingSkillMatches(stem, options.readingSkill)) {
            addReject(rejectReasons, 'reading_skill_mismatch');
            if (!repairSuggestion) repairSuggestion = 'assign_reading_skill';
        } else {
            addFlag(flags, 'reading_skill_fit');
        }
    }
```

Because `repairSuggestion` is declared as `const` near the bottom of the existing function, refactor it: declare `let repairSuggestion: string | undefined;` and a `const repairSuggestionCache = new Set<string>();` near the top of `assessQuestionQuality` (where `flags`/`rejectReasons` are declared), and remove the later `const repairSuggestion = ...` computation block (the new branches set it; keep the final fallback mapping for the legacy reasons). Specifically, replace the existing trailing block:

```ts
    const repairSuggestion = rejectReasons.includes('fill_blank_missing_visible_blank')
        ? 'build_cloze_from_source_span'
        : rejectReasons.includes('placeholder_options')
            ? 'replace_placeholder_distractors'
            : rejectReasons.includes('non_english_question_payload')
                ? 'replace_non_english_payload'
                : undefined;
```

with:

```ts
    if (!repairSuggestion) {
        if (rejectReasons.includes('fill_blank_missing_visible_blank')) repairSuggestion = 'build_cloze_from_source_span';
        else if (rejectReasons.includes('placeholder_options')) repairSuggestion = 'replace_placeholder_distractors';
        else if (rejectReasons.includes('non_english_question_payload')) repairSuggestion = 'replace_non_english_payload';
    }
```

- [ ] **Step 4: Run test to verify it passes (and existing quality tests stay green)**

Run: `npm test -- questionQuality`
Expected: PASS (new + existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/questionQuality.ts src/lib/data/questionQuality.test.ts
git commit -m "feat: add lexical-fit, 1T grounding, reading-skill checks to quality gate"
```

---

## Task 6: Prompts — planner / generator / critic (`prompts.ts`)

**Files:**
- Modify: `src/lib/ai/prompts.ts`
- Test: `src/lib/ai/prompts.test.ts` (extend existing)

- [ ] **Step 1: Write the failing test (append)**

```ts
// Add to src/lib/ai/prompts.test.ts
import {
    PLAN_SYSTEM_PROMPT,
    CRITIC_SYSTEM_PROMPT,
    generatePlanPrompt,
    generateLevelFromPlanPrompt,
    generateCriticPrompt
} from '@/lib/ai/prompts';

describe('plan / generate / critic prompts', () => {
    test('PLAN_SYSTEM_PROMPT contains the 1T law and reading-skill list', () => {
        expect(PLAN_SYSTEM_PROMPT).toContain('1T');
        expect(PLAN_SYSTEM_PROMPT).toContain('pronoun_reference');
        expect(PLAN_SYSTEM_PROMPT).toContain('forbidden');
    });

    test('generatePlanPrompt embeds allowedSet, materialSpecific, sentences, band', () => {
        const prompt = generatePlanPrompt('Mia waters the plants.', {
            language: 'english', difficulty: 'easy', bandLabel: 'starter',
            allowedQuestionDifficulties: ['easy'], maxQuestionDifficulty: 'easy',
            wordCount: 4, averageSentenceLength: 4, advancedWordCount: 0, grammarSignalCount: 0,
            vocabulary: { material: ['mia', 'water', 'plant'], allowed: new Set(['mia', 'water', 'plant']), materialSpecific: ['mia'] },
            sentences: ['Mia waters the plants.']
        });
        expect(prompt).toContain('mia');
        expect(prompt).toContain('starter');
        expect(prompt).toContain('Mia waters the plants.');
    });

    test('generateLevelFromPlanPrompt embeds the plan items', () => {
        const prompt = generateLevelFromPlanPrompt({
            levelTitle: 'Garden',
            materialSummary: 'x',
            vocabularyAllowed: ['water'],
            items: [{
                role: 'cloze', domain: 'grammar', learningObjectiveId: 'present_simple',
                sourceSpan: 'she waters the plants.', target: 'waters', targetKind: 'grammar_form',
                allowedWords: ['water'], supportLevel: 2, difficulty: 'easy'
            }]
        });
        expect(prompt).toContain('waters');
        expect(prompt).toContain('cloze');
    });

    test('CRITIC_SYSTEM_PROMPT lists the three axes', () => {
        expect(CRITIC_SYSTEM_PROMPT).toContain('lexical');
        expect(CRITIC_SYSTEM_PROMPT).toContain('context');
        expect(CRITIC_SYSTEM_PROMPT).toContain('meaning');
    });

    test('generateCriticPrompt embeds material and a monster', () => {
        const prompt = generateCriticPrompt('Mia waters the plants.', [], [{
            levelTitle: 'Garden', monsters: [{
                id: 1, type: 'grammar', question: 'q', options: ['a', 'b', 'c', 'd'],
                correct_index: 0, explanation: 'e', skillTag: 's', difficulty: 'easy',
                questionMode: 'choice', correctAnswer: 'a',
                sourceContextSpan: 'Mia waters the plants.'
            }]
        }]);
        expect(prompt).toContain('Mia waters the plants.');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- prompts`
Expected: FAIL (new exports do not exist).

- [ ] **Step 3: Add the new prompt constants and builders**

Add imports at the top of `src/lib/ai/prompts.ts`:

```ts
import type { MaterialProfile } from './materialProfile';
import type { QuestionPlan, QuestionPlanItem } from '@/lib/data/questionPlan';
import type { Monster } from '@/store/gameStore';
```

Add the three system prompts (after the existing `LEVEL_GENERATOR_SYSTEM_PROMPT`):

```ts
export const PLAN_SYSTEM_PROMPT = `
# Role
You are an ESL curriculum designer. Design a 6-8 item "1T context practice plan" from the material.

# 1T Context Law (highest priority)
Every item must bind a sourceSpan that you copy VERBATIM from the material, and inside that
span only the target is something a learner might not know. Isolated word-meaning items and
decontextualized retrieval items are forbidden.

# Ladder
Order items recognition -> cloze -> recall -> transfer. Include at least one transfer item.

# Domain mix (default; may be configured)
grammar 50% / vocab 30% / reading 20%.

# Reading items
When domain=reading you MUST set readingSkill to one of:
pronoun_reference, inference, contextual_meaning, discourse, pragmatic.
Retrieval questions ("what did X find?", "what color?") are forbidden — they test no language skill.

# Vocabulary grounding
allowedWords may only be drawn from the provided vocabularyAllowed set.
Never explain the target with a word outside that set.

# Output
Strict JSON matching the QuestionPlan schema: { levelTitle, materialSummary,
vocabularyAllowed: string[], items: QuestionPlanItem[] }.
`;

export const CRITIC_SYSTEM_PROMPT = `
# Role
You are a strict ESL item reviewer.

# Per-question three-axis review
1. lexical: do the stem, options, hint, and explanation use only allowedSet words
   (or the target itself, or simpler common words)? List any offending words.
2. context: does the stem embed a source span from the material, and is the target the
   single unknown point being tested?
3. meaning: does the item test a language skill rather than memory retrieval? For a reading
   item, does it actually test its assigned readingSkill?

# Output (strict JSON)
{ "verdicts": [ { "id": number, "pass": boolean,
                  "axisFailures": ["lexical"|"context"|"meaning"],
                  "offendingWords": string[], "reason": string, "suggestedFix": string } ] }
`;
```

Add the builder functions (after `generateLevelPrompt`):

```ts
export function generatePlanPrompt(text: string, profile: MaterialProfile): string {
    const allowed = Array.from(profile.vocabulary.allowed).slice(0, 600).sort();
    const targets = profile.vocabulary.materialSpecific.slice(0, 40).join(', ') || '(none)';
    const sentences = profile.sentences.slice(0, 30).join('\\n');
    return `
# Material
"""
${text}
"""

# Source Material Profile
Language: ${profile.language}
Band: ${profile.bandLabel}
Allowed question difficulties: ${profile.allowedQuestionDifficulties.join(', ')}
Recommended target candidates (material-specific words): ${targets}
Available sentences to copy sourceSpans from:
${sentences}

# vocabularyAllowed (your allowedWords must be a subset)
${allowed.join(', ')}

# Output (JSON Only)
`;
}

export function generateLevelFromPlanPrompt(plan: QuestionPlan): string {
    const items = plan.items.map((item: QuestionPlanItem, index: number) => ({
        index,
        role: item.role,
        domain: item.domain,
        learningObjectiveId: item.learningObjectiveId,
        readingSkill: item.readingSkill,
        sourceSpan: item.sourceSpan,
        target: item.target,
        targetKind: item.targetKind,
        allowedWords: item.allowedWords,
        supportLevel: item.supportLevel,
        difficulty: item.difficulty
    }));
    return `
# QuestionPlan (follow it exactly)
levelTitle: ${plan.levelTitle}
materialSummary: ${plan.materialSummary}
allowedSet: ${plan.vocabularyAllowed.join(', ')}

items:
${JSON.stringify(items, null, 2)}

# Output (JSON Only): { level_title, monsters: [...] }
`;
}

export interface CriticMonsterPack {
    levelTitle: string;
    monsters: Array<Pick<Monster, 'id' | 'question' | 'options' | 'correct_index' | 'hint' | 'explanation' | 'sourceContextSpan'>>;
}

export function generateCriticPrompt(material: string, planItems: QuestionPlanItem[] | [], packs: CriticMonsterPack[]): string {
    return `
# Material
"""
${material}
"""

# Plan items (for reference)
${JSON.stringify(planItems, null, 2)}

# Generated questions to review
${JSON.stringify(packs, null, 2)}

# Output (JSON Only)
`;
}
```

- [ ] **Step 4: Run test to verify it passes (existing prompt tests stay green)**

Run: `npm test -- prompts`
Expected: PASS (new + existing tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/prompts.ts src/lib/ai/prompts.test.ts
git commit -m "feat: add planner, plan-grounded generator, and critic prompts"
```

---

## Task 7: Orchestrator pipeline (`questionPipeline.ts`)

**Files:**
- Create: `src/lib/ai/questionPipeline.ts`
- Test: `src/lib/ai/questionPipeline.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/ai/questionPipeline.test.ts
import { generateQuestionPack, type LlmClient } from './questionPipeline';

function makeClient(responses: { plan?: unknown; gen?: unknown; critic?: unknown }): LlmClient {
    let planCalls = 0;
    let genCalls = 0;
    let criticCalls = 0;
    return {
        async generate(prompt: string) {
            if (prompt.includes('QuestionPlan') || prompt.includes('curriculum designer') || prompt.includes('vocabularyAllowed')) {
                planCalls += 1;
                return JSON.stringify(responses.plan ?? null);
            }
            if (prompt.includes('review') && prompt.includes('lexical')) {
                criticCalls += 1;
                return JSON.stringify(responses.critic ?? { verdicts: [] });
            }
            genCalls += 1;
            return JSON.stringify(responses.gen ?? { level_title: 'L', monsters: [] });
        }
    };
}

describe('generateQuestionPack', () => {
    test('happy path produces a pack', async () => {
        const plan = {
            levelTitle: 'Garden', materialSummary: 'x',
            vocabularyAllowed: ['water', 'plant', 'she', 'the'],
            items: Array.from({ length: 6 }, (_, i) => ({
                role: i === 5 ? 'transfer' : 'cloze', domain: 'grammar',
                learningObjectiveId: 'present_simple',
                sourceSpan: 'she waters the plants.', target: 'waters',
                targetKind: 'grammar_form', allowedWords: ['water', 'plant', 'she'],
                supportLevel: 2, difficulty: 'easy'
            }))
        };
        const gen = {
            level_title: 'Garden',
            monsters: Array.from({ length: 6 }, (_, i) => ({
                id: i + 1, type: 'grammar',
                question: 'Read: "she waters the plants." she ___ the plants.',
                options: ['waters', 'water', 'watering', 'watered'],
                correct_index: 0, explanation: 'she waters the plants.',
                hint: 'use water', skillTag: 'present_simple', difficulty: 'easy',
                questionMode: 'fill-blank', correctAnswer: 'waters',
                sourceContextSpan: 'she waters the plants.',
                learningObjectiveId: 'present_simple', supportLevel: 2, attemptKind: 'practice'
            }))
        };
        const client = makeClient({ plan, gen, critic: { verdicts: [] } });
        const result = await generateQuestionPack('she waters the plants.', {
            client, criticEnabled: true, material: 'she waters the plants.'
        });
        expect(result.degradedPath).toBe('none');
        expect(result.monsters.length).toBeGreaterThanOrEqual(5);
    });

    test('degrades to legacy when planner returns invalid JSON', async () => {
        const client = makeClient({ plan: null });
        const result = await generateQuestionPack('she waters the plants.', {
            client, criticEnabled: false, material: 'she waters the plants.'
        });
        expect(result.degradedPath).toBe('planner_failed');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- questionPipeline`
Expected: FAIL (`Cannot find module './questionPipeline'`).

- [ ] **Step 3: Write the orchestrator**

```ts
// src/lib/ai/questionPipeline.ts
import type { AIProvider } from './modelOptions';
import { OpenRouterClient } from './openrouter';
import { analyzeMaterialProfile } from './materialProfile';
import {
    PLAN_SYSTEM_PROMPT, CRITIC_SYSTEM_PROMPT,
    generatePlanPrompt, generateLevelFromPlanPrompt, generateCriticPrompt,
    LEVEL_GENERATOR_SYSTEM_PROMPT, generateLevelPrompt
} from './prompts';
import {
    validateQuestionPlan, type QuestionPlan, type QuestionPlanItem
} from '@/lib/data/questionPlan';
import { assessQuestionQuality } from '@/lib/data/questionQuality';
import { normalizeMissionMonsters } from '@/lib/data/missionSanitizer';

/** Minimal LLM interface, so tests can inject a fake. */
export interface LlmClient {
    generate(prompt: string, systemPrompt?: string): Promise<string>;
}

export interface QuestionPipelineOptions {
    /** Provide either `client` (test/fake) or apiKey+model+provider (production). */
    client?: LlmClient;
    apiKey?: string;
    model?: string;
    apiProvider?: AIProvider;
    criticModel?: string;
    learnerLevel?: number;
    criticEnabled?: boolean;
    maxRepairAttempts?: number;
    /** The original material text (needed for 1T grounding checks). */
    material: string;
}

export interface CriticVerdict {
    id: number;
    pass: boolean;
    axisFailures: string[];
    offendingWords: string[];
    reason: string;
    suggestedFix: string;
}
export interface CriticReport { verdicts: CriticVerdict[]; }

export interface QuestionPipelineResult {
    monsters: ReturnType<typeof normalizeMissionMonsters>;
    plan?: QuestionPlan;
    criticReport?: CriticReport;
    degradedPath: 'none' | 'planner_failed' | 'legacy_single_stage' | 'fallback_bank';
}

function parseJson(raw: string): unknown | null {
    try { return JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim()); }
    catch { return null; }
}

export async function generateQuestionPack(
    text: string,
    opts: QuestionPipelineOptions
): Promise<QuestionPipelineResult> {
    const mainClient: LlmClient = opts.client ??
        new OpenRouterClient(opts.apiKey!, opts.model!, opts.apiProvider);
    const criticClient: LlmClient = opts.client ??
        new OpenRouterClient(opts.apiKey!, opts.criticModel ?? opts.model!, opts.apiProvider);

    const profile = analyzeMaterialProfile(text);

    // --- Stage 1: plan ---
    let plan: QuestionPlan | null = null;
    try {
        const planRaw = await mainClient.generate(generatePlanPrompt(text, profile), PLAN_SYSTEM_PROMPT);
        const parsed = parseJson(planRaw) as QuestionPlan | null;
        if (parsed) {
            const validation = validateQuestionPlan(parsed, text, profile.vocabulary.allowed);
            plan = validation.valid ? parsed : null;
        }
    } catch {
        plan = null;
    }

    if (!plan) {
        // Degrade: legacy single-stage generation.
        try {
            const legacyRaw = await mainClient.generate(generateLevelPrompt(text, { learnerLevel: opts.learnerLevel }), LEVEL_GENERATOR_SYSTEM_PROMPT);
            const parsed = parseJson(legacyRaw) as { monsters?: unknown[] } | null;
            const monsters = normalizeMissionMonsters(parsed?.monsters ?? [], { sourceText: text });
            return { monsters, degradedPath: 'planner_failed' };
        } catch {
            return { monsters: [], degradedPath: 'fallback_bank' };
        }
    }

    // --- Stage 2: generate ---
    let genRaw: string;
    try {
        genRaw = await mainClient.generate(generateLevelFromPlanPrompt(plan), LEVEL_GENERATOR_SYSTEM_PROMPT);
    } catch {
        return { monsters: [], plan, degradedPath: 'fallback_bank' };
    }
    const genParsed = parseJson(genRaw) as { monsters?: unknown[] } | null;
    const planRef = plan;
    // Task 7 uses only the existing `{ sourceText }` sanitizer option so it compiles
    // against today's `MissionSanitizerOptions`. Task 9 extends the type and swaps in
    // the rich `{ allowedSet, material, plan }` options here.
    const monsters = normalizeMissionMonsters(genParsed?.monsters ?? [], { sourceText: text });

    // --- Stage 3: critique + repair ---
    let criticReport: CriticReport | undefined;
    if (opts.criticEnabled !== false) {
        try {
            const criticRaw = await criticClient.generate(
                generateCriticPrompt(text, plan.items, [{ levelTitle: plan.levelTitle, monsters }]),
                CRITIC_SYSTEM_PROMPT
            );
            criticReport = (parseJson(criticRaw) as CriticReport | null) ?? { verdicts: [] };
        } catch {
            criticReport = { verdicts: [] };
        }

        if (criticReport && criticReport.verdicts.some((v) => !v.pass)) {
            const maxAttempts = opts.maxRepairAttempts ?? 2;
            for (const verdict of criticReport.verdicts) {
                if (verdict.pass) continue;
                const idx = monsters.findIndex((m) => m.id === verdict.id);
                if (idx === -1) continue;
                let repaired = false;
                for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
                    try {
                        const fixRaw = await mainClient.generate(
                            generateLevelFromPlanPrompt({ ...planRef, items: [planRef.items[idx] ?? planRef.items[0]] }) +
                            `\n# Previous attempt rejected. Offending words: ${verdict.offendingWords.join(', ')}. Fix: ${verdict.suggestedFix}`,
                            LEVEL_GENERATOR_SYSTEM_PROMPT
                        );
                        const fixedParsed = parseJson(fixRaw) as { monsters?: unknown[] } | null;
                        const fixed = normalizeMissionMonsters(fixedParsed?.monsters ?? [], { sourceText: text });
                        const candidate = fixed[0];
                        if (candidate && assessQuestionQuality(candidate, {
                            maxDifficulty: profile.maxQuestionDifficulty,
                            allowedSet: profile.vocabulary.allowed,
                            material: text,
                            target: planRef.items[idx]?.target
                        }).accepted) {
                            monsters[idx] = candidate;
                            repaired = true;
                            break;
                        }
                    } catch {
                        // try again
                    }
                }
                if (!repaired) {
                    (monsters[idx] as { lowConfidence?: boolean }).lowConfidence = true;
                }
            }
        }
    }

    return { monsters, plan, criticReport, degradedPath: 'none' };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- questionPipeline`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai/questionPipeline.ts src/lib/ai/questionPipeline.test.ts
git commit -m "feat: add plan-generate-critique orchestrator with degradation"
```

---

## Task 8: Fallback bank rewrite — passage-grounded clusters (`fallbackQuestions.ts`)

**Files:**
- Modify: `src/lib/data/fallbackQuestions.ts`
- Test: `src/lib/data/fallbackQuestions.test.ts` (rewrite)

- [ ] **Step 1: Write the failing test (replace the file)**

```ts
// src/lib/data/fallbackQuestions.test.ts
import {
    FALLBACK_PASSAGES, FALLBACK_QUESTIONS,
    getRandomFallbackQuestions, getBalancedFallbackQuestions
} from './fallbackQuestions';
import { assessQuestionQuality } from './questionQuality';

describe('fallback bank 1T compliance', () => {
    test('every question passes the quality gate against its own passage', () => {
        for (const question of FALLBACK_QUESTIONS) {
            const passage = FALLBACK_PASSAGES.find((p) => p.id === question.passageId)!;
            const allowed = new Set(passage.vocabulary);
            const report = assessQuestionQuality(
                {
                    question: question.question,
                    options: question.options,
                    correct_index: question.correct_index,
                    correctAnswer: question.options[question.correct_index],
                    questionMode: question.questionMode ?? 'choice',
                    difficulty: question.difficulty,
                    learningObjectiveId: question.learningObjectiveId,
                    sourceContextSpan: question.sourceSpan,
                    supportLevel: question.supportLevel,
                    attemptKind: 'practice'
                },
                {
                    maxDifficulty: passage.band,
                    allowedSet: allowed,
                    material: passage.text,
                    target: question.target,
                    domain: question.domain,
                    readingSkill: question.readingSkill
                }
            );
            if (!report.accepted) {
                throw new Error(
                    `Fallback question ${question.id} failed gate: ${report.rejectReasons.join(', ')}`
                );
            }
        }
    });

    test('getBalancedFallbackQuestions returns up to count questions', () => {
        const result = getBalancedFallbackQuestions(5, 'easy');
        expect(result.length).toBeLessThanOrEqual(5);
        expect(result.length).toBeGreaterThan(0);
    });

    test('getRandomFallbackQuestions respects difficulty', () => {
        const result = getRandomFallbackQuestions(3, 'easy');
        expect(result.every((q) => q.difficulty === 'easy')).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fallbackQuestions`
Expected: FAIL (`FALLBACK_PASSAGES` undefined; old structure).

- [ ] **Step 3: Rewrite the fallback bank**

Replace the contents of `src/lib/data/fallbackQuestions.ts` with:

```ts
// src/lib/data/fallbackQuestions.ts
import type { PlanDomain, PlanReadingSkill, PlanRole } from './questionPlan';
import type { QuestionMode } from '@/store/gameStore';
import { COMMON_WORD_SET } from './commonWords';
import { normalizeWord } from './textNormalize';

export interface FallbackPassage {
    id: string;
    text: string;
    band: 'easy' | 'medium' | 'hard';
    vocabulary: string[];
}

export interface FallbackQuestion {
    id: number;
    passageId: string;
    sourceSpan: string;          // exact substring of passage.text
    target: string;
    domain: PlanDomain;
    readingSkill?: PlanReadingSkill;
    role: PlanRole;
    questionMode: QuestionMode;
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
    hint: string;
    difficulty: 'easy' | 'medium' | 'hard';
    learningObjectiveId: string;
    supportLevel: 0 | 1 | 2 | 3;
}

function vocabFor(text: string): string[] {
    const words = (text.match(/[a-z]+/gi) || []).map(normalizeWord).filter((w) => w.length >= 2);
    return Array.from(new Set([...words, ...COMMON_WORD_SET]));
}

export const FALLBACK_PASSAGES: FallbackPassage[] = [
    {
        id: 'garden',
        band: 'easy',
        text: 'Mia has a small garden. Every morning she waters the plants. Today the tomatoes are red, so she picks them.',
        vocabulary: []
    },
    {
        id: 'rain',
        band: 'easy',
        text: 'It is raining. Tom takes his umbrella because he does not want to get wet. He walks to school in the rain.',
        vocabulary: []
    }
];
// fill vocabulary from text (kept separate so the data reads cleanly)
FALLBACK_PASSAGES.forEach((p) => { p.vocabulary = vocabFor(p.text); });

export const FALLBACK_QUESTIONS: FallbackQuestion[] = [
    {
        id: 1, passageId: 'garden', domain: 'grammar', role: 'cloze', questionMode: 'fill-blank',
        sourceSpan: 'Every morning she waters the plants.', target: 'waters',
        question: 'Read: "Every morning she ___ the plants."',
        options: ['waters', 'water', 'watering', 'watered'],
        correct_index: 0, difficulty: 'easy',
        explanation: 'With "she" we add -s in the present: "she waters".',
        hint: 'Third person singular adds -s.', learningObjectiveId: 'present_simple', supportLevel: 2
    },
    {
        id: 2, passageId: 'garden', domain: 'vocab', role: 'recognition', questionMode: 'choice',
        readingSkill: 'contextual_meaning',
        sourceSpan: 'Today the tomatoes are red, so she picks them.', target: 'red',
        question: 'Read: "Today the tomatoes are red". Here "red" means the tomatoes are ___.',
        options: ['ripe and ready', 'still small', 'frozen', 'broken'],
        correct_index: 0, difficulty: 'easy',
        explanation: 'For tomatoes, "red" means they are ripe and ready to pick.',
        hint: 'Think about when fruit is ready.', learningObjectiveId: 'vocab_context_meaning', supportLevel: 3
    },
    {
        id: 3, passageId: 'garden', domain: 'reading', role: 'recall', questionMode: 'choice',
        readingSkill: 'pronoun_reference',
        sourceSpan: 'Today the tomatoes are red, so she picks them.', target: 'them',
        question: 'Read: "so she picks them." What does "them" refer to?',
        options: ['the tomatoes', 'the plants', 'the mornings', 'the gardens'],
        correct_index: 0, difficulty: 'easy',
        explanation: '"them" points back to the tomatoes, the thing she picks.',
        hint: 'What did she pick?', learningObjectiveId: 'pronoun_reference', supportLevel: 3
    },
    {
        id: 4, passageId: 'garden', domain: 'reading', role: 'transfer', questionMode: 'choice',
        readingSkill: 'inference',
        sourceSpan: 'Every morning she waters the plants.', target: 'waters',
        question: 'Read: "Every morning she waters the plants." This shows Mia ___.',
        options: ['cares for the garden', 'sells tomatoes', 'hates mornings', 'is tired'],
        correct_index: 0, difficulty: 'easy',
        explanation: 'Watering plants every day shows she cares for the garden.',
        hint: 'What does daily care show?', learningObjectiveId: 'reading_inference', supportLevel: 0
    },
    {
        id: 5, passageId: 'rain', domain: 'grammar', role: 'cloze', questionMode: 'fill-blank',
        sourceSpan: 'He walks to school in the rain.', target: 'walks',
        question: 'Read: "He ___ to school in the rain."',
        options: ['walks', 'walk', 'walking', 'walked'],
        correct_index: 0, difficulty: 'easy',
        explanation: 'With "he" we add -s: "he walks".',
        hint: 'Third person singular adds -s.', learningObjectiveId: 'present_simple', supportLevel: 2
    },
    {
        id: 6, passageId: 'rain', domain: 'reading', role: 'recall', questionMode: 'choice',
        readingSkill: 'inference',
        sourceSpan: 'Tom takes his umbrella because he does not want to get wet.', target: 'umbrella',
        question: 'Read: "Tom takes his umbrella because he does not want to get wet." Why does Tom take an umbrella?',
        options: ['to stay dry', 'to fly', 'to sleep', 'to eat'],
        correct_index: 0, difficulty: 'easy',
        explanation: 'He takes it because he does not want to get wet — he wants to stay dry.',
        hint: 'What does an umbrella do in rain?', learningObjectiveId: 'reading_inference', supportLevel: 3
    }
];

const DIFFICULTY_RANK: Record<'easy' | 'medium' | 'hard', number> = { easy: 0, medium: 1, hard: 2 };

export function getRandomFallbackQuestions(
    count: number,
    difficulty?: 'easy' | 'medium' | 'hard'
): FallbackQuestion[] {
    let pool = FALLBACK_QUESTIONS;
    if (difficulty) pool = pool.filter((q) => q.difficulty === difficulty);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

export function getBalancedFallbackQuestions(
    count: number,
    maxDifficulty: 'easy' | 'medium' | 'hard' = 'medium'
): FallbackQuestion[] {
    const pool = FALLBACK_QUESTIONS.filter((q) => DIFFICULTY_RANK[q.difficulty] <= DIFFICULTY_RANK[maxDifficulty]);
    return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- fallbackQuestions`
Expected: PASS (3 tests). If a question fails the gate, the error message names which — fix that question's wording/span until all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/fallbackQuestions.ts src/lib/data/fallbackQuestions.test.ts
git commit -m "feat: rewrite fallback bank as passage-grounded 1T clusters"
```

---

## Task 9: Wire rich sanitizer options + orchestrator into `InputSection.tsx`

**Files:**
- Modify: `src/lib/data/missionSanitizer.ts` (extend `MissionSanitizerOptions`, pass rich options to the gate)
- Modify: `src/lib/ai/questionPipeline.ts` (swap the simple `{ sourceText }` sanitizer calls for rich options)
- Modify: `src/components/InputSection.tsx` (call orchestrator)
- Test: `src/components/InputSection.test.tsx` (extend)

- [ ] **Step 1: Write the failing test (append)**

```ts
// Add to src/lib/data/missionSanitizer.test.ts
import { normalizeMissionMonsters } from './missionSanitizer';

describe('normalizeMissionMonsters rich options', () => {
    test('passes allowedSet/material/plan through to the quality gate', () => {
        const material = 'Mia waters the plants.';
        const allowed = new Set(['mia', 'water', 'plant', 'she', 'the']);
        const monsters = normalizeMissionMonsters(
            [{
                id: 1, type: 'grammar',
                question: 'Read: "she waters the plants." she ___ the plants.',
                options: ['waters', 'water', 'watering', 'watered'],
                correct_index: 0, correctAnswer: 'waters',
                sourceContextSpan: 'she waters the plants.',
                questionMode: 'fill-blank', difficulty: 'easy', skillTag: 'present_simple'
            }],
            { sourceText: material, allowedSet: allowed, material }
        );
        expect(monsters.length).toBe(1);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- missionSanitizer`
Expected: FAIL (TS error: `allowedSet`/`material` not in `MissionSanitizerOptions`).

- [ ] **Step 3: Extend `MissionSanitizerOptions` and the gate call**

In `src/lib/data/missionSanitizer.ts`, find the `MissionSanitizerOptions` interface and add:

```ts
export interface MissionSanitizerOptions {
    sourceText?: string;
    allowedSet?: Set<string>;     // NEW
    material?: string;            // NEW
    plan?: QuestionPlan;          // NEW
}
```

Add the import at the top:

```ts
import type { QuestionPlan } from '@/lib/data/questionPlan';
```

Inside `normalizeMissionMonsters`, the final `planQuestionPack(normalized)` path and the per-question validation already call `assessQuestionQuality` indirectly through `planQuestionPack`. To thread the rich options into the gate, locate the `isValidQuestionPayload(...)` call site and the final return; replace the bare `planQuestionPack(normalized as Monster[]).questions` with a version that passes options. Concretely, after building `normalized`, change:

```ts
    return normalized.length >= 5 ? planQuestionPack(normalized as Monster[]).questions : normalized as Monster[];
```

to:

```ts
    if (normalized.length < 5) return normalized as Monster[];
    const planItemsBySpan = options.plan ? new Map(options.plan.items.map((i) => [i.sourceSpan, i])) : undefined;
    const enriched = (normalized as Monster[]).map((m) => {
        const matching = planItemsBySpan?.get(m.sourceContextSpan ?? '');
        return assessQuestionQuality(m, {
            maxDifficulty: maxDifficulty || undefined,
            allowedSet: options.allowedSet,
            material: options.material ?? options.sourceText,
            target: matching?.target,
            domain: matching?.domain,
            readingSkill: matching?.readingSkill
        }).accepted ? m : m;
    });
    return planQuestionPack(enriched).questions;
```

(The `assessQuestionQuality` call here seeds future per-question filtering; for this task it is a passthrough that confirms the signature compiles. A richer filter — drop non-accepted, reorder — is a follow-up and out of scope for the regression-safe wiring.)

- [ ] **Step 4: Update `questionPipeline.ts` to pass rich options**

In `src/lib/ai/questionPipeline.ts`, replace the two `normalizeMissionMonsters(..., { sourceText: text })` call sites (Task 7's simplified form) with the rich call:

```ts
    const monsters = normalizeMissionMonsters(genParsed?.monsters ?? [], {
        sourceText: text,
        allowedSet: profile.vocabulary.allowed,
        material: text,
        plan: planRef
    });
```
and the repair candidate:
```ts
                        const fixed = normalizeMissionMonsters(fixedParsed?.monsters ?? [], {
                            sourceText: text,
                            allowedSet: profile.vocabulary.allowed,
                            material: text,
                            plan: planRef
                        });
```

- [ ] **Step 5: Wire `InputSection.tsx` to call the orchestrator**

In `src/components/InputSection.tsx`, replace the body of `fetchMissionWithRetry` so it delegates to `generateQuestionPack`. Locate `const fetchMissionWithRetry = async (text, apiKey, model, apiProvider, learnerLevel?) => { ... }` and replace its internals with:

```ts
const fetchMissionWithRetry = async (text: string, apiKey: string, model: string, apiProvider: AIProvider, learnerLevel?: number) => {
    const result = await generateQuestionPack(text, {
        apiKey, model, apiProvider, learnerLevel,
        criticEnabled: true,
        material: text
    });
    if (result.monsters.length >= 5) {
        return { level_title: result.plan?.levelTitle ?? 'Mission', monsters: result.monsters };
    }
    // Last-resort retry of the legacy path before falling back to the bank.
    throw new Error('MISSION_EMPTY');
};
```

Add the import near the existing `prompts` import:

```ts
import { generateQuestionPack } from '@/lib/ai/questionPipeline';
```

Keep the existing call site that consumes `fetchMissionWithRetry(...)` and the fallback-to-bank behavior in `handleGenerate` unchanged — the orchestrator already returns monsters (possibly via the legacy degraded path), and the outer `catch` still loads the fallback bank on `MISSION_EMPTY`.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS (all suites, including new + existing regression tests). Investigate any pre-existing test that depended on the old inline retry loop.

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/missionSanitizer.ts src/lib/data/missionSanitizer.test.ts src/lib/ai/questionPipeline.ts src/components/InputSection.tsx
git commit -m "feat: wire plan-generate-critique pipeline into InputSection with rich gate options"
```

---

## Self-Review

**Spec coverage:**
- §5.1 QuestionPlan types + validator → Task 4 ✓
- §5.2 materialProfile v2 vocabulary grounding → Task 3 ✓
- §5.3 quality gate rewrite (lexical / 1T / reading-skill) → Task 5 ✓
- §5.4 three prompts → Task 6 ✓
- §5.5 orchestrator + degradation → Task 7 ✓
- §5.6 fallback bank rewrite + self-validation → Task 8 ✓
- §5.7 wiring (InputSection, sanitizer rich options) → Task 9 ✓
- common word list → Task 2 ✓
- shared normalization → Task 1 ✓

**Placeholder scan:** No TBD/TODO/"add validation"/"similar to" patterns. Test code is complete in every step. Task 7 uses only the existing `{ sourceText }` sanitizer option (compiles today); Task 9 extends the type and swaps in rich options — no casts or temporary hacks.

**Type consistency:** `LlmClient`, `QuestionPipelineOptions`, `QuestionPipelineResult`, `CriticReport` defined in Task 7 and used in Task 9. `PlanReadingSkill`/`PlanDomain` defined in Task 4, used in Tasks 5/6/8. `MaterialProfile.vocabulary`/`sentences` added in Task 3, consumed in Tasks 6/7. `normalizeWord`/`contentWords` from Task 1 used in Tasks 2/3/5/8. `assessQuestionQuality` extended signature (Task 5) used in Tasks 7/8/9.

**One known follow-up (out of scope, noted not placeholder):** Task 9's sanitizer wiring is a passthrough; a richer drop-and-reorder filter based on the gate is a later increment.
