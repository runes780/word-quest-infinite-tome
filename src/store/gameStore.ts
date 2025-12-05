
import { create } from 'zustand';
import { logMistake } from '@/lib/data/mistakes';
import { getCurrentBlessingEffect } from '@/components/InputSection';
import { loadPlayerStats, savePlayerStats, checkAchievements, PlayerAchievementStats, Achievement } from '@/components/AchievementSystem';
import { updatePlayerProfile, reviewCard, hashQuestion } from '@/db/db';

// Achievement stats update helper
let pendingAchievements: Achievement[] = [];
export function getPendingAchievements() {
    const achievements = [...pendingAchievements];
    pendingAchievements = [];
    return achievements;
}

function updateAchievementStats(updates: Partial<PlayerAchievementStats>) {
    const stats = loadPlayerStats();
    const newStats = { ...stats };

    // Apply updates (increment values)
    if (updates.totalCorrect !== undefined) newStats.totalCorrect = (newStats.totalCorrect || 0) + updates.totalCorrect;
    if (updates.totalWrong !== undefined) newStats.totalWrong = (newStats.totalWrong || 0) + updates.totalWrong;
    if (updates.totalQuestions !== undefined) newStats.totalQuestions = (newStats.totalQuestions || 0) + updates.totalQuestions;
    if (updates.totalCriticals !== undefined) newStats.totalCriticals = (newStats.totalCriticals || 0) + updates.totalCriticals;
    if (updates.totalGoldEarned !== undefined) newStats.totalGoldEarned = (newStats.totalGoldEarned || 0) + updates.totalGoldEarned;
    if (updates.totalXpEarned !== undefined) newStats.totalXpEarned = (newStats.totalXpEarned || 0) + updates.totalXpEarned;
    if (updates.bossesDefeated !== undefined) newStats.bossesDefeated = (newStats.bossesDefeated || 0) + updates.bossesDefeated;
    if (updates.perfectRuns !== undefined) newStats.perfectRuns = (newStats.perfectRuns || 0) + updates.perfectRuns;
    if (updates.potionsUsed !== undefined) newStats.potionsUsed = (newStats.potionsUsed || 0) + updates.potionsUsed;
    if (updates.fastAnswers !== undefined) newStats.fastAnswers = (newStats.fastAnswers || 0) + updates.fastAnswers;
    if (updates.hintsUsed !== undefined) newStats.hintsUsed = (newStats.hintsUsed || 0) + updates.hintsUsed;
    if (updates.revengeCleared !== undefined) newStats.revengeCleared = (newStats.revengeCleared || 0) + updates.revengeCleared;
    if (updates.levelsCompleted !== undefined) newStats.levelsCompleted = (newStats.levelsCompleted || 0) + updates.levelsCompleted;

    // Update max streak if current streak is higher
    if (updates.currentStreak !== undefined) {
        newStats.currentStreak = updates.currentStreak;
        if (newStats.currentStreak > newStats.maxStreak) {
            newStats.maxStreak = newStats.currentStreak;
        }
    }

    savePlayerStats(newStats);

    // Check for newly unlocked achievements
    const newlyUnlocked = checkAchievements(newStats);
    if (newlyUnlocked.length > 0) {
        pendingAchievements.push(...newlyUnlocked);
    }
}

export type MonsterDifficulty = 'easy' | 'medium' | 'hard';

// Question mode for productive recall
export type QuestionMode = 'choice' | 'typing' | 'fill-blank';

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
    questionMode?: QuestionMode; // Productive recall mode
    correctAnswer?: string; // For typing/fill-blank questions
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
    type: 'gold' | 'relic' | 'potion' | 'card' | 'fragment';
    value: number | string | KnowledgeCardReward;
    icon: string;
    label: string;
    description?: string;
}

export interface KnowledgeCardReward {
    skillTag: string;
    hint: string;
}

export interface KnowledgeCard {
    id: string;
    skillTag: string;
    hint: string;
    createdAt: number;
}

export const CRAFT_THRESHOLD = 5;

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

const hasRelic = (inventory: Item[], type: ItemType) => inventory.some((item) => item.type === type);

