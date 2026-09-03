import type { Monster } from '@/store/gameStore';
import { buildAnswerLearningEvidence, buildUserAnswer } from './answerLearningEvidence';

const question: Monster = {
    id: 42,
    type: 'vocab',
    question: 'Choose the word supported by the sentence.',
    options: ['orchard', 'ocean', 'office', 'oven'],
    correct_index: 0,
    explanation: 'Trees bearing fruit indicate an orchard.',
    hint: 'Look for fruit trees.',
    skillTag: 'vocab_context',
    difficulty: 'medium',
    questionMode: 'choice',
    correctAnswer: 'orchard',
    learningObjectiveId: 'vocab_context_meaning',
    objectiveConfidence: 0.91,
    sourceContextSpan: 'Rows of fruit trees covered the hillside.',
    attemptKind: 'transfer',
    assessmentRole: 'transfer',
    transferDistance: 'near',
    reviewerStatus: 'system-reviewed',
    supportLevel: 1,
    causeTag: 'context_clue'
};

describe('answer learning evidence contract', () => {
    test('keeps the session answer aligned with objective metadata', () => {
        expect(buildUserAnswer({
            question,
            selectedOption: 'orchard',
            result: 'correct',
            selfConfidence: 'high',
            questionHash: 'hash_public_fixture',
            progressReward: {
                kind: 'transfer-success',
                xp: 18,
                gold: 10,
                counted: true
            }
        })).toEqual({
            questionId: 42,
            questionText: question.question,
            userChoice: 'orchard',
            correctChoice: 'orchard',
            isCorrect: true,
            learningObjectiveId: 'vocab_context_meaning',
            itemFamilyId: expect.stringMatching(/^family_/),
            assessmentRole: 'transfer',
            evidenceStrength: 'transfer-independent',
            attemptKind: 'transfer',
            supportLevel: 1,
            causeTag: 'context_clue',
            selfConfidence: 'high',
            questionHash: 'hash_public_fixture',
            progressReward: {
                kind: 'transfer-success',
                xp: 18,
                gold: 10,
                counted: true
            }
        });
    });

    test.each([
        { result: 'correct' as const, isCritical: false, rating: 'good' },
        { result: 'correct' as const, isCritical: true, rating: 'easy' },
        { result: 'wrong' as const, isCritical: false, rating: 'again' }
    ])('aligns $result evidence across events, FSRS, objective, and mastery', ({ result, isCritical, rating }) => {
        const evidence = buildAnswerLearningEvidence({
            question,
            selectedOption: result === 'correct' ? 'orchard' : 'ocean',
            result,
            questionHash: 'hash_public_fixture',
            responseLatencyMs: 1250,
            source: 'battle',
            isCritical,
            selfConfidence: 'high',
            progressReward: result === 'correct'
                ? { kind: 'transfer-success', xp: 18, gold: 10, counted: true }
                : null
        });

        expect(evidence.learningEvent).toEqual(expect.objectContaining({
            eventType: 'answer',
            questionHash: 'hash_public_fixture',
            result,
            source: 'battle',
            skillTag: 'vocab_context',
            learningObjectiveId: 'vocab_context_meaning',
            sourceContextSpan: question.sourceContextSpan,
            attemptKind: 'transfer',
            supportLevel: 1,
            causeTag: 'context_clue',
            latencyMs: 1250,
            selfConfidence: 'high'
        }));
        if (result === 'correct') {
            expect(evidence.learningEvent).toEqual(expect.objectContaining({
                progressRewardKind: 'transfer-success',
                rewardXp: 18,
                rewardGold: 10,
                rewardCounted: true
            }));
        } else {
            expect(evidence.learningEvent.progressRewardKind).toBeUndefined();
        }
        expect(evidence.objectiveMastery).toEqual(expect.objectContaining({
            result,
            skillTag: 'vocab_context',
            objectiveId: 'vocab_context_meaning',
            attemptKind: 'transfer',
            supportLevel: 1,
            latencyMs: 1250
        }));
        expect(evidence.objectiveMastery).not.toHaveProperty('selfConfidence');
        expect(evidence.objectiveMastery).not.toHaveProperty('progressRewardKind');
        expect(evidence.review).toEqual(expect.objectContaining({
            questionHash: 'hash_public_fixture',
            rating,
            questionData: expect.objectContaining({
                skillTag: 'vocab_context',
                learningObjectiveId: 'vocab_context_meaning',
                sourceContextSpan: question.sourceContextSpan,
                questionMode: 'choice',
                correctAnswer: 'orchard'
            })
        }));
        expect(evidence.review.questionData).not.toHaveProperty('selfConfidence');
        expect(evidence.review.questionData).not.toHaveProperty('progressRewardKind');
        expect(evidence.masteryResult).toBe(result);
        expect(Boolean(evidence.mistake)).toBe(result === 'wrong');
    });

    test('captures the selected wrong answer without adding learner identity', () => {
        const evidence = buildAnswerLearningEvidence({
            question,
            selectedOption: 'ocean',
            result: 'wrong',
            questionHash: 'hash_public_fixture',
            responseLatencyMs: 900,
            source: 'srs',
            isCritical: false
        });

        expect(evidence.mistake).toEqual(expect.objectContaining({
            questionId: 42,
            wrongAnswer: 'ocean',
            correctAnswer: 'orchard',
            skillTag: 'vocab_context'
        }));
        expect(JSON.stringify(evidence)).not.toMatch(/student|school|guardian|email/i);
    });
});

