import { db, type CachedQuestion, type ContentReviewRecord } from '@/db/db';
import type { ContentReviewerStatus } from './learningEvidenceContract';

export type EducatorReviewDecision = 'educator-approved' | 'educator-edited' | 'rejected';

function normalizeKeyPart(value?: string | null): string {
    return (value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 120);
}

function stableHash(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

export function contentReviewKey(question: Pick<CachedQuestion, 'question' | 'learningObjectiveId' | 'itemFamilyId' | 'contextId'>): string {
    const identity = [
        question.learningObjectiveId,
        question.itemFamilyId,
        question.contextId,
        question.question
    ].map(normalizeKeyPart).join('|');
    return `content_${stableHash(identity)}`;
}

export function isMeasurementApproved(status?: ContentReviewerStatus): boolean {
    return status === 'system-reviewed' || status === 'educator-approved' || status === 'educator-edited';
}

export function buildContentReviewRecord(input: {
    question: CachedQuestion;
    decision: EducatorReviewDecision;
    notes?: string;
    now?: number;
    existing?: ContentReviewRecord | null;
}): ContentReviewRecord {
    const now = input.now ?? Date.now();
    const notes = input.notes?.trim().slice(0, 500) || undefined;
    return {
        id: input.existing?.id,
        contentKey: input.existing?.contentKey || contentReviewKey(input.question),
        cachedQuestionId: input.question.id,
        questionText: input.question.question.slice(0, 500),
        sourceType: 'ai',
        status: input.decision,
        objectiveId: input.question.learningObjectiveId,
        itemFamilyId: input.question.itemFamilyId,
        equivalenceGroup: input.question.equivalenceGroup,
        notes,
        createdAt: input.existing?.createdAt || now,
        updatedAt: now
    };
}

export async function reviewCachedQuestion(input: {
    question: CachedQuestion;
    decision: EducatorReviewDecision;
    notes?: string;
    now?: number;
}): Promise<ContentReviewRecord> {
    const key = contentReviewKey(input.question);
    const existing = await db.contentReviews.where('contentKey').equals(key).first();
    const record = buildContentReviewRecord({ ...input, existing });

    await db.transaction('rw', db.contentReviews, db.questionCache, async () => {
        await db.contentReviews.put(record);
        if (input.question.id) {
            await db.questionCache.update(input.question.id, { reviewerStatus: input.decision });
        }
    });
    return record;
}

export async function getContentReviewQueue(limit = 50): Promise<Array<{
    question: CachedQuestion;
    review?: ContentReviewRecord;
}>> {
    const [questions, reviews] = await Promise.all([
        db.questionCache.orderBy('timestamp').reverse().limit(limit).toArray(),
        db.contentReviews.toArray()
    ]);
    const byKey = new Map(reviews.map((review) => [review.contentKey, review]));
    return questions.map((question) => ({
        question,
        review: byKey.get(contentReviewKey(question))
    }));
}
