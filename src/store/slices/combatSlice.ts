import type { StateCreator } from 'zustand';
import type { GameState } from '@/store/gameStore';

export type CombatSlice = Pick<
    GameState,
    | 'health'
    | 'maxHealth'
    | 'score'
    | 'currentIndex'
    | 'isGameOver'
    | 'isVictory'
    | 'currentMonsterHp'
    | 'bossShieldProgress'
    | 'clarityEffect'
    | 'questionStartedAt'
    | 'nextQuestion'
    | 'heal'
>;

export const createCombatSlice: StateCreator<GameState, [], [], CombatSlice> = (set, get) => ({
    health: 3,
    maxHealth: 3,
    score: 0,
    currentIndex: 0,
    isGameOver: false,
    isVictory: false,
    currentMonsterHp: 1,
    bossShieldProgress: 0,
    clarityEffect: null,
    questionStartedAt: Date.now(),

    nextQuestion: () => {
        const { currentIndex, questions, currentMonsterHp } = get();
        const currentQuestion = questions[currentIndex];
        if (currentQuestion?.isBoss && currentMonsterHp > 0) return;

        if (currentIndex < questions.length - 1) {
            const nextIndex = currentIndex + 1;
            const nextMonster = questions[nextIndex];
            set({
                currentIndex: nextIndex,
                currentMonsterHp: nextMonster.hp || 1,
                bossShieldProgress: 0,
                clarityEffect: null,
                questionStartedAt: Date.now()
            });
            return;
        }

        set({ isVictory: true });
    },

    heal: (amount) => set((state) => ({
        health: Math.min(state.health + amount, state.maxHealth)
    }))
});
