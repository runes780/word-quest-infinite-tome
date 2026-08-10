import {
    buildCalibrationSummary,
    calibrationSignalFor,
    shouldCollectSelfConfidence
} from './metacognitiveCalibration';

describe('metacognitive calibration', () => {
    test('collects optional confidence only for diagnostic and transfer choices', () => {
        expect(shouldCollectSelfConfidence('diagnostic', 'choice')).toBe(true);
        expect(shouldCollectSelfConfidence('transfer', 'choice')).toBe(true);
        expect(shouldCollectSelfConfidence('practice', 'choice')).toBe(false);
        expect(shouldCollectSelfConfidence('transfer', 'typing')).toBe(false);
    });

    test('flags the two feedback moments without judging aligned answers', () => {
        expect(calibrationSignalFor('high', false)).toBe('high-confidence-error');
        expect(calibrationSignalFor('low', true)).toBe('low-confidence-correct');
        expect(calibrationSignalFor('high', true)).toBeNull();
        expect(calibrationSignalFor(undefined, false)).toBeNull();
    });

    test('builds an aggregate summary without retaining question content', () => {
        const summary = buildCalibrationSummary([
            { selfConfidence: 'high', result: 'wrong' },
            { selfConfidence: 'low', result: 'correct' },
            { selfConfidence: 'high', result: 'correct' },
            { selfConfidence: 'medium', result: 'wrong' },
            { result: 'correct' }
        ]);

        expect(summary).toEqual({
            ratedAnswers: 4,
            highConfidenceErrors: 1,
            lowConfidenceCorrect: 1,
            alignedJudgments: 1,
            status: 'review-high-confidence-errors'
        });
        expect(JSON.stringify(summary)).not.toMatch(/question|answerText|student/i);
    });

    test('filters persisted evidence to the requested time window', () => {
        const now = Date.UTC(2026, 6, 15);
        const summary = buildCalibrationSummary([
            { timestamp: now - 2 * 86400000, selfConfidence: 'low', result: 'correct' },
            { timestamp: now - 20 * 86400000, selfConfidence: 'high', result: 'wrong' }
        ], { now, windowDays: 7 });

        expect(summary.ratedAnswers).toBe(1);
        expect(summary.status).toBe('reinforce-low-confidence-success');
    });
});
