import { LearningEvent, buildWeeklyLearningTasksFromEvents, getWeeklyWindow } from './db';

function event(overrides: Partial<LearningEvent>): LearningEvent {
    return {
        eventType: 'answer',
        source: 'battle',
        timestamp: Date.now(),
        ...overrides
    };
}

describe('buildWeeklyLearningTasksFromEvents', () => {
    test('computes weekly progress by metric and marks completion', () => {
        const now = Date.UTC(2026, 1, 8, 12, 0, 0);
        const { periodStart } = getWeeklyWindow(now);
        const records: LearningEvent[] = [];

        for (let i = 0; i < 3; i++) {
            records.push(event({
                eventType: 'session_complete',
                source: 'daily',
                timestamp: periodStart + (i + 1) * 1000
            }));
        }
        for (let i = 0; i < 5; i++) {
            records.push(event({
                eventType: 'answer',
                source: 'srs',
                result: i % 2 === 0 ? 'correct' : 'wrong',
                timestamp: periodStart + 10_000 + i * 1000
            }));
        }
        for (let i = 0; i < 15; i++) {
            records.push(event({
                eventType: 'answer',
                source: 'battle',
                result: 'correct',
                timestamp: periodStart + 20_000 + i * 1000
            }));
        }

        const tasks = buildWeeklyLearningTasksFromEvents(records, now);
        const daily = tasks.find((t) => t.taskId === 'daily_champion_weekly');
        const srs = tasks.find((t) => t.taskId === 'srs_guardian_weekly');
        const battle = tasks.find((t) => t.taskId === 'battle_precision_weekly');

        expect(daily?.progress).toBe(3);
        expect(daily?.status).toBe('completed');
        expect(srs?.progress).toBe(5);
        expect(srs?.status).toBe('active');
        expect(battle?.progress).toBe(15);
        expect(battle?.status).toBe('completed');
    });

    test('keeps existing completedAt when rebuilding tasks', () => {
        const now = Date.UTC(2026, 1, 8, 12, 0, 0);
        const { periodStart } = getWeeklyWindow(now);
        const records: LearningEvent[] = [
            event({ eventType: 'session_complete', source: 'daily', timestamp: periodStart + 1000 }),
            event({ eventType: 'session_complete', source: 'daily', timestamp: periodStart + 2000 }),
            event({ eventType: 'session_complete', source: 'daily', timestamp: periodStart + 3000 })
        ];

        const first = buildWeeklyLearningTasksFromEvents(records, now);
        const existing = first.find((row) => row.taskId === 'daily_champion_weekly');
        const completedAt = 1_700_000_000_000;

        const second = buildWeeklyLearningTasksFromEvents(records, now + 10_000, {
            daily_champion_weekly: {
                ...existing!,
                completedAt
            }
        });

        const rebuilt = second.find((row) => row.taskId === 'daily_champion_weekly');
        expect(rebuilt?.status).toBe('completed');
        expect(rebuilt?.completedAt).toBe(completedAt);
    });

    test('caps evidence and keeps latest events first', () => {
        const now = Date.UTC(2026, 1, 8, 12, 0, 0);
        const { periodStart } = getWeeklyWindow(now);
        const records: LearningEvent[] = [];

        for (let i = 0; i < 8; i++) {
            records.push(event({
                eventType: 'answer',
                source: 'battle',
                result: 'correct',
                questionHash: `q_${i}`,
                timestamp: periodStart + (i + 1) * 1000
            }));
        }

        const tasks = buildWeeklyLearningTasksFromEvents(records, now);
        const battle = tasks.find((row) => row.taskId === 'battle_precision_weekly');
        expect(battle?.evidence).toHaveLength(5);
        expect(battle?.evidence[0].questionHash).toBe('q_7');
        expect(battle?.evidence[4].questionHash).toBe('q_3');
    });
});