const applyGoldBonus = (base: number, inventory: Item[]) => Math.floor(base * (hasRelic(inventory, 'relic_midas') ? 1.5 : 1));

const applyXpBonus = (base: number, inventory: Item[]) => Math.round(base * (hasRelic(inventory, 'relic_scholar') ? 1.2 : 1));

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

export const BOSS_COMBO_THRESHOLD = 2;

const formatSkillLabel = (skill: string) => skill.replace(/_/g, ' ');

const findWeakSkill = (stats: Record<string, { correct: number; total: number }>) => {
    const sorted = Object.entries(stats)
        .filter(([, value]) => value.total >= 1)
        .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total));
    return sorted[0]?.[0];
};

const craftRelic = (inventory: Item[]) => {
    const ownedTypes = new Set(inventory.map((item) => item.type));
    const options = RELICS.filter((relic) => !ownedTypes.has(relic.type));
    if (options.length === 0) return null;
    const relic = options[Math.floor(Math.random() * options.length)];
    return { ...relic, id: `${relic.id}_${Date.now()}` };
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
    bossShieldProgress: number;
    clarityEffect: { questionId: number; hiddenOptions: number[] } | null;
    knowledgeCards: KnowledgeCard[];
    rootFragments: number;

    // Actions
    startGame: (questions: Monster[], context: string) => void;
    answerQuestion: (optionIndex: number) => { correct: boolean; explanation: string; damageDealt: number; isCritical: boolean; isSuperEffective: boolean };
    nextQuestion: () => void;
    addQuestions: (newQuestions: Monster[]) => void;
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

    // Error Recovery
    hasSavedGame: () => boolean;
    resumeGame: () => boolean;
    clearSavedGame: () => void;
}

// Game state persistence for error recovery
const GAME_STATE_KEY = 'word-quest-game-state';

interface SavedGameState {
    health: number;
    maxHealth: number;
    score: number;
    questions: Monster[];
    currentIndex: number;
    playerStats: PlayerStats;
    currentMonsterHp: number;
    context: string;
    inventory: Item[];
    skillStats: Record<string, { correct: number; total: number }>;
    bossShieldProgress: number;
    knowledgeCards: KnowledgeCard[];
    rootFragments: number;
    savedAt: number;
}

function saveGameState(state: Partial<SavedGameState>) {
    if (typeof window === 'undefined') return;
    try {
        const existing = loadSavedGameState();
        const toSave: SavedGameState = {
            health: state.health ?? existing?.health ?? 3,
            maxHealth: state.maxHealth ?? existing?.maxHealth ?? 3,
            score: state.score ?? existing?.score ?? 0,
            questions: state.questions ?? existing?.questions ?? [],
            currentIndex: state.currentIndex ?? existing?.currentIndex ?? 0,
            playerStats: state.playerStats ?? existing?.playerStats ?? { level: 1, xp: 0, maxXp: 100, streak: 0, gold: 0 },
            currentMonsterHp: state.currentMonsterHp ?? existing?.currentMonsterHp ?? 1,
            context: state.context ?? existing?.context ?? '',
            inventory: state.inventory ?? existing?.inventory ?? [],
            skillStats: state.skillStats ?? existing?.skillStats ?? {},
            bossShieldProgress: state.bossShieldProgress ?? existing?.bossShieldProgress ?? 0,
            knowledgeCards: state.knowledgeCards ?? existing?.knowledgeCards ?? [],
            rootFragments: state.rootFragments ?? existing?.rootFragments ?? 0,
            savedAt: Date.now()
        };
        // Only save if there's an active game
        if (toSave.questions.length > 0 && toSave.currentIndex < toSave.questions.length) {
            window.localStorage.setItem(GAME_STATE_KEY, JSON.stringify(toSave));
            console.log('[Recovery] Game state saved');
        }
    } catch (error) {
        console.error('[Recovery] Failed to save game state:', error);
    }
}

function loadSavedGameState(): SavedGameState | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = window.localStorage.getItem(GAME_STATE_KEY);
        if (!raw) return null;
        const saved = JSON.parse(raw) as SavedGameState;
        // Check if save is less than 24 hours old
        if (Date.now() - saved.savedAt > 24 * 60 * 60 * 1000) {
            window.localStorage.removeItem(GAME_STATE_KEY);
            return null;
        }
        return saved;
    } catch (error) {
        console.error('[Recovery] Failed to load game state:', error);
        return null;
    }
}

