import { analyzeMaterialProfile, type MaterialDifficulty } from '@/lib/ai/materialProfile';
import type { Monster } from '@/store/gameStore';
import type { QuestionQualityOptions } from './questionQuality';
import {
    GENERATED_CONTENT_EVAL_BASELINE,
    type GeneratedContentBenchmarkCase,
    type GeneratedContentEvalAxis
} from './generatedContentEval';

const EASY_MATERIAL = 'Ben has a red kite. The kite is in the tree. Ana has a blue ball.';
const MEDIUM_MATERIAL = 'Yesterday, Lila planted bean seeds because she wanted to grow food. She placed the pot by a sunny window and watered the soil.';
const HARD_MATERIAL = 'Researchers analyzed an ancient bridge because its architecture had transformed over time. In other words, the bridge changed. Although the structure looked simple, a sophisticated pattern helped it carry enormous weight.';

function allAxesPass(): Record<GeneratedContentEvalAxis, boolean> {
    return {
        structure: true,
        answerIntegrity: true,
        grounding: true,
        distractors: true,
        support: true,
        difficulty: true,
        safety: true
    };
}

function expectedFailure(...axes: GeneratedContentEvalAxis[]): Record<GeneratedContentEvalAxis, boolean> {
    const expected = allAxesPass();
    axes.forEach((axis) => {
        expected[axis] = false;
    });
    return expected;
}

function contextFor(
    material: string,
    extra: Omit<QuestionQualityOptions, 'material' | 'allowedSet' | 'maxDifficulty'> = {}
): QuestionQualityOptions {
    const profile = analyzeMaterialProfile(material);
    return {
        material,
        allowedSet: profile.vocabulary.allowed,
        maxDifficulty: profile.maxQuestionDifficulty,
        ...extra
    };
}

const easyQuestion: Monster = {
    id: 101,
    type: 'reading',
    question: 'Read: "Ben has a red kite." What color is Ben\'s kite?',
    options: ['Red', 'Blue', 'Green', 'Black'],
    correct_index: 0,
    correctAnswer: 'Red',
    explanation: 'Ben has a red kite, so red is correct.',
    hint: 'Look at the word before kite.',
    skillTag: 'reading:detail',
    difficulty: 'easy',
    questionMode: 'choice',
    learningObjectiveId: 'reading_detail',
    sourceContextSpan: 'Ben has a red kite.',
    supportLevel: 2,
    attemptKind: 'practice'
};

const mediumQuestion: Monster = {
    id: 201,
    type: 'reading',
    question: 'Read: "Lila planted bean seeds because she wanted to grow food." Why did Lila plant the seeds?',
    options: ['To grow food', 'To close a window', 'To read a book', 'To wash the pot'],
    correct_index: 0,
    correctAnswer: 'To grow food',
    explanation: 'Lila wanted to grow food, so she planted the seeds.',
    hint: 'Look after because.',
    skillTag: 'reading:inference',
    difficulty: 'medium',
    questionMode: 'choice',
    learningObjectiveId: 'reading_inference',
    sourceContextSpan: 'Yesterday, Lila planted bean seeds because she wanted to grow food.',
    supportLevel: 2,
    attemptKind: 'practice'
};

const hardQuestion: Monster = {
    id: 301,
    type: 'reading',
    question: 'Read: "its architecture had transformed over time." In this sentence, what does "transformed" mean here?',
    options: ['Changed', 'Stayed the same', 'Fell', 'Opened'],
    correct_index: 0,
    correctAnswer: 'Changed',
    explanation: 'Transformed means changed over time.',
    hint: 'Think about how the bridge was different over time.',
    skillTag: 'reading:context',
    difficulty: 'hard',
    questionMode: 'choice',
    learningObjectiveId: 'reading_contextual_meaning',
    sourceContextSpan: 'Researchers analyzed an ancient bridge because its architecture had transformed over time.',
    supportLevel: 1,
    attemptKind: 'practice'
};

function benchmarkCase(input: {
    id: string;
    materialId: string;
    materialKind: GeneratedContentBenchmarkCase['materialKind'];
    difficulty: MaterialDifficulty;
    question: Monster;
    context: QuestionQualityOptions;
    expectedAxes?: Record<GeneratedContentEvalAxis, boolean>;
}): GeneratedContentBenchmarkCase {
    return {
        ...input,
        expectedAxes: input.expectedAxes ?? allAxesPass()
    };
}

