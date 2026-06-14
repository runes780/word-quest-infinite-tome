import {
    FALLBACK_PASSAGES,
    FALLBACK_QUESTIONS,
    getRandomFallbackQuestions,
    getBalancedFallbackQuestions,
    fallbackToMonster
} from './fallbackQuestions';
import { assessQuestionQuality } from './questionQuality';

describe('fallback bank 1T compliance', () => {
    test('every question passes the quality gate against its own passage', () => {
        for (const question of FALLBACK_QUESTIONS) {
            const passage = FALLBACK_PASSAGES.find((p) => p.id === question.passageId);
            if (!passage) throw new Error(`passage ${question.passageId} not found`);
            const allowed = new Set(passage.vocabulary);
            const report = assessQuestionQuality(
                {
                    question: question.question,
                    options: question.options,
                    correct_index: question.correct_index,
                    correctAnswer: question.options[question.correct_index],
                    questionMode: question.questionMode,
                    difficulty: question.difficulty,
                    learningObjectiveId: question.learningObjectiveId,
                    sourceContextSpan: question.sourceSpan,
                    supportLevel: question.supportLevel,
                    attemptKind: 'practice' as const,
                    hint: question.hint,
                    explanation: question.explanation
                },
                {
                    maxDifficulty: passage.band,
                    allowedSet: allowed,
                    material: passage.text,
                    target: question.target,
                    domain: question.type,
                    readingSkill: question.readingSkill
                }
            );
            if (!report.accepted) {
                throw new Error(
                    `Fallback question ${question.id} failed gate: ${report.rejectReasons.join(', ')}`
                );
            }
        }
    });

    test('getBalancedFallbackQuestions returns up to count questions', () => {
        const result = getBalancedFallbackQuestions(5, 'easy');
        expect(result.length).toBeLessThanOrEqual(5);
        expect(result.length).toBeGreaterThan(0);
    });

    test('getRandomFallbackQuestions respects difficulty', () => {
        const result = getRandomFallbackQuestions(3, 'easy');
        expect(result.every((q) => q.difficulty === 'easy')).toBe(true);
    });

    test('fallbackToMonster preserves grounding and intent', () => {
        const fb = FALLBACK_QUESTIONS[0];
        const monster = fallbackToMonster(fb, 42);
        expect(monster.id).toBe(42);
        expect(monster.sourceContextSpan).toBe(fb.sourceSpan); // span preserved
        expect(monster.correctAnswer).toBe(fb.options[fb.correct_index]);
        expect(monster.learningObjectiveId).toBe(fb.learningObjectiveId);
        expect(monster.supportLevel).toBe(fb.supportLevel);
        expect(monster.attemptKind).toBe(fb.role === 'transfer' ? 'transfer' : 'practice');
    });
});
