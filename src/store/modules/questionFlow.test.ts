import { applyQuestionDefaults, expandBossGateQuestions } from './questionFlow';

describe('question flow learning gates', () => {
    test('expands a boss into recognition, application, and transfer stages', () => {
        const boss = applyQuestionDefaults({
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
            isBoss: true
        });

        const stages = expandBossGateQuestions([boss]);

        expect(stages).toHaveLength(3);
        expect(stages.map((stage) => stage.bossStage)).toEqual([1, 2, 3]);
        expect(stages.map((stage) => stage.supportLevel)).toEqual([3, 2, 0]);
        expect(stages.map((stage) => stage.attemptKind)).toEqual(['practice', 'practice', 'transfer']);
        expect(new Set(stages.map((stage) => stage.question)).size).toBe(3);
        expect(stages[1].question).not.toBe(boss.question);
        expect(stages[2].question).not.toBe(boss.question);
        expect(stages[2]).toEqual(expect.objectContaining({
            questionMode: 'typing',
            learningObjectiveId: 'past_tense_basic'
        }));
    });
});