describe('practice-only task contracts in answer evidence', () => {
    const localVocabFormQuestion: Monster = {
        id: 7,
        type: 'vocab',
        question: 'Read: "Mia was ___ about her gift." What is the word?',
        options: ['excited', 'quiet', 'small', 'late'],
        correct_index: 0,
        explanation: 'The word is excited.',
        skillTag: 'vocab:vocab_context_meaning',
        difficulty: 'easy',
        questionMode: 'typing',
        correctAnswer: 'excited',
        learningObjectiveId: 'vocab_context_meaning',
        sourceContextSpan: 'Mia was excited about her gift.',
        supportLevel: 1,
        attemptKind: 'practice',
        itemFamilyId: 'ltf_lt-excited-abc123',
        learningTask: {
            schemaVersion: 1,
            targetFacet: 'vocab-form',
            cognitiveAction: 'retrieve-form',
            contextRelation: 'same-source',
            measurementEligibility: 'practice-only',
            encounterRole: 'skirmish'
        }
    };

    test('records the answer event, FSRS review, and mistake but skips objective mastery', () => {
        const correct = buildAnswerLearningEvidence({
            question: localVocabFormQuestion,
            selectedOption: 'excited',
            result: 'correct',
            questionHash: 'hash_vocab_form',
            responseLatencyMs: 1200,
            source: 'battle',
            isCritical: false
        });
        const wrong = buildAnswerLearningEvidence({
            question: localVocabFormQuestion,
            selectedOption: 'excite',
            result: 'wrong',
            questionHash: 'hash_vocab_form',
            responseLatencyMs: 1200,
            source: 'battle',
            isCritical: false
        });

        for (const evidence of [correct, wrong]) {
            expect(evidence.learningEvent).toEqual(expect.objectContaining({
                eventType: 'answer',
                result: evidence === correct ? 'correct' : 'wrong',
                learningObjectiveId: 'vocab_context_meaning',
                learningTask: localVocabFormQuestion.learningTask
            }));
            expect(evidence.review.questionHash).toBe('hash_vocab_form');
            expect(evidence.review.questionData.learningTask).toEqual(localVocabFormQuestion.learningTask);
            expect(evidence.objectiveMastery).toBeUndefined();
        }
        // Without the contract this typing item at support 1 would have been
        // independent; practice-only caps it at supported.
        expect(correct.learningEvent.evidenceStrength).toBe('supported');
        expect(wrong.mistake).toEqual(expect.objectContaining({
            wrongAnswer: 'excite',
            correctAnswer: 'excited'
        }));
    });

    test('a legacy question without a contract still reaches the mastery updater', () => {
        const legacy = buildAnswerLearningEvidence({
            question: { ...localVocabFormQuestion, learningTask: undefined },
            selectedOption: 'excited',
            result: 'correct',
            questionHash: 'hash_vocab_form_legacy',
            responseLatencyMs: 1200,
            source: 'battle',
            isCritical: false
        });

        expect(legacy.objectiveMastery).toEqual(expect.objectContaining({
            objectiveId: 'vocab_context_meaning',
            result: 'correct'
        }));
        expect(legacy.learningEvent.evidenceStrength).toBe('independent');
    });

    test('an aligned past-tense form item still creates objective evidence', () => {
        const pastTenseQuestion: Monster = {
            ...localVocabFormQuestion,
            id: 8,
            type: 'grammar',
            question: 'Read: "Yesterday Mia ___ to the park." What is the word?',
            options: ['went', 'saw', 'took', 'made'],
            correctAnswer: 'went',
            correct_index: 0,
            skillTag: 'grammar:past_tense_basic',
            learningObjectiveId: 'past_tense_basic',
            sourceContextSpan: 'Yesterday Mia went to the park.',
            itemFamilyId: 'ltf_lt-went-def456',
            learningTask: {
                schemaVersion: 1,
                targetFacet: 'grammar-form',
                cognitiveAction: 'retrieve-form',
                contextRelation: 'same-source',
                measurementEligibility: 'objective-evidence',
                encounterRole: 'skirmish'
            }
        };

        const evidence = buildAnswerLearningEvidence({
            question: pastTenseQuestion,
            selectedOption: 'went',
            result: 'correct',
            questionHash: 'hash_past_form',
            responseLatencyMs: 1200,
            source: 'battle',
            isCritical: false
        });

        expect(evidence.objectiveMastery).toEqual(expect.objectContaining({
            objectiveId: 'past_tense_basic',
            evidenceStrength: 'independent'
        }));
    });

    test('a prior answer for the same target caps later same-source items to supported', () => {
        const firstAnswer = buildUserAnswer({
            question: localVocabFormQuestion,
            selectedOption: 'excited',
            result: 'correct',
            questionHash: 'hash_recognition',
            progressReward: { kind: 'supported-practice', xp: 8, gold: 4, counted: true }
        });

        const repeated = buildAnswerLearningEvidence({
            question: { ...localVocabFormQuestion, id: 9, questionMode: 'typing' },
            selectedOption: 'excited',
            result: 'correct',
            questionHash: 'hash_typed_repeat',
            responseLatencyMs: 900,
            source: 'battle',
            isCritical: false,
            priorAnswers: [firstAnswer]
        });

        expect(repeated.learningEvent.evidenceStrength).toBe('supported');
        expect(repeated.objectiveMastery).toBeUndefined();
    });

    test('same-objective legacy questions are not capped by unrelated prior answers', () => {
        const priorAnswer = buildUserAnswer({
            question,
            selectedOption: 'orchard',
            result: 'correct',
            questionHash: 'hash_public_fixture'
        });

        const evidence = buildAnswerLearningEvidence({
            question,
            selectedOption: 'orchard',
            result: 'correct',
            questionHash: 'hash_public_fixture_2',
            responseLatencyMs: 1200,
            source: 'battle',
            isCritical: false,
            priorAnswers: [priorAnswer]
        });

        expect(evidence.learningEvent.evidenceStrength).toBe('transfer-independent');
    });
});
