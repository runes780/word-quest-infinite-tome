import {
    completeCurrentPracticePlanStep,
    createPracticePlanRun,
    currentPracticePlanStep,
    isPracticePlanComplete,
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
});
