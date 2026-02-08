import { computeStudyPlanCompletionSnapshot } from './studyPlan';

describe('computeStudyPlanCompletionSnapshot', () => {
    test('computes action and minute totals from statuses', () => {
        const snapshot = computeStudyPlanCompletionSnapshot(
            [
                { id: 'a1', title: 'A', estimatedMinutes: 10 },
                { id: 'a2', title: 'B', estimatedMinutes: 12 },
                { id: 'a3', title: 'C', estimatedMinutes: 8 }
            ],
            {
                a1: 'completed',
                a2: 'skipped'
            }
        );

        expect(snapshot.totalActions).toBe(3);
        expect(snapshot.completedActions).toBe(1);
        expect(snapshot.skippedActions).toBe(1);
        expect(snapshot.pendingActions).toBe(1);
        expect(snapshot.plannedMinutes).toBe(30);
        expect(snapshot.completedMinutes).toBe(10);
    });
});
