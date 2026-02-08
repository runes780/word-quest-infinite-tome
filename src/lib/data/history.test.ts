import type { HistoryRecord } from '@/db/db';
import { getTargetedReviewSummary } from './history';

function rec(overrides: Partial<HistoryRecord>): HistoryRecord {
    return {
        timestamp: Date.now(),
        score: 0,
        totalQuestions: 0,
        levelTitle: 'Mission',
        ...overrides
    };
}

describe('getTargetedReviewSummary', () => {
    test('aggregates targeted review runs only', () => {
        const now = Date.now();
        const records: HistoryRecord[] = [
            rec({
                timestamp: now - 1000,
                score: 40,
                totalQuestions: 5,
                totalCorrect: 4,
                levelTitle: 'Targeted Review: tense_confusion'
            }),
            rec({
                timestamp: now - 2000,
                score: 30,
                totalQuestions: 5,
                totalCorrect: 3,
                levelTitle: 'Targeted Review: collocation_mixup'
            }),
            rec({
                timestamp: now - 3000,
                score: 80,
                totalQuestions: 10,
                totalCorrect: 8,
                levelTitle: 'Daily Challenge'
            })
        ];

        const summary = getTargetedReviewSummary(records);
        expect(summary.sessions).toBe(2);
        expect(summary.avgScore).toBe(35);
        expect(summary.avgAccuracy).toBeCloseTo(0.7, 5);
        expect(summary.successRuns).toBe(1);
        expect(summary.lastFocusTag).toBe('tense_confusion');
    });

    test('returns zero summary when no targeted runs', () => {
        const summary = getTargetedReviewSummary([
            rec({ levelTitle: 'Daily Challenge', totalQuestions: 10, totalCorrect: 8, score: 80 })
        ]);
        expect(summary.sessions).toBe(0);
        expect(summary.avgAccuracy).toBe(0);
        expect(summary.lastFocusTag).toBeUndefined();
    });
});
