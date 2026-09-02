import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { downloadNodeAsImage, openNodePrintView } from '@/lib/exportReport';
import { logGuardianDashboardEvent } from '@/db/db';
import { ParentDashboard } from './ParentDashboard';
import { SYNTHETIC_DASHBOARD_LABELS } from '../../tests/fixtures/syntheticLearning';

const startGame = jest.fn();
const scrollIntoView = jest.fn();
const scrollTo = jest.fn();
const mockGetContentReviewQueue = jest.fn(async () => []);
const mockReviewCachedQuestion = jest.fn(async () => undefined);

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

const buildMockDashboardViewModel = () => ({
    history: {
        records: [{
            id: 1,
            timestamp: Date.now(),
            score: 80,
            totalQuestions: 10,
            levelTitle: SYNTHETIC_DASHBOARD_LABELS.missionTitle,
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
    playerProfile: {
        id: 1,
        totalXp: 432,
        globalLevel: 5,
        totalGold: 90,
        dailyStreak: 9,
        lastActiveDate: new Date().toISOString().slice(0, 10),
        dailyXpGoal: 50,
        dailyXpEarned: 35,
        wordsLearned: 42,
        lessonsCompleted: 17,
        totalStudyMinutes: 86,
        perfectLessons: 3,
        vocabMastery: 74,
        grammarMastery: 61,
        readingMastery: 82,
        ownedRelics: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    },
    dailyFlameStatus: {
        state: 'needs-practice',
        streakDays: 9,
        dailyXpGoal: 50,
        dailyXpEarned: 35,
        remainingXp: 15,
        progressPercent: 70,
        canUseFreeze: false,
        lastActiveDate: new Date().toISOString().slice(0, 10)
    },
    mistakes: [{
        id: 1,
        questionId: 10,
        questionText: SYNTHETIC_DASHBOARD_LABELS.mistakeQuestion,
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
        question: SYNTHETIC_DASHBOARD_LABELS.dueQuestion,
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
    objectiveMastery: {
        windowDays: 14,
        generatedAt: Date.now(),
        averageScore: 76,
        byObjective: [{
            objectiveId: 'reading_inference',
            title: 'Reading Inference',
            domain: 'reading',
            score: 76,
            state: 'consolidated',
            attempts: 6,
            correct: 5,
            qualifiedAttempts: 4,
            independentAttempts: 2,
            confidence: 0.8,
            transferAttempts: 1,
            delayedProbeAttempts: 1,
            evidenceStatus: 'retained',
            nextReviewAt: Date.now() + 86400000
        }],
        byDomain: [{ domain: 'reading', averageScore: 76, objectiveCount: 1, masteredCount: 0, learningCount: 1 }],
        stateCounts: { new: 0, learning: 0, consolidated: 1, mastered: 0 }
    },
    learningTasks: [{
        taskId: 'weekly-reading',
        metric: 'battle_correct',
        title: SYNTHETIC_DASHBOARD_LABELS.taskTitle,
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
    dailyPracticePlan: {
        planId: 'daily_2026-06-01',
        title: 'Today\'s Learning Path',
        estimatedMinutes: 12,
        rationale: 'Uses due review and recent mistakes.',
        generatedAt: Date.now(),
        evidence: [
            { label: 'Due review', value: '1 card due for Reading Inference', source: 'srs' }
        ],
        steps: [{
            id: 'review_reading_inference',
            type: 'review',
            title: 'Review Reading Inference',
            objectiveId: 'reading_inference',
            skillTag: 'cause_effect',
            estimatedMinutes: 5,
            questionCount: 3,
            supportLevel: 3,
            attemptKind: 'review',
            rationale: 'Due FSRS cards come first.',
            evidence: []
        }]
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
    }],
    calibrationSummary: {
        ratedAnswers: 4,
        highConfidenceErrors: 1,
        lowConfidenceCorrect: 1,
        alignedJudgments: 1,
        status: 'review-high-confidence-errors' as const
    },
    progressRewardSummary: {
        countedRewards: 5,
        protectedAttempts: 1,
        totalXp: 66,
        totalGold: 36,
        strongEvidenceCount: 3,
        byKind: {
            'supported-practice': 2,
            'independent-success': 0,
            'repair-success': 1,
            'delayed-recall': 1,
            'transfer-success': 1
        }
    },
    scaffoldFadingSummary: {
        answerCount: 6,
        supportedAttempts: 3,
        independentAttempts: 1,
        hintUsedAnswers: 1,
        hintDependencyRate: 1 / 6,
        fadedSteps: 1,
        increasedSupportSteps: 0,
        repairSteps: 1,
        transferReadySignals: 1,
        transferAttempts: 1,
        transferCorrect: 1,
        transferAccuracy: 1
    }
});

const mockGetGuardianDashboardViewModel = jest.fn(async () => buildMockDashboardViewModel());

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

jest.mock('@/lib/data/contentReview', () => ({
    getContentReviewQueue: (...args: unknown[]) => mockGetContentReviewQueue(...args),
    reviewCachedQuestion: (...args: unknown[]) => mockReviewCachedQuestion(...args)
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
    beforeEach(() => {
        mockGetGuardianDashboardViewModel.mockClear();
        jest.mocked(downloadNodeAsImage).mockClear();
        jest.mocked(openNodePrintView).mockClear();
        jest.mocked(logGuardianDashboardEvent).mockClear();
        mockGetContentReviewQueue.mockClear();
        mockReviewCachedQuestion.mockClear();
        scrollIntoView.mockClear();
        scrollTo.mockClear();
        Element.prototype.scrollIntoView = scrollIntoView;
        HTMLElement.prototype.scrollTo = scrollTo;
    });

    test('renders the README-style dashboard sections from the guardian dashboard view model', async () => {
        render(<ParentDashboard />);

        fireEvent.click(screen.getByLabelText('Open Guardian Dashboard'));

        await waitFor(() => {
            expect(screen.getByText('Good morning, Guardian!')).toBeInTheDocument();
        });

        expect(mockGetGuardianDashboardViewModel).toHaveBeenCalledWith(14);
        expect(screen.getByText('Review Queue')).toBeInTheDocument();
        expect(screen.getByText('Learning Events')).toBeInTheDocument();
        expect(await screen.findByText('Confidence Calibration Signals')).toBeInTheDocument();
        expect(screen.getByText('Support Fading & Transfer Evidence')).toBeInTheDocument();
        expect(screen.getByText(/must be read together/i)).toBeInTheDocument();
        expect(screen.getByText('Learning Progress Reward Evidence')).toBeInTheDocument();
        expect(screen.getByText(/trace back only to local review, repair/i)).toBeInTheDocument();
        expect(screen.getByText(/does not affect mastery, ranking, or final judgments/i)).toBeInTheDocument();
        expect(screen.getByText('Wrong battle answer')).toBeInTheDocument();
        expect(screen.getByText('Guardian Recommendations')).toBeInTheDocument();
        expect(screen.getByText('Why This Plan')).toBeInTheDocument();
        expect(screen.getByText('AI Request Monitor')).toBeInTheDocument();
    });

    test('binds top KPI cards to the persisted player profile and daily flame state', async () => {
        render(<ParentDashboard />);

        fireEvent.click(screen.getByLabelText('Open Guardian Dashboard'));

        await waitFor(() => {
            expect(screen.getByText('17')).toBeInTheDocument();
        });

        expect(screen.getByText('Retained Objectives')).toBeInTheDocument();
        expect(within(screen.getByLabelText('Open mastery evidence')).getByText('1/1')).toBeInTheDocument();
        expect(screen.getByText('35/50 XP optional goal')).toBeInTheDocument();
        expect(screen.getByText('9')).toBeInTheDocument();
    });

    test('turns dashboard navigation, alert, and KPI surfaces into meaningful evidence links', async () => {
        render(<ParentDashboard />);

        fireEvent.click(screen.getByLabelText('Open Guardian Dashboard'));

        await waitFor(() => {
            expect(screen.getByText('Good morning, Guardian!')).toBeInTheDocument();
        });

        [
            'Open Overview insights',
            'Open Learner engagement insights',
            'Open Mission follow-through',
            'Open Knowledge review insights',
            'Open Report trends',
            'Open Recommendations',
            'Open System status',
            'Open Help and support guidance'
        ].forEach((label) => {
            expect(screen.getByLabelText(label)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByLabelText('Open Mission follow-through'));
        expect(scrollTo).toHaveBeenCalled();
        expect(scrollIntoView).not.toHaveBeenCalled();

        scrollTo.mockClear();
        fireEvent.click(screen.getByLabelText('View dashboard alerts'));
        expect(scrollTo).toHaveBeenCalled();

        scrollTo.mockClear();
        fireEvent.click(screen.getByLabelText('Open mastery evidence'));
        expect(scrollTo).toHaveBeenCalled();

        scrollTo.mockClear();
        fireEvent.click(screen.getByLabelText('Open learning rhythm evidence'));
        expect(scrollTo).toHaveBeenCalled();
    });

    test('keeps the original compact sidebar layout while preserving actionable navigation', async () => {
        render(<ParentDashboard />);

        fireEvent.click(screen.getByLabelText('Open Guardian Dashboard'));

        await waitFor(() => {
            expect(screen.getByText('Good morning, Guardian!')).toBeInTheDocument();
        });

        expect(screen.getByLabelText('Open Overview insights')).toHaveTextContent('Overview');
        expect(screen.getByLabelText('Open Learner engagement insights')).toHaveTextContent('Learners');
        expect(screen.getByLabelText('Open Mission follow-through')).toHaveTextContent('Missions');
        expect(screen.getByLabelText('Open Knowledge review insights')).toHaveTextContent('Knowledge');
        expect(screen.getByLabelText('Open Report trends')).toHaveTextContent('Reports');
        expect(screen.getByLabelText('Open Recommendations')).toHaveTextContent('Recommendations');
        expect(screen.getByLabelText('Open System status')).toHaveTextContent('Settings');
        expect(screen.getByLabelText('Open Help and support guidance')).toHaveTextContent('Help & Support');

        expect(screen.queryByText('Learner Signals')).not.toBeInTheDocument();
        expect(screen.queryByText('Activity')).not.toBeInTheDocument();
        expect(screen.queryByText('System')).not.toBeInTheDocument();

        fireEvent.click(screen.getByLabelText('Open System status'));
        expect(scrollTo).toHaveBeenCalled();

        scrollTo.mockClear();
        fireEvent.click(screen.getByLabelText('Open Help and support guidance'));
        expect(scrollTo).toHaveBeenCalled();
    });

    test('uses responsive min-width-safe dashboard grids so long evidence text cannot collapse sibling panels', async () => {
        render(<ParentDashboard />);

        fireEvent.click(screen.getByLabelText('Open Guardian Dashboard'));

        await waitFor(() => {
            expect(screen.getByText('Good morning, Guardian!')).toBeInTheDocument();
        });

        const overview = screen.getByLabelText('Dashboard overview');
        expect(overview.className).toContain('xl:grid-cols-3');
        expect(overview.className).toContain('2xl:grid-cols-5');

        const masteryPanel = screen.getByLabelText('Learning Evidence Progress');
        expect(masteryPanel).toHaveClass('min-w-0');
        expect(masteryPanel.parentElement?.className).toContain('xl:grid-cols-2');
        expect(masteryPanel.parentElement?.className).toContain('2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)_minmax(0,0.9fr)]');
    });

    test('does not present insufficient AI request telemetry as hard reliability percentages', async () => {
        const insufficientMetric = {
            ...mockMetric,
            currentRate: 0,
            numerator: 0,
            denominator: 1,
            status: 'insufficient' as const
        };
        mockGetGuardianDashboardViewModel.mockResolvedValueOnce({
            ...buildMockDashboardViewModel(),
            aiMonitor: {
                windowDays: 7,
                generatedAt: Date.now(),
                totalRequests: 1,
                avgLatencyMs: 2963,
                p95LatencyMs: 2963,
                successRate: insufficientMetric,
                nonRateLimitedRate: insufficientMetric,
                retryPressureRate: 1,
                status: 'insufficient' as const
            }
        });

        render(<ParentDashboard />);

        fireEvent.click(screen.getByLabelText('Open Guardian Dashboard'));

        await waitFor(() => {
            expect(screen.getAllByText('Collecting Data').length).toBeGreaterThan(0);
        });

        expect(screen.getByText('1/5 requests collected')).toBeInTheDocument();
        expect(screen.getByText('Shown after 5 requests')).toBeInTheDocument();
        expect(screen.getByText('1 sample · p95 2963ms')).toBeInTheDocument();
        const aiMonitorPanel = screen.getByLabelText('AI Request Monitor');
        expect(within(aiMonitorPanel).queryByText('0%')).not.toBeInTheDocument();
        expect(within(aiMonitorPanel).queryByText('100%')).not.toBeInTheDocument();
        expect(within(aiMonitorPanel).queryByText('No incidents reported')).not.toBeInTheDocument();
    });

    test('shows the latest execution result on guardian recommendation cards', async () => {
        mockGetGuardianDashboardViewModel.mockResolvedValueOnce({
            ...buildMockDashboardViewModel(),
            studyActionExecutions: [{
                actionId: 'targeted_pack',
                dateKey: new Date().toISOString().slice(0, 10),
                status: 'completed' as const,
                priority: 'urgent' as const,
                estimatedMinutes: 8,
                source: 'guardian_dashboard' as const,
                completedAt: Date.now() - 1000,
                updatedAt: Date.now()
            }]
        });

        render(<ParentDashboard />);

        fireEvent.click(screen.getByLabelText('Open Guardian Dashboard'));

        await waitFor(() => {
            expect(screen.getByText('Result after completion:')).toBeInTheDocument();
        });
        expect(screen.getByText('Completed today · 8 min tracked')).toBeInTheDocument();
    });

    test('keeps AI questions out of measurement until an educator explicitly approves them', async () => {
        const question = {
            id: 17,
            question: 'Which sentence describes a routine?',
            options: ['Mina walks to the library.', 'Mina walked yesterday.'],
            correct_index: 0,
            type: 'grammar' as const,
            explanation: 'The present simple describes a routine.',
            skillTag: 'grammar:present_simple',
            learningObjectiveId: 'present_simple',
            itemFamilyId: 'present-simple-routine-ai-1',
            assessmentRole: 'practice' as const,
            transferDistance: 'near' as const,
            reviewerStatus: 'unreviewed' as const,
            contextHash: 'synthetic-context',
            timestamp: Date.now(),
            used: false
        };
        mockGetContentReviewQueue.mockResolvedValueOnce([{ question }]);

        render(<ParentDashboard />);
        fireEvent.click(screen.getByLabelText('Open Guardian Dashboard'));

        expect(await screen.findByText(question.question)).toBeInTheDocument();
        expect(screen.getByText(/Approval does not mean mastery/i)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Approve for measurement' }));

        await waitFor(() => {
            expect(mockReviewCachedQuestion).toHaveBeenCalledWith({
                question,
                decision: 'educator-approved'
            });
        });
    });

    test('exports a print-ready report snapshot with generation time instead of the scrollable dashboard', async () => {
        render(<ParentDashboard />);

        fireEvent.click(screen.getByLabelText('Open Guardian Dashboard'));

        await waitFor(() => {
            expect(screen.getByText('Good morning, Guardian!')).toBeInTheDocument();
        });

        const exportButton = screen.getByRole('button', { name: 'Export Report' });
        await waitFor(() => expect(exportButton).toBeEnabled());
        fireEvent.click(exportButton);

        const privacyDialog = screen.getByRole('dialog', { name: 'Confirm report export privacy' });
        expect(privacyDialog).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create PNG report' })).toBeDisabled();
        fireEvent.click(screen.getByLabelText(/I understand this file leaves browser-local storage/));
        fireEvent.click(screen.getByRole('button', { name: 'Create PNG report' }));

        await waitFor(() => {
            expect(downloadNodeAsImage).toHaveBeenCalled();
        });

        const [node, filename, options] = jest.mocked(downloadNodeAsImage).mock.calls[0] as unknown as [
            HTMLElement,
            string,
            { backgroundColor?: string }?
        ];

        expect(node).toHaveAttribute('data-testid', 'guardian-export-report');
        expect(node.textContent).toContain('Generated');
        expect(node.textContent).toContain('Last 14 days');
        expect(node.textContent).toContain('Question text excluded from export');
        expect(node.textContent).not.toContain(SYNTHETIC_DASHBOARD_LABELS.missionTitle);
        expect(node.textContent).not.toContain(SYNTHETIC_DASHBOARD_LABELS.dueQuestion);
        expect(node.textContent).not.toContain(SYNTHETIC_DASHBOARD_LABELS.mistakeQuestion);
        expect(filename).toMatch(/^word-quest-report-14d-\d{8}-\d{4}\.png$/);
        expect(options).toMatchObject({ backgroundColor: '#f8fafc' });
        expect(logGuardianDashboardEvent).toHaveBeenCalledWith('report_export');
    });

    test('shows the export contract and cancellation does not export or log an event', async () => {
        render(<ParentDashboard />);
        fireEvent.click(screen.getByLabelText('Open Guardian Dashboard'));

        expect(await screen.findByText('Check privacy before exporting')).toBeInTheDocument();
        expect(screen.getByText(/Source text, questions, answers, mistake text/)).toBeInTheDocument();
        const downloadButton = screen.getByRole('button', { name: 'Download Snapshot' });
        await waitFor(() => expect(downloadButton).toBeEnabled());
        fireEvent.click(downloadButton);
        expect(screen.getByText('Included')).toBeInTheDocument();
        expect(screen.getByText('Excluded')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

        expect(screen.queryByRole('dialog', { name: 'Confirm report export privacy' })).not.toBeInTheDocument();
        expect(downloadNodeAsImage).not.toHaveBeenCalled();
        expect(openNodePrintView).not.toHaveBeenCalled();
        expect(logGuardianDashboardEvent).not.toHaveBeenCalledWith('report_export');
    });

    test('requires the same acknowledgement before opening print or PDF', async () => {
        render(<ParentDashboard />);
        fireEvent.click(screen.getByLabelText('Open Guardian Dashboard'));
        await screen.findByText('Good morning, Guardian!');

        const printButton = screen.getByRole('button', { name: 'Print / Save PDF' });
        await waitFor(() => expect(printButton).toBeEnabled());
        fireEvent.click(printButton);
        const confirmButton = screen.getByRole('button', { name: 'Open print / PDF' });
        expect(confirmButton).toBeDisabled();
        fireEvent.click(screen.getByLabelText(/I understand this file leaves browser-local storage/));
        fireEvent.click(confirmButton);

        await waitFor(() => expect(openNodePrintView).toHaveBeenCalledTimes(1));
        expect(logGuardianDashboardEvent).toHaveBeenCalledWith('report_export');
    });
});
