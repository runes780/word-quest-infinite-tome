import { useGameStore } from './gameStore';
import { logLearningEvent, reviewCard, updatePlayerProfile, updateSkillMastery, upsertStudyActionExecution } from '@/db/db';
import { createPracticePlanRun, currentPracticePlanStep } from '@/lib/data/practicePlanRunner';
import type { PracticePlan } from '@/lib/data/dailyPracticePlan';

jest.mock('@/components/InputSection', () => ({
    getCurrentBlessingEffect: jest.fn(() => null)
}));

jest.mock('@/lib/data/mistakes', () => ({
    logMistake: jest.fn()
}));

jest.mock('@/lib/data/practicePlanRunner', () => {
    const actual = jest.requireActual('@/lib/data/practicePlanRunner');
    return {
        ...actual,
        markPracticePlanRunStepComplete: jest.fn(async () => null)
    };
});

jest.mock('@/components/AchievementSystem', () => ({
    loadPlayerStats: jest.fn(() => ({
        totalCorrect: 0,
        totalWrong: 0,
        totalQuestions: 0,
        maxStreak: 0,
        currentStreak: 0,
        totalCriticals: 0,
        totalGoldEarned: 0,
        totalXpEarned: 0,
        bossesDefeated: 0,
        perfectRuns: 0,
        relicsOwned: 0,
        potionsUsed: 0,
        daysPlayed: 0,
        consecutiveDays: 0,
        vocabMastered: 0,
        grammarMastered: 0,
        fastAnswers: 0,
        hintsUsed: 0,
        revengeCleared: 0,
        levelsCompleted: 0
    })),
    savePlayerStats: jest.fn(),
    checkAchievements: jest.fn(() => [])
}));

jest.mock('@/db/db', () => ({
    updatePlayerProfile: jest.fn(async () => ({ dailyStreak: 1 })),
    reviewCard: jest.fn(async () => undefined),
    hashQuestion: jest.fn((text: string) => `hash_${text}`),
    logLearningEvent: jest.fn(async () => undefined),
    updateSkillMastery: jest.fn(async () => ({
        skillTag: 'vocab_core',
        score: 28,
        state: 'new',
        attempts: 1,
        correct: 1,
        lastReviewedAt: Date.now(),
        updatedAt: Date.now()
    })),
    updateObjectiveMastery: jest.fn(async () => ({
        objectiveId: 'vocab_context_meaning',
        score: 28,
        state: 'new',
        attempts: 1,
        correct: 1,
        attemptsByMode: { choice: 1, 'fill-blank': 0, typing: 0 },
        transferAttempts: 0,
        transferCorrect: 0,
        hintCount: 0,
        hintRate: 0,
        lastReviewedAt: Date.now(),
        nextReviewAt: Date.now(),
        confidence: 0.2,
        updatedAt: Date.now()
    })),
    upsertStudyActionExecution: jest.fn(async () => undefined),
    seedSkillMasteryFromLearningEvents: jest.fn(async () => 0),
    getSkillMasteryMap: jest.fn(async () => ({})),
    getSkillReviewRiskMap: jest.fn(async () => ({})),
    getRecentMistakeIntensity: jest.fn(async () => ({}))
}));

const baseQuestion = {
    id: 1,
    type: 'vocab' as const,
    question: 'apple',
    options: ['apple', 'banana', 'orange'],
    correct_index: 0,
    explanation: 'apple is correct',
    skillTag: 'vocab_core',
    difficulty: 'medium' as const,
    questionMode: 'choice' as const,
    correctAnswer: 'apple',
    learningObjectiveId: 'vocab_context_meaning',
    objectiveConfidence: 0.92,
    sourceContextSpan: 'The apple is red.',
    supportLevel: 3 as const,
    attemptKind: 'practice' as const
};

const practicePlan: PracticePlan = {
    planId: 'daily_test',
    title: 'Today\'s Learning Path',
    estimatedMinutes: 8,
    generatedAt: 100,
    rationale: 'test plan',
    evidence: [],
    steps: [
        {
            id: 'daily_review_vocab',
            type: 'review',
            title: 'Review vocabulary',
            objectiveId: 'vocab_context_meaning',
            skillTag: 'vocab_core',
            estimatedMinutes: 4,
            questionCount: 3,
            supportLevel: 3,
            attemptKind: 'review',
            rationale: 'review first',
            evidence: []
        },
        {
            id: 'daily_transfer_vocab',
            type: 'transfer',
            title: 'Transfer vocabulary',
            objectiveId: 'vocab_context_meaning',
            skillTag: 'vocab_core',
            estimatedMinutes: 4,
            questionCount: 2,
            supportLevel: 0,
            attemptKind: 'transfer',
            rationale: 'transfer second',
            evidence: []
        }
    ]
};

const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

