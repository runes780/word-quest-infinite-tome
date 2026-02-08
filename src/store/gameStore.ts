
import { create } from 'zustand';
import { logMistake } from '@/lib/data/mistakes';
import { getCurrentBlessingEffect } from '@/components/InputSection';
import { loadPlayerStats, savePlayerStats, checkAchievements, PlayerAchievementStats, Achievement } from '@/components/AchievementSystem';
import {
    updatePlayerProfile,
    reviewCard,
    hashQuestion,
    logLearningEvent,
    LearningEventSource,
    SkillMasteryRecord,
    MasteryState,
    updateSkillMastery,
    seedSkillMasteryFromLearningEvents,
    getSkillMasteryMap,
    getSkillReviewRiskMap,
    getRecentMistakeIntensity,
    logSessionRecoveryEvent
} from '@/db/db';
import {
    applyQuestionDefaults,
    buildRunObjectiveBonuses,
    computeSkillPriority as computeSkillPriorityFromModule,
    findBreakthroughSkill,
    findWeakSkill,
    formatSkillLabel,
    getSkillKey,
    isMasteryUpgrade,
    type QuestionInput,
    reorderQuestionsBySkill
} from '@/store/modules/questionFlow';
import {
    loadInitialRevengeQueue,
    persistRevengeQueue,
    sanitizeForQueue,
    type RevengeEntry
} from '@/store/modules/revengeQueue';

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
    if (updates.relicsOwned !== undefined) newStats.relicsOwned = Math.max(newStats.relicsOwned || 0, updates.relicsOwned);
    if (updates.potionsUsed !== undefined) newStats.potionsUsed = (newStats.potionsUsed || 0) + updates.potionsUsed;
    if (updates.daysPlayed !== undefined) newStats.daysPlayed = (newStats.daysPlayed || 0) + updates.daysPlayed;
    if (updates.consecutiveDays !== undefined) newStats.consecutiveDays = updates.consecutiveDays;
    if (updates.vocabMastered !== undefined) newStats.vocabMastered = Math.max(newStats.vocabMastered || 0, updates.vocabMastered);
    if (updates.grammarMastered !== undefined) newStats.grammarMastered = Math.max(newStats.grammarMastered || 0, updates.grammarMastered);
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
    skillTag: string;
    difficulty: MonsterDifficulty;
    questionMode: QuestionMode; // Productive recall mode
    correctAnswer: string; // For typing/fill-blank questions
    learningObjectiveId?: string;
    sourceContextSpan?: string;
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
    type: 'gold' | 'relic' | 'potion' | 'card' | 'fragment' | 'objective';
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

const hasRelic = (inventory: Item[], type: ItemType) => inventory.some((item) => item.type === type);

const applyGoldBonus = (base: number, inventory: Item[]) => Math.floor(base * (hasRelic(inventory, 'relic_midas') ? 1.5 : 1));

const applyXpBonus = (base: number, inventory: Item[]) => Math.round(base * (hasRelic(inventory, 'relic_scholar') ? 1.2 : 1));
export const computeSkillPriority = computeSkillPriorityFromModule;

export const BOSS_COMBO_THRESHOLD = 2;

const masteryBonusByState: Record<MasteryState, { xp: number; gold: number }> = {
    new: { xp: 0, gold: 0 },
    learning: { xp: 8, gold: 6 },
    consolidated: { xp: 16, gold: 12 },
    mastered: { xp: 24, gold: 20 }
};

const applyProgressionReward = (stats: PlayerStats, xpGain: number, goldGain: number): PlayerStats => {
    let xp = stats.xp + xpGain;
    let level = stats.level;
    let maxXp = stats.maxXp;
    while (xp >= maxXp) {
        xp -= maxXp;
        level += 1;
        maxXp = Math.floor(maxXp * 1.2);
    }
    return {
        ...stats,
        xp,
        level,
        maxXp,
        gold: stats.gold + goldGain
    };
};


const craftRelic = (inventory: Item[]) => {
    const ownedTypes = new Set(inventory.map((item) => item.type));
    const options = RELICS.filter((relic) => !ownedTypes.has(relic.type));
    if (options.length === 0) return null;
    const relic = options[Math.floor(Math.random() * options.length)];
    return { ...relic, id: `${relic.id}_${Date.now()}` };
};

