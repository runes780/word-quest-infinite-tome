import {
    computeMasteryUpdate,
    computeObjectiveMasteryUpdate,
    computeObjectiveMasteryAggregateFromRows,
    ObjectiveMasteryRecord
} from './db';

describe('mastery update rules', () => {
    test('low-sample correct answers are smoothed to avoid over-jump', () => {
        const result = computeMasteryUpdate({
            previousScore: 20,
            previousState: 'new',
            attempts: 1,
            correct: 1,
            result: 'correct'
        });

        expect(result.smoothedAccuracy).toBeCloseTo(0.6, 3);
        expect(result.score).toBeLessThan(45);
        expect(result.state).toBe('new');
    });

    test('stable high performance upgrades learning to consolidated', () => {
        const result = computeMasteryUpdate({
            previousScore: 66,
            previousState: 'learning',
            attempts: 6,
            correct: 6,
            result: 'correct'
        });

        expect(result.score).toBeGreaterThanOrEqual(68);
        expect(result.state).toBe('consolidated');
    });

    test('hysteresis downgrades mastered when confidence drops hard', () => {
        const result = computeMasteryUpdate({
            previousScore: 90,
            previousState: 'mastered',
            attempts: 12,
            correct: 8,
            result: 'wrong'
        });

        expect(result.score).toBeLessThan(74);
        expect(result.state).toBe('consolidated');
    });

    test('objective mastery weights recognition lower than transfer', () => {
        const base = computeObjectiveMasteryUpdate({
            previousScore: 30,
            previousState: 'learning',
            attempts: 5,
            correct: 4,
            attemptsByMode: { choice: 4, 'fill-blank': 0, typing: 0 },
            transferAttempts: 0,
            transferCorrect: 0,
            hintCount: 0,
            result: 'correct',
            mode: 'choice',
            attemptKind: 'practice',
            supportLevel: 3,
            latencyMs: 1200
        });

        const transfer = computeObjectiveMasteryUpdate({
            previousScore: 30,
            previousState: 'learning',
            attempts: 5,
            correct: 4,
            attemptsByMode: { choice: 0, 'fill-blank': 0, typing: 4 },
            transferAttempts: 1,
            transferCorrect: 1,
            hintCount: 0,
            result: 'correct',
            mode: 'typing',
            attemptKind: 'transfer',
            supportLevel: 0,
            latencyMs: 1200
        });

        expect(transfer.score).toBeGreaterThan(base.score);
        expect(transfer.confidence).toBeGreaterThan(base.confidence);
    });

    test('objective mastery aggregate groups objective rows into domain scores', () => {
        const now = Date.UTC(2026, 5, 1);
        const rows: ObjectiveMasteryRecord[] = [
            {
                objectiveId: 'vocab_context_meaning',
                score: 80,
                state: 'consolidated',
                attempts: 8,
                correct: 7,
                attemptsByMode: { choice: 3, 'fill-blank': 2, typing: 3 },
                transferAttempts: 2,
                transferCorrect: 1,
                hintCount: 1,
                hintRate: 0.125,
                confidence: 0.72,
                lastReviewedAt: now,
                nextReviewAt: now + 86_400_000,
                updatedAt: now
            },
            {
                objectiveId: 'reading_inference',
                score: 50,
                state: 'learning',
                attempts: 6,
                correct: 3,
                attemptsByMode: { choice: 4, 'fill-blank': 1, typing: 1 },
                transferAttempts: 1,
                transferCorrect: 0,
                hintCount: 2,
                hintRate: 1 / 3,
                confidence: 0.45,
                lastReviewedAt: now,
                nextReviewAt: now + 86_400_000,
                updatedAt: now
            }
        ];

        const snapshot = computeObjectiveMasteryAggregateFromRows(rows, 14, now);
        expect(snapshot.byObjective).toHaveLength(2);
        expect(snapshot.byDomain.find((row) => row.domain === 'vocab')?.averageScore).toBe(80);
        expect(snapshot.byDomain.find((row) => row.domain === 'reading')?.averageScore).toBe(50);
        expect(snapshot.averageScore).toBe(65);
    });
});