function clearGameState() {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(GAME_STATE_KEY);
        console.log('[Recovery] Game state cleared');
    } catch (error) {
        console.error('[Recovery] Failed to clear game state:', error);
    }
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
    bossShieldProgress: 0,
    clarityEffect: null,
    knowledgeCards: [],
    rootFragments: 0,

    startGame: (questions, context) => {
        const revengeEntries = [...get().revengeQueue];
        const preparedRevenge = revengeEntries.map((entry, idx) => applyQuestionDefaults({ ...entry, id: entry.id || Date.now() + idx }));
        const preparedIncoming = questions.map((q) => applyQuestionDefaults(q));
        const combined = [...preparedRevenge, ...preparedIncoming];
        const firstHp = combined[0]?.hp || 1;

        set((state) => ({
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
            revengeQueue: [],
            bossShieldProgress: 0,
            clarityEffect: null,
            knowledgeCards: state.knowledgeCards,
            rootFragments: state.rootFragments
        }));
        persistRevengeQueue([]);
    },

    answerQuestion: (optionIndex) => {
        const { questions, currentIndex, health, maxHealth, score, playerStats, currentMonsterHp, userAnswers, skillStats, bossShieldProgress, inventory } = get();
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

        // Get active blessing effect
        const blessingEffect = getCurrentBlessingEffect();
        const xpMultiplier = blessingEffect?.xpMultiplier ?? 1;
        const goldMultiplier = blessingEffect?.goldMultiplier ?? 1;
        const damageMultiplier = blessingEffect?.damageMultiplier ?? 1;
        const damageTakenMultiplier = blessingEffect?.damageTaken ?? 1;
        const wrongAnswerXp = blessingEffect?.wrongAnswerXp ?? 0;
        const healOnCorrectThreshold = blessingEffect?.shieldOnStreak ?? 0;
        const healAmount = blessingEffect?.healOnCorrect ?? 0;
        const goldPenalty = blessingEffect?.goldPenalty ?? 0;

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
        let nextBossShieldProgress = bossShieldProgress;
        let nextMonsterHp = currentMonsterHp;

        const reorderedQuestions = reorderBySkill(questions, currentIndex, updatedSkillStats);

        if (isCorrect) {
            // RPG Logic
            isCritical = playerStats.streak >= 2;
            // 20% chance for Super Effective (Weakness Exploit) if not critical, or bonus if critical
            isSuperEffective = Math.random() > 0.8;

            let baseDamage = 1;
            if (isCritical) baseDamage += 1;
            if (isSuperEffective) baseDamage += 1;

            if (currentQuestion.isBoss) {
                nextBossShieldProgress = bossShieldProgress + 1;
                damageDealt = 0;
                if (nextBossShieldProgress >= BOSS_COMBO_THRESHOLD) {
                    damageDealt = 1;
                    nextBossShieldProgress = 0;
                    nextMonsterHp = Math.max(0, currentMonsterHp - damageDealt);
                } else {
                    nextMonsterHp = currentMonsterHp;
                }
            } else {
                // Apply blessing damage multiplier
                damageDealt = Math.floor(baseDamage * damageMultiplier);
                nextMonsterHp = Math.max(0, currentMonsterHp - damageDealt);
                nextBossShieldProgress = 0;
            }

            // XP Calculation with blessing multiplier
            const xpBase = 20 + (isCritical ? 10 : 0);
            const xpGain = Math.floor(applyXpBonus(xpBase, inventory) * xpMultiplier);
            let newXp = playerStats.xp + xpGain;
            let newLevel = playerStats.level;
            let newMaxXp = playerStats.maxXp;

            // Level Up Logic
            if (newXp >= playerStats.maxXp) {
                newLevel++;
                newXp -= playerStats.maxXp;
                newMaxXp = Math.floor(newMaxXp * 1.2);
                // Full Heal on Level Up
                set({ health: maxHealth });
            }

            // Gold calculation with blessing multiplier
            const goldBase = 15 + (isCritical ? 10 : 0);
            const goldGain = Math.floor(applyGoldBonus(goldBase, inventory) * goldMultiplier);
            const newStreak = playerStats.streak + 1;

            set({
                score: score + 10 + (isCritical ? 5 : 0) + (isSuperEffective ? 5 : 0),
                currentMonsterHp: nextMonsterHp,
                playerStats: {
                    ...playerStats,
                    xp: newXp,
                    level: newLevel,
                    maxXp: newMaxXp,
                    streak: newStreak,
                    gold: playerStats.gold + goldGain
                },
                skillStats: updatedSkillStats,
                questions: reorderedQuestions,
                bossShieldProgress: nextBossShieldProgress
            });

            // Track achievement stats
            updateAchievementStats({
                totalCorrect: 1,
                totalQuestions: 1,
                totalGoldEarned: goldGain,
                totalXpEarned: xpGain,
                totalCriticals: isCritical ? 1 : 0,
                currentStreak: newStreak,
                bossesDefeated: (nextMonsterHp <= 0 && currentQuestion.isBoss) ? 1 : 0,
            });

            // Update global persistent profile (XP, gold, streak)
            updatePlayerProfile({
                totalXp: xpGain,
                totalGold: goldGain,
                dailyXpEarned: xpGain,
                wordsLearned: 1
            }).catch(console.error);

            // Update FSRS card scheduling (mark as 'good' for correct answer)
            const questionHash = hashQuestion(currentQuestion.question);
            reviewCard(questionHash, isCritical ? 'easy' : 'good', {
                question: currentQuestion.question,
                options: currentQuestion.options,
                correct_index: currentQuestion.correct_index,
                type: currentQuestion.type,
                explanation: currentQuestion.explanation,
                hint: currentQuestion.hint,
                skillTag: currentQuestion.skillTag
            }).catch(console.error);

            // Blessing: Heal on streak threshold (e.g., Vampiric Wisdom)
            if (healOnCorrectThreshold > 0 && healAmount > 0 && newStreak % healOnCorrectThreshold === 0) {
                get().heal(healAmount);
            }

            // Trigger Vampire Fangs relic
            if (isCritical && get().inventory.some(i => i.type === 'relic_vampire')) {
                get().heal(1);
            }
        } else {
            // Apply blessing damage taken multiplier (e.g., Perfectionist's Burden takes double damage)
            const damageToTake = Math.floor(1 * damageTakenMultiplier);
            const newHealth = Math.max(0, health - damageToTake);

            // Apply gold penalty if blessing has it (e.g., Fortune Seeker)
            const goldAfterPenalty = Math.max(0, playerStats.gold - goldPenalty);

            // Apply XP on wrong answer if blessing allows (e.g., Quick Learner)
            const newXp = wrongAnswerXp > 0 ? playerStats.xp + wrongAnswerXp : playerStats.xp;

            set({
                health: newHealth,
                isGameOver: newHealth <= 0,
                playerStats: {
                    ...playerStats,
                    streak: 0,
                    gold: goldAfterPenalty,
                    xp: newXp
                },
                skillStats: updatedSkillStats,
                questions: reorderedQuestions,
                bossShieldProgress: currentQuestion.isBoss ? 0 : bossShieldProgress
            });

            logMistake({
                questionId: currentQuestion.id,
                questionText: currentQuestion.question,
                wrongAnswer: currentQuestion.options[optionIndex],
                correctAnswer: currentQuestion.options[currentQuestion.correct_index],
                explanation: currentQuestion.explanation,
                options: currentQuestion.options,
                correctIndex: currentQuestion.correct_index,
                type: currentQuestion.type,
                skillTag: currentQuestion.skillTag
            });

            // Track achievement stats for wrong answer
            updateAchievementStats({
                totalWrong: 1,
                totalQuestions: 1,
                currentStreak: 0,
            });

            // Update FSRS card scheduling (mark as 'again' for wrong answer)
            const questionHash = hashQuestion(currentQuestion.question);
            reviewCard(questionHash, 'again', {
                question: currentQuestion.question,
                options: currentQuestion.options,
                correct_index: currentQuestion.correct_index,
                type: currentQuestion.type,
                explanation: currentQuestion.explanation,
                hint: currentQuestion.hint,
                skillTag: currentQuestion.skillTag
            }).catch(console.error);
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
        const processedQuestions = newQuestions.map(q => applyQuestionDefaults(q));
        set({ questions: [...questions, ...processedQuestions] });
    },

    nextQuestion: () => {
        const { currentIndex, questions, currentMonsterHp } = get();
        const currentQuestion = questions[currentIndex];
        if (currentQuestion?.isBoss && currentMonsterHp > 0) {
            return;
        }

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
                currentMonsterHp: nextMonster.hp || 1,
                bossShieldProgress: 0,
                clarityEffect: null
            });
        } else {
            // Endless Mode Trigger would go here
            set({ isVictory: true });
        }
    },

    injectQuestion: (question) => {
        const { questions, currentIndex } = get();
        const newQuestions = [...questions];
        newQuestions.splice(currentIndex + 1, 0, applyQuestionDefaults(question));
        set({ questions: newQuestions });
    },

    heal: (amount) => set((state) => ({
        health: Math.min(state.health + amount, state.maxHealth)
    })),

    addGold: (amount) => set((state) => ({
        playerStats: { ...state.playerStats, gold: state.playerStats.gold + applyGoldBonus(amount, state.inventory) }
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
        const { inventory, health, maxHealth, questions, currentIndex, clarityEffect } = get();
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
            const currentQuestion = questions[currentIndex];
            if (currentQuestion) {
                const alreadyApplied = clarityEffect && clarityEffect.questionId === currentQuestion.id;
                if (!alreadyApplied) {
                    const wrongIndexes = currentQuestion.options
                        .map((_, idx) => idx)
                        .filter(idx => idx !== currentQuestion.correct_index);
                    if (wrongIndexes.length > 0) {
                        const shuffled = [...wrongIndexes].sort(() => Math.random() - 0.5);
                        const hidden = shuffled.slice(0, Math.min(2, shuffled.length));
                        set({ clarityEffect: { questionId: currentQuestion.id, hiddenOptions: hidden } });
                        consumed = true;
                    }
                }
            }
        }

        if (consumed) {
            const newInventory = [...inventory];
            newInventory.splice(itemIndex, 1);
            set({ inventory: newInventory });
        }
    },

    resetGame: () => set((state) => ({
        questions: [],
        health: 3,
        score: 0,
        currentIndex: 0,
        isGameOver: false,
        isVictory: false,
        pendingRewards: [],
        showRewardScreen: false,
        bossShieldProgress: 0,
        clarityEffect: null,
        knowledgeCards: state.knowledgeCards,
        rootFragments: state.rootFragments
    })),

    generateRewards: (type) => {
        const rewards: Reward[] = [];
        const { playerStats, inventory, skillStats } = get();

        // Gold Reward
        const baseGold = type === 'boss' ? 100 : type === 'elite' ? 50 : 20;
        const goldAmount = applyGoldBonus(baseGold, inventory);

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

        const weakSkill = findWeakSkill(skillStats);
        if ((type === 'boss' || playerStats.streak >= 3) && weakSkill) {
            rewards.push({
                id: `card_${Date.now()}`,
                type: 'card',
                value: { skillTag: weakSkill, hint: formatSkillLabel(weakSkill) },
                icon: '📘',
                label: `Knowledge Card: ${formatSkillLabel(weakSkill)}`,
                description: 'Adds a targeted review card based on your weakest skill.'
            });
        }

        const fragmentsAwarded = type === 'boss' ? 2 : playerStats.streak >= 3 ? 2 : 1;
        if (fragmentsAwarded > 0) {
            rewards.push({
                id: `fragment_${Date.now()}`,
                type: 'fragment',
                value: fragmentsAwarded,
                icon: '🪨',
                label: `Root Fragment x${fragmentsAwarded}`,
                description: 'Collect fragments to craft rare relics. Perfekt streaks grant extras.'
            });
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
        } else if (reward.type === 'card') {
            const knowledgeValue = reward.value as KnowledgeCardReward;
            const card: KnowledgeCard = {
                id: reward.id,
                skillTag: knowledgeValue.skillTag,
                hint: knowledgeValue.hint,
                createdAt: Date.now()
            };
            set((state) => ({ knowledgeCards: [...state.knowledgeCards, card] }));
            const question = get().questions.find((q) => getSkillKey(q) === knowledgeValue.skillTag);
            if (question) {
                get().addToRevengeQueue(question);
            }
        } else if (reward.type === 'fragment') {
            const fragmentsToAdd = Number(reward.value || 0);
            set((state) => {
                let newFragments = state.rootFragments + fragmentsToAdd;
                let newInventory = [...state.inventory];
                const extraRewards: Reward[] = [];

                while (newFragments >= CRAFT_THRESHOLD) {
                    newFragments -= CRAFT_THRESHOLD;
                    const crafted = craftRelic(newInventory);
                    if (crafted) {
                        newInventory = [...newInventory, crafted];
                        extraRewards.push({
                            id: `crafted_${crafted.id}`,
                            type: 'relic',
                            value: crafted.type,
                            icon: crafted.icon,
                            label: `Crafted ${crafted.name}`,
                            description: 'Automatic relic crafted from root fragments.'
                        });
                    } else {
                        break;
                    }
                }

                const pending = extraRewards.length > 0 ? [...state.pendingRewards, ...extraRewards] : state.pendingRewards;

                return {
                    rootFragments: newFragments,
                    inventory: newInventory,
                    pendingRewards: pending,
                    showRewardScreen: extraRewards.length > 0 ? true : state.showRewardScreen
                };
            });
        }

        // Remove claimed reward from latest state
        set((state) => {
            const remaining = state.pendingRewards.filter(r => r.id !== rewardId);
            return {
                pendingRewards: remaining,
                showRewardScreen: state.showRewardScreen && remaining.length > 0
            };
        });
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
    },

    // Error Recovery Methods
    hasSavedGame: () => {
        const saved = loadSavedGameState();
        return saved !== null && saved.questions.length > 0 && saved.currentIndex < saved.questions.length;
    },

    resumeGame: () => {
        const saved = loadSavedGameState();
        if (!saved || saved.questions.length === 0) return false;

        set({
            health: saved.health,
            maxHealth: saved.maxHealth,
            score: saved.score,
            questions: saved.questions,
            currentIndex: saved.currentIndex,
            isGameOver: false,
            isVictory: false,
            playerStats: saved.playerStats,
            currentMonsterHp: saved.currentMonsterHp,
            context: saved.context,
            inventory: saved.inventory,
            skillStats: saved.skillStats,
            bossShieldProgress: saved.bossShieldProgress,
            knowledgeCards: saved.knowledgeCards,
            rootFragments: saved.rootFragments,
            userAnswers: [],
            pendingRewards: [],
            showRewardScreen: false,
            clarityEffect: null
        });
        console.log('[Recovery] Game resumed from saved state');
        return true;
    },

    clearSavedGame: () => {
        clearGameState();
    }
}));

