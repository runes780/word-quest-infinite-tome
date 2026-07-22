import type { HistoryRecord, LearningEvent, LearningTask } from '@/db/db';
import type { MistakeRecord } from '@/db/db';
import { buildGuardianActivityFeed } from './guardianDashboard';
import { buildCalibrationSummary } from './metacognitiveCalibration';
import { buildLearningProgressRewardSummary } from './learningProgressRewards';
import { buildScaffoldFadingSummary } from './adaptiveScaffolding';

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

describe('guardian confidence calibration evidence', () => {
    test('keeps guardian evidence aggregate and excludes original question content', () => {
        const summary = buildCalibrationSummary([
            event({ result: 'wrong', selfConfidence: 'high' }),
            event({ result: 'correct', selfConfidence: 'low' })
        ]);

        expect(summary).toEqual(expect.objectContaining({
            ratedAnswers: 2,
            highConfidenceErrors: 1,
            lowConfidenceCorrect: 1
        }));
        expect(JSON.stringify(summary)).not.toContain('Choose the cause.');
    });
});

describe('guardian learning progress reward evidence', () => {
    test('summarizes traceable payouts without retaining question content', () => {
        const summary = buildLearningProgressRewardSummary([
            event({
                result: 'correct',
                progressRewardKind: 'repair-success',
                rewardXp: 14,
                rewardGold: 8,
                rewardCounted: true
            }),
            event({
                result: 'correct',
                progressRewardKind: 'supported-practice',
                rewardCounted: false,
                rewardProtectionReason: 'kind-cap'
            })
        ]);

        expect(summary).toEqual(expect.objectContaining({
            countedRewards: 1,
            protectedAttempts: 1,
            totalXp: 14,
            totalGold: 8,
            strongEvidenceCount: 0
        }));
        expect(JSON.stringify(summary)).not.toContain('Choose the cause.');
    });
});

describe('guardian scaffold fading evidence', () => {
    test('keeps support, hint, and transfer evidence aggregate and privacy-safe', () => {
        const summary = buildScaffoldFadingSummary([
            event({
                result: 'correct',
                supportLevel: 2,
                hintUsed: true,
                scaffoldReason: 'hint-dependence',
                scaffoldTransition: 'hold'
            }),
            event({
                result: 'correct',
                supportLevel: 1,
                scaffoldReason: 'transfer-ready',
                scaffoldTransition: 'transfer'
            }),
            event({
                result: 'correct',
                supportLevel: 0,
                attemptKind: 'transfer',
                scaffoldReason: 'transfer-confirmed',
                scaffoldTransition: 'hold'
            })
        ]);

        expect(summary).toEqual(expect.objectContaining({
            supportedAttempts: 1,
            independentAttempts: 1,
            hintUsedAnswers: 1,
            transferReadySignals: 1,
            transferAttempts: 1,
            transferCorrect: 1
        }));
        expect(JSON.stringify(summary)).not.toContain('Choose the cause.');
    });
});
