import { buildBossGateVariants } from './bossGateVariants';
import { applyLearningMetadataForSource } from './questionFlow';
import { validateLearningTaskContract } from '@/lib/data/learningTaskContract';
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
        expect(stages.map((stage) => stage.sourceContextSpan)).toEqual([
            'Yesterday, I went to school.',
            'Last weekend, I went to the park with my friend.',
            'Last weekend, I went to the library.'
        ]);
        expect(stages.map((stage) => stage.assessmentRole)).toEqual(['practice', 'practice', 'transfer']);
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
            correctAnswer: 'It might rain',
            sourceContextSpan: 'Mia saw dark clouds and brought an umbrella.'
        });

        expect(stages[0].question).toContain('clue');
        expect(stages[0].correctAnswer).toBe('dark clouds');
        expect(stages[0].options).toContain('dark clouds');
        expect(stages[0].correctAnswer).not.toBe('It might rain');
        expect(stages[1].question).toContain('best inference');
        expect(stages[1].correctAnswer).toBe('It might rain');
        expect(stages[2].question).toContain('Type the inference');
        expect(stages.map((stage) => stage.sourceContextSpan)).toEqual([
            'Mia saw dark clouds and brought an umbrella.',
            'A student sees dark clouds and takes an umbrella.',
            'Someone takes an umbrella after seeing dark clouds.'
        ]);
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
        // Stage 1 must be grounded in the source context; a bare "which
        // preposition is correct" with no sentence is unanswerable.
        expect(stages[0].question).toContain('We meet ___ seven o\'clock.');
        expect(stages[1]).toEqual(expect.objectContaining({
            questionMode: 'fill-blank',
            correctAnswer: 'at'
        }));
        expect(stages[1].question).toContain('___ six');
        expect(stages[1].question).not.toContain('book is ___ the table');
        expect(stages[2]).toEqual(expect.objectContaining({
            questionMode: 'typing',
            supportLevel: 0,
            attemptKind: 'transfer',
            correctAnswer: 'at'
        }));
        expect(stages[2].question).toContain('___ nine');
        expect(stages.map((stage) => stage.sourceContextSpan)).toEqual([
            'We meet at seven o\'clock.',
            'The train leaves at six o\'clock.',
            'The class starts at nine.'
        ]);
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

