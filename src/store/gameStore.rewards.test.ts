import { RELICS, useGameStore, UserAnswer } from './gameStore';
import { logLearningEvent, updatePlayerProfile } from '@/db/db';

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

describe('reward planning and objective rewards', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        useGameStore.getState().resetGame();
    });

    test('boss rewards are guarantee-driven with relic pity and progression floor', () => {
        useGameStore.setState({
            inventory: [],
            skillStats: {
                vocab_core: { correct: 3, total: 4 }
            }
        });

        useGameStore.getState().generateRewards('boss');
        const rewards = useGameStore.getState().pendingRewards;

        expect(rewards.some((reward) => reward.type === 'gold')).toBe(true);
        expect(rewards.some((reward) => reward.type === 'fragment')).toBe(true);
        expect(rewards.some((reward) => reward.type === 'relic')).toBe(true);
        expect(rewards.some((reward) => reward.type === 'objective')).toBe(true);
    });

    test('boss rewards fallback to guaranteed potion when all relics are owned', () => {
        useGameStore.setState({
            inventory: RELICS.map((relic, idx) => ({ ...relic, id: `${relic.id}_${idx}` })),
            skillStats: {}
        });

        useGameStore.getState().generateRewards('boss');
        const rewards = useGameStore.getState().pendingRewards;

        expect(rewards.some((reward) => reward.type === 'relic')).toBe(false);
        expect(rewards.some((reward) => reward.type === 'potion')).toBe(true);
    });

    test('recordRunCompletion grants review-completion and weakness-breakthrough objective bonuses', async () => {
        const answers: UserAnswer[] = [
            { questionId: 1, questionText: 'q1', userChoice: 'a', correctChoice: 'a', isCorrect: true },
            { questionId: 2, questionText: 'q2', userChoice: 'a', correctChoice: 'a', isCorrect: true },
            { questionId: 3, questionText: 'q3', userChoice: 'a', correctChoice: 'a', isCorrect: true },
            { questionId: 4, questionText: 'q4', userChoice: 'a', correctChoice: 'a', isCorrect: true },
            { questionId: 5, questionText: 'q5', userChoice: 'b', correctChoice: 'a', isCorrect: false },
            { questionId: 6, questionText: 'q6', userChoice: 'a', correctChoice: 'a', isCorrect: true }
        ];

        useGameStore.setState({
            sessionSource: 'srs',
            userAnswers: answers,
            skillStats: {
                vocab_core: { correct: 4, total: 5 }
            }
        });

        useGameStore.getState().recordRunCompletion();
        await Promise.resolve();

        const state = useGameStore.getState();
        expect(state.runObjectiveBonuses).toHaveLength(2);
        expect(state.playerStats.xp).toBe(54);
        expect(state.playerStats.gold).toBe(38);
        expect(updatePlayerProfile).toHaveBeenCalledWith(expect.objectContaining({
            totalXp: 54,
            totalGold: 38,
            dailyXpEarned: 54
        }));
        expect(logLearningEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'session_complete',
            source: 'srs'
        }));
    });
});
