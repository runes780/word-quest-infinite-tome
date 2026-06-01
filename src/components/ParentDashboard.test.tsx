import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ParentDashboard } from './ParentDashboard';

const startGame = jest.fn();

const mockMetric = {
    currentRate: 0.72,
    previousRate: 0.64,
    absoluteDelta: 0.08,
    relativeDelta: 0.125,
    numerator: 18,
    denominator: 25,
    previousNumerator: 16,
    previousDenominator: 25,
    target: 0.6,
    targetType: 'absolute_rate' as const,
    status: 'met' as const
};

const mockGetGuardianDashboardViewModel = jest.fn(async () => ({
    history: {
        records: [{
            id: 1,
            timestamp: Date.now(),
            score: 80,
            totalQuestions: 10,
            levelTitle: 'Animal Habits Adventure',
            totalCorrect: 8,
            accuracy: 0.8
        }],
        daily: [
            { date: Date.now() - 86400000 * 2, label: 'May 12', accuracy: 0.66, correct: 6, total: 9, missions: 1 },
            { date: Date.now() - 86400000, label: 'May 13', accuracy: 0.75, correct: 9, total: 12, missions: 2 },
            { date: Date.now(), label: 'May 14', accuracy: 0.82, correct: 14, total: 17, missions: 2 }
        ],
        skills: [
            { skill: 'reading_comprehension', accuracy: 0.78, correct: 14, total: 18 },
            { skill: 'vocabulary', accuracy: 0.65, correct: 13, total: 20 },
            { skill: 'grammar', accuracy: 0.58, correct: 11, total: 19 }
        ],
        targetedReview: {
            sessions: 2,
            avgAccuracy: 0.7,
            avgScore: 72,
            successRuns: 1,
            recentAccuracies: [0.62, 0.78],
            consecutiveLowAccuracyRuns: 1,
            lowAccuracyThreshold: 0.65,
            lastFocusTag: 'cause_effect',
            lastRunAt: Date.now()
        },
        totals: {
            missions: 28,
            correct: 232,
            total: 342,
            accuracy: 0.68,
            lastActive: Date.now()
        }
    },
    mistakes: [{
        id: 1,
        questionId: 10,
        questionText: 'Why did the bird fly south?',
        wrongAnswer: 'Because it was tired',
        correctAnswer: 'Because winter was coming',
        explanation: 'Cause and effect connects why and what happened.',
        skillTag: 'cause_effect',
        mentorCauseTag: 'cause_effect',
        timestamp: Date.now()
    }],
    dueCards: [{
        id: 1,
        questionHash: 'q1',
        question: 'Choose the cause.',
        options: ['wind', 'because', 'blue', 'cat'],
        correct_index: 1,
        type: 'reading',
        skillTag: 'cause_effect',
        due: Date.now(),
        stability: 1,
        difficulty: 0.4,
        elapsed_days: 1,
        scheduled_days: 1,
        reps: 2,
        lapses: 0,
        state: 2
    }],
    srsStats: { total: 4, due: 12, new: 1, learning: 1, review: 2 },
    mastery: {
        windowDays: 14,
        totalAttempts: 342,
        totalCorrect: 232,
        bySkill: [
            { skillTag: 'reading_comprehension', attempts: 18, correct: 14, smoothedAccuracy: 0.78, currentState: 'consolidated', currentScore: 78 },
            { skillTag: 'vocabulary', attempts: 20, correct: 13, smoothedAccuracy: 0.65, currentState: 'learning', currentScore: 65 }
        ],
        stateCounts: { new: 1, learning: 3, consolidated: 2, mastered: 1 }
    },
    learningTasks: [{
        taskId: 'weekly-reading',
        metric: 'battle_correct',
        title: 'Reading Sprint',
        description: 'Answer reading questions',
        goal: 20,
        progress: 12,
        status: 'active',
        periodStart: Date.now() - 86400000,
        periodEnd: Date.now() + 86400000,
        rewardXp: 100,
        rewardGold: 20,
        evidence: [],
        updatedAt: Date.now()
    }],
    studyActionExecutions: [],
    studyActionSummary: {
        windowDays: 14,
        completed: 1,
        skipped: 0,
        pending: 2,
        totalTracked: 3,
        executionRate: 1 / 3
    },
    studyActionGoal: {
        windowDays: 14,
        generatedAt: Date.now(),
        executionRate: mockMetric
    },
    engagement: {
        windowDays: 14,
        generatedAt: Date.now(),
        dailyChallengeParticipation: mockMetric,
        weeklyTaskCompletion: mockMetric,
        nextDayRetention: mockMetric
    },
    guardianAcceptance: {
        windowDays: 7,
        generatedAt: Date.now(),
        weeklyActiveRate: mockMetric
    },
    repeatedCauseSnapshot: {
        windowDays: 14,
        taggedMistakes: 5,
        repeatedMistakes: 3,
        repeatRate: 0.6,
        topCauses: [{ causeTag: 'cause_effect', count: 3 }]
    },
    repeatedCauseTrends: [],
    repeatedCauseBaselineGoal: { targetReduction: 0.2, overallStatus: 'not_met', rows: [] },
    repeatedAction: {
        status: 'not_met',
        focusCauseTag: 'cause_effect',
        recommendedQuestions: 4,
        reason: 'reduce',
        intensity: 'standard',
        rationale: 'Cause/effect mistakes are repeating.'
    },
    repeatedAlert: null,
    consistencyAudit: {
        generatedAt: Date.now(),
        overallStatus: 'ok',
        checks: []
    },
    aiMonitor: {
        windowDays: 7,
        generatedAt: Date.now(),
        totalRequests: 24,
        avgLatencyMs: 182,
        p95LatencyMs: 360,
        successRate: mockMetric,
        nonRateLimitedRate: mockMetric,
        retryPressureRate: 0.03,
        status: 'healthy'
    },
    sessionRecovery: {
        windowDays: 14,
        generatedAt: Date.now(),
        attempts: 4,
        successRate: mockMetric,
        status: 'healthy'
    },
    activityFeed: [{
        id: 'event-answer-1',
        kind: 'answer',
        tone: 'red',
        title: 'Wrong battle answer',
        detail: 'Cause Effect',
        meta: '2m ago',
        timestamp: Date.now()
    }, {
        id: 'history-1',
        kind: 'mission',
        tone: 'green',
        title: 'Mission completed',
        detail: 'Animal Habits Adventure',
        meta: '80% accuracy',
        timestamp: Date.now() - 1000
    }]
}));

