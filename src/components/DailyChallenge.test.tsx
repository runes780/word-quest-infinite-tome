import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DailyChallenge } from './DailyChallenge';
import { logLearningEvent, updatePlayerProfile } from '@/db/db';

jest.mock('@/store/settingsStore', () => ({
    useSettingsStore: () => ({
        language: 'en',
        soundEnabled: false
    })
}));

jest.mock('@/lib/audio', () => ({
    playSound: {
        click: jest.fn(),
        success: jest.fn(),
        defeat: jest.fn(),
        victory: jest.fn()
    }
}));

jest.mock('@/lib/data/fallbackQuestions', () => ({
    getBalancedFallbackQuestions: jest.fn(() => [{
        id: 101,
        type: 'vocab',
        question: 'Choose apple',
        options: ['apple', 'banana', 'orange', 'pear'],
        correct_index: 0,
        explanation: 'apple is correct',
        skillTag: 'vocab_daily'
    }])
}));

jest.mock('@/lib/data/history', () => ({
    logMissionHistory: jest.fn(async () => undefined)
}));

jest.mock('@/db/db', () => ({
    logLearningEvent: jest.fn(async () => undefined),
    updatePlayerProfile: jest.fn(async () => undefined),
    hashQuestion: jest.fn((text: string) => `daily_${text}`)
}));

describe('DailyChallenge learning pipeline regression', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        localStorage.clear();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('daily challenge answer + completion syncs to learning/profile pipeline', async () => {
        render(<DailyChallenge isOpen onClose={jest.fn()} />);

        fireEvent.click(screen.getByText('Start Challenge'));
        fireEvent.click(await screen.findByText('apple'));

        act(() => {
            jest.advanceTimersByTime(900);
        });

        await waitFor(() => {
            expect(logLearningEvent).toHaveBeenCalledWith(expect.objectContaining({
                eventType: 'answer',
                source: 'daily',
                result: 'correct',
                questionHash: 'daily_Choose apple'
            }));
        });

        await waitFor(() => {
            expect(logLearningEvent).toHaveBeenCalledWith(expect.objectContaining({
                eventType: 'session_complete',
                source: 'daily'
            }));
        });

        expect(updatePlayerProfile).toHaveBeenCalledWith(expect.objectContaining({
            lessonsCompleted: 1,
            wordsLearned: 1,
            totalStudyMinutes: 1
        }));
    });

    test('keeps an explicit exit action visible while the challenge is active', () => {
        const onClose = jest.fn();
        render(<DailyChallenge isOpen onClose={onClose} />);

        fireEvent.click(screen.getByText('Start Challenge'));
        fireEvent.click(screen.getByLabelText('Exit Daily Challenge'));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    test('keeps the challenge dialog within the viewport when content grows', () => {
        render(<DailyChallenge isOpen onClose={jest.fn()} />);

        const dialog = screen.getByRole('dialog', { name: 'Daily Challenge' });

        expect(dialog.className).toContain('max-h-[calc(100dvh-2rem)]');
        expect(dialog.className).toContain('overflow-y-auto');
    });
});
