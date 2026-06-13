import type { Monster } from '@/store/gameStore';
import {
    planQuestionPack,
    type QuestionLadderRole,
    type QuestionPackPlan
} from './questionPackPlanner';

function question(id: number, overrides: Partial<Monster> = {}): Monster {
    return {
        id,
        type: 'vocab',
        question: `Read: "The bright star shines at night." What does "bright" mean? ${id}`,
        options: ['shining', 'dark', 'quiet', 'late'],
        correct_index: 0,
        explanation: 'Bright means shining.',
        hint: 'Look for light.',
        skillTag: 'vocab:bright',
        difficulty: 'easy',
        questionMode: 'choice',
        correctAnswer: 'shining',
        learningObjectiveId: 'vocab_context_meaning',
        sourceContextSpan: 'The bright star shines at night.',
        supportLevel: 3,
        attemptKind: 'practice',
        ...overrides
    };
}

describe('question pack planner', () => {
    test('does not force structurally valid choice questions into invalid fill-blank quotas', () => {
        const allChoice = Array.from({ length: 6 }, (_, index) => question(index + 1));

        const plan: QuestionPackPlan = planQuestionPack(allChoice);

        expect(plan.questions).toHaveLength(6);
        expect(plan.questions.every((item) => item.questionMode !== 'fill-blank' || item.question.includes('___'))).toBe(true);
        expect(plan.questions.some((item) => item.attemptKind === 'transfer')).toBe(true);
    });

    test('orders a mixed pack by recognition, cloze, recall, then transfer roles', () => {
        const mixed = [
            question(1, { questionMode: 'typing', supportLevel: 1, attemptKind: 'practice' }),
            question(2, { questionMode: 'choice', supportLevel: 3, attemptKind: 'practice' }),
            question(3, { questionMode: 'typing', supportLevel: 0, attemptKind: 'transfer' }),
            question(4, {
                questionMode: 'fill-blank',
                supportLevel: 2,
                attemptKind: 'practice',
                question: 'Read: "The ___ star shines at night." Complete the missing word.'
            })
        ];

        const roles: QuestionLadderRole[] = planQuestionPack(mixed).items.map((item) => item.role);

        expect(roles).toEqual(['recognition', 'cloze', 'recall', 'transfer']);
    });

    test('avoids three consecutive questions with the same objective and source span', () => {
        const sameSpan = Array.from({ length: 4 }, (_, index) => question(index + 1));
        const differentSpan = question(99, {
            learningObjectiveId: 'reading_detail',
            skillTag: 'reading:detail',
            sourceContextSpan: 'The moon is high in the sky.',
            question: 'Read: "The moon is high in the sky." Where is the moon?'
        });

        const plan = planQuestionPack([...sameSpan, differentSpan]);
        const keys = plan.questions.map((item) => `${item.learningObjectiveId}:${item.sourceContextSpan}`);

        for (let index = 2; index < keys.length; index += 1) {
            expect([keys[index - 2], keys[index - 1], keys[index]].every((key) => key === keys[index])).toBe(false);
        }
    });

    test('does not synthesize transfer cards when no real source span exists', () => {
        const genericPack = Array.from({ length: 6 }, (_, index) => question(index + 1, {
            sourceContextSpan: 'sanitized_fallback'
        }));

        const plan = planQuestionPack(genericPack);

        expect(plan.questions).toHaveLength(6);
        expect(plan.questions.some((item) => item.attemptKind === 'transfer' || item.supportLevel === 0)).toBe(false);
        expect(plan.hasTransfer).toBe(false);
    });

    test('does not synthesize transfer cards without a learning objective', () => {
        const missingObjectivePack = Array.from({ length: 6 }, (_, index) => question(index + 1, {
            learningObjectiveId: undefined,
            skillTag: 'vocab:bright',
            sourceContextSpan: 'The bright star shines at night.'
        }));

        const plan = planQuestionPack(missingObjectivePack);

        expect(plan.questions).toHaveLength(6);
        expect(plan.questions.some((item) => item.attemptKind === 'transfer' || item.supportLevel === 0)).toBe(false);
        expect(plan.hasTransfer).toBe(false);
    });

    test('synthesizes vocabulary transfer with a fresh context instead of a generic instruction', () => {
        const plan = planQuestionPack(Array.from({ length: 6 }, (_, index) => question(index + 1)));
        const transfer = plan.questions.find((item) => item.attemptKind === 'transfer');

        expect(transfer?.question).toContain('bright lamp');
        expect(transfer?.question).toContain('What does "bright" mean');
        expect(transfer?.question).not.toContain('type the answer for the same skill');
        expect(transfer).toEqual(expect.objectContaining({
            correctAnswer: 'shining',
            questionMode: 'typing',
            supportLevel: 0,
            sourceContextSpan: 'The bright star shines at night.'
        }));
    });

    test('synthesizes past-tense transfer with a fresh past-time sentence', () => {
        const pastTensePack = Array.from({ length: 6 }, (_, index) => question(index + 1, {
            type: 'grammar',
            question: 'Read: "Yesterday, I went to school." Choose the past tense of go.',
            options: ['go', 'went', 'goes', 'going'],
            correct_index: 1,
            correctAnswer: 'went',
            skillTag: 'grammar:past_simple',
            learningObjectiveId: 'past_tense_basic',
            sourceContextSpan: 'Yesterday, I went to school.'
        }));

        const transfer = planQuestionPack(pastTensePack).questions.find((item) => item.attemptKind === 'transfer');

        expect(transfer?.question).toContain('Last weekend');
        expect(transfer?.question).toContain('___ to the library');
        expect(transfer?.question).not.toContain('type the answer for the same skill');
        expect(transfer?.correctAnswer).toBe('went');
    });
});
