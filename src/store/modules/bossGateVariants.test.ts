import { buildBossGateVariants } from './bossGateVariants';
import type { Monster } from '@/store/gameStore';

const baseBoss: Monster = {
    id: 10,
    type: 'grammar',
    question: 'Choose the past tense of go.',
    options: ['go', 'went', 'goes', 'going'],
    correct_index: 1,
    explanation: 'Went is the past tense.',
    skillTag: 'grammar:past_simple',
    difficulty: 'hard',
    questionMode: 'choice',
    correctAnswer: 'went',
    isBoss: true,
    learningObjectiveId: 'past_tense_basic',
    supportLevel: 3,
    attemptKind: 'transfer',
    sourceContextSpan: 'Yesterday, I went to school.'
};

describe('buildBossGateVariants', () => {
    test('creates distinct recognition, application, and transfer questions for a boss objective', () => {
        const stages = buildBossGateVariants(baseBoss);

        expect(stages).toHaveLength(3);
        expect(stages.map((stage) => stage.bossStage)).toEqual([1, 2, 3]);
        expect(stages.every((stage) => stage.sourceContextSpan === 'Yesterday, I went to school.')).toBe(true);
        expect(new Set(stages.map((stage) => stage.question)).size).toBe(3);
        expect(stages[1]).toEqual(expect.objectContaining({
            questionMode: 'fill-blank',
            supportLevel: 2,
            correctAnswer: 'went'
        }));
        expect(stages[2]).toEqual(expect.objectContaining({
            questionMode: 'typing',
            supportLevel: 0,
            attemptKind: 'transfer',
            correctAnswer: 'went'
        }));
        expect(stages[2].question).toContain('Last weekend');
    });

    test('uses reading inference transfer prompts for inference objectives', () => {
        const stages = buildBossGateVariants({
            ...baseBoss,
            id: 20,
            type: 'reading',
            question: 'Why did Mia bring an umbrella?',
            options: ['It was sunny', 'It might rain', 'She lost it', 'It was hot'],
            correct_index: 1,
            explanation: 'Clouds suggest possible rain.',
            skillTag: 'reading:inference',
            learningObjectiveId: 'reading_inference',
            correctAnswer: 'It might rain'
        });

        expect(stages[0].question).toContain('clue');
        expect(stages[1].question).toContain('best inference');
        expect(stages[2].question).toContain('Type the inference');
    });

    test('keeps sentence context in pronoun reference recognition prompts', () => {
        const stages = buildBossGateVariants({
            ...baseBoss,
            id: 30,
            type: 'reading',
            question: 'Read: "Lily found her notebook and put it away." What does "it" refer to?',
            options: ['notebook', 'Lily', 'school', 'away'],
            correct_index: 0,
            explanation: '"It" refers to the notebook.',
            skillTag: 'pronoun_reference',
            learningObjectiveId: 'pronoun_reference',
            correctAnswer: 'notebook',
            sourceContextSpan: 'Lily found her notebook and put it away.'
        });

        expect(stages[0].question).toContain('Lily found her notebook and put it away.');
        expect(stages[0].question).toContain('pronoun');
    });

    test('builds preposition boss stages with answer-matched contexts', () => {
        const stages = buildBossGateVariants({
            ...baseBoss,
            id: 35,
            question: 'Choose the correct preposition: "We meet ___ seven o\'clock."',
            options: ['in', 'on', 'at', 'under'],
            correct_index: 2,
            explanation: 'Use at with clock time.',
            skillTag: 'grammar:preposition_time',
            learningObjectiveId: 'preposition_place_time',
            correctAnswer: 'at',
            sourceContextSpan: 'We meet at seven o\'clock.'
        });

        expect(stages).toHaveLength(3);
        expect(stages[1]).toEqual(expect.objectContaining({
            questionMode: 'fill-blank',
            correctAnswer: 'at'
        }));
        expect(stages[1].question).toContain('___ seven');
        expect(stages[1].question).not.toContain('book is ___ the table');
        expect(stages[2]).toEqual(expect.objectContaining({
            questionMode: 'typing',
            supportLevel: 0,
            attemptKind: 'transfer',
            correctAnswer: 'at'
        }));
        expect(stages[2].question).toContain('___ nine');
    });

    test('does not expand bosses when a valid three-step ladder cannot be built', () => {
        const stages = buildBossGateVariants({
            ...baseBoss,
            id: 40,
            type: 'vocab',
            question: 'What does the word mean?',
            options: ['answer', 'Option A', 'Option B', 'Option C'],
            correct_index: 0,
            skillTag: 'vocab:unknown',
            learningObjectiveId: 'vocab_context_meaning',
            correctAnswer: 'answer',
            sourceContextSpan: undefined
        });

        expect(stages).toHaveLength(1);
        expect(stages[0].id).toBe(40);
    });

    test('does not expand transfer bosses without original source evidence', () => {
        const stages = buildBossGateVariants({
            ...baseBoss,
            id: 50,
            sourceContextSpan: undefined
        });

        expect(stages).toHaveLength(1);
        expect(stages[0].id).toBe(50);
    });
});
