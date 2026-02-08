import type { MistakeRecord } from '@/db/db';
import { computeRepeatedCauseSnapshot } from './mistakes';

function row(overrides: Partial<MistakeRecord>): MistakeRecord {
    return {
        questionId: 1,
        questionText: 'q',
        wrongAnswer: 'a',
        correctAnswer: 'b',
        explanation: 'exp',
        timestamp: Date.now(),
        ...overrides
    };
}

describe('computeRepeatedCauseSnapshot', () => {
    test('computes repeat rate from repeated cause tags', () => {
        const now = Date.now();
        const records: MistakeRecord[] = [
            row({ mentorCauseTag: 'tense_confusion', timestamp: now - 1000 }),
            row({ mentorCauseTag: 'tense_confusion', timestamp: now - 2000 }),
            row({ mentorCauseTag: 'inference_gap', timestamp: now - 3000 }),
            row({ mentorCauseTag: 'collocation_mixup', timestamp: now - 4000 }),
            row({ mentorCauseTag: 'collocation_mixup', timestamp: now - 5000 })
        ];

        const snapshot = computeRepeatedCauseSnapshot(records, 14, now);
        expect(snapshot.taggedMistakes).toBe(5);
        expect(snapshot.repeatedMistakes).toBe(4);
        expect(snapshot.repeatRate).toBeCloseTo(0.8, 5);
        expect(snapshot.topCauses[0].causeTag).toBe('tense_confusion');
        expect(snapshot.topCauses[0].count).toBe(2);
    });

    test('ignores old records outside window and blank tags', () => {
        const now = Date.now();
        const old = now - (30 * 24 * 60 * 60 * 1000);
        const records: MistakeRecord[] = [
            row({ mentorCauseTag: 'tense_confusion', timestamp: old }),
            row({ mentorCauseTag: '', timestamp: now - 500 }),
            row({ timestamp: now - 200 })
        ];

        const snapshot = computeRepeatedCauseSnapshot(records, 7, now);
        expect(snapshot.taggedMistakes).toBe(0);
        expect(snapshot.repeatedMistakes).toBe(0);
        expect(snapshot.repeatRate).toBe(0);
        expect(snapshot.topCauses).toHaveLength(0);
    });
});
