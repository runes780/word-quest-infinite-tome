import {
    completeCurrentPracticePlanStep,
    createPracticePlanRunRecord,
    createPracticePlanRun,
    currentPracticePlanStep,
    isPracticePlanComplete,
    completePracticePlanRunRecordStep,
    loadPracticePlanStepLaunch,
    practicePlanProgressText
} from './practicePlanRunner';
import type { PracticePlan } from './dailyPracticePlan';

const plan: PracticePlan = {
    planId: 'daily_test',
    title: 'Today\'s Learning Path',
    estimatedMinutes: 12,
    generatedAt: 100,
    rationale: 'test plan',
    evidence: [],
    steps: [
        {
            id: 'review_vocab',
            type: 'review',
            title: 'Review vocabulary',
            objectiveId: 'vocab_context_meaning',
            skillTag: 'vocab_core',
            estimatedMinutes: 4,
            questionCount: 3,
            supportLevel: 3,
            attemptKind: 'review',
            rationale: 'due cards first',
            evidence: []
        },
        {
            id: 'transfer_vocab',
            type: 'transfer',
            title: 'Transfer vocabulary',
            objectiveId: 'vocab_context_meaning',
            skillTag: 'vocab_core',
            estimatedMinutes: 3,
            questionCount: 2,
            supportLevel: 0,
            attemptKind: 'transfer',
            rationale: 'independent recall',
            evidence: []
        }
    ]
};

describe('practice plan runner', () => {
    test('tracks the active step and completion progress', () => {
        const run = createPracticePlanRun(plan, 1000);

        expect(currentPracticePlanStep(run)?.id).toBe('review_vocab');
        expect(practicePlanProgressText(run)).toBe('0/2');
        expect(isPracticePlanComplete(run)).toBe(false);

        const afterFirst = completeCurrentPracticePlanStep(run, 2000);
        expect(afterFirst.completedStepIds).toEqual(['review_vocab']);
        expect(afterFirst.currentStepIndex).toBe(1);
        expect(currentPracticePlanStep(afterFirst)?.id).toBe('transfer_vocab');
        expect(practicePlanProgressText(afterFirst)).toBe('1/2');

        const afterSecond = completeCurrentPracticePlanStep(afterFirst, 3000);
        expect(afterSecond.completedStepIds).toEqual(['review_vocab', 'transfer_vocab']);
        expect(afterSecond.currentStepIndex).toBe(2);
        expect(currentPracticePlanStep(afterSecond)).toBeNull();
        expect(isPracticePlanComplete(afterSecond)).toBe(true);
        expect(practicePlanProgressText(afterSecond)).toBe('2/2');
    });

    test('launches reviewed equivalent content for delayed probes and preserves measurement metadata', async () => {
        const launch = await loadPracticePlanStepLaunch({
            id: 'probe_day-1_family_present_routine_third_person',
            type: 'review',
            title: 'Recall Present Simple',
            objectiveId: 'present_simple',
            estimatedMinutes: 2,
            questionCount: 1,
            supportLevel: 0,
            attemptKind: 'review',
            assessmentRole: 'delayed-probe',
            probeStage: 'day-1',
            probeScheduledFor: 1000,
            itemFamilyId: 'family_present_routine_third_person',
            equivalenceGroup: 'equiv_present_routine_s',
            originalContextId: 'family_present_routine_third_person_context_1',
            rationale: 'retention check',
            evidence: []
        });

        expect(launch.usedFallback).toBe(false);
        expect(launch.monsters).toHaveLength(1);
        expect(launch.monsters[0]).toEqual(expect.objectContaining({
            assessmentRole: 'delayed-probe',
            probeStage: 'day-1',
            reviewerStatus: 'system-reviewed',
            supportLevel: 0
        }));
        expect(launch.monsters[0].contextId).not.toBe('family_present_routine_third_person_context_1');
    });

    test('creates a persistable run record with before and after evidence', () => {
        const record = createPracticePlanRunRecord(plan, 1000);

        expect(record).toEqual(expect.objectContaining({
            planId: 'daily_test',
            dateKey: '1970-01-01',
            status: 'active',
            completedStepIds: [],
            evidenceBefore: plan.evidence,
            startedAt: 1000,
            updatedAt: 1000
        }));

        const afterStep = completePracticePlanRunRecordStep(record, 'review_vocab', [
            { label: 'Mastery change', value: 'Vocabulary in Context +4%', source: 'mastery' }
        ], 2000);

        expect(afterStep.status).toBe('active');
        expect(afterStep.completedStepIds).toEqual(['review_vocab']);
        expect(afterStep.evidenceAfter).toHaveLength(1);
        expect(afterStep.completedAt).toBeUndefined();

        const complete = completePracticePlanRunRecordStep(afterStep, 'transfer_vocab', [], 3000);
        expect(complete.status).toBe('completed');
        expect(complete.completedAt).toBe(3000);
    });
});