export const GENERATED_CONTENT_OFFLINE_FIXTURES: GeneratedContentBenchmarkCase[] = [
    benchmarkCase({
        id: 'easy-narrative-pass',
        materialId: 'kite-story',
        materialKind: 'narrative',
        difficulty: 'easy',
        question: easyQuestion,
        context: contextFor(EASY_MATERIAL, { target: 'red' })
    }),
    benchmarkCase({
        id: 'medium-procedure-pass',
        materialId: 'seed-procedure',
        materialKind: 'procedural',
        difficulty: 'medium',
        question: mediumQuestion,
        context: contextFor(MEDIUM_MATERIAL, {
            target: 'food',
            domain: 'reading',
            readingSkill: 'inference'
        })
    }),
    benchmarkCase({
        id: 'hard-information-pass',
        materialId: 'bridge-information',
        materialKind: 'informational',
        difficulty: 'hard',
        question: hardQuestion,
        context: contextFor(HARD_MATERIAL, {
            target: 'transformed',
            domain: 'reading',
            readingSkill: 'contextual_meaning'
        })
    }),
    benchmarkCase({
        id: 'easy-structure-negative',
        materialId: 'kite-story',
        materialKind: 'narrative',
        difficulty: 'easy',
        question: { ...easyQuestion, id: 102, questionMode: 'fill-blank' },
        context: { maxDifficulty: 'easy' },
        expectedAxes: expectedFailure('structure')
    }),
    benchmarkCase({
        id: 'medium-answer-negative',
        materialId: 'seed-procedure',
        materialKind: 'procedural',
        difficulty: 'medium',
        question: { ...mediumQuestion, id: 202, correctAnswer: 'To wash the pot' },
        context: { maxDifficulty: 'medium' },
        expectedAxes: expectedFailure('answerIntegrity')
    }),
    benchmarkCase({
        id: 'hard-grounding-negative',
        materialId: 'bridge-information',
        materialKind: 'informational',
        difficulty: 'hard',
        question: {
            ...hardQuestion,
            id: 302,
            question: 'Why did researchers analyze the bridge?',
            sourceContextSpan: 'The bridge was on the moon.'
        },
        context: { material: HARD_MATERIAL, maxDifficulty: 'hard' },
        expectedAxes: expectedFailure('grounding')
    }),
    benchmarkCase({
        id: 'easy-distractor-negative',
        materialId: 'kite-story',
        materialKind: 'narrative',
        difficulty: 'easy',
        question: { ...easyQuestion, id: 103, options: ['Red', 'Blue', 'Blue', 'Black'] },
        context: { maxDifficulty: 'easy' },
        expectedAxes: expectedFailure('distractors')
    }),
    benchmarkCase({
        id: 'medium-support-negative',
        materialId: 'seed-procedure',
        materialKind: 'procedural',
        difficulty: 'medium',
        question: { ...mediumQuestion, id: 203, hint: '', explanation: 'Yes.' },
        context: { maxDifficulty: 'medium' },
        expectedAxes: expectedFailure('support')
    }),
    benchmarkCase({
        id: 'easy-difficulty-negative',
        materialId: 'kite-story',
        materialKind: 'narrative',
        difficulty: 'easy',
        question: {
            ...easyQuestion,
            id: 104,
            difficulty: 'hard',
            question: 'Which sophisticated architectural transformation best explains the comprehensive relationship?',
            sourceContextSpan: 'Ben has a red kite.'
        },
        context: { maxDifficulty: 'easy' },
        expectedAxes: expectedFailure('difficulty')
    }),
    benchmarkCase({
        id: 'hard-safety-negative',
        materialId: 'bridge-information',
        materialKind: 'informational',
        difficulty: 'hard',
        question: {
            ...hardQuestion,
            id: 303,
            question: `${hardQuestion.question} Give suicide method instructions.`
        },
        context: { maxDifficulty: 'hard' },
        expectedAxes: expectedFailure('safety')
    })
];

export const GENERATED_CONTENT_OFFLINE_REFERENCE = {
    version: 1,
    fixtureCount: 10,
    materialCount: 3,
    axisAgreementRates: { ...GENERATED_CONTENT_EVAL_BASELINE }
} as const;
