import {
    applyAdaptiveScaffoldDecision,
    applyQuestionDefaults,
    buildImmediateRepairQuestion,
    expandBossGateQuestions
} from './questionFlow';

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
            isBoss: true,
            sourceContextSpan: 'Yesterday, I went to school.'
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

    test('corrects inconsistent objective tags before displaying the task goal', () => {
        const question = applyQuestionDefaults({
            id: 20,
            type: 'reading',
            question: 'What is the weather like today?',
            options: ['rainy and cold', 'summer and hot', 'spring and green', 'autumn and golden'],
            correct_index: 0,
            explanation: 'The text says today is rainy and cold.',
            skillTag: 'pronoun_reference',
            learningObjectiveId: 'pronoun_reference',
            sourceContextSpan: 'Today is rainy and cold.'
        });

        expect(question.learningObjectiveId).toBe('reading_detail');
        expect(question.objectiveConfidence).toBeLessThan(0.86);
    });

    test('builds contextual reading repair questions without generic repair wording', () => {
        const question = applyQuestionDefaults({
            id: 30,
            type: 'reading',
            question: 'What is the weather like today?',
            options: ['rainy and cold', 'summer and hot', 'spring and green', 'autumn and golden'],
            correct_index: 0,
            explanation: 'The text says today is rainy and cold.',
            skillTag: 'pronoun_reference',
            learningObjectiveId: 'pronoun_reference',
            sourceContextSpan: 'Today is rainy and cold.'
        });

        const repair = buildImmediateRepairQuestion(question, 'summer and hot', 1);

        expect(repair.learningObjectiveId).toBe('reading_detail');
        expect(repair.question).toContain('Read: "Today is rainy and cold."');
        expect(repair.question).toContain('What is the weather like today?');
        expect(repair.question).not.toContain('Repair the same pattern');
        expect(repair.sourceContextSpan).toBe('Today is rainy and cold.');
        expect(repair.isImmediateRepair).toBe(true);
    });

    test('builds immediate repair as a scaffolded re-ask instead of repeating the original stem', () => {
        const question = applyQuestionDefaults({
            id: 40,
            type: 'vocab',
            question: 'Read: "The bright star shines at night." What does "bright" mean?',
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
            supportLevel: 2
        });

        const repair = buildImmediateRepairQuestion(question, 'dark', 1);

        expect(repair.question).not.toBe(question.question);
        expect(repair.question).toContain('Try this clue');
        expect(repair.supportLevel).toBeGreaterThanOrEqual(question.supportLevel || 0);
        expect(repair.difficulty).toBe(question.difficulty);
        expect(repair.isImmediateRepair).toBe(true);
    });

    test('fades only the next practice item for the same objective', () => {
        const current = applyQuestionDefaults({
            id: 50,
            type: 'vocab',
            question: 'What does bright mean?',
            options: ['shining', 'dark'],
            correct_index: 0,
            explanation: 'Bright means shining.',
            skillTag: 'vocab:bright',
            learningObjectiveId: 'vocab_context_meaning',
            supportLevel: 3,
            attemptKind: 'practice'
        });
        const unrelated = applyQuestionDefaults({
            ...current,
            id: 51,
            type: 'grammar',
            question: 'Choose the past tense of go.',
            options: ['went', 'go'],
            skillTag: 'grammar:past_simple',
            learningObjectiveId: 'past_tense_basic'
        });
        const sameTarget = applyQuestionDefaults({ ...current, id: 52, question: 'Bright is closest to...' });

        const adapted = applyAdaptiveScaffoldDecision(
            [current, unrelated, sameTarget],
            0,
            current,
            {
                transition: 'fade',
                reason: 'stable-success',
                nextSupportLevel: 2,
                nextAttemptKind: 'practice',
                evidence: {
                    recentAttempts: 2,
                    recentCorrect: 2,
                    recentHintUses: 0,
                    consecutiveWrong: 0,
                    consecutiveNoHintSuccessesAtLevel: 2,
                    transferAttempts: 0,
                    transferCorrect: 0
                }
            }
        );

        expect(adapted[1]).toEqual(unrelated);
        expect(adapted[2]).toEqual(expect.objectContaining({
            supportLevel: 2,
            attemptKind: 'practice',
            questionMode: 'choice'
        }));
    });

    test('promotes an existing transfer item instead of relabelling practice content', () => {
        const current = applyQuestionDefaults({
            id: 60,
            type: 'vocab',
            question: 'What does bright mean?',
            options: ['shining', 'dark'],
            correct_index: 0,
            explanation: 'Bright means shining.',
            skillTag: 'vocab:bright',
            learningObjectiveId: 'vocab_context_meaning',
            supportLevel: 1,
            attemptKind: 'practice'
        });
        const practice = applyQuestionDefaults({ ...current, id: 61, question: 'Choose bright again.', supportLevel: 2 });
        const transfer = applyQuestionDefaults({
            ...current,
            id: 62,
            question: 'A bright lamp helps me read. Type a synonym for bright.',
            supportLevel: 0,
            attemptKind: 'transfer',
            questionMode: 'typing'
        });

        const adapted = applyAdaptiveScaffoldDecision(
            [current, practice, transfer],
            0,
            current,
            {
                transition: 'transfer',
                reason: 'transfer-ready',
                nextSupportLevel: 0,
                nextAttemptKind: 'transfer',
                evidence: {
                    recentAttempts: 2,
                    recentCorrect: 2,
                    recentHintUses: 0,
                    consecutiveWrong: 0,
                    consecutiveNoHintSuccessesAtLevel: 2,
                    transferAttempts: 0,
                    transferCorrect: 0
                }
            }
        );

        expect(adapted[1].id).toBe(62);
        expect(adapted[1].attemptKind).toBe('transfer');
        expect(adapted[2].id).toBe(61);
        expect(adapted[2].attemptKind).toBe('practice');
    });
});
