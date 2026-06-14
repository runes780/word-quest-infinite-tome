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
