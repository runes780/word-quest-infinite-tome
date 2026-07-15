import { act, renderHook } from '@testing-library/react';
import { playSound } from '@/lib/audio';
import { useBattleFeedback } from './useBattleFeedback';

jest.mock('@/lib/audio', () => ({
    playSound: {
        attackSlash: jest.fn(),
        attackFire: jest.fn(),
        attackZap: jest.fn(),
        coin: jest.fn(),
        crit: jest.fn(),
        hit: jest.fn()
    }
}));

describe('useBattleFeedback', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.spyOn(Math, 'random').mockReturnValue(0.1);
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    test('exposes deterministic feedback state and clears delayed work on unmount', () => {
        const { result, unmount } = renderHook(() => useBattleFeedback({
            soundEnabled: true,
            criticalLabel: 'Critical',
            weaknessLabel: 'Weakness'
        }));

        act(() => {
            result.current.triggerCorrectFeedback({
                damageDealt: 3,
                isCritical: false,
                isSuperEffective: false
            });
        });

        expect(playSound.attackSlash).toHaveBeenCalledTimes(1);
        expect(result.current.damageText[0].text).toBe('-3');
        expect(result.current.flyingCoins).toHaveLength(8);

        unmount();
        act(() => jest.runAllTimers());

        expect(playSound.hit).not.toHaveBeenCalled();
        expect(playSound.coin).not.toHaveBeenCalled();
    });

    test('keeps wrong-answer audio as an explicit immediate action', () => {
        const { result } = renderHook(() => useBattleFeedback({
            soundEnabled: true,
            criticalLabel: 'Critical',
            weaknessLabel: 'Weakness'
        }));

        act(() => result.current.markWrongFeedback());

        expect(playSound.hit).toHaveBeenCalledTimes(1);
    });
});

