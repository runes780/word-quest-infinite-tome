import type { LearningEvent } from '@/db/db';
import { getLearningObjective, type LearningObjectiveId } from './learningObjectives';
import type { RetentionProbeStage } from './learningEvidenceContract';

const DAY_MS = 24 * 60 * 60 * 1000;
const RETRY_DELAY_MS = DAY_MS;
const REVIEWED_STATUSES = new Set(['system-reviewed', 'educator-approved', 'educator-edited']);

const PROBE_OFFSETS: Record<RetentionProbeStage, number> = {
    'day-1': DAY_MS,
    'day-7': 7 * DAY_MS
};

export interface DueRetentionProbe {
    probeId: string;
    stage: RetentionProbeStage;
    objectiveId: LearningObjectiveId;
    itemFamilyId: string;
    equivalenceGroup: string;
    originalContextId?: string;
    sourceEventAt: number;
    scheduledFor: number;
    overdueMs: number;
    priorFailedAttempts: number;
}

export interface RetentionProbeOutcomePlan {
    status: 'retained' | 'repair-required';
    countAsIndependentEvidence: boolean;
    queueImmediateRepair: boolean;
    retryAt?: number;
}

function isReviewed(event: LearningEvent): boolean {
    return Boolean(event.reviewerStatus && REVIEWED_STATUSES.has(event.reviewerStatus));
}

function isEligibleBaseline(event: LearningEvent): boolean {
    return event.eventType === 'answer' &&
        event.result === 'correct' &&
        Boolean(event.itemFamilyId && event.equivalenceGroup && getLearningObjective(event.learningObjectiveId)) &&
        (event.evidenceStrength === 'independent' || event.evidenceStrength === 'transfer-independent') &&
        event.assessmentRole !== 'delayed-probe' &&
        isReviewed(event);
}

function probeEventsFor(events: LearningEvent[], baseline: LearningEvent, stage: RetentionProbeStage) {
    return events
        .filter((event) => event.eventType === 'answer' &&
            event.assessmentRole === 'delayed-probe' &&
            event.itemFamilyId === baseline.itemFamilyId &&
            event.probeStage === stage &&
            event.timestamp >= baseline.timestamp)
        .sort((a, b) => a.timestamp - b.timestamp);
}

export function buildDueRetentionProbes(events: LearningEvent[], now = Date.now()): DueRetentionProbe[] {
    const latestBaselineByFamily = new Map<string, LearningEvent>();
    events.filter(isEligibleBaseline).forEach((event) => {
        const key = event.itemFamilyId as string;
        const existing = latestBaselineByFamily.get(key);
        if (!existing || event.timestamp > existing.timestamp) latestBaselineByFamily.set(key, event);
    });

    const due: DueRetentionProbe[] = [];
    latestBaselineByFamily.forEach((baseline) => {
        const objective = getLearningObjective(baseline.learningObjectiveId);
        if (!objective || !baseline.itemFamilyId || !baseline.equivalenceGroup) return;
        const itemFamilyId = baseline.itemFamilyId;
        const equivalenceGroup = baseline.equivalenceGroup;

        (Object.keys(PROBE_OFFSETS) as RetentionProbeStage[]).forEach((stage) => {
            const attempts = probeEventsFor(events, baseline, stage);
            if (attempts.some((event) => event.result === 'correct')) return;

            const scheduledFor = baseline.timestamp + PROBE_OFFSETS[stage];
            const lastFailedAt = attempts.filter((event) => event.result === 'wrong').at(-1)?.timestamp;
            const availableAt = lastFailedAt ? Math.max(scheduledFor, lastFailedAt + RETRY_DELAY_MS) : scheduledFor;
            if (now < availableAt) return;

            due.push({
                probeId: `probe_${stage}_${itemFamilyId}`,
                stage,
                objectiveId: objective.objectiveId,
                itemFamilyId,
                equivalenceGroup,
                originalContextId: baseline.contextId,
                sourceEventAt: baseline.timestamp,
                scheduledFor: availableAt,
                overdueMs: Math.max(0, now - availableAt),
                priorFailedAttempts: attempts.filter((event) => event.result === 'wrong').length
            });
        });
    });

    return due.sort((a, b) => b.overdueMs - a.overdueMs || a.scheduledFor - b.scheduledFor);
}

export function planRetentionProbeOutcome(result: 'correct' | 'wrong', now = Date.now()): RetentionProbeOutcomePlan {
    if (result === 'correct') {
        return {
            status: 'retained',
            countAsIndependentEvidence: true,
            queueImmediateRepair: false
        };
    }
    return {
        status: 'repair-required',
        countAsIndependentEvidence: true,
        queueImmediateRepair: true,
        retryAt: now + RETRY_DELAY_MS
    };
}
