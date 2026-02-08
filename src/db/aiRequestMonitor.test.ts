import { AIRequestMetric, computeAIRequestMonitorSnapshotFromRows } from './db';

function row(overrides: Partial<AIRequestMetric>): AIRequestMetric {
    return {
        provider: 'openrouter',
        model: 'meta-llama/llama-3-8b-instruct:free',
        isFreeModel: true,
        outcome: 'success',
        attempts: 1,
        retryCount: 0,
        rateLimitHits: 0,
        latencyMs: 1200,
        timestamp: Date.now(),
        ...overrides
    };
}

function ts(now: number, dayOffset: number, minute = 0): number {
    return now - (dayOffset * 24 * 60 * 60 * 1000) + (minute * 60 * 1000);
}

describe('computeAIRequestMonitorSnapshotFromRows', () => {
    test('marks healthy when success and non-rate-limited rates meet targets', () => {
        const now = Date.UTC(2026, 1, 8, 12, 0, 0);
        const rows: AIRequestMetric[] = [
            row({ timestamp: ts(now, 1, 1), outcome: 'success' }),
            row({ timestamp: ts(now, 1, 2), outcome: 'success' }),
            row({ timestamp: ts(now, 2, 1), outcome: 'success' }),
            row({ timestamp: ts(now, 2, 2), outcome: 'success', retryCount: 1, attempts: 2 }),
            row({ timestamp: ts(now, 3, 1), outcome: 'success' }),
            row({ timestamp: ts(now, 8, 1), outcome: 'success' }),
            row({ timestamp: ts(now, 9, 1), outcome: 'error', rateLimitHits: 1 }),
            row({ timestamp: ts(now, 10, 1), outcome: 'success' }),
            row({ timestamp: ts(now, 11, 1), outcome: 'success' }),
            row({ timestamp: ts(now, 12, 1), outcome: 'success' })
        ];

        const snapshot = computeAIRequestMonitorSnapshotFromRows(rows, now, 7);
        expect(snapshot.status).toBe('healthy');
        expect(snapshot.successRate.currentRate).toBeCloseTo(1, 5);
        expect(snapshot.nonRateLimitedRate.currentRate).toBeCloseTo(1, 5);
        expect(snapshot.totalRequests).toBe(5);
    });

    test('marks critical when success and non-rate-limited rates both fail', () => {
        const now = Date.UTC(2026, 1, 8, 12, 0, 0);
        const rows: AIRequestMetric[] = [
            row({ timestamp: ts(now, 1, 1), outcome: 'error', rateLimitHits: 1, retryCount: 2, attempts: 3 }),
            row({ timestamp: ts(now, 1, 2), outcome: 'error', rateLimitHits: 1, retryCount: 2, attempts: 3 }),
            row({ timestamp: ts(now, 2, 1), outcome: 'success', rateLimitHits: 1, retryCount: 1, attempts: 2 }),
            row({ timestamp: ts(now, 2, 2), outcome: 'error', rateLimitHits: 1, retryCount: 2, attempts: 3 }),
            row({ timestamp: ts(now, 3, 1), outcome: 'error', rateLimitHits: 1, retryCount: 2, attempts: 3 })
        ];

        const snapshot = computeAIRequestMonitorSnapshotFromRows(rows, now, 7);
        expect(snapshot.status).toBe('critical');
        expect(snapshot.successRate.status).toBe('not_met');
        expect(snapshot.nonRateLimitedRate.status).toBe('not_met');
    });
});
