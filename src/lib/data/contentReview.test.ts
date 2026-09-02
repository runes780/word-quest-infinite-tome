import type { CachedQuestion } from '@/db/db';
import {
    buildContentReviewRecord,
    contentReviewKey,
    isMeasurementApproved
} from './contentReview';

function question(overrides: Partial<CachedQuestion> = {}): CachedQuestion {
    return {
        id: 3,
        question: 'Read: "Mia walks every day." Which verb shows the routine?',
        options: ['walks', 'walked', 'walking', 'walk'],
        correct_index: 0,
        type: 'grammar',
        explanation: 'Walks is the present-simple routine form.',
        skillTag: 'present_simple:routine',
        learningObjectiveId: 'present_simple',
        itemFamilyId: 'family_present_routine',
        contextId: 'context_daily_walk',
        equivalenceGroup: 'equiv_present_routine',
        contextHash: 'synthetic_context',
        timestamp: 100,
        used: false,
        ...overrides
    };
}

describe('educator content review', () => {
    test('uses stable content identity without learner information', () => {
        const key = contentReviewKey(question());
        expect(key).toBe(contentReviewKey(question({ id: 99, timestamp: 999 })));
        expect(key).toMatch(/^content_/);
        expect(key).not.toMatch(/mia|student|email/i);
    });

    test('records an explicit educator decision and bounded notes', () => {
        const record = buildContentReviewRecord({
            question: question(),
            decision: 'educator-approved',
            notes: ` Clear answer key. ${'x'.repeat(600)}`,
            now: 200
        });
        expect(record).toEqual(expect.objectContaining({
            sourceType: 'ai',
            status: 'educator-approved',
            objectiveId: 'present_simple',
            createdAt: 200,
            updatedAt: 200
        }));
        expect(record.notes?.length).toBeLessThanOrEqual(500);
    });

    test('allows measurement only for system or educator-reviewed content', () => {
        expect(isMeasurementApproved('unreviewed')).toBe(false);
        expect(isMeasurementApproved('rejected')).toBe(false);
        expect(isMeasurementApproved('system-reviewed')).toBe(true);
        expect(isMeasurementApproved('educator-approved')).toBe(true);
        expect(isMeasurementApproved('educator-edited')).toBe(true);
    });
});
