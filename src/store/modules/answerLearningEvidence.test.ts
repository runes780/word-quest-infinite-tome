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
    supportLevel: 1,
    causeTag: 'context_clue'
};

describe('answer learning evidence contract', () => {
    test('keeps the session answer aligned with objective metadata', () => {
        expect(buildUserAnswer({
            question,
            selectedOption: 'orchard',
            result: 'correct',
            selfConfidence: 'high'
        })).toEqual({
            questionId: 42,
            questionText: question.question,
            userChoice: 'orchard',
            correctChoice: 'orchard',
            isCorrect: true,
            learningObjectiveId: 'vocab_context_meaning',
            attemptKind: 'transfer',
            supportLevel: 1,
            causeTag: 'context_clue',
            selfConfidence: 'high'
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
            selfConfidence: 'high'
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
        expect(evidence.objectiveMastery).toEqual(expect.objectContaining({
            result,
            skillTag: 'vocab_context',
            objectiveId: 'vocab_context_meaning',
            attemptKind: 'transfer',
            supportLevel: 1,
            latencyMs: 1250
        }));
        expect(evidence.objectiveMastery).not.toHaveProperty('selfConfidence');
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
