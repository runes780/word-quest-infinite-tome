import {
    StudyActionExecution,
    computeStudyActionExecutionSummaryFromRows,
    dateKeyFromTimestamp
} from './db';

function row(overrides: Partial<StudyActionExecution>): StudyActionExecution {
    return {
        actionId: 'targeted_pack',
        dateKey: dateKeyFromTimestamp(Date.now()),
        status: 'pending',
        priority: 'important',
        estimatedMinutes: 10,
        source: 'guardian_dashboard',
        updatedAt: Date.now(),
        ...overrides
    };
}

describe('computeStudyActionExecutionSummaryFromRows', () => {
    test('uses latest status per action/day and computes execution rate', () => {
        const now = Date.UTC(2026, 1, 8, 12, 0, 0);
        const rows: StudyActionExecution[] = [
            row({
                actionId: 'targeted_pack',
                dateKey: '2026-02-07',
                status: 'pending',
                updatedAt: now - 1000
            }),
            row({
                actionId: 'targeted_pack',
                dateKey: '2026-02-07',
                status: 'completed',
                updatedAt: now - 500
            }),
            row({
                actionId: 'srs_focus',
                dateKey: '2026-02-07',
                status: 'skipped',
                updatedAt: now - 400
            }),
            row({
                actionId: 'mastery_drill',
                dateKey: '2026-02-08',
                status: 'pending',
                updatedAt: now - 100
            })
        ];

        const summary = computeStudyActionExecutionSummaryFromRows(rows, 14, now);
        expect(summary.completed).toBe(1);
        expect(summary.skipped).toBe(1);
        expect(summary.pending).toBe(1);
        expect(summary.totalTracked).toBe(3);
        expect(summary.executionRate).toBeCloseTo(1 / 3, 5);
    });

    test('returns zero summary when nothing tracked in window', () => {
        const now = Date.UTC(2026, 1, 8, 12, 0, 0);
        const rows: StudyActionExecution[] = [
            row({
                actionId: 'targeted_pack',
                dateKey: '2025-12-01',
                status: 'completed',
                updatedAt: now - (40 * 24 * 60 * 60 * 1000)
            })
        ];

        const summary = computeStudyActionExecutionSummaryFromRows(rows, 14, now);
        expect(summary.totalTracked).toBe(0);
        expect(summary.executionRate).toBe(0);
    });
});
