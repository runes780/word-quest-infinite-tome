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
    attemptKind: 'transfer'
};

describe('buildBossGateVariants', () => {
    test('creates distinct recognition, application, and transfer questions for a boss objective', () => {
        const stages = buildBossGateVariants(baseBoss);

        expect(stages).toHaveLength(3);
        expect(stages.map((stage) => stage.bossStage)).toEqual([1, 2, 3]);
        expect(stages.map((stage) => stage.sourceContextSpan)).toEqual([
            'boss_gate_recognition',
            'boss_gate_application',
            'boss_gate_transfer'
        ]);
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
});
