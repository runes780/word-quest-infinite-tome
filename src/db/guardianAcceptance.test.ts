import {
    GuardianDashboardEvent,
    computeGuardianAcceptanceSnapshotFromEvents,
    dateKeyFromTimestamp
} from './db';

function event(overrides: Partial<GuardianDashboardEvent>): GuardianDashboardEvent {
    const timestamp = overrides.timestamp ?? Date.now();
    return {
        eventType: 'panel_open',
        dateKey: dateKeyFromTimestamp(timestamp),
        timestamp,
        ...overrides
    };
}

function ts(now: number, dayOffset: number, minute = 0): number {
    return now - (dayOffset * 24 * 60 * 60 * 1000) + (minute * 60 * 1000);
}

describe('computeGuardianAcceptanceSnapshotFromEvents', () => {
    test('marks met when weekly active rate lifts by at least 20%', () => {
        const now = Date.UTC(2026, 1, 8, 12, 0, 0);
        const rows: GuardianDashboardEvent[] = [
            event({ timestamp: ts(now, 1, 1) }),
            event({ timestamp: ts(now, 2, 2), eventType: 'action_marked' }),
            event({ timestamp: ts(now, 4, 3), eventType: 'report_export' }),
            event({ timestamp: ts(now, 6, 4), eventType: 'session_launch' }),
            event({ timestamp: ts(now, 8, 1) }),
            event({ timestamp: ts(now, 10, 2) })
        ];

        const snapshot = computeGuardianAcceptanceSnapshotFromEvents(rows, now, 7, 0.2);
        expect(snapshot.weeklyActiveRate.currentRate).toBeCloseTo(4 / 7, 5);
        expect(snapshot.weeklyActiveRate.previousRate).toBeCloseTo(2 / 7, 5);
        expect(snapshot.weeklyActiveRate.status).toBe('met');
    });

    test('marks insufficient when previous window has no active day baseline', () => {
        const now = Date.UTC(2026, 1, 8, 12, 0, 0);
        const rows: GuardianDashboardEvent[] = [
            event({ timestamp: ts(now, 1, 1) }),
            event({ timestamp: ts(now, 2, 2), eventType: 'action_marked' })
        ];

        const snapshot = computeGuardianAcceptanceSnapshotFromEvents(rows, now, 7, 0.2);
        expect(snapshot.weeklyActiveRate.previousRate).toBe(0);
        expect(snapshot.weeklyActiveRate.status).toBe('insufficient');
    });
});
