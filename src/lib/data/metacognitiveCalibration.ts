import type {
    LearningEventAttemptKind,
    LearningEventMode,
    LearningEventResult,
    LearningEventSelfConfidence
} from '@/db/db';

export type CalibrationSignal = 'high-confidence-error' | 'low-confidence-correct';
export type CalibrationStatus =
    | 'insufficient'
    | 'review-high-confidence-errors'
    | 'reinforce-low-confidence-success'
    | 'aligned';

export interface CalibrationRecord {
    result?: LearningEventResult;
    isCorrect?: boolean;
    selfConfidence?: LearningEventSelfConfidence;
    timestamp?: number;
}

export interface CalibrationSummary {
    ratedAnswers: number;
    highConfidenceErrors: number;
    lowConfidenceCorrect: number;
    alignedJudgments: number;
    status: CalibrationStatus;
}

export function shouldCollectSelfConfidence(
    attemptKind?: LearningEventAttemptKind,
    mode?: LearningEventMode
) {
    return mode === 'choice' && (attemptKind === 'diagnostic' || attemptKind === 'transfer');
}

export function calibrationSignalFor(
    selfConfidence: LearningEventSelfConfidence | undefined,
    isCorrect: boolean
): CalibrationSignal | null {
    if (selfConfidence === 'high' && !isCorrect) return 'high-confidence-error';
    if (selfConfidence === 'low' && isCorrect) return 'low-confidence-correct';
    return null;
}

export function buildCalibrationSummary(
    records: CalibrationRecord[],
    options: { now?: number; windowDays?: number } = {}
): CalibrationSummary {
    const now = options.now ?? Date.now();
    const start = typeof options.windowDays === 'number'
        ? now - options.windowDays * 24 * 60 * 60 * 1000
        : null;
    const rated = records.filter((record) => {
        if (!record.selfConfidence) return false;
        if (start === null || typeof record.timestamp !== 'number') return true;
        return record.timestamp >= start && record.timestamp <= now;
    });

    let highConfidenceErrors = 0;
    let lowConfidenceCorrect = 0;
    let alignedJudgments = 0;

    rated.forEach((record) => {
        const isCorrect = typeof record.isCorrect === 'boolean'
            ? record.isCorrect
            : record.result === 'correct';
        if (record.selfConfidence === 'high' && !isCorrect) highConfidenceErrors += 1;
        if (record.selfConfidence === 'low' && isCorrect) lowConfidenceCorrect += 1;
        if (
            (record.selfConfidence === 'high' && isCorrect) ||
            (record.selfConfidence === 'low' && !isCorrect)
        ) {
            alignedJudgments += 1;
        }
    });

    const status: CalibrationStatus = rated.length === 0
        ? 'insufficient'
        : highConfidenceErrors > 0
            ? 'review-high-confidence-errors'
            : lowConfidenceCorrect > 0
                ? 'reinforce-low-confidence-success'
                : 'aligned';

    return {
        ratedAnswers: rated.length,
        highConfidenceErrors,
        lowConfidenceCorrect,
        alignedJudgments,
        status
    };
}
