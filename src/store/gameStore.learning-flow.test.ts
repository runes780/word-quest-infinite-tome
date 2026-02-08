import { useGameStore } from './gameStore';
import { logLearningEvent, reviewCard, updatePlayerProfile, updateSkillMastery } from '@/db/db';

jest.mock('@/components/InputSection', () => ({
    getCurrentBlessingEffect: jest.fn(() => null)
}));

jest.mock('@/lib/data/mistakes', () => ({
    logMistake: jest.fn()
}));

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
    correctAnswer: 'apple'
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
            skillTag: 'vocab_core'
        }));
        expect(updatePlayerProfile).toHaveBeenCalledWith(expect.objectContaining({
            totalXp: expect.any(Number),
            totalGold: expect.any(Number),
            wordsLearned: 1
        }));
        expect(reviewCard).toHaveBeenCalledWith(
            'hash_apple',
            expect.stringMatching(/good|easy/),
            expect.objectContaining({ skillTag: 'vocab_core' })
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
            skillTag: 'vocab_core'
        }));
        expect(reviewCard).toHaveBeenCalledWith(
            'hash_apple',
            'again',
            expect.objectContaining({ skillTag: 'vocab_core' })
        );
    });
});