describe('boss ladder construct quarantine', () => {
    test('a vocabulary boss whose answer is the target word falls back to the original question', () => {
        const vocabBoss: Monster = {
            ...baseBoss,
            id: 60,
            type: 'vocab',
            question: 'Read: "The gardener watered the orchard." Choose the right word.',
            options: ['orchard', 'ocean', 'office', 'oven'],
            correct_index: 0,
            skillTag: 'vocab:vocab_context_meaning',
            learningObjectiveId: 'vocab_context_meaning',
            correctAnswer: 'orchard',
            sourceContextSpan: 'The gardener watered the orchard.'
        };

        const stages = buildBossGateVariants(vocabBoss);

        // The options are words, not meanings, so "which option matches the
        // target meaning" would reuse the word as its own meaning.
        expect(stages).toHaveLength(1);
        expect(stages[0].id).toBe(60);
        expect(stages[0].question).toBe(vocabBoss.question);
    });

    test('a pronoun boss whose answer is still a pronoun falls back to the original question', () => {
        const stages = buildBossGateVariants({
            ...baseBoss,
            id: 61,
            type: 'reading',
            question: 'Read: "Mia found her notebook. ___ kept it." Choose the right word.',
            options: ['She', 'He', 'They', 'It'],
            correct_index: 0,
            skillTag: 'reading:pronoun_reference',
            learningObjectiveId: 'pronoun_reference',
            correctAnswer: 'She',
            sourceContextSpan: 'Mia found her notebook. She kept it.'
        });

        // Asking "what does the pronoun refer to" when the answer is itself a
        // pronoun measures form, not reference.
        expect(stages).toHaveLength(1);
        expect(stages[0].id).toBe(61);
    });

    test('a past-tense boss with all-past distractors falls back (stage 1 would not discriminate)', () => {
        const stages = buildBossGateVariants({
            ...baseBoss,
            id: 62,
            question: 'Read: "Yesterday Mia ___ to the park." Choose the right word.',
            options: ['went', 'saw', 'took', 'made'],
            correct_index: 0,
            skillTag: 'grammar:past_tense_basic',
            correctAnswer: 'went',
            sourceContextSpan: 'Yesterday Mia went to the park.'
        });

        // "Which option is the past-tense form?" cannot discriminate when all
        // options are past-tense forms.
        expect(stages).toHaveLength(1);
        expect(stages[0].id).toBe(62);
    });

    test('a past-tense boss whose verb cannot complete the motion frames falls back', () => {
        const stages = buildBossGateVariants({
            ...baseBoss,
            id: 63,
            question: 'Choose the past tense of play.',
            options: ['play', 'played', 'plays', 'playing'],
            correct_index: 1,
            correctAnswer: 'played',
            sourceContextSpan: 'Yesterday Mia played football.'
        });

        // "Last weekend, I played to the park" is not a valid application
        // sentence, so the hardcoded frames cannot carry this answer.
        expect(stages).toHaveLength(1);
        expect(stages[0].id).toBe(63);
    });

    test('a present-simple boss falls back because the generic frames carry no stage-specific stimulus', () => {
        const stages = buildBossGateVariants({
            ...baseBoss,
            id: 64,
            question: 'Choose the present-simple form.',
            options: ['play', 'plays', 'played', 'playing'],
            correct_index: 1,
            skillTag: 'grammar:present_simple',
            learningObjectiveId: 'present_simple',
            correctAnswer: 'plays',
            sourceContextSpan: 'Every day Mia plays the piano.'
        });

        expect(stages).toHaveLength(1);
        expect(stages[0].id).toBe(64);
    });

    test('a reading-detail boss falls back instead of reusing the detail across a missing transfer text', () => {
        const stages = buildBossGateVariants({
            ...baseBoss,
            id: 65,
            type: 'reading',
            question: 'Read: "The weather was sunny and warm." What was the weather like?',
            options: ['sunny and warm', 'cold and rainy', 'windy', 'snowy'],
            correct_index: 0,
            skillTag: 'reading:detail',
            learningObjectiveId: 'reading_detail',
            correctAnswer: 'sunny and warm',
            sourceContextSpan: 'The weather was sunny and warm.'
        });

        expect(stages).toHaveLength(1);
        expect(stages[0].id).toBe(65);
    });

    test('an inference boss with an answer unrelated to the canned scenario falls back', () => {
        const stages = buildBossGateVariants({
            ...baseBoss,
            id: 66,
            type: 'reading',
            question: 'Why did Mia bring an umbrella?',
            options: ['The bag was heavy', 'It might rain', 'She lost it', 'It was hot'],
            correct_index: 0,
            skillTag: 'reading:inference',
            learningObjectiveId: 'reading_inference',
            correctAnswer: 'The bag was heavy',
            sourceContextSpan: 'Mia saw dark clouds and brought an umbrella.'
        });

        // The dark-clouds scenario supports a rain inference; reusing an
        // unrelated original answer would fake the inference.
        expect(stages).toHaveLength(1);
        expect(stages[0].id).toBe(66);
    });

    test('every stage of a surviving ladder carries an accepted task contract', () => {
        const stages = buildBossGateVariants(baseBoss);

        expect(stages).toHaveLength(3);
        for (const stage of stages) {
            expect(stage.learningTask).toBeDefined();
            expect(validateLearningTaskContract(stage).accepted).toBe(true);
        }
        expect(stages[0].learningTask).toEqual(expect.objectContaining({
            targetFacet: 'grammar-form',
            cognitiveAction: 'recognize-form',
            encounterRole: 'boss'
        }));
    });

    test('replaces parent evidence roles and derives context ids from each stage stimulus', () => {
        const preparedBoss = applyLearningMetadataForSource(baseBoss, 'battle');
        expect(preparedBoss.assessmentRole).toBe('transfer');

        const stages = buildBossGateVariants(preparedBoss)
            .map((stage) => applyLearningMetadataForSource(stage, 'battle'));

        expect(stages).toHaveLength(3);
        expect(stages.map((stage) => stage.assessmentRole)).toEqual(['practice', 'practice', 'transfer']);
        expect(new Set(stages.map((stage) => stage.contextId)).size).toBe(3);
    });
});