// Auto-save game state after every action that modifies important state
// Subscribe to store changes and save periodically
if (typeof window !== 'undefined') {
    let saveTimeout: ReturnType<typeof setTimeout> | null = null;

    useGameStore.subscribe((state, prevState) => {
        // Only save if there's an active game and something important changed
        if (state.questions.length > 0 &&
            !state.isGameOver &&
            !state.isVictory &&
            (state.currentIndex !== prevState.currentIndex ||
                state.health !== prevState.health ||
                state.score !== prevState.score ||
                state.inventory !== prevState.inventory)) {

            // Debounce saves to avoid too frequent writes
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                saveGameState({
                    health: state.health,
                    maxHealth: state.maxHealth,
                    score: state.score,
                    questions: state.questions,
                    currentIndex: state.currentIndex,
                    playerStats: state.playerStats,
                    currentMonsterHp: state.currentMonsterHp,
                    context: state.context,
                    inventory: state.inventory,
                    skillStats: state.skillStats,
                    bossShieldProgress: state.bossShieldProgress,
                    knowledgeCards: state.knowledgeCards,
                    rootFragments: state.rootFragments
                });
            }, 1000);
        }

        // Clear saved game when game ends
        if ((state.isGameOver || state.isVictory) && !prevState.isGameOver && !prevState.isVictory) {
            clearGameState();
        }
    });
}
