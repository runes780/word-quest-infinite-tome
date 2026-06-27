import { replaceFailedMonsters } from './safetyNet';
import type { Monster } from '@/store/gameStore';
import type { QuestionPlan } from './questionPlan';
import { COMMON_WORD_SET } from './commonWords';
import { normalizeWord } from './textNormalize';

const plan: QuestionPlan = {
    levelTitle: 't',
    materialSummary: 'm',
    vocabularyAllowed: [],
    items: [
        {
            role: 'cloze', domain: 'grammar', learningObjectiveId: 'present_simple',
            sourceSpan: 'She waters the plants.', target: 'waters', targetKind: 'word',
            allowedWords: [], supportLevel: 2, difficulty: 'easy',
        },
        {
            role: 'recognition', domain: 'vocab', learningObjectiveId: 'vocab_context_meaning',
            sourceSpan: 'The tomatoes are red.', target: 'red', targetKind: 'word',
            allowedWords: [], supportLevel: 3, difficulty: 'easy',
        },
    ],
};

function monster(id: number, type: Monster['type']): Monster {
    return {
        id, type, question: 'bad unfaithful', options: ['a', 'b', 'c', 'd'],
        correct_index: 0, explanation: '', skillTag: 'x', difficulty: 'easy',
        questionMode: 'choice', correctAnswer: 'a',
    };
}

describe('replaceFailedMonsters', () => {
    test('replaces a failed cloze slot with a material-grounded template monster', () => {
        const monsters = [monster(0, 'grammar'), monster(1, 'vocab')];
        const materialWords = ['she', 'waters', 'the', 'plants', 'tomatoes', 'red'].map(normalizeWord);
        const allowedSet = new Set([...materialWords, ...COMMON_WORD_SET]);
        const out = replaceFailedMonsters(monsters, [0], plan, {
            allowedSet,
            material: 'She waters the plants.',
            maxDifficulty: 'easy',
        });
        expect(out[0].verb).toBe('recall');
        expect(out[0].sourceContextSpan).toBe('She waters the plants.');
        expect(out[0].correctAnswer).toBe('waters');
        expect(out[0].questionMode).toBe('fill-blank');
    });

    test('leaves non-failed slots untouched', () => {
        const monsters = [monster(0, 'grammar'), monster(1, 'vocab')];
        const materialWords = ['she', 'waters', 'the', 'plants'].map(normalizeWord);
        const allowedSet = new Set([...materialWords, ...COMMON_WORD_SET]);
        const out = replaceFailedMonsters(monsters, [0], plan, {
            allowedSet,
            material: 'She waters the plants.',
            maxDifficulty: 'easy',
        });
        expect(out[1]).toBe(monsters[1]);
    });

    test('returns original length and order', () => {
        const monsters = [monster(0, 'grammar'), monster(1, 'vocab')];
        const materialWords = ['she', 'waters', 'the', 'plants'].map(normalizeWord);
        const allowedSet = new Set([...materialWords, ...COMMON_WORD_SET]);
        const out = replaceFailedMonsters(monsters, [1], plan, {
            allowedSet,
            material: 'She waters the plants.',
            maxDifficulty: 'easy',
        });
        expect(out).toHaveLength(2);
    });

    test('falls back to the question bank when the template cannot build (transfer role)', () => {
        const transferPlan: QuestionPlan = {
            ...plan,
            items: [
                {
                    role: 'transfer', domain: 'reading', learningObjectiveId: 'reading_inference',
                    sourceSpan: 'She waters the plants.', target: 'waters', targetKind: 'inference',
                    allowedWords: [], supportLevel: 0, difficulty: 'easy',
                },
                plan.items[1],
            ],
        };
        const monsters = [monster(0, 'reading'), monster(1, 'vocab')];
        const out = replaceFailedMonsters(monsters, [0], transferPlan, {
            allowedSet: new Set(['she', 'waters', 'the', 'plants']),
            material: 'She waters the plants.',
            maxDifficulty: 'easy',
        });
        // template returns null for transfer -> bank replacement; never ships the original
        expect(out[0].id).toBe(0);
        expect(out[0].question).not.toBe('bad unfaithful');
    });

    test('uses the monster id (not array position) to look up its plan item when monsters were role-reordered', () => {
        // plan.items[0] = "walks"; plan.items[1] = "waters"
        const reorderedPlan: QuestionPlan = {
            levelTitle: 't',
            materialSummary: 'm',
            vocabularyAllowed: [],
            items: [
                {
                    role: 'cloze', domain: 'grammar', learningObjectiveId: 'present_simple',
                    sourceSpan: 'He walks to school.', target: 'walks', targetKind: 'word',
                    allowedWords: [], supportLevel: 2, difficulty: 'easy',
                },
                {
                    role: 'cloze', domain: 'grammar', learningObjectiveId: 'present_simple',
                    sourceSpan: 'She waters the plants.', target: 'waters', targetKind: 'word',
                    allowedWords: [], supportLevel: 2, difficulty: 'easy',
                },
            ],
        };
        // After role-reorder, the monster at array position 0 carries id=1 (its true
        // plan index), i.e. it corresponds to plan.items[1] ("waters"), NOT plan.items[0].
        const monsters = [monster(1, 'grammar'), monster(0, 'grammar')];
        const words = ['he', 'walks', 'to', 'school', 'she', 'waters', 'the', 'plants'].map(normalizeWord);
        const out = replaceFailedMonsters(monsters, [0], reorderedPlan, {
            allowedSet: new Set([...words, ...COMMON_WORD_SET]),
            material: 'He walks to school. She waters the plants.',
            maxDifficulty: 'easy',
        });
        // Must build from the monster's OWN plan item (id=1 -> "waters"), not array position 0.
        expect(out[0].sourceContextSpan).toBe('She waters the plants.');
        expect(out[0].correctAnswer).toBe('waters');
    });
});
