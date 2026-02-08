import { render, waitFor } from '@testing-library/react';
import { MissionReport } from '@/components/MissionReport';
import { useGameStore } from '@/store/gameStore';
import { logMissionHistory } from '@/lib/data/history';
import { logLearningEvent, reviewCard, updatePlayerProfile, updateSkillMastery } from '@/db/db';

jest.mock('@/store/settingsStore', () => ({
    useSettingsStore: () => ({
        language: 'en',
        apiKey: '',
        model: 'meta-llama/llama-3-8b-instruct:free',
        soundEnabled: false
    })
}));

jest.mock('@/lib/ai/openrouter', () => ({
    OpenRouterClient: jest.fn().mockImplementation(() => ({
        generate: jest.fn(async () => JSON.stringify({
            mvp_skill: 'vocab',
            weakness: 'tense',
            advice: 'Keep reviewing.',
            mistake_analysis: 'Focus on tense transitions.'
        }))
    }))
}));

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

jest.mock('@/lib/data/history', () => ({
    logMissionHistory: jest.fn(async () => undefined)
}));

jest.mock('@/db/db', () => ({
    updatePlayerProfile: jest.fn(async () => ({ dailyStreak: 1 })),
    reviewCard: jest.fn(async () => undefined),
    hashQuestion: jest.fn((text: string) => `hash_${text}`),
    logLearningEvent: jest.fn(async () => undefined),
    updateSkillMastery: jest.fn(async () => ({
        skillTag: 'vocab_core',
        score: 35,
        state: 'learning',
        attempts: 2,
        correct: 1,
        lastReviewedAt: Date.now(),
        updatedAt: Date.now()
    })),
    seedSkillMasteryFromLearningEvents: jest.fn(async () => 0),
    getSkillMasteryMap: jest.fn(async () => ({})),
    getSkillReviewRiskMap: jest.fn(async () => ({})),
    getRecentMistakeIntensity: jest.fn(async () => ({})),
    logSessionRecoveryEvent: jest.fn(async () => undefined)
}));

const flush = async () => {
    await Promise.resolve();
    await Promise.resolve();
};

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

describe('learning main flow e2e (mission -> battle -> srs -> report)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
        useGameStore.getState().resetGame();
    });

    test('keeps events/profile/history chain consistent across the full learning loop', async () => {
        (updateSkillMastery as jest.Mock).mockResolvedValue({
            skillTag: 'vocab_core',
            score: 50,
            state: 'learning',
            attempts: 3,
            correct: 2,
            lastReviewedAt: Date.now(),
            updatedAt: Date.now()
        });

        // Battle step
        useGameStore.getState().startGame([{ ...baseQuestion, id: 11 }], 'Battle Mission', 'battle');
        useGameStore.getState().answerQuestion(0, { responseLatencyMs: 700 });
        await flush();

        // SRS step
        useGameStore.getState().startGame([{ ...baseQuestion, id: 22 }], 'SRS Session', 'srs');
        useGameStore.getState().answerQuestion(1, { responseLatencyMs: 900 });
        await flush();

        // Report step uses current mission state, so create a fresh battle mission before rendering report
        useGameStore.getState().startGame([{ ...baseQuestion, id: 33 }], 'Report Mission', 'battle');
        useGameStore.getState().answerQuestion(0, { responseLatencyMs: 800 });
        await flush();

        render(<MissionReport />);

        await waitFor(() => {
            expect(logMissionHistory).toHaveBeenCalledWith(expect.objectContaining({
                levelTitle: 'Report Mission',
                totalQuestions: 1,
                totalCorrect: 1
            }));
        });

        await waitFor(() => {
            expect(logLearningEvent).toHaveBeenCalledWith(expect.objectContaining({
                eventType: 'session_complete',
                source: 'battle'
            }));
        });

        expect(logLearningEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'answer',
            source: 'battle',
            result: 'correct'
        }));
        expect(logLearningEvent).toHaveBeenCalledWith(expect.objectContaining({
            eventType: 'answer',
            source: 'srs',
            result: 'wrong'
        }));

        expect(updatePlayerProfile).toHaveBeenCalledWith(expect.objectContaining({
            lessonsCompleted: 1,
            totalStudyMinutes: 1,
            perfectLessons: 1
        }));
        expect(reviewCard).toHaveBeenCalled();
    });
});
