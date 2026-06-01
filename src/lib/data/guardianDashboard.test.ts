import type { HistoryRecord, LearningEvent, LearningTask } from '@/db/db';
import type { MistakeRecord } from '@/db/db';
import { buildGuardianActivityFeed } from './guardianDashboard';

const now = Date.UTC(2026, 5, 1, 8, 0, 0);

function event(overrides: Partial<LearningEvent>): LearningEvent {
    return {
        eventType: 'answer',
        source: 'battle',
        timestamp: now,
        ...overrides
    };
}

function history(overrides: Partial<HistoryRecord>): HistoryRecord {
    return {
        timestamp: now,
        score: 0,
        totalQuestions: 0,
        levelTitle: 'Mission',
        ...overrides
    };
}

function mistake(overrides: Partial<MistakeRecord>): MistakeRecord {
    return {
        questionId: 1,
        questionText: 'Choose the cause.',
        wrongAnswer: 'blue',
        correctAnswer: 'because',
        explanation: 'Cause and effect explains why.',
        timestamp: now,
        ...overrides
    };
}

function task(overrides: Partial<LearningTask>): LearningTask {
    return {
        taskId: 'battle_precision_weekly',
        metric: 'battle_correct',
        title: 'Battle Precision',
        description: 'Answer battle questions correctly',
        goal: 15,
        progress: 7,
        status: 'active',
        periodStart: now - 1000,
        periodEnd: now + 1000,
        rewardXp: 50,
        rewardGold: 10,
        evidence: [],
        updatedAt: now,
        ...overrides
    };
}

describe('buildGuardianActivityFeed', () => {
    test('builds a recency-sorted feed from persisted learning sources', () => {
        const feed = buildGuardianActivityFeed({
            learningEvents: [
                event({
                    eventType: 'answer',
                    source: 'battle',
                    result: 'wrong',
                    skillTag: 'cause_effect',
                    timestamp: now - 1000
                }),
                event({
                    eventType: 'session_complete',
                    source: 'daily',
                    timestamp: now - 3000
                })
            ],
            historyRecords: [
                history({
                    levelTitle: 'Animal Habits Adventure',
                    totalCorrect: 8,
                    totalQuestions: 10,
                    timestamp: now - 2000
                })
            ],
            mistakes: [
                mistake({
                    mentorCauseTag: 'cause_effect',
                    timestamp: now - 500
                })
            ],
            learningTasks: [
                task({
                    title: 'Battle Precision',
                    progress: 7,
                    goal: 15,
                    updatedAt: now - 4000
                })
            ],
            now,
            limit: 5
        });

        expect(feed.map((item) => item.kind)).toEqual([
            'mistake',
            'answer',
            'mission',
            'session',
            'task'
        ]);
        expect(feed[0]).toEqual(expect.objectContaining({
            title: 'Review signal detected',
            detail: 'Cause Effect'
        }));
        expect(feed[1]).toEqual(expect.objectContaining({
            title: 'Wrong battle answer',
            detail: 'Cause Effect'
        }));
        expect(feed[2]).toEqual(expect.objectContaining({
            title: 'Mission completed',
            detail: 'Animal Habits Adventure'
        }));
    });

    test('respects the requested limit', () => {
        const feed = buildGuardianActivityFeed({
            learningEvents: [
                event({ timestamp: now - 1000 }),
                event({ timestamp: now - 2000 }),
                event({ timestamp: now - 3000 })
            ],
            historyRecords: [],
            mistakes: [],
            learningTasks: [],
            now,
            limit: 2
        });

        expect(feed).toHaveLength(2);
    });
});
