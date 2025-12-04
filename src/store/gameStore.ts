
import { create } from 'zustand';
import { logMistake } from '@/lib/data/mistakes';

export type MonsterDifficulty = 'easy' | 'medium' | 'hard';

export interface Monster {
    id: number;
    type: 'vocab' | 'grammar' | 'reading';
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
    hint?: string;
    hp?: number; // Monster HP (default 1)
    maxHp?: number;
    element?: 'fire' | 'water' | 'grass'; // Elemental type
    isBoss?: boolean;
    skillTag?: string;
    difficulty?: MonsterDifficulty;
}

export interface PlayerStats {
    level: number;
    xp: number;
    maxXp: number;
    streak: number;
    gold: number;
}

export type ItemType = 'potion_health' | 'potion_clarity' | 'relic_vampire' | 'relic_midas' | 'relic_scholar';

export interface Item {
    id: string;
    type: ItemType;
    name: string;
    description: string;
    cost: number;
    icon: string;
}

export interface Reward {
    id: string;
    type: 'gold' | 'relic' | 'potion' | 'card';
    value: number | string; // Amount for gold, Item ID for others
    icon: string;
    label: string;
    description?: string;
}

export const RELICS: Item[] = [
    {
        id: 'relic_vampire',
        type: 'relic_vampire',
        name: 'Vampire Fangs',
        description: 'Heal 1 HP on Critical Hit',
        cost: 150,
        icon: '🧛'
    },
    {
        id: 'relic_midas',
        type: 'relic_midas', // Need to add to ItemType
        name: 'Hand of Midas',
        description: '+50% Gold from all sources',
        cost: 200,
        icon: '✋'
    },
    {
        id: 'relic_scholar',
        type: 'relic_scholar', // Need to add to ItemType
        name: 'Scholar\'s Lens',
        description: '+20% XP gain',
        cost: 120,
        icon: '👓'
    }
];

type RevengeEntry = Pick<Monster, 'id' | 'type' | 'question' | 'options' | 'correct_index' | 'explanation' | 'hint' | 'skillTag' | 'difficulty'>;

const REVENGE_STORAGE_KEY = 'word-quest-revenge';

const loadInitialRevengeQueue = (): RevengeEntry[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(REVENGE_STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch (error) {
        console.error('Failed to load revenge queue', error);
        return [];
    }
};

const persistRevengeQueue = (entries: RevengeEntry[]) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(REVENGE_STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
        console.error('Failed to persist revenge queue', error);
    }
};

const sanitizeForQueue = (question: Monster): RevengeEntry => ({
    id: Date.now(),
    type: question.type,
    question: question.question,
    options: question.options,
    correct_index: question.correct_index,
    explanation: question.explanation,
    hint: question.hint,
    skillTag: question.skillTag,
    difficulty: question.difficulty
});

const applyQuestionDefaults = (question: Partial<Monster> & { id: number; type: Monster['type']; question: string; options: string[]; correct_index: number; explanation: string; }) => ({
    ...question,
    skillTag: question.skillTag || `${question.type}_core`,
    difficulty: question.difficulty || 'medium',
    hp: question.isBoss ? 3 : 1,
    maxHp: question.isBoss ? 3 : 1,
    element: question.type === 'grammar' ? 'water' : question.type === 'vocab' ? 'fire' : 'grass'
}) as Monster;

const getSkillKey = (question: Monster) => question.skillTag || `${question.type}_${question.difficulty || 'medium'}`;

const accuracyFor = (stats: Record<string, { correct: number; total: number }>, question: Monster) => {
    const key = getSkillKey(question);
    const data = stats[key];
    if (!data || data.total === 0) return 0;
    return data.correct / data.total;
};

const reorderBySkill = (questions: Monster[], currentIndex: number, stats: Record<string, { correct: number; total: number }>) => {
    if (currentIndex >= questions.length - 1) return questions;
    const head = questions.slice(0, currentIndex + 1);
    const tail = [...questions.slice(currentIndex + 1)];
    tail.sort((a, b) => accuracyFor(stats, a) - accuracyFor(stats, b));
    return [...head, ...tail];
};

const getSkillKey = (question: Monster) => question.skillTag || `${question.type}_${question.difficulty || 'medium'}`;

const accuracyFor = (stats: Record<string, { correct: number; total: number }>, question: Monster) => {
    const key = getSkillKey(question);
    const data = stats[key];
    if (!data || data.total === 0) return 0;
    return data.correct / data.total;
};

const reorderBySkill = (
    questions: Monster[],
    currentIndex: number,
    stats: Record<string, { correct: number; total: number }>
) => {
    if (currentIndex >= questions.length - 1) return questions;
    const before = questions.slice(0, currentIndex + 1);
    const tail = [...questions.slice(currentIndex + 1)];
    tail.sort((a, b) => accuracyFor(stats, a) - accuracyFor(stats, b));
    return [...before, ...tail];
};

