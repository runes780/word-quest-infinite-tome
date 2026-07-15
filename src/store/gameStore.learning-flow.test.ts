import { useGameStore } from './gameStore';
import {
    logLearningEvent,
    reviewCard,
    updateObjectiveMastery,
    updatePlayerProfile,
    updateSkillMastery,
    upsertStudyActionExecution
} from '@/db/db';
import { logMistake } from '@/lib/data/mistakes';
import { createPracticePlanRun, currentPracticePlanStep } from '@/lib/data/practicePlanRunner';
import type { PracticePlan } from '@/lib/data/dailyPracticePlan';
import { getCurrentBlessingEffect } from '@/components/InputSection';

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
        const result = useGameStore.getState().answerQuestion(0, {
            responseLatencyMs: 900,
            selfConfidence: 'high'
        });
        await flush();

        expect(result.correct).toBe(true);
        expect(result.progressReward).toEqual({
            kind: 'supported-practice',
            xp: 8,
            gold: 4,
            counted: true
        });
        expect(logLearningEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'answer',
            source: 'battle',
            result: 'correct',
            skillTag: 'vocab_core',
            learningObjectiveId: 'vocab_context_meaning',
            attemptKind: 'practice',
            supportLevel: 3,
            selfConfidence: 'high',
            progressRewardKind: 'supported-practice',
            rewardXp: 8,
            rewardGold: 4,
            rewardCounted: true
        }));
        expect(updatePlayerProfile).toHaveBeenCalledWith(expect.objectContaining({
            totalXp: 8,
            totalGold: 4,
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
        expect(updateObjectiveMastery).toHaveBeenCalledWith(expect.objectContaining({
            objectiveId: 'vocab_context_meaning',
            skillTag: 'vocab_core',
            result: 'correct',
            mode: 'choice',
            attemptKind: 'practice',
            supportLevel: 3,
            latencyMs: 900
        }));
        expect(updateObjectiveMastery).not.toHaveBeenCalledWith(expect.objectContaining({
            selfConfidence: expect.anything()
        }));
        expect(updateSkillMastery).toHaveBeenCalledWith('vocab_core', 'correct');
        expect(useGameStore.getState().userAnswers[0]).toEqual(expect.objectContaining({
            selfConfidence: 'high',
            questionHash: 'hash_apple',
            progressReward: expect.objectContaining({
                kind: 'supported-practice',
                counted: true
            })
        }));
        expect(logMistake).not.toHaveBeenCalled();
    });

    test('keeps answer-level hint use consistent across session, event, and objective mastery', async () => {
        useGameStore.getState().startGame([baseQuestion], 'battle context', 'battle');

        useGameStore.getState().answerQuestion(0, {
            responseLatencyMs: 900,
            hintUsed: true
        });
        await flush();

        expect(useGameStore.getState().userAnswers[0]).toEqual(expect.objectContaining({
            hintUsed: true,
            scaffoldReason: 'hint-dependence',
            nextSupportLevel: 3
        }));
        expect(logLearningEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'answer',
            hintUsed: true,
            scaffoldReason: 'hint-dependence',
            scaffoldTransition: 'hold',
            nextSupportLevel: 3
        }));
        expect(updateObjectiveMastery).toHaveBeenCalledWith(expect.objectContaining({
            hintUsed: true
        }));
    });

    test('fades the next same-objective question only after two no-hint successes', () => {
        useGameStore.getState().startGame([
            baseQuestion,
            { ...baseQuestion, id: 2, question: 'apple means...', sourceContextSpan: 'An apple grows on a tree.' },
            { ...baseQuestion, id: 3, question: 'choose apple', sourceContextSpan: 'She packed an apple.' }
        ], 'battle context', 'battle');

        const first = useGameStore.getState().answerQuestion(0, { responseLatencyMs: 700 });
        expect(first.scaffoldDecision.reason).toBe('collect-more-evidence');
        expect(useGameStore.getState().questions[1].supportLevel).toBe(3);

        useGameStore.getState().nextQuestion();
        const second = useGameStore.getState().answerQuestion(0, { responseLatencyMs: 700 });

        expect(second.scaffoldDecision).toEqual(expect.objectContaining({
            transition: 'fade',
            reason: 'stable-success',
            nextSupportLevel: 2
        }));
        expect(useGameStore.getState().questions[2]).toEqual(expect.objectContaining({
            supportLevel: 2,
            attemptKind: 'practice'
        }));
        expect(useGameStore.getState().userAnswers[1]).toEqual(expect.objectContaining({
            scaffoldTransition: 'fade',
            scaffoldReason: 'stable-success',
            nextSupportLevel: 2
        }));
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
        expect(result.progressReward).toBeNull();
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
        expect(updateObjectiveMastery).toHaveBeenCalledWith(expect.objectContaining({
            objectiveId: 'vocab_context_meaning',
            skillTag: 'vocab_core',
            result: 'wrong',
            mode: 'choice',
            attemptKind: 'review',
            supportLevel: 3,
            latencyMs: 1200
        }));
        expect(updateSkillMastery).toHaveBeenCalledWith('vocab_core', 'wrong');
        expect(logMistake).toHaveBeenCalledWith(expect.objectContaining({
            questionId: 1,
            wrongAnswer: 'banana',
            correctAnswer: 'apple',
            skillTag: 'vocab_core'
        }));
    });

    test('srs success earns a delayed-recall reward without changing FSRS rating rules', async () => {
        useGameStore.getState().startGame([baseQuestion], 'srs context', 'srs');
        const result = useGameStore.getState().answerQuestion(0, { responseLatencyMs: 1400 });
        await flush();

        expect(result.progressReward).toEqual({
            kind: 'delayed-recall',
            xp: 14,
            gold: 8,
            counted: true
        });
        expect(reviewCard).toHaveBeenCalledWith(
            'hash_apple',
            expect.stringMatching(/good|easy/),
            expect.any(Object)
        );
        expect(logLearningEvent).toHaveBeenCalledWith(expect.objectContaining({
            source: 'srs',
            attemptKind: 'review',
            progressRewardKind: 'delayed-recall'
        }));
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
        jest.mocked(getCurrentBlessingEffect).mockReturnValue({ repairXpMultiplier: 1.25 });
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
        expect(repair.question).toContain('Try this clue');
        expect(repair.question).toContain('The ___ is red.');
        expect(repair.question).not.toBe(baseQuestion.question);
        expect(repair.question).not.toContain('Repair the same pattern');

        useGameStore.getState().nextQuestion();
        const repairResult = useGameStore.getState().answerQuestion(repair.correct_index, { responseLatencyMs: 800 });
        expect(repairResult.progressReward).toEqual({
            kind: 'repair-success',
            xp: 17,
            gold: 8,
            counted: true
        });
        expect(logLearningEvent).toHaveBeenCalledWith(expect.objectContaining({
            progressRewardKind: 'repair-success',
            rewardXp: 17,
            rewardGold: 8,
            rewardCounted: true
        }));
        jest.mocked(getCurrentBlessingEffect).mockReturnValue(null);
    });
});
