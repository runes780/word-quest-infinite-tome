import { replaceFailedMonsters } from './safetyNet';
import type { Monster } from '@/store/gameStore';
import type { QuestionPlan } from './questionPlan';

// Force the fallback bank to be empty so the lowConfidence last-resort path fires.
jest.mock('./fallbackQuestions', () => ({
    ...jest.requireActual('./fallbackQuestions'),
    getBalancedFallbackQuestions: () => [],
}));

const plan: QuestionPlan = {
    levelTitle: 't',
    materialSummary: 'm',
    vocabularyAllowed: [],
    items: [
        {
            role: 'transfer', domain: 'reading', learningObjectiveId: 'reading_inference',
            sourceSpan: 'She waters the plants.', target: 'waters', targetKind: 'inference',
            allowedWords: [], supportLevel: 0, difficulty: 'easy',
        },
    ],
};

test('flags lowConfidence when template fails AND the fallback bank is exhausted', () => {
    const monsters: Monster[] = [
        {
            id: 1, type: 'reading', question: 'bad unfaithful', options: ['a', 'b', 'c', 'd'],
            correct_index: 0, explanation: '', skillTag: 'x', difficulty: 'easy',
            questionMode: 'choice', correctAnswer: 'a',
        },
    ];
    const out = replaceFailedMonsters(monsters, [0], plan, {
        allowedSet: new Set(['she', 'waters', 'the', 'plants']),
        material: 'She waters the plants.',
        maxDifficulty: 'easy',
    });
    expect((out[0] as Monster & { lowConfidence?: boolean }).lowConfidence).toBe(true);
});
