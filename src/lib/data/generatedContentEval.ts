import type { Monster } from '@/store/gameStore';
import {
    assessQuestionQuality,
    type QuestionQualityOptions,
    type QuestionQualityReport
} from './questionQuality';
import type { MaterialDifficulty } from '@/lib/ai/materialProfile';

export type GeneratedContentEvalAxis =
    | 'structure'
    | 'answerIntegrity'
    | 'grounding'
    | 'distractors'
    | 'support'
    | 'difficulty'
    | 'safety';

export const GENERATED_CONTENT_EVAL_BASELINE: Record<GeneratedContentEvalAxis, number> = {
    structure: 1,
    answerIntegrity: 1,
    grounding: 1,
    distractors: 1,
    support: 1,
    difficulty: 1,
    safety: 1
};

export interface GeneratedContentAxisResult {
    passed: boolean;
    findings: string[];
    humanReviewPrompt: string;
}

export interface GeneratedQuestionEvalResult {
    questionId: number;
    automatedPass: boolean;
    score: number;
    axes: Record<GeneratedContentEvalAxis, GeneratedContentAxisResult>;
    qualityReport: QuestionQualityReport;
    humanReviewRequired: true;
}

export interface GeneratedContentPackEvalResult {
    automatedPass: boolean;
    itemCount: number;
    axisPassRates: Record<GeneratedContentEvalAxis, number>;
    items: GeneratedQuestionEvalResult[];
    humanReviewRequired: true;
}

export interface GeneratedContentBenchmarkCase {
    id: string;
    materialId: string;
    materialKind: 'narrative' | 'procedural' | 'informational';
    difficulty: MaterialDifficulty;
    question: Monster;
    context: QuestionQualityOptions;
    expectedAxes: Record<GeneratedContentEvalAxis, boolean>;
}

export interface GeneratedContentAxisTrend {
    current: number;
    reference: number;
    delta: number;
    direction: 'improved' | 'stable' | 'regressed';
}

export interface GeneratedContentBenchmarkMismatch {
    caseId: string;
    axis: GeneratedContentEvalAxis;
    expected: boolean;
    actual: boolean;
    findings: string[];
}

export interface GeneratedContentDifficultyResult {
    caseCount: number;
    axisAgreementRates: Record<GeneratedContentEvalAxis, number>;
}

export interface GeneratedContentBenchmarkResult {
    automatedPass: boolean;
    caseCount: number;
    materialCount: number;
    materialKinds: Array<GeneratedContentBenchmarkCase['materialKind']>;
    difficultyResults: Record<MaterialDifficulty, GeneratedContentDifficultyResult>;
    axisAgreementRates: Record<GeneratedContentEvalAxis, number>;
    axisTrends: Record<GeneratedContentEvalAxis, GeneratedContentAxisTrend>;
    caseResults: Array<{
        caseId: string;
        materialId: string;
        difficulty: MaterialDifficulty;
        evaluation: GeneratedQuestionEvalResult;
    }>;
    mismatches: GeneratedContentBenchmarkMismatch[];
    humanReviewRequired: true;
}

const AXIS_REVIEW_PROMPTS: Record<GeneratedContentEvalAxis, string> = {
    structure: 'Does the mode, stem, and response format make one clear task?',
    answerIntegrity: 'Is the keyed answer actually correct and supported by the item?',
    grounding: 'Does the item test the supplied material or a valid transfer of one objective?',
    distractors: 'Are all wrong options plausible, distinct, and diagnostically useful?',
    support: 'Does the hint scaffold without revealing the answer, and does the explanation teach why?',
    difficulty: 'Are vocabulary, sentence length, and reasoning demand appropriate for the material?',
    safety: 'Is the wording age-appropriate, non-stereotyping, and suitable for educator review?'
};

