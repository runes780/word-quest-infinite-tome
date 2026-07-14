import type { StateCreator } from 'zustand';
import type { PlayerAchievementStats } from '@/components/AchievementSystem';
import type { GameState } from '@/store/gameStore';
import { applyGoldBonus } from '@/store/modules/economyRewards';

export interface EconomySliceDependencies {
    updateAchievementStats: (updates: Partial<PlayerAchievementStats>) => void;
}

export type EconomySlice = Pick<
    GameState,
    | 'playerStats'
    | 'inventory'
    | 'pendingRewards'
    | 'showRewardScreen'
    | 'knowledgeCards'
    | 'rootFragments'
    | 'addGold'
    | 'spendGold'
    | 'addItem'
    | 'useItem'
    | 'closeRewardScreen'
>;

export const createEconomySlice = (
    dependencies: EconomySliceDependencies
): StateCreator<GameState, [], [], EconomySlice> => (set, get) => ({
    playerStats: {
        level: 1,
        xp: 0,
        maxXp: 100,
        streak: 0,
        gold: 0
    },
    inventory: [],
    pendingRewards: [],
    showRewardScreen: false,
    knowledgeCards: [],
    rootFragments: 0,

    addGold: (amount) => set((state) => ({
        playerStats: {
            ...state.playerStats,
            gold: state.playerStats.gold + applyGoldBonus(amount, state.inventory)
        }
    })),

    spendGold: (amount) => {
        const { playerStats } = get();
        if (playerStats.gold < amount) return false;
        set({ playerStats: { ...playerStats, gold: playerStats.gold - amount } });
        return true;
    },

    addItem: (item) => {
        set((state) => ({ inventory: [...state.inventory, item] }));
        if (item.type.startsWith('relic_')) {
            const uniqueRelics = new Set(
                get().inventory
                    .filter((entry) => entry.type.startsWith('relic_'))
                    .map((entry) => entry.type)
            ).size;
            dependencies.updateAchievementStats({ relicsOwned: uniqueRelics });
        }
    },

    useItem: (itemId) => {
        const { inventory, health, maxHealth, questions, currentIndex, clarityEffect } = get();
        const itemIndex = inventory.findIndex((item) => item.id === itemId);
        if (itemIndex === -1) return;

        const item = inventory[itemIndex];
        let consumed = false;
        if (item.type === 'potion_health' && health < maxHealth) {
            set({ health: Math.min(health + 1, maxHealth) });
            consumed = true;
        } else if (item.type === 'potion_clarity') {
            const currentQuestion = questions[currentIndex];
            const alreadyApplied = clarityEffect?.questionId === currentQuestion?.id;
            if (currentQuestion && !alreadyApplied) {
                const wrongIndexes = currentQuestion.options
                    .map((_, index) => index)
                    .filter((index) => index !== currentQuestion.correct_index);
                if (wrongIndexes.length > 0) {
                    const hiddenOptions = [...wrongIndexes]
                        .sort(() => Math.random() - 0.5)
                        .slice(0, Math.min(2, wrongIndexes.length));
                    set({ clarityEffect: { questionId: currentQuestion.id, hiddenOptions } });
                    consumed = true;
                }
            }
        }

        if (!consumed) return;
        const nextInventory = [...inventory];
        nextInventory.splice(itemIndex, 1);
        set({ inventory: nextInventory });
        dependencies.updateAchievementStats({ potionsUsed: 1 });
    },

    closeRewardScreen: () => set({ showRewardScreen: false, pendingRewards: [] })
});