const buildBossRewardBundle = (
    inventory: Item[],
    skillStats: Record<string, { correct: number; total: number }>
): Reward[] => {
    const rewards: Reward[] = [];
    const ownedRelicTypes = new Set(inventory.map((entry) => entry.type));
    const availableRelics = RELICS.filter((relic) => !ownedRelicTypes.has(relic.type));

    const guaranteedGold = applyGoldBonus(100, inventory);
    rewards.push({
        id: `gold_${Date.now()}`,
        type: 'gold',
        value: guaranteedGold,
        icon: '💰',
        label: `${guaranteedGold} Gold`,
        description: 'Guaranteed mission payout.'
    });

    rewards.push({
        id: `fragment_${Date.now()}`,
        type: 'fragment',
        value: 2,
        icon: '🪨',
        label: 'Root Fragment x2',
        description: 'Guaranteed progression drop with crafting pity.'
    });

    const breakthrough = findBreakthroughSkill(skillStats);
    if (breakthrough) {
        rewards.push({
            id: `objective_breakthrough_${Date.now()}`,
            type: 'objective',
            value: 'weakness_breakthrough',
            icon: '🎯',
            label: 'Weakness Breakthrough',
            description: `${formatSkillLabel(breakthrough.skillTag)} stabilized at ${Math.round(breakthrough.accuracy * 100)}%.`
        });
    }

    if (availableRelics.length > 0) {
        const guaranteedRelic = availableRelics[0];
        rewards.push({
            id: `relic_${Date.now()}`,
            type: 'relic',
            value: guaranteedRelic.id,
            icon: guaranteedRelic.icon,
            label: guaranteedRelic.name,
            description: 'Guaranteed relic drop (pity protection active).'
        });
    } else {
        rewards.push({
            id: `potion_${Date.now()}`,
            type: 'potion',
            value: 'potion_clarity',
            icon: '💎',
            label: 'Clarity Potion',
            description: 'All relics collected, converted to guaranteed utility drop.'
        });
    }

    return rewards;
};


export interface UserAnswer {
    questionId: number;
    questionText: string;
    userChoice: string;
    correctChoice: string;
    isCorrect: boolean;
}

export interface MasteryCelebration {
    id: string;
    skillTag: string;
    fromState: MasteryState;
    toState: MasteryState;
    bonusXp: number;
    bonusGold: number;
    timestamp: number;
}

export interface RunObjectiveBonus {
    id: string;
    title: string;
    description: string;
    xp: number;
    gold: number;
    skillTag?: string;
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
    sessionSource: LearningEventSource;
    questionStartedAt: number;
    masteryBySkill: Record<string, SkillMasteryRecord>;
    reviewRiskBySkill: Record<string, number>;
    recentMistakeBySkill: Record<string, number>;
    masteryCelebrations: MasteryCelebration[];
    runObjectiveBonuses: RunObjectiveBonus[];

    // Actions
    startGame: (questions: Monster[], context: string, source?: LearningEventSource) => void;
    answerQuestion: (optionIndex: number, meta?: { userResponse?: string; responseLatencyMs?: number }) => { correct: boolean; explanation: string; damageDealt: number; isCritical: boolean; isSuperEffective: boolean };
    nextQuestion: () => void;
    addQuestions: (newQuestions: QuestionInput[]) => void;
    injectQuestion: (question: QuestionInput) => void;
    heal: (amount: number) => void;
    addGold: (amount: number) => void;
    spendGold: (amount: number) => boolean;
    addItem: (item: Item) => void;
    useItem: (itemId: string) => void;
    resetGame: () => void;
    generateRewards: (type: 'normal' | 'elite' | 'boss') => void;
    claimReward: (rewardId: string) => void;
    closeRewardScreen: () => void;
    recordHintUsed: () => void;
    recordRunCompletion: () => void;

    // Error Recovery
    hasSavedGame: () => boolean;
    resumeGame: () => boolean;
    clearSavedGame: () => void;
    dismissMasteryCelebration: (id: string) => void;
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
    sessionSource: LearningEventSource;
    questionStartedAt: number;
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
            sessionSource: state.sessionSource ?? existing?.sessionSource ?? 'battle',
            questionStartedAt: state.questionStartedAt ?? existing?.questionStartedAt ?? Date.now(),
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
    sessionSource: 'battle',
    questionStartedAt: Date.now(),
    masteryBySkill: {},
    reviewRiskBySkill: {},
    recentMistakeBySkill: {},
    masteryCelebrations: [],
    runObjectiveBonuses: [],