export interface UserAnswer {
    questionId: number;
    questionText: string;
    userChoice: string;
    correctChoice: string;
    isCorrect: boolean;
}

interface GameState {
    health: number;
    maxHealth: number;
    score: number;
    questions: Monster[];
    currentIndex: number;
    isGameOver: boolean;
    isVictory: boolean;

    // RPG Stats
    playerStats: PlayerStats;
    currentMonsterHp: number;
    context: string; // Store the study material for endless generation
    inventory: Item[];
    userAnswers: UserAnswer[];
    pendingRewards: Reward[];
    showRewardScreen: boolean;
    skillStats: Record<string, { correct: number; total: number }>;
    revengeQueue: RevengeEntry[];
    addToRevengeQueue: (question: Monster) => void;


    // Actions
    startGame: (questions: Monster[], context: string) => void;
    answerQuestion: (optionIndex: number) => { correct: boolean; explanation: string; damageDealt: number; isCritical: boolean; isSuperEffective: boolean };
    nextQuestion: () => void;
    addQuestions: (newQuestions: Monster[]) => void; // For Endless Mode
    injectQuestion: (question: Monster) => void;
    heal: (amount: number) => void;
    addGold: (amount: number) => void;
    spendGold: (amount: number) => boolean;
    addItem: (item: Item) => void;
    useItem: (itemId: string) => void;
    resetGame: () => void;
    generateRewards: (type: 'normal' | 'elite' | 'boss') => void;
    claimReward: (rewardId: string) => void;
    closeRewardScreen: () => void;
}