jest.mock('@/store/settingsStore', () => ({
    useSettingsStore: () => ({ language: 'en' })
}));

jest.mock('@/store/gameStore', () => ({
    useGameStore: () => ({ startGame })
}));

jest.mock('@/lib/exportReport', () => ({
    downloadNodeAsImage: jest.fn(async () => undefined),
    openNodePrintView: jest.fn()
}));

jest.mock('@/lib/data/guardianDashboard', () => ({
    getGuardianDashboardViewModel: (...args: unknown[]) => mockGetGuardianDashboardViewModel(...args)
}));

jest.mock('@/lib/data/studyPlan', () => ({
    computeStudyPlanCompletionSnapshot: jest.fn(() => ({
        plannedActions: 3,
        completedActions: 1,
        plannedMinutes: 24,
        completedMinutes: 8,
        completionRate: 1 / 3
    }))
}));

jest.mock('@/lib/data/targetedReview', () => ({
    buildTargetedReviewPack: jest.fn(() => ({ monsters: [] }))
}));

jest.mock('@/db/db', () => ({
    computeStudyActionExecutionSummaryFromRows: jest.fn(() => ({
        windowDays: 14,
        completed: 1,
        skipped: 0,
        pending: 2,
        totalTracked: 3,
        executionRate: 1 / 3
    })),
    getMemoryStatus: jest.fn(() => ({ statusEmoji: '*', statusText: { en: 'Due now', zh: '到期' } })),
    logGuardianDashboardEvent: jest.fn(async () => undefined),
    upsertStudyActionExecution: jest.fn(async () => undefined)
}));

describe('ParentDashboard visual information architecture', () => {
    test('renders the README-style dashboard sections from the guardian dashboard view model', async () => {
        render(<ParentDashboard />);

        fireEvent.click(screen.getByLabelText('Open Guardian Dashboard'));

        await waitFor(() => {
            expect(screen.getByText('Good morning, Guardian!')).toBeInTheDocument();
        });

        expect(mockGetGuardianDashboardViewModel).toHaveBeenCalledWith(14);
        expect(screen.getByText('Review Queue')).toBeInTheDocument();
        expect(screen.getByText('Learning Events')).toBeInTheDocument();
        expect(screen.getByText('Wrong battle answer')).toBeInTheDocument();
        expect(screen.getByText('Guardian Recommendations')).toBeInTheDocument();
        expect(screen.getByText('Stability Monitor')).toBeInTheDocument();
    });
});
