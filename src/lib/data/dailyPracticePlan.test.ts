import type { FSRSCard, LearningTask, SkillMasteryRecord, MistakeRecord } from '@/db/db';
import { buildDailyPracticePlan } from './dailyPracticePlan';

const now = new Date('2026-06-01T08:00:00.000Z').getTime();

function mastery(overrides: Partial<SkillMasteryRecord>): SkillMasteryRecord {
    return {
        skillTag: 'vocab:happy',
        score: 40,
        state: 'learning',
        attempts: 4,
        correct: 2,
        lastReviewedAt: now,
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
                mastery({ skillTag: 'vocab:happy', state: 'learning', score: 48 }),
                mastery({ skillTag: 'reading:detail', state: 'consolidated', score: 74, attempts: 8, correct: 6 })
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
                    skillTag: 'preposition:under',
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
        expect(stepIds.filter((id) => id === 'practice_preposition_place_time_preposition_under')).toHaveLength(1);
    });
});