export const useGameStore = create<GameState>((set, get) => ({
    health: 3,
    maxHealth: 3,
    score: 0,
    questions: [],
    currentIndex: 0,
    isGameOver: false,
    isVictory: false,

    playerStats: {
        level: 1,
        xp: 0,
        maxXp: 100,
        streak: 0,
        gold: 0
    },
    currentMonsterHp: 1,
    context: '',
    inventory: [],
    userAnswers: [],
    pendingRewards: [],
    showRewardScreen: false,
    skillStats: {},
    revengeQueue: loadInitialRevengeQueue(),

    startGame: (questions, context) => {
        const revengeEntries = [...get().revengeQueue];
        const preparedRevenge = revengeEntries.map((entry, idx) => applyQuestionDefaults({ ...entry, id: entry.id || Date.now() + idx }));
        const preparedIncoming = questions.map((q) => applyQuestionDefaults(q));
        const combined = [...preparedRevenge, ...preparedIncoming];
        const firstHp = combined[0]?.hp || 1;

        set({
            questions: combined,
            health: 3,
            score: 0,
            currentIndex: 0,
            isGameOver: false,
            isVictory: false,
            playerStats: { level: 1, xp: 0, maxXp: 100, streak: 0, gold: 0 },
            currentMonsterHp: firstHp,
            context,
            inventory: [],
            userAnswers: [],
            pendingRewards: [],
            showRewardScreen: false,
            skillStats: {},
            revengeQueue: []
        });
        persistRevengeQueue([]);
    },

    answerQuestion: (optionIndex) => {
        const { questions, currentIndex, health, score, playerStats, currentMonsterHp, userAnswers, skillStats } = get();
        const currentQuestion = questions[currentIndex];
        const isCorrect = optionIndex === currentQuestion.correct_index;
        const skillKey = getSkillKey(currentQuestion);
        const prevStats = skillStats[skillKey] || { correct: 0, total: 0 };
        const updatedSkillStats = {
            ...skillStats,
            [skillKey]: {
                total: prevStats.total + 1,
                correct: prevStats.correct + (isCorrect ? 1 : 0)
            }
        };

        // Record Answer
        const newAnswer: UserAnswer = {
            questionId: currentQuestion.id,
            questionText: currentQuestion.question,
            userChoice: currentQuestion.options[optionIndex],
            correctChoice: currentQuestion.options[currentQuestion.correct_index],
            isCorrect
        };
        set({ userAnswers: [...userAnswers, newAnswer] });

        let damageDealt = 0;
        let isCritical = false;
        let isSuperEffective = false; // Simplified for now

        const reorderedQuestions = reorderBySkill(questions, currentIndex, updatedSkillStats);

        if (isCorrect) {
            // RPG Logic
            isCritical = playerStats.streak >= 2;
            // 20% chance for Super Effective (Weakness Exploit) if not critical, or bonus if critical
            isSuperEffective = Math.random() > 0.8;

            let baseDamage = 1;
            if (isCritical) baseDamage += 1;
            if (isSuperEffective) baseDamage += 1;

            damageDealt = baseDamage;

            const newMonsterHp = Math.max(0, currentMonsterHp - damageDealt);

            // XP Calculation
            const xpGain = 20 + (isCritical ? 10 : 0);
            let newXp = playerStats.xp + xpGain;
            let newLevel = playerStats.level;
            let newMaxXp = playerStats.maxXp;

            // Level Up Logic
            if (newXp >= playerStats.maxXp) {
                newLevel++;
                newXp -= playerStats.maxXp;
                newMaxXp = Math.floor(newMaxXp * 1.2);
                // Full Heal on Level Up
                set({ health: 3 });
            }

            set({
                score: score + 10 + (isCritical ? 5 : 0) + (isSuperEffective ? 5 : 0),
                currentMonsterHp: newMonsterHp,
                playerStats: {
                    ...playerStats,
                    xp: newXp,
                    level: newLevel,
                    maxXp: newMaxXp,
                    streak: playerStats.streak + 1,
                    gold: playerStats.gold + Math.floor((15 + (isCritical ? 10 : 0)) * (playerStats.gold > 0 && get().inventory.some(i => i.type === 'relic_midas') ? 1.5 : 1))
                },
                skillStats: updatedSkillStats,
                questions: reorderedQuestions
            });

            // Trigger Vampire Fangs
            if (isCritical && get().inventory.some(i => i.type === 'relic_vampire')) {
                get().heal(1);
            }
        } else {
            const newHealth = health - 1;
            set({
                health: newHealth,
                isGameOver: newHealth <= 0,
                playerStats: {
                    ...playerStats,
                    streak: 0
                },
                skillStats: updatedSkillStats,
                questions: reorderedQuestions
            });

            logMistake({
                questionId: currentQuestion.id,
                questionText: currentQuestion.question,
                wrongAnswer: currentQuestion.options[optionIndex],
                correctAnswer: currentQuestion.options[currentQuestion.correct_index],
                explanation: currentQuestion.explanation,
                options: currentQuestion.options,
                correctIndex: currentQuestion.correct_index,
                type: currentQuestion.type
            });
        }

        return {
            correct: isCorrect,
            explanation: currentQuestion.explanation,
            damageDealt,
            isCritical,
            isSuperEffective
        };
    },

    addQuestions: (newQuestions) => {
        const { questions } = get();
        // Process new questions to add RPG stats
        const processedQuestions = newQuestions.map(q => ({
            ...q,
            hp: q.isBoss ? 3 : 1,
            maxHp: q.isBoss ? 3 : 1,
            element: (q.type === 'grammar' ? 'water' : q.type === 'vocab' ? 'fire' : 'grass') as 'fire' | 'water' | 'grass',
            skillTag: q.skillTag || `${q.type}_core`,
            difficulty: q.difficulty || 'medium'
        }));
        set({ questions: [...questions, ...processedQuestions] });
    },

    nextQuestion: () => {
        const { currentIndex, questions, currentMonsterHp } = get();

        // Only proceed if monster is defeated (HP <= 0) or if it was a wrong answer (game flow choice)
        // Actually, for this game, we usually move on after feedback. 
        // But with Bosses, we might want to stay on the same question?
        // For MVP, let's assume "Next Question" means "Next Encounter".
        // If Boss HP > 0, we might need to regenerate the question or just keep attacking?
        // Let's simplify: A "Boss" is just a sequence of questions? 
        // OR: A Boss Question requires 3 correct answers to *pass*.
        // If we answer correctly but Boss HP > 0, we stay on the same question?
        // No, that's boring. 
        // Better: A Boss Fight is a series of 3 questions.
        // BUT the data structure is 1 question = 1 monster.
        // So "Boss HP" implies we stay on this index?
        // Let's implement: If HP > 0, we stay on index, but we need a NEW question for the same monster?
        // That's complex.
        // Alternative: Boss HP is just visual flavor for now, or we just move on.
        // Let's stick to: 1 Question = 1 Monster for now to avoid breaking the loop.
        // We can add "Multi-stage Bosses" later where 1 Boss = 3 Questions in the array.

        if (currentIndex < questions.length - 1) {
            const nextIndex = currentIndex + 1;
            const nextMonster = questions[nextIndex];
            set({
                currentIndex: nextIndex,
                currentMonsterHp: nextMonster.hp || 1
            });
        } else {
            // Endless Mode Trigger would go here
            set({ isVictory: true });
        }
    },

    injectQuestion: (question) => {
        const { questions, currentIndex } = get();
        const newQuestions = [...questions];
        newQuestions.splice(currentIndex + 1, 0, question);
        set({ questions: newQuestions });
    },

    heal: (amount) => set((state) => ({
        health: Math.min(state.health + amount, state.maxHealth)
    })),

    addGold: (amount) => set((state) => ({
        playerStats: { ...state.playerStats, gold: state.playerStats.gold + amount }
    })),

    spendGold: (amount) => {
        const { playerStats } = get();
        if (playerStats.gold >= amount) {
            set({ playerStats: { ...playerStats, gold: playerStats.gold - amount } });
            return true;
        }
        return false;
    },

    addItem: (item) => set((state) => ({
        inventory: [...state.inventory, item]
    })),

    useItem: (itemId) => {
        const { inventory, health, maxHealth } = get();
        const itemIndex = inventory.findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;

        const item = inventory[itemIndex];
        let consumed = false;

        if (item.type === 'potion_health') {
            if (health < maxHealth) {
                set({ health: Math.min(health + 1, maxHealth) });
                consumed = true;
            }
        } else if (item.type === 'potion_clarity') {
            // Logic handled in UI or we need a state for "clarity active"
            // For simplicity, let's say it heals for now or we add a "activeEffects" state later
            // Let's make clarity potion just heal 2 for MVP to avoid complex UI logic changes right now
            // Or better: Clarity Potion removes 2 wrong answers. This needs UI state.
            // Let's stick to Health Potion for now and add Clarity later if needed.
            // Actually, let's implement Clarity as "Heal 2" for now to keep it simple? No, that's confusing.
            // Let's just implement Health Potion logic here.
        }

        if (consumed) {
            const newInventory = [...inventory];
            newInventory.splice(itemIndex, 1);
            set({ inventory: newInventory });
        }
    },

    resetGame: () => set({
        questions: [],
        health: 3,
        score: 0,
        currentIndex: 0,
        isGameOver: false,
        isVictory: false,
        pendingRewards: [],
        showRewardScreen: false
    }),

    generateRewards: (type) => {
        const rewards: Reward[] = [];
        const { playerStats, inventory } = get();

        // Gold Reward
        const baseGold = type === 'boss' ? 100 : type === 'elite' ? 50 : 20;
        const goldAmount = Math.floor(baseGold * (inventory.some(i => i.type === 'relic_midas') ? 1.5 : 1));

        rewards.push({
            id: `gold_${Date.now()}`,
            type: 'gold',
            value: goldAmount,
            icon: '💰',
            label: `${goldAmount} Gold`,
            description: 'Currency for the shop'
        });

        // Relic Reward (Guaranteed for Boss, Chance for others)
        if (type === 'boss' || (type === 'elite' && Math.random() > 0.5)) {
            // Find unowned relics
            const ownedRelicTypes = new Set(inventory.map(i => i.type));
            const availableRelics = RELICS.filter(r => !ownedRelicTypes.has(r.type));

            if (availableRelics.length > 0) {
                const randomRelic = availableRelics[Math.floor(Math.random() * availableRelics.length)];
                rewards.push({
                    id: `relic_${Date.now()}`,
                    type: 'relic',
                    value: randomRelic.id,
                    icon: randomRelic.icon,
                    label: randomRelic.name,
                    description: randomRelic.description
                });
            }
        }

        // Potion Reward (Chance)
        if (Math.random() > 0.3) {
            rewards.push({
                id: `potion_${Date.now()}`,
                type: 'potion',
                value: 'potion_health',
                icon: '❤️',
                label: 'Health Potion',
                description: 'Restores 1 Heart'
            });
        }

        set({ pendingRewards: rewards, showRewardScreen: true });
    },

    claimReward: (rewardId) => {
        const { pendingRewards, playerStats, inventory } = get();
        const reward = pendingRewards.find(r => r.id === rewardId);
        if (!reward) return;

        if (reward.type === 'gold') {
            set({ playerStats: { ...playerStats, gold: playerStats.gold + (reward.value as number) } });
        } else if (reward.type === 'relic') {
            const relic = RELICS.find(r => r.id === reward.value);
            if (relic) {
                set({ inventory: [...inventory, { ...relic, id: `${relic.id}_${Date.now()}` }] });
            }
        } else if (reward.type === 'potion') {
            // Simplified potion adding
            const potion: Item = {
                id: `potion_${Date.now()}`,
                type: 'potion_health',
                name: 'Health Potion',
                description: 'Restores 1 Heart',
                cost: 50,
                icon: '❤️'
            };
            set({ inventory: [...inventory, potion] });
        }

        // Remove claimed reward
        set({ pendingRewards: pendingRewards.filter(r => r.id !== rewardId) });
    },

    closeRewardScreen: () => set({ showRewardScreen: false, pendingRewards: [] }),
    addToRevengeQueue: (question) => {
        set((state) => {
            const entry = sanitizeForQueue(question);
            const exists = state.revengeQueue.some((q) => q.question === entry.question && q.correct_index === entry.correct_index);
            if (exists) return state;
            const updated = [...state.revengeQueue, entry].slice(-10);
            persistRevengeQueue(updated);
            return { revengeQueue: updated };
        });
    }
}));
