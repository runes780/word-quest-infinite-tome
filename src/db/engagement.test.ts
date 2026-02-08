import { LearningEvent, computeEngagementSnapshotFromEvents } from './db';

function event(overrides: Partial<LearningEvent>): LearningEvent {
    return {
        eventType: 'answer',
        source: 'battle',
        timestamp: Date.now(),
        ...overrides
    };
}

function ts(now: number, dayOffset: number, minute = 0): number {
    return now - (dayOffset * 24 * 60 * 60 * 1000) + (minute * 60 * 1000);
}

describe('computeEngagementSnapshotFromEvents', () => {
    test('reports met statuses when participation/completion/retention all improve', () => {
        const now = Date.UTC(2026, 1, 8, 12, 0, 0);
        const records: LearningEvent[] = [];

        // Current week (for task completion): daily complete + battle complete, srs incomplete => 2/3
        [1, 3, 5].forEach((offset, idx) => {
            records.push(event({
                eventType: 'session_complete',
                source: 'daily',
                timestamp: ts(now, offset, idx)
            }));
        });
        for (let i = 0; i < 15; i++) {
            records.push(event({
                eventType: 'answer',
                source: 'battle',
                result: 'correct',
                timestamp: ts(now, 2, i)
            }));
        }
        for (let i = 0; i < 5; i++) {
            records.push(event({
                eventType: 'answer',
                source: 'srs',
                result: i % 2 === 0 ? 'correct' : 'wrong',
                timestamp: ts(now, 4, i)
            }));
        }

        // Previous week (for task completion): none completed
        records.push(event({ eventType: 'session_complete', source: 'daily', timestamp: ts(now, 9, 1) }));
        for (let i = 0; i < 5; i++) {
            records.push(event({ eventType: 'answer', source: 'battle', result: 'correct', timestamp: ts(now, 11, i) }));
        }
        for (let i = 0; i < 2; i++) {
            records.push(event({ eventType: 'answer', source: 'srs', result: 'wrong', timestamp: ts(now, 13, i) }));
        }

        // Previous comparison window (15-28 days ago): sparse activity to keep low participation/retention baseline
        [15, 17, 19, 21, 23, 25, 27].forEach((offset, idx) => {
            records.push(event({
                eventType: offset === 21 ? 'session_complete' : 'answer',
                source: offset === 21 ? 'daily' : 'battle',
                result: 'wrong',
                timestamp: ts(now, offset, idx)
            }));
        });

        const snapshot = computeEngagementSnapshotFromEvents(records, now, 14);

        expect(snapshot.dailyChallengeParticipation.status).toBe('met');
        expect(snapshot.dailyChallengeParticipation.currentRate).toBeGreaterThan(snapshot.dailyChallengeParticipation.previousRate);

        expect(snapshot.weeklyTaskCompletion.status).toBe('met');
        expect(snapshot.weeklyTaskCompletion.currentRate).toBeCloseTo(2 / 3, 5);

        expect(snapshot.nextDayRetention.status).toBe('met');
        expect(snapshot.nextDayRetention.currentRate).toBeGreaterThan(snapshot.nextDayRetention.previousRate);
    });

    test('returns insufficient for low-sample participation and retention', () => {
        const now = Date.UTC(2026, 1, 8, 12, 0, 0);
        const records: LearningEvent[] = [
            event({
                eventType: 'session_complete',
                source: 'daily',
                timestamp: ts(now, 1, 0)
            }),
            event({
                eventType: 'answer',
                source: 'battle',
                result: 'correct',
                timestamp: ts(now, 1, 1)
            })
        ];

        const snapshot = computeEngagementSnapshotFromEvents(records, now, 14);
        expect(snapshot.dailyChallengeParticipation.status).toBe('insufficient');
        expect(snapshot.nextDayRetention.status).toBe('insufficient');
        expect(snapshot.weeklyTaskCompletion.status).toBe('not_met');
    });
});