describe('learning pipeline regression (battle/srs)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        useGameStore.getState().resetGame();
    });

    test('battle source logs answer event and updates profile', async () => {
        (updateSkillMastery as jest.Mock).mockResolvedValueOnce({
            skillTag: 'vocab_core',
            score: 28,
            state: 'new',
            attempts: 1,
            correct: 1,
            lastReviewedAt: Date.now(),
            updatedAt: Date.now()
        });
        useGameStore.getState().startGame([baseQuestion], 'battle context', 'battle');
        const result = useGameStore.getState().answerQuestion(0, { responseLatencyMs: 900 });
        await flush();

        expect(result.correct).toBe(true);
        expect(logLearningEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'answer',
            source: 'battle',
            result: 'correct',
            skillTag: 'vocab_core',
            learningObjectiveId: 'vocab_context_meaning',
            attemptKind: 'practice',
            supportLevel: 3
        }));
        expect(updatePlayerProfile).toHaveBeenCalledWith(expect.objectContaining({
            totalXp: expect.any(Number),
            totalGold: expect.any(Number),
            wordsLearned: 1
        }));
        expect(reviewCard).toHaveBeenCalledWith(
            'hash_apple',
            expect.stringMatching(/good|easy/),
            expect.objectContaining({
                skillTag: 'vocab_core',
                learningObjectiveId: 'vocab_context_meaning',
                sourceContextSpan: 'The apple is red.',
                questionMode: 'choice',
                correctAnswer: 'apple'
            })
        );
    });

    test('srs source writes wrong answer with srs tag', async () => {
        (updateSkillMastery as jest.Mock).mockResolvedValueOnce({
            skillTag: 'vocab_core',
            score: 12,
            state: 'new',
            attempts: 2,
            correct: 1,
            lastReviewedAt: Date.now(),
            updatedAt: Date.now()
        });

        useGameStore.getState().startGame([baseQuestion], 'srs context', 'srs');
        const result = useGameStore.getState().answerQuestion(1, { responseLatencyMs: 1200 });
        await flush();

        expect(result.correct).toBe(false);
        expect(logLearningEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'answer',
            source: 'srs',
            result: 'wrong',
            skillTag: 'vocab_core',
            learningObjectiveId: 'vocab_context_meaning',
            attemptKind: 'review',
            supportLevel: 3
        }));
        expect(reviewCard).toHaveBeenCalledWith(
            'hash_apple',
            'again',
            expect.objectContaining({
                skillTag: 'vocab_core',
                learningObjectiveId: 'vocab_context_meaning',
                sourceContextSpan: 'The apple is red.',
                questionMode: 'choice',
                correctAnswer: 'apple'
            })
        );
    });

    test('run completion advances the active daily practice plan one step', async () => {
        const run = createPracticePlanRun(practicePlan, 1000);

        useGameStore.getState().startGame([baseQuestion], 'daily path context', 'battle', run);
        useGameStore.getState().answerQuestion(0, { responseLatencyMs: 700 });
        useGameStore.getState().recordRunCompletion();
        await flush();

        const activeRun = useGameStore.getState().activePracticePlanRun;
        expect(activeRun?.completedStepIds).toEqual(['daily_review_vocab']);
        expect(activeRun?.currentStepIndex).toBe(1);
        expect(currentPracticePlanStep(activeRun)?.id).toBe('daily_transfer_vocab');
    });

    test('guardian-launched sessions auto-mark the source action completed', async () => {
        useGameStore.getState().startGame([{
            ...baseQuestion,
            sourceActionId: 'targeted_pack',
            sourceActionPriority: 'urgent',
            sourceActionEstimatedMinutes: 8
        }], 'Targeted Review: cause_effect', 'battle');

        useGameStore.getState().answerQuestion(0, { responseLatencyMs: 700 });
        useGameStore.getState().recordRunCompletion();
        await flush();

        expect(upsertStudyActionExecution).toHaveBeenCalledWith(expect.objectContaining({
            actionId: 'targeted_pack',
            status: 'completed',
            priority: 'urgent',
            estimatedMinutes: 8
        }));
    });

    test('wrong answers queue an immediate repair question for the same objective', async () => {
        useGameStore.getState().startGame([{
            ...baseQuestion,
            learningObjectiveId: 'vocab_context_meaning',
            supportLevel: 1,
            attemptKind: 'transfer',
            causeTag: 'context_clue'
        }], 'Battle Mission', 'battle');

        const result = useGameStore.getState().answerQuestion(1, { responseLatencyMs: 1100 });
        const state = useGameStore.getState();
        const repair = state.questions[state.currentIndex + 1];

        expect(result.correct).toBe(false);
        expect(result.repairQueued).toBe(true);
        expect(repair).toEqual(expect.objectContaining({
            skillTag: 'vocab_core',
            learningObjectiveId: 'vocab_context_meaning',
            causeTag: 'context_clue',
            attemptKind: 'practice',
            sourceContextSpan: 'The apple is red.',
            isImmediateRepair: true
        }));
        expect(repair.supportLevel).toBeGreaterThanOrEqual(2);
        expect(repair.question).toContain('Try again: apple');
        expect(repair.question).not.toContain('Repair the same pattern');
    });
});
