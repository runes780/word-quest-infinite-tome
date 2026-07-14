import type { Monster } from '@/store/gameStore';
import { analyzeMaterialProfile } from '@/lib/ai/materialProfile';
import { evaluateGeneratedContentPack, evaluateGeneratedQuestion } from './generatedContentEval';

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
});
