import {
    applyTaskContractToEvidenceStrength,
    canUpdateObjectiveMastery,
    isLearningTaskContract,
    isObjectiveAlignedTask,
    restoresSourceToken,
    validateLearningTaskContract,
    type LearningTaskContract,
    type TaskContractQuestion
} from './learningTaskContract';
import { generateCriticPrompt, generateReportPrompt, type CriticMonsterPack } from '@/lib/ai/prompts';
import type { Monster, UserAnswer } from '@/store/gameStore';

const pastTenseFormTask: LearningTaskContract = {
    schemaVersion: 1,
    targetFacet: 'grammar-form',
    cognitiveAction: 'retrieve-form',
    contextRelation: 'same-source',
    measurementEligibility: 'objective-evidence',
    encounterRole: 'skirmish'
};

const vocabFormPracticeTask: LearningTaskContract = {
    schemaVersion: 1,
    targetFacet: 'vocab-form',
    cognitiveAction: 'retrieve-form',
    contextRelation: 'same-source',
    measurementEligibility: 'practice-only',
    encounterRole: 'skirmish'
};

const pronounFormPracticeTask: LearningTaskContract = {
    schemaVersion: 1,
    targetFacet: 'pronoun-form',
    cognitiveAction: 'recognize-form',
    contextRelation: 'same-source',
    measurementEligibility: 'practice-only',
    encounterRole: 'skirmish'
};

function questionWith(overrides: Partial<TaskContractQuestion> & Pick<TaskContractQuestion, 'question' | 'options'>): TaskContractQuestion {
    return {
        correct_index: 0,
        ...overrides
    };
}

describe('isLearningTaskContract', () => {
    test.each([
        ['valid contract', pastTenseFormTask, true],
        ['wrong schema version', { ...pastTenseFormTask, schemaVersion: 2 as unknown as 1 }, false],
        ['unknown facet', { ...pastTenseFormTask, targetFacet: 'vibes' as unknown as LearningTaskContract['targetFacet'] }, false],
        ['unknown eligibility', { ...pastTenseFormTask, measurementEligibility: 'full-credit' as unknown as LearningTaskContract['measurementEligibility'] }, false],
        ['null', null, false],
        ['undefined', undefined, false]
    ])('shape check: %s', (_label, value, expected) => {
        expect(isLearningTaskContract(value)).toBe(expected);
    });
});

