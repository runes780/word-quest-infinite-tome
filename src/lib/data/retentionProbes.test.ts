import type { LearningEvent } from '@/db/db';
import { buildDueRetentionProbes, planRetentionProbeOutcome } from './retentionProbes';

const DAY_MS = 24 * 60 * 60 * 1000;
const baselineAt = Date.parse('2026-07-01T08:00:00Z');

function event(overrides: Partial<LearningEvent>): LearningEvent {
    return {
        eventType: 'answer',
        source: 'battle',
        timestamp: baselineAt,
        result: 'correct',
        learningObjectiveId: 'present_simple',
        itemFamilyId: 'family_daily_routine',
        equivalenceGroup: 'equiv_present_routine',
        contextId: 'context_home',
        assessmentRole: 'practice',
        reviewerStatus: 'system-reviewed',
        evidenceStrength: 'independent',
        ...overrides
    };
}

describe('retention probe scheduler', () => {
    test('schedules day-1 and day-7 probes from reviewed independent evidence', () => {
        const due = buildDueRetentionProbes([event({})], baselineAt + 8 * DAY_MS);
        expect(due.map((probe) => probe.stage)).toEqual(['day-1', 'day-7']);
        expect(due[0]).toEqual(expect.objectContaining({
            objectiveId: 'present_simple',
            itemFamilyId: 'family_daily_routine',
            equivalenceGroup: 'equiv_present_routine'
        }));
    });

    test('does not schedule probes for unreviewed or supported content', () => {
        expect(buildDueRetentionProbes([
            event({ reviewerStatus: 'unreviewed' }),
            event({ itemFamilyId: 'family_supported', evidenceStrength: 'supported' })
        ], baselineAt + 8 * DAY_MS)).toEqual([]);
    });

    test('marks only the completed stage and keeps the later stage due', () => {
        const due = buildDueRetentionProbes([
            event({}),
            event({
                timestamp: baselineAt + DAY_MS,
                assessmentRole: 'delayed-probe',
                probeStage: 'day-1',
                evidenceStrength: 'delayed-independent'
            })
        ], baselineAt + 8 * DAY_MS);
        expect(due.map((probe) => probe.stage)).toEqual(['day-7']);
    });

    test('cooldowns a failed probe before retrying instead of drilling immediately', () => {
        const failedAt = baselineAt + DAY_MS;
        const events = [
            event({}),
            event({
                timestamp: failedAt,
                result: 'wrong',
                assessmentRole: 'delayed-probe',
                probeStage: 'day-1',
                evidenceStrength: 'delayed-independent'
            })
        ];
        expect(buildDueRetentionProbes(events, failedAt + 12 * 60 * 60 * 1000)).toEqual([]);
        expect(buildDueRetentionProbes(events, failedAt + DAY_MS)[0]).toEqual(expect.objectContaining({
            stage: 'day-1',
            priorFailedAttempts: 1
        }));
    });

    test('routes a failed delayed probe to supported repair and a spaced retry', () => {
        expect(planRetentionProbeOutcome('wrong', baselineAt)).toEqual({
            status: 'repair-required',
            countAsIndependentEvidence: true,
            queueImmediateRepair: true,
            retryAt: baselineAt + DAY_MS
        });
        expect(planRetentionProbeOutcome('correct', baselineAt)).toEqual({
            status: 'retained',
            countAsIndependentEvidence: true,
            queueImmediateRepair: false
        });
    });
});