const AXIS_REASON_MAP: Record<GeneratedContentEvalAxis, Set<string>> = {
    structure: new Set([
        'missing_question',
        'invalid_question_mode',
        'fill_blank_missing_visible_blank',
        'option_count_not_four'
    ]),
    answerIntegrity: new Set([
        'missing_correct_answer',
        'correct_index_out_of_range',
        'answer_key_mismatch'
    ]),
    grounding: new Set([
        'not_grounded_in_material',
        'transfer_missing_learning_objective',
        'transfer_missing_source_span',
        'reading_skill_missing',
        'reading_skill_mismatch'
    ]),
    distractors: new Set(['duplicate_options', 'placeholder_options']),
    support: new Set(),
    difficulty: new Set(['above_material_difficulty', 'above_material_vocabulary']),
    safety: new Set(['unsuitable_content', 'meta_content', 'non_english_question_payload'])
};

function normalized(value?: string) {
    return (value || '').trim().toLowerCase().replace(/[^a-z0-9\s'-]/g, '');
}

function supportFindings(question: Pick<Monster, 'hint' | 'explanation' | 'correctAnswer' | 'options' | 'correct_index'>) {
    const findings: string[] = [];
    const hint = normalized(question.hint);
    const explanation = normalized(question.explanation);
    const answer = normalized(question.correctAnswer || question.options?.[question.correct_index]);
    if (!hint) findings.push('missing_hint');
    if (!explanation || explanation.split(/\s+/).filter(Boolean).length < 4) findings.push('weak_explanation');
    if (hint && answer && (hint === answer || (answer.length >= 4 && hint.includes(answer)))) {
        findings.push('hint_reveals_answer');
    }
    return findings;
}

export function evaluateGeneratedQuestion(
    question: Monster,
    context: QuestionQualityOptions
): GeneratedQuestionEvalResult {
    const qualityReport = assessQuestionQuality(question, context);
    const axes = {} as Record<GeneratedContentEvalAxis, GeneratedContentAxisResult>;
    const axisNames = Object.keys(GENERATED_CONTENT_EVAL_BASELINE) as GeneratedContentEvalAxis[];

    axisNames.forEach((axis) => {
        const findings = qualityReport.rejectReasons.filter((reason) => AXIS_REASON_MAP[axis].has(reason));
        if (axis === 'support') findings.push(...supportFindings(question));
        axes[axis] = {
            passed: findings.length === 0,
            findings,
            humanReviewPrompt: AXIS_REVIEW_PROMPTS[axis]
        };
    });

    const passedAxes = axisNames.filter((axis) => axes[axis].passed).length;
    return {
        questionId: question.id,
        automatedPass: qualityReport.accepted && passedAxes === axisNames.length,
        score: Math.round((passedAxes / axisNames.length) * 100),
        axes,
        qualityReport,
        humanReviewRequired: true
    };
}

export function evaluateGeneratedContentPack(
    questions: Monster[],
    contextFor: (question: Monster, index: number) => QuestionQualityOptions
): GeneratedContentPackEvalResult {
    const items = questions.map((question, index) => evaluateGeneratedQuestion(question, contextFor(question, index)));
    const axisNames = Object.keys(GENERATED_CONTENT_EVAL_BASELINE) as GeneratedContentEvalAxis[];
    const axisPassRates = {} as Record<GeneratedContentEvalAxis, number>;
    axisNames.forEach((axis) => {
        axisPassRates[axis] = items.length === 0
            ? 0
            : items.filter((item) => item.axes[axis].passed).length / items.length;
    });

    return {
        automatedPass: items.length >= 5 &&
            items.every((item) => item.automatedPass) &&
            axisNames.every((axis) => axisPassRates[axis] >= GENERATED_CONTENT_EVAL_BASELINE[axis]),
        itemCount: items.length,
        axisPassRates,
        items,
        humanReviewRequired: true
    };
}

function rateForAxis(
    cases: GeneratedContentBenchmarkCase[],
    results: GeneratedQuestionEvalResult[],
    axis: GeneratedContentEvalAxis
): number {
    if (cases.length === 0) return 0;
    const matches = cases.filter((testCase, index) =>
        results[index]?.axes[axis].passed === testCase.expectedAxes[axis]
    ).length;
    return matches / cases.length;
}

function axisAgreementRatesFor(
    cases: GeneratedContentBenchmarkCase[],
    results: GeneratedQuestionEvalResult[]
): Record<GeneratedContentEvalAxis, number> {
    const rates = {} as Record<GeneratedContentEvalAxis, number>;
    (Object.keys(GENERATED_CONTENT_EVAL_BASELINE) as GeneratedContentEvalAxis[])
        .forEach((axis) => {
            rates[axis] = rateForAxis(cases, results, axis);
        });
    return rates;
}

function roundedDelta(value: number): number {
    return Math.round(value * 10000) / 10000;
}

export function evaluateGeneratedContentBenchmark(
    cases: GeneratedContentBenchmarkCase[],
    referenceRates: Partial<Record<GeneratedContentEvalAxis, number>> = GENERATED_CONTENT_EVAL_BASELINE
): GeneratedContentBenchmarkResult {
    const results = cases.map((testCase) =>
        evaluateGeneratedQuestion(testCase.question, testCase.context)
    );
    const axes = Object.keys(GENERATED_CONTENT_EVAL_BASELINE) as GeneratedContentEvalAxis[];
    const axisAgreementRates = axisAgreementRatesFor(cases, results);
    const mismatches: GeneratedContentBenchmarkMismatch[] = [];

    cases.forEach((testCase, index) => {
        axes.forEach((axis) => {
            const actual = results[index].axes[axis].passed;
            const expected = testCase.expectedAxes[axis];
            if (actual !== expected) {
                mismatches.push({
                    caseId: testCase.id,
                    axis,
                    expected,
                    actual,
                    findings: results[index].axes[axis].findings
                });
            }
        });
    });

    const difficultyResults = {} as Record<MaterialDifficulty, GeneratedContentDifficultyResult>;
    (['easy', 'medium', 'hard'] as MaterialDifficulty[]).forEach((difficulty) => {
        const selectedCases: GeneratedContentBenchmarkCase[] = [];
        const selectedResults: GeneratedQuestionEvalResult[] = [];
        cases.forEach((testCase, index) => {
            if (testCase.difficulty === difficulty) {
                selectedCases.push(testCase);
                selectedResults.push(results[index]);
            }
        });
        difficultyResults[difficulty] = {
            caseCount: selectedCases.length,
            axisAgreementRates: axisAgreementRatesFor(selectedCases, selectedResults)
        };
    });

    const axisTrends = {} as Record<GeneratedContentEvalAxis, GeneratedContentAxisTrend>;
    axes.forEach((axis) => {
        const reference = referenceRates[axis] ?? GENERATED_CONTENT_EVAL_BASELINE[axis];
        const current = axisAgreementRates[axis];
        const delta = roundedDelta(current - reference);
        axisTrends[axis] = {
            current,
            reference,
            delta,
            direction: delta > 0 ? 'improved' : delta < 0 ? 'regressed' : 'stable'
        };
    });

    const materialKinds = Array.from(new Set(cases.map((testCase) => testCase.materialKind)));
    const materialCount = new Set(cases.map((testCase) => testCase.materialId)).size;
    const hasDifficultyCoverage = (['easy', 'medium', 'hard'] as MaterialDifficulty[])
        .every((difficulty) => difficultyResults[difficulty].caseCount > 0);

    return {
        automatedPass: cases.length >= 7 &&
            materialCount >= 3 &&
            materialKinds.length >= 3 &&
            hasDifficultyCoverage &&
            mismatches.length === 0,
        caseCount: cases.length,
        materialCount,
        materialKinds,
        difficultyResults,
        axisAgreementRates,
        axisTrends,
        caseResults: cases.map((testCase, index) => ({
            caseId: testCase.id,
            materialId: testCase.materialId,
            difficulty: testCase.difficulty,
            evaluation: results[index]
        })),
        mismatches,
        humanReviewRequired: true
    };
}