describe('validateLearningTaskContract', () => {
    test('accepts a same-source grammar-form restoration aligned with a form objective', () => {
        const question = questionWith({
            question: 'Read: "Yesterday Mia ___ to the park." What is the word?',
            options: ['went', 'saw', 'took', 'made'],
            correctAnswer: 'went',
            sourceContextSpan: 'Yesterday Mia went to the park.',
            learningObjectiveId: 'past_tense_basic',
            supportLevel: 1,
            learningTask: pastTenseFormTask
        });

        expect(validateLearningTaskContract(question)).toEqual({ accepted: true, reasons: [] });
    });

    test('accepts legacy questions without a contract', () => {
        const question = questionWith({
            question: 'What does bright mean?',
            options: ['shining', 'dark'],
            learningObjectiveId: 'vocab_context_meaning'
        });

        expect(validateLearningTaskContract(question)).toEqual({ accepted: true, reasons: [] });
    });

    test.each([
        [
            'vocab-form restoration claiming meaning objective evidence',
            questionWith({
                question: 'Read: "The ___ star shines at night." What is the word?',
                options: ['bright', 'quiet', 'small', 'late'],
                correctAnswer: 'bright',
                sourceContextSpan: 'The bright star shines at night.',
                learningObjectiveId: 'vocab_context_meaning',
                learningTask: {
                    ...vocabFormPracticeTask,
                    measurementEligibility: 'objective-evidence'
                }
            }),
            ['facet-not-aligned-with-objective:vocab_context_meaning']
        ],
        [
            'pronoun-form restoration claiming reference objective evidence',
            questionWith({
                question: 'Read: "Mia found her notebook. ___ kept it." Choose the right word.',
                options: ['She', 'He', 'They', 'It'],
                correct_index: 0,
                correctAnswer: 'She',
                sourceContextSpan: 'Mia found her notebook. She kept it.',
                learningObjectiveId: 'pronoun_reference',
                learningTask: {
                    ...pronounFormPracticeTask,
                    measurementEligibility: 'objective-evidence'
                }
            }),
            ['facet-not-aligned-with-objective:pronoun_reference']
        ],
        [
            'token restoration labeled as a meaning facet',
            questionWith({
                question: 'Read: "The ___ star shines at night." Choose the meaning.',
                options: ['bright', 'quiet', 'small', 'late'],
                correctAnswer: 'bright',
                sourceContextSpan: 'The bright star shines at night.',
                learningObjectiveId: 'vocab_context_meaning',
                learningTask: {
                    ...vocabFormPracticeTask,
                    targetFacet: 'vocab-meaning',
                    cognitiveAction: 'recognize-meaning'
                }
            }),
            ['source-token-restoration-must-be-form-task']
        ],
        [
            'transfer claimed on a same-source item',
            questionWith({
                question: 'Read: "Yesterday Mia ___ to the park." Type the word.',
                options: ['went', 'saw', 'took', 'made'],
                correctAnswer: 'went',
                sourceContextSpan: 'Yesterday Mia went to the park.',
                learningObjectiveId: 'past_tense_basic',
                supportLevel: 0,
                attemptKind: 'transfer',
                learningTask: pastTenseFormTask
            }),
            ['transfer-requires-changed-context']
        ],
        [
            'transfer claimed with heavy support',
            questionWith({
                question: 'Last weekend, I ___ to the library.',
                options: ['went', 'saw', 'took', 'made'],
                correctAnswer: 'went',
                sourceContextSpan: 'Yesterday Mia went to the park.',
                learningObjectiveId: 'past_tense_basic',
                supportLevel: 2,
                attemptKind: 'transfer',
                learningTask: { ...pastTenseFormTask, contextRelation: 'varied-source' }
            }),
            ['transfer-requires-low-support']
        ],
        [
            'action not coherent for the facet',
            questionWith({
                question: 'Which option matches the target meaning?',
                options: ['to feel happy', 'to feel sad', 'to feel tired', 'to feel cold'],
                correctAnswer: 'to feel happy',
                sourceContextSpan: 'Mia was happy about her gift.',
                learningObjectiveId: 'vocab_context_meaning',
                learningTask: {
                    schemaVersion: 1,
                    targetFacet: 'vocab-meaning',
                    cognitiveAction: 'retrieve-form',
                    contextRelation: 'same-source',
                    measurementEligibility: 'practice-only',
                    encounterRole: 'skirmish'
                }
            }),
            ['cognitive-action-not-coherent-for-facet:vocab-meaning']
        ],
        [
            'repair question tagged with a non-repair encounter role',
            questionWith({
                question: 'Try again: Read: "Yesterday Mia ___ to the park."',
                options: ['went', 'saw', 'took', 'made'],
                correctAnswer: 'went',
                sourceContextSpan: 'Yesterday Mia went to the park.',
                learningObjectiveId: 'past_tense_basic',
                isImmediateRepair: true,
                learningTask: pastTenseFormTask
            }),
            ['encounter-role-mismatch:skirmish']
        ]
    ])('rejects: %s', (_label, question, expectedReasons) => {
        const result = validateLearningTaskContract(question);
        expect(result.accepted).toBe(false);
        expect(result.reasons).toEqual(expectedReasons);
    });

    test('a blank in a new sentence is not treated as source-token restoration', () => {
        expect(restoresSourceToken(questionWith({
            question: 'Application: Last weekend, I ___ to the park with my friend.',
            options: ['went', 'saw', 'took', 'made'],
            correctAnswer: 'went',
            sourceContextSpan: 'Yesterday Mia went to the park.'
        }))).toBe(false);

        expect(restoresSourceToken(questionWith({
            question: 'Read: "Yesterday Mia ___ to the park." What is the word?',
            options: ['went', 'saw', 'took', 'made'],
            correctAnswer: 'went',
            sourceContextSpan: 'Yesterday Mia went to the park.'
        }))).toBe(true);
    });

    test('accepts a pronoun-reference stage whose answer is an antecedent', () => {
        const question = questionWith({
            question: 'Read: "Lily found her notebook and put it away." Which person or thing does the pronoun refer to?',
            options: ['notebook', 'Lily', 'school', 'away'],
            correctAnswer: 'notebook',
            sourceContextSpan: 'Lily found her notebook and put it away.',
            learningObjectiveId: 'pronoun_reference',
            learningTask: {
                schemaVersion: 1,
                targetFacet: 'pronoun-reference',
                cognitiveAction: 'resolve-reference',
                contextRelation: 'same-source',
                measurementEligibility: 'objective-evidence',
                encounterRole: 'boss'
            },
            isBoss: true
        });

        expect(validateLearningTaskContract(question).accepted).toBe(true);
    });
});

