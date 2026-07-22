import type { FSRSCard, LearningTask, ObjectiveMasteryRecord, MistakeRecord } from '@/db/db';
import { buildDailyPracticePlan, getPrerequisiteReadiness } from './dailyPracticePlan';

const now = new Date('2026-06-01T08:00:00.000Z').getTime();

function mastery(overrides: Partial<ObjectiveMasteryRecord>): ObjectiveMasteryRecord {
    return {
        objectiveId: 'vocab_context_meaning',
        score: 40,
        state: 'learning',
        attempts: 4,
        correct: 2,
        qualifiedAttempts: 2,
        qualifiedCorrect: 1,
        independentAttempts: 1,
        attemptsByMode: { choice: 2, 'fill-blank': 1, typing: 1 },
        transferAttempts: 0,
        transferCorrect: 0,
        delayedProbeAttempts: 0,
        delayedProbeCorrect: 0,
        hintCount: 1,
        hintRate: 0.25,
        lastReviewedAt: now,
        nextReviewAt: now + 86_400_000,
        confidence: 0.3,
        updatedAt: now,
        ...overrides
    };
}

function dueCard(overrides: Partial<FSRSCard>): FSRSCard {
    return {
        questionHash: 'q1',
        question: 'Choose the past tense.',
        options: ['go', 'went', 'goes', 'going'],
        correct_index: 1,
        type: 'grammar',
        skillTag: 'grammar:past_simple',
        due: now - 2 * 24 * 60 * 60 * 1000,
        stability: 1,
        difficulty: 0.5,
        elapsed_days: 2,
        scheduled_days: 1,
        reps: 2,
        lapses: 1,
        state: 2,
        ...overrides
    };
}

function mistake(overrides: Partial<MistakeRecord>): MistakeRecord {
    return {
        questionId: 1,
        questionText: 'Why did she leave?',
        wrongAnswer: 'because happy',
        correctAnswer: 'because it was late',
        explanation: 'Read the detail in the sentence.',
        skillTag: 'reading:inference',
        mentorCauseTag: 'inference_gap',
        timestamp: now - 60_000,
        ...overrides
    };
}

function task(overrides: Partial<LearningTask>): LearningTask {
    return {
        taskId: 'srs_guardian_weekly',
        metric: 'srs_answers',
        title: 'SRS Guardian',
        description: 'Finish review answers.',
        goal: 12,
        progress: 3,
        status: 'active',
        periodStart: now - 86_400_000,
        periodEnd: now + 6 * 86_400_000,
        rewardXp: 60,
        rewardGold: 35,
        evidence: [],
        updatedAt: now,
        ...overrides
    };
}

describe('daily practice planner', () => {
    test('prioritizes due review and recent mistakes before consolidation', () => {
        const plan = buildDailyPracticePlan({
            now,
            dueCards: [dueCard({})],
            recentMistakes: [mistake({})],
            masteryRecords: [
                mastery({ objectiveId: 'vocab_context_meaning', state: 'learning', score: 48 }),
                mastery({
                    objectiveId: 'reading_detail',
                    state: 'consolidated',
                    score: 84,
                    attempts: 8,
                    correct: 7,
                    qualifiedAttempts: 6,
                    qualifiedCorrect: 5,
                    independentAttempts: 3,
                    confidence: 0.7
                })
            ],
            learningTasks: [task({})]
        });

        expect(plan.estimatedMinutes).toBeLessThanOrEqual(15);
        expect(plan.steps[0]).toEqual(expect.objectContaining({
            type: 'review',
            attemptKind: 'review',
            objectiveId: 'past_tense_basic',
            supportLevel: 3
        }));
        expect(plan.steps.some((step) => step.type === 'practice' && step.objectiveId === 'reading_inference')).toBe(true);
        expect(plan.steps.some((step) => step.type === 'transfer')).toBe(true);
        expect(plan.evidence.map((row) => row.label)).toContain('Due review');
    });

    test('gives new users an executable starter path', () => {
        const plan = buildDailyPracticePlan({
            now,
            dueCards: [],
            recentMistakes: [],
            masteryRecords: [],
            learningTasks: []
        });

        expect(plan.steps).toHaveLength(3);
        expect(plan.steps[0].objectiveId).toBe('vocab_context_meaning');
        expect(plan.steps[0].supportLevel).toBe(3);
        expect(plan.steps.some((step) => step.type === 'transfer')).toBe(false);
        expect(plan.rationale).toContain('starter');
    });

    test('does not create duplicate practice step ids when mistakes and mastery target the same skill', () => {
        const plan = buildDailyPracticePlan({
            now,
            dueCards: [],
            recentMistakes: [
                mistake({
                    skillTag: 'preposition:under',
                    mentorCauseTag: 'context_understanding',
                    type: 'grammar'
                })
            ],
            masteryRecords: [
                mastery({
                    objectiveId: 'preposition_place_time',
                    state: 'learning',
                    score: 45,
                    attempts: 4,
                    correct: 2
                })
            ],
            learningTasks: []
        });

        const stepIds = plan.steps.map((step) => step.id);
        expect(stepIds).toHaveLength(new Set(stepIds).size);
        expect(stepIds.filter((id) => id === 'practice_preposition_place_time')).toHaveLength(1);
    });

    test('blocks inference transfer until detail and vocabulary prerequisites are independently ready', () => {
        const inference = mastery({
            objectiveId: 'reading_inference',
            state: 'consolidated',
            score: 90,
            independentAttempts: 6,
            qualifiedAttempts: 8,
            qualifiedCorrect: 8
        });
        const detail = mastery({
            objectiveId: 'reading_detail',
            state: 'consolidated',
            score: 84,
            independentAttempts: 3
        });
        const vocabNotReady = mastery({
            objectiveId: 'vocab_context_meaning',
            state: 'learning',
            score: 72,
            independentAttempts: 2
        });

        expect(getPrerequisiteReadiness('reading_inference', [inference, detail, vocabNotReady])).toEqual({
            ready: false,
            missing: ['vocab_context_meaning']
        });
        const plan = buildDailyPracticePlan({
            now,
            dueCards: [],
            recentMistakes: [],
            masteryRecords: [inference, detail, vocabNotReady],
            learningTasks: []
        });
        expect(plan.steps.some((step) => step.type === 'transfer' && step.objectiveId === 'reading_inference')).toBe(false);
    });
});
