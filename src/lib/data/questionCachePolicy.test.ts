import {
    buildQuestionCacheKey,
    mergeQuestionCache,
    normalizeQuestionCacheEntry,
    QuestionCachePolicy
} from './questionCachePolicy';

describe('questionCachePolicy', () => {
    const now = Date.UTC(2026, 1, 8, 12, 0, 0);

    test('enforces ttl, per-context cap, and total cap', () => {
        const policy: QuestionCachePolicy = {
            ttlMs: 1000 * 60 * 60 * 24,
            maxPerContext: 2,
            maxTotal: 3
        };

        const existing = [
            { question: 'q1', options: ['a', 'b'], correct_index: 0, type: 'vocab' as const, explanation: '', contextHash: 'ctx-a', timestamp: now - 100, used: false },
            { question: 'q2', options: ['a', 'b'], correct_index: 0, type: 'vocab' as const, explanation: '', contextHash: 'ctx-a', timestamp: now - 200, used: false },
            { question: 'q3', options: ['a', 'b'], correct_index: 0, type: 'vocab' as const, explanation: '', contextHash: 'ctx-a', timestamp: now - 300, used: false },
            { question: 'q4', options: ['a', 'b'], correct_index: 0, type: 'grammar' as const, explanation: '', contextHash: 'ctx-b', timestamp: now - 150, used: false },
            { question: 'q5', options: ['a', 'b'], correct_index: 0, type: 'grammar' as const, explanation: '', contextHash: 'ctx-b', timestamp: now - 250, used: false },
            // stale (ttl exceeded)
            { question: 'stale', options: ['a', 'b'], correct_index: 0, type: 'reading' as const, explanation: '', contextHash: 'ctx-c', timestamp: now - (2 * 24 * 60 * 60 * 1000), used: false }
        ];

        const retained = mergeQuestionCache(existing, [], now, policy);
        expect(retained).toHaveLength(3);
        expect(retained.every((row) => row.timestamp >= now - policy.ttlMs)).toBe(true);

        const countA = retained.filter((row) => row.contextHash === 'ctx-a').length;
        const countB = retained.filter((row) => row.contextHash === 'ctx-b').length;
        expect(countA).toBeLessThanOrEqual(2);
        expect(countB).toBeLessThanOrEqual(2);
        expect(retained[0].timestamp).toBeGreaterThanOrEqual(retained[1].timestamp);
    });

    test('incoming duplicate refreshes entry and resets used to false', () => {
        const existing = [
            {
                question: 'Where is the clock?',
                options: ['wall', 'bag', 'desk', 'door'],
                correct_index: 0,
                type: 'reading' as const,
                explanation: 'old',
                contextHash: 'ctx-1',
                timestamp: now - 5000,
                used: true
            }
        ];

        const incoming = [
            {
                question: 'Where is the clock?',
                options: ['on the wall', 'in the bag', 'on the desk', 'under the door'],
                correct_index: 0,
                type: 'reading' as const,
                explanation: 'new',
                contextHash: 'ctx-1',
                timestamp: now - 1000,
                used: true
            }
        ];

        const retained = mergeQuestionCache(existing, incoming, now);
        expect(retained).toHaveLength(1);
        expect(retained[0].question).toBe('Where is the clock?');
        expect(retained[0].explanation).toBe('new');
        expect(retained[0].used).toBe(false);
        expect(retained[0].timestamp).toBe(now - 1000);
    });

    test('normalizes and rejects malformed cache rows', () => {
        const normalized = normalizeQuestionCacheEntry({
            question: '  Choose the best word  ',
            options: ['A', 'A', 'B', '', 'C'],
            correct_index: 9,
            explanation: '  ',
            contextHash: ' hash-1 ',
            timestamp: Number.NaN,
            used: false
        }, now);
        expect(normalized).not.toBeNull();
        expect(normalized?.question).toBe('Choose the best word');
        expect(normalized?.options).toEqual(['A', 'B', 'C']);
        expect(normalized?.correct_index).toBe(0);
        expect(normalized?.timestamp).toBe(now);
        expect(buildQuestionCacheKey(normalized!)).toBe('hash-1::vocab::choose the best word');

        const invalid = normalizeQuestionCacheEntry({
            question: '',
            options: ['x', 'y'],
            contextHash: 'ctx',
            timestamp: now,
            used: false
        }, now);
        expect(invalid).toBeNull();
    });
});