describe('measurement eligibility policy', () => {
    test('legacy questions keep mastery-update behavior', () => {
        const legacy = questionWith({
            question: 'What does bright mean?',
            options: ['shining', 'dark'],
            learningObjectiveId: 'vocab_context_meaning'
        });

        expect(canUpdateObjectiveMastery(legacy)).toBe(true);
        expect(isObjectiveAlignedTask(legacy)).toBe(false);
    });

    test('form practice on meaning/reference objectives cannot update mastery', () => {
        expect(canUpdateObjectiveMastery(questionWith({
            question: 'Read: "The ___ star shines at night."',
            options: ['bright', 'quiet', 'small', 'late'],
            correctAnswer: 'bright',
            sourceContextSpan: 'The bright star shines at night.',
            learningObjectiveId: 'vocab_context_meaning',
            learningTask: vocabFormPracticeTask
        }))).toBe(false);

        expect(canUpdateObjectiveMastery(questionWith({
            question: 'Read: "Mia found her notebook. ___ kept it."',
            options: ['She', 'He', 'They', 'It'],
            correctAnswer: 'She',
            sourceContextSpan: 'Mia found her notebook. She kept it.',
            learningObjectiveId: 'pronoun_reference',
            learningTask: pronounFormPracticeTask
        }))).toBe(false);
    });

    test('aligned grammar-form tasks can update mastery', () => {
        expect(canUpdateObjectiveMastery(questionWith({
            question: 'Read: "Yesterday Mia ___ to the park."',
            options: ['went', 'saw', 'took', 'made'],
            correctAnswer: 'went',
            sourceContextSpan: 'Yesterday Mia went to the park.',
            learningObjectiveId: 'past_tense_basic',
            learningTask: pastTenseFormTask
        }))).toBe(true);
    });
});

describe('applyTaskContractToEvidenceStrength', () => {
    test('practice-only caps independent evidence at supported', () => {
        expect(applyTaskContractToEvidenceStrength('independent', { learningTask: vocabFormPracticeTask }))
            .toBe('supported');
        expect(applyTaskContractToEvidenceStrength('transfer-independent', { learningTask: pronounFormPracticeTask }))
            .toBe('supported');
        expect(applyTaskContractToEvidenceStrength('delayed-independent', { learningTask: vocabFormPracticeTask }))
            .toBe('supported');
        expect(applyTaskContractToEvidenceStrength('supported', { learningTask: vocabFormPracticeTask }))
            .toBe('supported');
    });

    test('no-credit stays no-credit regardless of the contract', () => {
        expect(applyTaskContractToEvidenceStrength('no-credit', { learningTask: vocabFormPracticeTask }))
            .toBe('no-credit');
    });

    test('same-target prior answer caps independent evidence for contract items only', () => {
        expect(applyTaskContractToEvidenceStrength(
            'independent',
            { learningTask: pastTenseFormTask },
            { priorAnswerForSameTarget: true }
        )).toBe('supported');

        // Legacy questions without a contract keep their raw strength.
        expect(applyTaskContractToEvidenceStrength(
            'independent',
            {},
            { priorAnswerForSameTarget: true }
        )).toBe('independent');
    });
});

describe('task-contract fields never enter AI prompt serialization', () => {
    const contractMonster: Monster = {
        id: 1,
        type: 'vocab',
        question: 'Read: "The ___ star shines at night."',
        options: ['bright', 'quiet', 'small', 'late'],
        correct_index: 0,
        explanation: 'The word is bright.',
        skillTag: 'vocab:vocab_context_meaning',
        difficulty: 'easy',
        questionMode: 'choice',
        correctAnswer: 'bright',
        learningObjectiveId: 'vocab_context_meaning',
        learningTask: vocabFormPracticeTask
    };

    test('critic prompt packs are Pick-typed and cannot leak contract fields', () => {
        const packs: CriticMonsterPack[] = [{
            levelTitle: 'Sample',
            monsters: [{
                id: contractMonster.id,
                question: contractMonster.question,
                options: contractMonster.options,
                correct_index: contractMonster.correct_index,
                explanation: contractMonster.explanation,
                sourceContextSpan: 'The bright star shines at night.'
            }]
        }];
        const prompt = generateCriticPrompt('The bright star shines at night.', [], packs);

        expect(prompt).not.toMatch(/learningTask|targetFacet|measurementEligibility|encounterRole/i);
    });

    test('report prompt user answers never contain contract fields', () => {
        const answer: UserAnswer = {
            questionId: 1,
            questionText: contractMonster.question,
            userChoice: 'quiet',
            correctChoice: 'bright',
            isCorrect: false,
            learningObjectiveId: 'vocab_context_meaning',
            evidenceStrength: 'supported'
        };
        const prompt = generateReportPrompt(10, 1, [answer]);

        expect(prompt).not.toMatch(/learningTask|targetFacet|measurementEligibility|encounterRole/i);
        expect(JSON.stringify(answer)).not.toMatch(/learningTask|targetFacet/);
    });
});
