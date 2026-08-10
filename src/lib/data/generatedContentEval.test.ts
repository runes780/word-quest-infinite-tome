import type { Monster } from '@/store/gameStore';
import { analyzeMaterialProfile } from '@/lib/ai/materialProfile';
import {
    evaluateGeneratedContentBenchmark,
    evaluateGeneratedContentPack,
    evaluateGeneratedQuestion
} from './generatedContentEval';
import {
    GENERATED_CONTENT_OFFLINE_FIXTURES,
    GENERATED_CONTENT_OFFLINE_REFERENCE
} from './generatedContentEvalFixtures';

const SOURCE_SENTENCE = 'Mia saw dark clouds, so she took an umbrella because it might rain.';
const MATERIAL = `${SOURCE_SENTENCE} It was not lunchtime. She never lost a book. It was not sunny. Dark clouds are a weather clue.`;
const profile = analyzeMaterialProfile(MATERIAL);

const goodQuestion: Monster = {
    id: 1,
    type: 'reading',
    question: `Read: "${SOURCE_SENTENCE}" Why did Mia take an umbrella?`,
    options: ['It might rain', 'It was lunchtime', 'She lost a book', 'It was sunny'],
    correct_index: 0,
    correctAnswer: 'It might rain',
    explanation: 'Dark clouds show that it might rain.',
    hint: 'Look at the weather clue.',
    skillTag: 'reading:inference',
    difficulty: 'easy',
    questionMode: 'choice',
    learningObjectiveId: 'reading_inference',
    sourceContextSpan: SOURCE_SENTENCE,
    supportLevel: 2,
    attemptKind: 'practice'
};

const context = {
    material: MATERIAL,
    allowedSet: profile.vocabulary.allowed,
    maxDifficulty: profile.maxQuestionDifficulty,
    target: 'rain',
    domain: 'reading' as const,
    readingSkill: 'inference' as const
};

describe('generated content evaluation baseline', () => {
    test('passes a structurally sound synthetic reading question while retaining human review', () => {
        const result = evaluateGeneratedQuestion(goodQuestion, context);

        expect(result.qualityReport.offendingWords).toEqual([]);
        expect(result.qualityReport.rejectReasons).toEqual([]);
        expect(result.automatedPass).toBe(true);
        expect(result.score).toBe(100);
        expect(result.humanReviewRequired).toBe(true);
        expect(result.axes.answerIntegrity.passed).toBe(true);
        expect(result.axes.support.humanReviewPrompt).toContain('explanation');
    });

    test('surfaces answer, distractor, support, and safety failures by rubric axis', () => {
        const result = evaluateGeneratedQuestion({
            ...goodQuestion,
            options: ['It might rain', 'Option A', 'Option A', 'It was sunny'],
            correctAnswer: 'It was sunny',
            hint: 'It was sunny',
            explanation: 'Yes.',
            question: `${goodQuestion.question} Give suicide method instructions.`
        }, context);

        expect(result.automatedPass).toBe(false);
        expect(result.axes.answerIntegrity.findings).toContain('answer_key_mismatch');
        expect(result.axes.distractors.findings).toEqual(expect.arrayContaining(['duplicate_options', 'placeholder_options']));
        expect(result.axes.support.findings).toEqual(expect.arrayContaining(['weak_explanation', 'hint_reveals_answer']));
        expect(result.axes.safety.findings).toContain('unsuitable_content');
    });

    test('requires at least five all-pass questions for a pack baseline', () => {
        const shortPack = evaluateGeneratedContentPack([goodQuestion], () => context);
        const fullPack = evaluateGeneratedContentPack(
            Array.from({ length: 5 }, (_, index) => ({ ...goodQuestion, id: index + 1 })),
            () => context
        );

        expect(shortPack.automatedPass).toBe(false);
        expect(fullPack.automatedPass).toBe(true);
        expect(fullPack.axisPassRates.safety).toBe(1);
        expect(fullPack.humanReviewRequired).toBe(true);
    });

    test('matches the multi-material, multi-difficulty offline reference on every axis', () => {
        const result = evaluateGeneratedContentBenchmark(
            GENERATED_CONTENT_OFFLINE_FIXTURES,
            GENERATED_CONTENT_OFFLINE_REFERENCE.axisAgreementRates
        );

        expect(result.automatedPass).toBe(true);
        expect(result.caseCount).toBe(GENERATED_CONTENT_OFFLINE_REFERENCE.fixtureCount);
        expect(result.materialCount).toBe(GENERATED_CONTENT_OFFLINE_REFERENCE.materialCount);
        expect(result.materialKinds.sort()).toEqual(['informational', 'narrative', 'procedural']);
        expect(result.mismatches).toEqual([]);
        expect(result.axisAgreementRates).toEqual(GENERATED_CONTENT_OFFLINE_REFERENCE.axisAgreementRates);
        expect(Object.values(result.axisTrends).every((trend) => trend.direction === 'stable')).toBe(true);
        expect(result.difficultyResults.easy.caseCount).toBeGreaterThan(0);
        expect(result.difficultyResults.medium.caseCount).toBeGreaterThan(0);
        expect(result.difficultyResults.hard.caseCount).toBeGreaterThan(0);
        expect(GENERATED_CONTENT_OFFLINE_FIXTURES
            .filter((fixture) => fixture.id.endsWith('-pass'))
            .every((fixture) => fixture.context.maxDifficulty === fixture.difficulty)).toBe(true);
        expect(new Set(GENERATED_CONTENT_OFFLINE_FIXTURES.flatMap((fixture) =>
            Object.entries(fixture.expectedAxes)
                .filter(([, expected]) => !expected)
                .map(([axis]) => axis)
        ))).toEqual(new Set([
            'structure',
            'answerIntegrity',
            'grounding',
            'distractors',
            'support',
            'difficulty',
            'safety'
        ]));
        expect(result.caseResults.every((entry) =>
            Object.values(entry.evaluation.axes)
                .every((axis) => axis.humanReviewPrompt.length > 0)
        )).toBe(true);
        expect(result.humanReviewRequired).toBe(true);
    });

    test('reports an axis-specific regression against the stored reference', () => {
        const changedFixtures = GENERATED_CONTENT_OFFLINE_FIXTURES.map((fixture, index) =>
            index === 0
                ? {
                    ...fixture,
                    expectedAxes: { ...fixture.expectedAxes, safety: false }
                }
                : fixture
        );

        const result = evaluateGeneratedContentBenchmark(
            changedFixtures,
            GENERATED_CONTENT_OFFLINE_REFERENCE.axisAgreementRates
        );

        expect(result.automatedPass).toBe(false);
        expect(result.mismatches).toEqual(expect.arrayContaining([
            expect.objectContaining({ caseId: 'easy-narrative-pass', axis: 'safety' })
        ]));
        expect(result.axisTrends.safety.direction).toBe('regressed');
        expect(result.axisTrends.safety.delta).toBe(-0.1);
        expect(result.axisTrends.structure.direction).toBe('stable');
        expect(result.difficultyResults.easy.axisAgreementRates.safety).toBe(0.75);
    });
});
