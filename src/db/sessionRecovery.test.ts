import { SessionRecoveryEvent, computeSessionRecoverySnapshotFromEvents } from './db';

function event(overrides: Partial<SessionRecoveryEvent>): SessionRecoveryEvent {
    return {
        eventType: 'attempt',
        hasSave: true,
        timestamp: Date.now(),
        ...overrides
    };
}

function ts(now: number, dayOffset: number, minute = 0): number {
    return now - (dayOffset * 24 * 60 * 60 * 1000) + (minute * 60 * 1000);
}

describe('computeSessionRecoverySnapshotFromEvents', () => {
    test('marks healthy when success rate meets target with enough attempts', () => {
        const now = Date.UTC(2026, 1, 8, 12, 0, 0);
        const rows: SessionRecoveryEvent[] = [
            event({ eventType: 'attempt', timestamp: ts(now, 1, 1) }),
            event({ eventType: 'success', timestamp: ts(now, 1, 2) }),
            event({ eventType: 'attempt', timestamp: ts(now, 2, 1) }),
            event({ eventType: 'success', timestamp: ts(now, 2, 2) }),
            event({ eventType: 'attempt', timestamp: ts(now, 3, 1) }),
            event({ eventType: 'success', timestamp: ts(now, 3, 2) }),
            event({ eventType: 'attempt', timestamp: ts(now, 4, 1) }),
            event({ eventType: 'failure', timestamp: ts(now, 4, 2), hasSave: false, reason: 'missing_save' })
        ];

        const snapshot = computeSessionRecoverySnapshotFromEvents(rows, now, 14);
        expect(snapshot.attempts).toBe(4);
        expect(snapshot.successRate.currentRate).toBeCloseTo(0.75, 5);
        expect(snapshot.status).toBe('warning');
    });

    test('marks critical when success rate drops below 60%', () => {
        const now = Date.UTC(2026, 1, 8, 12, 0, 0);
        const rows: SessionRecoveryEvent[] = [
            event({ eventType: 'attempt', timestamp: ts(now, 1, 1) }),
            event({ eventType: 'failure', timestamp: ts(now, 1, 2), hasSave: false }),
            event({ eventType: 'attempt', timestamp: ts(now, 2, 1) }),
            event({ eventType: 'success', timestamp: ts(now, 2, 2) }),
            event({ eventType: 'attempt', timestamp: ts(now, 3, 1) }),
            event({ eventType: 'failure', timestamp: ts(now, 3, 2), hasSave: false }),
            event({ eventType: 'attempt', timestamp: ts(now, 4, 1) }),
            event({ eventType: 'failure', timestamp: ts(now, 4, 2), hasSave: false })
        ];

        const snapshot = computeSessionRecoverySnapshotFromEvents(rows, now, 14);
        expect(snapshot.successRate.currentRate).toBeCloseTo(0.25, 5);
        expect(snapshot.status).toBe('critical');
    });
});
