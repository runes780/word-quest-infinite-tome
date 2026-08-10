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
        item({ role: 'recall', domain: 'reading', readingSkill: 'pronoun_reference', sourceSpan: 'She waters the plants.', target: 'She', targetKind: 'reference', allowedWords: ['mia', 'plant'] }),
        item({ role: 'recall', domain: 'reading', readingSkill: 'inference', sourceSpan: 'Today the tomatoes are red.', target: 'red', targetKind: 'inference', allowedWords: ['tomato', 'red'] }),
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

    test('treats a missing transfer item as advisory, not a rejection', () => {
        const items = sixValidItems().map((i) => ({ ...i, role: 'cloze' as const }));
        const result = validateQuestionPlan(plan(items), MATERIAL, ALLOWED);
        // An otherwise-good plan must not degrade to the legacy path just because
        // the model omitted a transfer item.
        expect(result.valid).toBe(true);
        expect(result.errors.some((e) => e.includes('transfer'))).toBe(false);
        expect(result.warnings.some((w) => w.includes('transfer'))).toBe(true);
    });

    test('does not crash on items missing optional fields (resilience)', () => {
        const items = sixValidItems();
        // Models sometimes omit allowedWords entirely; the validator must not throw.
        delete (items[0] as { allowedWords?: string[] }).allowedWords;
        const result = validateQuestionPlan(plan(items), MATERIAL, ALLOWED);
        expect(result.valid).toBe(true);
    });

    test('rejects a non-array items payload without throwing', () => {
        const malformed = {
            levelTitle: 'Garden',
            materialSummary: 'x',
            vocabularyAllowed: [],
            items: 'not-an-array'
        } as unknown as QuestionPlan;
        expect(() => validateQuestionPlan(malformed, MATERIAL, ALLOWED)).not.toThrow();
        const result = validateQuestionPlan(malformed, MATERIAL, ALLOWED);
        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Plan items must be an array.');
    });

    test('rejects malformed item objects without throwing', () => {
        const malformed = plan(sixValidItems()) as unknown as { items: unknown[] };
        malformed.items[2] = null;
        malformed.items[3] = { sourceSpan: 'She waters the plants.' };
        expect(() => validateQuestionPlan(malformed as unknown as QuestionPlan, MATERIAL, ALLOWED)).not.toThrow();
        const result = validateQuestionPlan(malformed as unknown as QuestionPlan, MATERIAL, ALLOWED);
        expect(result.valid).toBe(false);
        expect(result.errors.some((error) => error.includes('item[2] must be an object'))).toBe(true);
        expect(result.errors.some((error) => error.includes('item[3] role is invalid'))).toBe(true);
    });
});
