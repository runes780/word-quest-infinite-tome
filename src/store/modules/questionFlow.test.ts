import {
    applyAdaptiveScaffoldDecision,
    applyQuestionDefaults,
    buildImmediateRepairQuestion,
    expandBossGateQuestions,
    reorderQuestionsBySkill
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

describe('task contract threading in the question flow', () => {
    const practiceOnlyContract = {
        schemaVersion: 1 as const,
        targetFacet: 'vocab-form' as const,
        cognitiveAction: 'retrieve-form' as const,
        contextRelation: 'same-source' as const,
        measurementEligibility: 'practice-only' as const,
        encounterRole: 'skirmish' as const
    };

    test('immediate repair inherits the construct contract with the repair role', () => {
        const question = applyQuestionDefaults({
            id: 70,
            type: 'vocab',
            question: 'Read: "The ___ star shines at night." What is the word?',
            options: ['bright', 'quiet', 'small', 'late'],
            correct_index: 0,
            explanation: 'The word is bright.',
            skillTag: 'vocab:vocab_context_meaning',
            learningObjectiveId: 'vocab_context_meaning',
            correctAnswer: 'bright',
            sourceContextSpan: 'The bright star shines at night.',
            learningTask: practiceOnlyContract
        });

        const repair = buildImmediateRepairQuestion(question, 'quiet', 1);

        expect(repair.learningTask).toEqual({
            ...practiceOnlyContract,
            encounterRole: 'repair'
        });
        expect(repair.isImmediateRepair).toBe(true);
    });

    test('reordering never leaves two same-target contract items adjacent', () => {
        const contractItem = (id: number, family: string, skillTag: string, supportLevel: 0 | 1 | 2 | 3) => ({
            id,
            type: 'grammar' as const,
            question: `Read: "Yesterday Mia ___ to the park (${id})."`,
            options: ['went', 'saw', 'took', 'made'],
            correct_index: 0,
            explanation: 'The word is went.',
            skillTag,
            difficulty: 'medium' as const,
            questionMode: 'typing' as const,
            correctAnswer: 'went',
            learningObjectiveId: 'past_tense_basic',
            itemFamilyId: family,
            supportLevel,
            attemptKind: 'practice' as const,
            learningTask: {
                schemaVersion: 1 as const,
                targetFacet: 'grammar-form' as const,
                cognitiveAction: 'retrieve-form' as const,
                contextRelation: 'same-source' as const,
                measurementEligibility: 'objective-evidence' as const,
                encounterRole: 'skirmish' as const
            }
        });
        const filler = (id: number) => ({
            ...contractItem(id, `family-other-${id}`, 'vocab:other', 3),
            type: 'vocab' as const,
            learningObjectiveId: 'vocab_context_meaning',
            learningTask: undefined
        });

        // After answering item 0, the tail sorts by priority. Both target-A
        // items share a skill tag and would sort together; the spread guard
        // must keep another item between them.
        const questions = [
            contractItem(1, 'family-a', 'grammar:past_tense_basic', 3),
            contractItem(2, 'family-a', 'grammar:past_tense_basic', 1),
            filler(3),
            filler(4)
        ];

        const reordered = reorderQuestionsBySkill(questions, 0, {}, {}, {}, {});

        const familyA = reordered.filter((question) => question.itemFamilyId === 'family-a');
        expect(familyA).toHaveLength(2);
        const positions = reordered.map((question, index) => (question.itemFamilyId === 'family-a' ? index : -1)).filter((index) => index >= 0);
        expect(Math.abs(positions[0] - positions[1])).toBeGreaterThan(1);
    });

    test('applyQuestionDefaults keeps the declared objective of contract-carrying questions', () => {
        const question = applyQuestionDefaults({
            id: 80,
            type: 'reading',
            question: 'Read: "She shared her sandwiches because everyone was hungry." Choose the right word.',
            options: ['her', 'his', 'their', 'its'],
            correct_index: 0,
            explanation: 'The word is her.',
            skillTag: 'reading:pronoun_reference',
            learningObjectiveId: 'pronoun_reference',
            correctAnswer: 'her',
            sourceContextSpan: 'She shared her sandwiches because everyone was hungry.',
            learningTask: {
                ...practiceOnlyContract,
                targetFacet: 'pronoun-form'
            }
        });

        // "was" in the span would otherwise infer past_tense_basic.
        expect(question.learningObjectiveId).toBe('pronoun_reference');
    });
});
