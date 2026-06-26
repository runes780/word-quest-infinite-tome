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
        const monsters = [monster(1, 'grammar'), monster(2, 'vocab')];
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
        const monsters = [monster(1, 'grammar'), monster(2, 'vocab')];
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
        const monsters = [monster(1, 'grammar'), monster(2, 'vocab')];
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
        const monsters = [monster(1, 'reading'), monster(2, 'vocab')];
        const out = replaceFailedMonsters(monsters, [0], transferPlan, {
            allowedSet: new Set(['she', 'waters', 'the', 'plants']),
            material: 'She waters the plants.',
            maxDifficulty: 'easy',
        });
        // template returns null for transfer -> bank replacement; never ships the original
        expect(out[0].id).toBe(1);
        expect(out[0].question).not.toBe('bad unfaithful');
    });
});
