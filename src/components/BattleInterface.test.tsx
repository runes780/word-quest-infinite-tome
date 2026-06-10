import { act, fireEvent, render, screen } from '@testing-library/react';
import { BattleInterface } from './BattleInterface';
import { useGameStore } from '@/store/gameStore';

jest.mock('@/store/settingsStore', () => ({
    useSettingsStore: () => ({
        apiKey: '',
        model: 'meta-llama/llama-3-8b-instruct:free',
        language: 'en',
        soundEnabled: false,
        ttsEnabled: false
    })
}));

jest.mock('@/components/battle/useEndlessWave', () => ({
    useEndlessWave: () => ({ isGeneratingMore: false })
}));

jest.mock('@/lib/audio', () => ({
    playSound: {
        attackSlash: jest.fn(),
        attackFire: jest.fn(),
        attackZap: jest.fn(),
        coin: jest.fn(),
        crit: jest.fn(),
        hit: jest.fn(),
        success: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('@/lib/tts', () => ({
    speakText: jest.fn(),
    stopSpeech: jest.fn()
}));

jest.mock('@/components/InputSection', () => ({
    getCurrentBlessingEffect: jest.fn(() => null)
}));

jest.mock('@/store/modules/sessionRecovery', () => ({
    clearSavedGameStateSnapshot: jest.fn(),
    loadSavedGameStateSnapshot: jest.fn(() => null),
    saveGameStateSnapshot: jest.fn()
}));

jest.mock('@/lib/data/mistakes', () => ({
    logMistake: jest.fn()
}));

jest.mock('@/components/AchievementSystem', () => ({
    AchievementToast: () => null,
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
    updateObjectiveMastery: jest.fn(async () => undefined),
    upsertStudyActionExecution: jest.fn(async () => undefined),
    seedSkillMasteryFromLearningEvents: jest.fn(async () => 0),
    getSkillMasteryMap: jest.fn(async () => ({})),
    getSkillReviewRiskMap: jest.fn(async () => ({})),
    getRecentMistakeIntensity: jest.fn(async () => ({})),
    logSessionRecoveryEvent: jest.fn(async () => undefined)
}));

const typingQuestion = {
    id: 101,
    type: 'vocab' as const,
    question: 'Type the word for apple.',
    options: ['apple', 'banana', 'orange', 'pear'],
    correct_index: 0,
    explanation: 'apple is correct',
    skillTag: 'vocab_core',
    difficulty: 'medium' as const,
    questionMode: 'typing' as const,
    correctAnswer: 'apple',
    supportLevel: 0 as const,
    attemptKind: 'transfer' as const
};

describe('BattleInterface productive recall combat feedback', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(Math, 'random').mockReturnValue(0.1);
        localStorage.clear();
        useGameStore.getState().resetGame();
        useGameStore.getState().startGame([typingQuestion], 'Typing Mission', 'battle');
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('shows damage feedback after a correct typing answer', async () => {
        render(<BattleInterface />);

        fireEvent.change(screen.getByPlaceholderText('Type your answer here...'), {
            target: { value: 'apple' }
        });
        fireEvent.click(screen.getByRole('button', { name: /submit answer/i }));

        await act(async () => {
            jest.advanceTimersByTime(1500);
        });

        expect(screen.getByText('-1')).toBeInTheDocument();
    });
});