    startGame: (questions, context, source = 'battle') => {
        const revengeEntries = [...get().revengeQueue];
        const preparedRevenge = revengeEntries.map((entry, idx) =>
            applyQuestionDefaults({ ...entry, id: entry.id || Date.now() + idx, sourceContextSpan: 'revenge' }, idx)
        );
        const preparedIncoming = questions.map((q, idx) => applyQuestionDefaults(q, preparedRevenge.length + idx));
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
            rootFragments: state.rootFragments,
            sessionSource: source,
            questionStartedAt: Date.now(),
            masteryBySkill: state.masteryBySkill,
            reviewRiskBySkill: state.reviewRiskBySkill,
            recentMistakeBySkill: state.recentMistakeBySkill,
            masteryCelebrations: [],
            runObjectiveBonuses: []
        }));
        persistRevengeQueue([]);

        const allSkillTags = Array.from(new Set(combined.map((q) => getSkillKey(q))));
        seedSkillMasteryFromLearningEvents()
            .then(() => Promise.all([
                getSkillMasteryMap(allSkillTags),
                getSkillReviewRiskMap(allSkillTags),
                getRecentMistakeIntensity(allSkillTags)
            ]))
            .then(([masteryBySkill, reviewRiskBySkill, recentMistakeBySkill]) => {
                set({ masteryBySkill, reviewRiskBySkill, recentMistakeBySkill });
            })
            .catch(console.error);
    },

    answerQuestion: (optionIndex, meta) => {
        const { questions, currentIndex, health, maxHealth, score, playerStats, currentMonsterHp, userAnswers, skillStats, bossShieldProgress, inventory, questionStartedAt, sessionSource, masteryBySkill, reviewRiskBySkill, recentMistakeBySkill } = get();
        const currentQuestion = questions[currentIndex];
        const isCorrect = optionIndex === currentQuestion.correct_index;
        const skillKey = getSkillKey(currentQuestion);
        const responseLatencyMs = meta?.responseLatencyMs ?? Math.max(0, Date.now() - questionStartedAt);
        const selectedOption = optionIndex >= 0 && optionIndex < currentQuestion.options.length
            ? currentQuestion.options[optionIndex]
            : (meta?.userResponse || '[typed_response]');
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
            userChoice: selectedOption,
            correctChoice: currentQuestion.options[currentQuestion.correct_index],
            isCorrect
        };
        set({ userAnswers: [...userAnswers, newAnswer] });

        let damageDealt = 0;
        let isCritical = false;
        let isSuperEffective = false; // Simplified for now
        let nextBossShieldProgress = bossShieldProgress;
        let nextMonsterHp = currentMonsterHp;

        const reorderedQuestions = reorderQuestionsBySkill(
            questions,
            currentIndex,
            updatedSkillStats,
            masteryBySkill,
            reviewRiskBySkill,
            recentMistakeBySkill
        );

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
                bossShieldProgress: nextBossShieldProgress,
                recentMistakeBySkill: {
                    ...recentMistakeBySkill,
                    [skillKey]: Math.max(0, (recentMistakeBySkill[skillKey] || 0) - 1)
                }
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
                fastAnswers: responseLatencyMs <= 5000 ? 1 : 0,
                revengeCleared: currentQuestion.sourceContextSpan === 'revenge' ? 1 : 0
            });

            // Update global persistent profile (XP, gold, streak)
            updatePlayerProfile({
                totalXp: xpGain,
                totalGold: goldGain,
                dailyXpEarned: xpGain,
                wordsLearned: 1
            }).then((profile) => {
                updateAchievementStats({
                    consecutiveDays: profile.dailyStreak
                });
            }).catch(console.error);

            logLearningEvent({
                eventType: 'answer',
                questionId: currentQuestion.id,
                questionHash: hashQuestion(currentQuestion.question),
                skillTag: currentQuestion.skillTag,
                mode: currentQuestion.questionMode,
                result: 'correct',
                latencyMs: responseLatencyMs,
                source: sessionSource
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

            updateSkillMastery(skillKey, 'correct')
                .then((record) => {
                    const previousState = masteryBySkill[skillKey]?.state || 'new';
                    const upgraded = isMasteryUpgrade(previousState, record.state);
                    const rewardPayload = upgraded ? masteryBonusByState[record.state] : null;
                    const celebration: MasteryCelebration | null = rewardPayload
                        ? {
                            id: `mastery_${skillKey}_${Date.now()}`,
                            skillTag: skillKey,
                            fromState: previousState,
                            toState: record.state,
                            bonusXp: rewardPayload.xp,
                            bonusGold: rewardPayload.gold,
                            timestamp: Date.now()
                        }
                        : null;

                    set((state) => ({
                        masteryBySkill: {
                            ...state.masteryBySkill,
                            [skillKey]: record
                        },
                        ...(rewardPayload && celebration
                            ? {
                                playerStats: applyProgressionReward(state.playerStats, rewardPayload.xp, rewardPayload.gold),
                                masteryCelebrations: [...state.masteryCelebrations, celebration]
                            }
                            : {})
                    }));
                    if (rewardPayload) {
                        updateAchievementStats({
                            totalGoldEarned: rewardPayload.gold,
                            totalXpEarned: rewardPayload.xp
                        });
                        updatePlayerProfile({
                            totalXp: rewardPayload.xp,
                            totalGold: rewardPayload.gold,
                            dailyXpEarned: rewardPayload.xp
                        }).catch(console.error);
                    }
                })
                .catch(console.error);

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
                bossShieldProgress: currentQuestion.isBoss ? 0 : bossShieldProgress,
                recentMistakeBySkill: {
                    ...recentMistakeBySkill,
                    [skillKey]: (recentMistakeBySkill[skillKey] || 0) + 1
                }
            });

            logMistake({
                questionId: currentQuestion.id,
                questionText: currentQuestion.question,
                wrongAnswer: selectedOption,
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

            updateSkillMastery(skillKey, 'wrong')
                .then((record) => {
                    set((state) => ({
                        masteryBySkill: {
                            ...state.masteryBySkill,
                            [skillKey]: record
                        }
                    }));
                })
                .catch(console.error);

            logLearningEvent({
                eventType: 'answer',
                questionId: currentQuestion.id,
                questionHash: hashQuestion(currentQuestion.question),
                skillTag: currentQuestion.skillTag,
                mode: currentQuestion.questionMode,
                result: 'wrong',
                latencyMs: responseLatencyMs,
                source: sessionSource
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
        const processedQuestions = newQuestions.map((q, idx) => applyQuestionDefaults(q, questions.length + idx));
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
                clarityEffect: null,
                questionStartedAt: Date.now()
            });
        } else {
            // Endless Mode Trigger would go here
            set({ isVictory: true });
        }
    },

    injectQuestion: (question) => {
        const { questions, currentIndex } = get();
        const newQuestions = [...questions];
        newQuestions.splice(currentIndex + 1, 0, applyQuestionDefaults(question, currentIndex + 1));
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

    addItem: (item) => {
        set((state) => ({
            inventory: [...state.inventory, item]
        }));
        if (item.type.startsWith('relic_')) {
            const nextInventory = [...get().inventory];
            const uniqueRelics = new Set(nextInventory.filter((entry) => entry.type.startsWith('relic_')).map((entry) => entry.type)).size;
            updateAchievementStats({ relicsOwned: uniqueRelics });
        }
    },

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
            if (item.type === 'potion_health' || item.type === 'potion_clarity') {
                updateAchievementStats({ potionsUsed: 1 });
            }
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
            rootFragments: state.rootFragments,
            sessionSource: 'battle',
            questionStartedAt: Date.now(),
            masteryCelebrations: [],
            runObjectiveBonuses: []
        })),

    generateRewards: (type) => {
        const { playerStats, inventory, skillStats } = get();
        let rewards: Reward[] = [];

        if (type === 'boss') {
            rewards = buildBossRewardBundle(inventory, skillStats);
        } else {
            const baseGold = type === 'elite' ? 50 : 20;
            const goldAmount = applyGoldBonus(baseGold, inventory);
            rewards.push({
                id: `gold_${Date.now()}`,
                type: 'gold',
                value: goldAmount,
                icon: '💰',
                label: `${goldAmount} Gold`,
                description: 'Guaranteed mission payout.'
            });

            const weakSkill = findWeakSkill(skillStats);
            if (weakSkill && playerStats.streak >= 2) {
                rewards.push({
                    id: `card_${Date.now()}`,
                    type: 'card',
                    value: { skillTag: weakSkill, hint: formatSkillLabel(weakSkill) },
                    icon: '📘',
                    label: `Knowledge Card: ${formatSkillLabel(weakSkill)}`,
                    description: 'Targeted practice reward for current weakness.'
                });
            }

            rewards.push({
                id: `fragment_${Date.now()}`,
                type: 'fragment',
                value: playerStats.streak >= 3 ? 2 : 1,
                icon: '🪨',
                label: `Root Fragment x${playerStats.streak >= 3 ? 2 : 1}`,
                description: 'Guaranteed progression drop.'
            });

            if (playerStats.streak >= 3) {
                rewards.push({
                    id: `potion_${Date.now()}`,
                    type: 'potion',
                    value: 'potion_health',
                    icon: '❤️',
                    label: 'Health Potion',
                    description: 'Streak guarantee reward.'
                });
            }
        }

        set({ pendingRewards: rewards, showRewardScreen: true });
    },

    claimReward: (rewardId) => {
        const { pendingRewards, playerStats, inventory } = get();
        const reward = pendingRewards.find(r => r.id === rewardId);
        if (!reward) return;

        if (reward.type === 'gold') {
            const goldValue = Number(reward.value || 0);
            set({ playerStats: { ...playerStats, gold: playerStats.gold + goldValue } });
            updateAchievementStats({ totalGoldEarned: goldValue });
            updatePlayerProfile({ totalGold: goldValue }).catch(console.error);
        } else if (reward.type === 'relic') {
            const relic = RELICS.find(r => r.id === reward.value);
            if (relic) {
                set({ inventory: [...inventory, { ...relic, id: `${relic.id}_${Date.now()}` }] });
                const uniqueRelics = new Set(
                    [...inventory, relic]
                        .filter((entry) => entry.type.startsWith('relic_'))
                        .map((entry) => entry.type)
                ).size;
                updateAchievementStats({ relicsOwned: uniqueRelics });
            }
        } else if (reward.type === 'potion') {
            const potionType = reward.value === 'potion_clarity' ? 'potion_clarity' : 'potion_health';
            const potionName = potionType === 'potion_clarity' ? 'Clarity Potion' : 'Health Potion';
            const potionDescription = potionType === 'potion_clarity' ? 'Hides wrong options once' : 'Restores 1 Heart';
            const potion: Item = {
                id: `potion_${Date.now()}`,
                type: potionType,
                name: potionName,
                description: potionDescription,
                cost: 50,
                icon: potionType === 'potion_clarity' ? '💎' : '❤️'
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
                        const uniqueRelics = new Set(
                            newInventory
                                .filter((entry) => entry.type.startsWith('relic_'))
                                .map((entry) => entry.type)
                        ).size;
                        updateAchievementStats({ relicsOwned: uniqueRelics });
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
        } else if (reward.type === 'objective') {
            const objectiveRewards = {
                weakness_breakthrough: { xp: 24, gold: 18 }
            } as const;
            const payload = objectiveRewards[String(reward.value) as keyof typeof objectiveRewards];
            if (payload) {
                set((state) => ({
                    playerStats: applyProgressionReward(state.playerStats, payload.xp, payload.gold)
                }));
                updateAchievementStats({
                    totalGoldEarned: payload.gold,
                    totalXpEarned: payload.xp
                });
                updatePlayerProfile({
                    totalXp: payload.xp,
                    totalGold: payload.gold,
                    dailyXpEarned: payload.xp
                }).catch(console.error);
            }
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
    recordHintUsed: () => {
        updateAchievementStats({ hintsUsed: 1 });
        const state = get();
        const currentQuestion = state.questions[state.currentIndex];
        if (!currentQuestion) return;
        logLearningEvent({
            eventType: 'hint',
            questionId: currentQuestion.id,
            questionHash: hashQuestion(currentQuestion.question),
            skillTag: currentQuestion.skillTag,
            mode: currentQuestion.questionMode,
            source: state.sessionSource
        }).catch(console.error);
    },
    recordRunCompletion: () => {
        const state = get();
        const totalAnswers = state.userAnswers.length;
        const totalCorrect = state.userAnswers.filter((answer) => answer.isCorrect).length;
        const isPerfect = totalAnswers > 0 && totalCorrect === totalAnswers;
        const masteredSkills = Object.entries(state.skillStats)
            .filter(([, value]) => value.total >= 3 && value.correct / value.total >= 0.8)
            .map(([key]) => key);
        const vocabMastered = masteredSkills.filter((skill) => skill.startsWith('vocab')).length;
        const grammarMastered = masteredSkills.filter((skill) => skill.startsWith('grammar')).length;
        updateAchievementStats({
            levelsCompleted: 1,
            perfectRuns: isPerfect ? 1 : 0,
            vocabMastered,
            grammarMastered
        });
        const objectiveBonuses = buildRunObjectiveBonuses(state.sessionSource, state.skillStats, state.userAnswers);
        if (objectiveBonuses.length > 0) {
            const totalObjectiveXp = objectiveBonuses.reduce((sum, bonus) => sum + bonus.xp, 0);
            const totalObjectiveGold = objectiveBonuses.reduce((sum, bonus) => sum + bonus.gold, 0);
            set((current) => ({
                playerStats: applyProgressionReward(current.playerStats, totalObjectiveXp, totalObjectiveGold),
                runObjectiveBonuses: objectiveBonuses
            }));
            updateAchievementStats({
                totalGoldEarned: totalObjectiveGold,
                totalXpEarned: totalObjectiveXp
            });
            updatePlayerProfile({
                totalXp: totalObjectiveXp,
                totalGold: totalObjectiveGold,
                dailyXpEarned: totalObjectiveXp
            }).catch(console.error);
        } else {
            set({ runObjectiveBonuses: [] });
        }
        logLearningEvent({
            eventType: 'session_complete',
            source: state.sessionSource
        }).catch(console.error);
    },
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
        const savedAgeMs = saved ? Math.max(0, Date.now() - saved.savedAt) : undefined;
        void logSessionRecoveryEvent('attempt', {
            hasSave: Boolean(saved),
            savedAgeMs
        });
        if (!saved || saved.questions.length === 0) {
            void logSessionRecoveryEvent('failure', {
                hasSave: false,
                reason: 'missing_save',
                savedAgeMs
            });
            return false;
        }
        const restoredQuestions = saved.questions.map((q, idx) => applyQuestionDefaults(q, idx));
        const allSkillTags = Array.from(new Set(restoredQuestions.map((q) => getSkillKey(q))));

        set({
            health: saved.health,
            maxHealth: saved.maxHealth,
            score: saved.score,
            questions: restoredQuestions,
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
            clarityEffect: null,
            sessionSource: saved.sessionSource,
            questionStartedAt: saved.questionStartedAt,
            masteryBySkill: {},
            reviewRiskBySkill: {},
            recentMistakeBySkill: {},
            masteryCelebrations: [],
            runObjectiveBonuses: []
        });

        seedSkillMasteryFromLearningEvents()
            .then(() => Promise.all([
                getSkillMasteryMap(allSkillTags),
                getSkillReviewRiskMap(allSkillTags),
                getRecentMistakeIntensity(allSkillTags)
            ]))
            .then(([masteryBySkill, reviewRiskBySkill, recentMistakeBySkill]) => {
                set({ masteryBySkill, reviewRiskBySkill, recentMistakeBySkill });
            })
            .catch(console.error);
        void logSessionRecoveryEvent('success', {
            hasSave: true,
            savedAgeMs
        });
        console.log('[Recovery] Game resumed from saved state');
        return true;
    },

    clearSavedGame: () => {
        clearGameState();
    },

    dismissMasteryCelebration: (id) => set((state) => ({
        masteryCelebrations: state.masteryCelebrations.filter((entry) => entry.id !== id)
    }))
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
                    rootFragments: state.rootFragments,
                    sessionSource: state.sessionSource,
                    questionStartedAt: state.questionStartedAt
                });
            }, 1000);
        }

        // Clear saved game when game ends
        if ((state.isGameOver || state.isVictory) && !prevState.isGameOver && !prevState.isVictory) {
            clearGameState();
        }
    });
}
