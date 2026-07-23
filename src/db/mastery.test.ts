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

    test('supported and immediate-repair evidence cannot manufacture consolidation', () => {
        const result = computeObjectiveMasteryUpdate({
            previousScore: 66,
            previousState: 'learning',
            attempts: 20,
            correct: 20,
            qualifiedAttempts: 0,
            qualifiedCorrect: 0,
            independentAttempts: 0,
            attemptsByMode: { choice: 20, 'fill-blank': 0, typing: 0 },
            transferAttempts: 0,
            transferCorrect: 0,
            delayedProbeAttempts: 0,
            delayedProbeCorrect: 0,
            hintCount: 0,
            result: 'correct',
            mode: 'choice',
            attemptKind: 'practice',
            supportLevel: 2,
            evidenceStrength: 'supported'
        });

        expect(result.score).toBeLessThan(68);
        expect(result.state).toBe('new');
    });

    test('mastery requires both delayed and transfer evidence', () => {
        const withoutDelayed = computeObjectiveMasteryUpdate({
            previousScore: 92,
            previousState: 'consolidated',
            attempts: 12,
            correct: 12,
            qualifiedAttempts: 12,
            qualifiedCorrect: 12,
            independentAttempts: 8,
            attemptsByMode: { choice: 2, 'fill-blank': 4, typing: 6 },
            transferAttempts: 3,
            transferCorrect: 3,
            delayedProbeAttempts: 0,
            delayedProbeCorrect: 0,
            hintCount: 0,
            result: 'correct',
            mode: 'typing',
            attemptKind: 'transfer',
            supportLevel: 0,
            evidenceStrength: 'transfer-independent'
        });
        const withDelayed = computeObjectiveMasteryUpdate({
            previousScore: 92,
            previousState: 'consolidated',
            attempts: 14,
            correct: 14,
            qualifiedAttempts: 14,
            qualifiedCorrect: 14,
            independentAttempts: 8,
            attemptsByMode: { choice: 2, 'fill-blank': 5, typing: 7 },
            transferAttempts: 3,
            transferCorrect: 3,
            delayedProbeAttempts: 2,
            delayedProbeCorrect: 2,
            hintCount: 0,
            result: 'correct',
            mode: 'typing',
            attemptKind: 'review',
            supportLevel: 0,
            evidenceStrength: 'delayed-independent'
        });

        expect(withoutDelayed.state).not.toBe('mastered');
        expect(withDelayed.state).toBe('mastered');
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
        expect(snapshot.byObjective.find((row) => row.objectiveId === 'vocab_context_meaning')).toEqual(expect.objectContaining({
            independentAttempts: 0,
            delayedProbeAttempts: 0,
            evidenceStatus: 'insufficient'
        }));
        expect(snapshot.byDomain.find((row) => row.domain === 'vocab')?.averageScore).toBe(80);
        expect(snapshot.byDomain.find((row) => row.domain === 'reading')?.averageScore).toBe(50);
        expect(snapshot.averageScore).toBe(65);
    });
});
