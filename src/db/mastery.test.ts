import { computeMasteryUpdate } from './db';

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
});
