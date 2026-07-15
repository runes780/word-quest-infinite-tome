import { act, renderHook } from '@testing-library/react';
import type { GameState, Monster } from '@/store/gameStore';
import { useBattleAnswerFlow } from './useBattleAnswerFlow';

const question: Monster = {
    id: 1,
    type: 'vocab',
    question: 'Choose apple.',
    options: ['apple', 'banana', 'orange', 'pear'],
    correct_index: 0,
    explanation: 'apple is correct',
    skillTag: 'vocab_core',
    difficulty: 'medium',
    questionMode: 'choice',
    correctAnswer: 'apple'
};

const correctResult: ReturnType<GameState['answerQuestion']> = {
    correct: true,
    explanation: 'apple is correct',
    damageDealt: 1,
    isCritical: false,
    isSuperEffective: false,
    progressReward: {
        kind: 'independent-success',
        xp: 12,
        gold: 6,
        counted: true
    }
};

function setup(overrides: Partial<Parameters<typeof useBattleAnswerFlow>[0]> = {}) {
    const answerQuestion = jest.fn(() => correctResult);
    const recordHintUsed = jest.fn();
    const onAnswerRecorded = jest.fn();
    const markWrongFeedback = jest.fn();
    const triggerCorrectFeedback = jest.fn();
    const options: Parameters<typeof useBattleAnswerFlow>[0] = {
        currentQuestion: question,
        language: 'en',
        health: 3,
        masteryBySkill: {},
        reviewRiskBySkill: {},
        recentMistakeBySkill: {},
        answerQuestion,
        recordHintUsed,
        onAnswerRecorded,
        markWrongFeedback,
        triggerCorrectFeedback,
        ...overrides
    };

    return {
        ...renderHook(() => useBattleAnswerFlow(options)),
        answerQuestion,
        recordHintUsed,
        onAnswerRecorded,
        markWrongFeedback,
        triggerCorrectFeedback
    };
}

describe('useBattleAnswerFlow', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test('records one productive answer and forwards the store result to combat feedback', () => {
        const flow = setup();

        act(() => flow.result.current.handleTextQuestionAnswer(true, 'apple'));

        expect(flow.answerQuestion).toHaveBeenCalledWith(0, { userResponse: 'apple' });
        expect(flow.onAnswerRecorded).toHaveBeenCalledTimes(1);
        expect(flow.triggerCorrectFeedback).toHaveBeenCalledWith(correctResult);
        expect(flow.result.current.showResult).toBe(true);
        expect(flow.result.current.selectedOption).toBe(0);
        expect(flow.result.current.progressReward).toEqual(correctResult.progressReward);
    });

    test('records hint use only when opening the hint', () => {
        const flow = setup();

        act(() => flow.result.current.toggleHint());
        act(() => flow.result.current.toggleHint());

        expect(flow.recordHintUsed).toHaveBeenCalledTimes(1);
        expect(flow.result.current.showHint).toBe(false);
    });

    test('forwards optional confidence with the answer and clears it for the next question', () => {
        const flow = setup();

        act(() => flow.result.current.setSelfConfidence('high'));
        act(() => flow.result.current.handleOptionClick(0));

        expect(flow.answerQuestion).toHaveBeenCalledWith(0, { selfConfidence: 'high' });
        expect(flow.result.current.selfConfidence).toBe('high');

        act(() => flow.result.current.resetAnswerState());
        expect(flow.result.current.selfConfidence).toBeUndefined();
        expect(flow.result.current.progressReward).toBeNull();
    });

    test('opens mentor support after a high-value mistake and clears the timer on unmount', () => {
        const wrongResult = { ...correctResult, correct: false };
        const answerQuestion = jest.fn(() => wrongResult);
        const flow = setup({
            answerQuestion,
            masteryBySkill: {
                vocab_core: {
                    skillTag: 'vocab_core',
                    score: 0,
                    state: 'new',
                    attempts: 1,
                    correct: 0,
                    lastReviewedAt: 1,
                    updatedAt: 1
                }
            }
        });

        act(() => flow.result.current.handleOptionClick(1));
        act(() => jest.advanceTimersByTime(1500));

        expect(flow.markWrongFeedback).toHaveBeenCalledTimes(1);
        expect(flow.result.current.showMentor).toBe(true);

        flow.unmount();
        expect(() => jest.runAllTimers()).not.toThrow();
    });
});
