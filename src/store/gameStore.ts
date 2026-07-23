
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
    LearningEventSelfConfidence,
    SkillMasteryRecord,
    MasteryState,
    updateSkillMastery,
    updateObjectiveMastery,
    upsertStudyActionExecution,
    seedSkillMasteryFromLearningEvents,
    getSkillMasteryMap,
    getSkillReviewRiskMap,
    getRecentMistakeIntensity,
    logSessionRecoveryEvent
} from '@/db/db';
import {
    applyQuestionDefaults,
    applyAdaptiveScaffoldDecision,
    applyLearningMetadataForSource,
    buildImmediateRepairQuestion,
    expandBossGateQuestions,
    computeSkillPriority as computeSkillPriorityFromModule,
    findWeakSkill,
    formatSkillLabel,
    getSkillKey,
    isMasteryUpgrade,
    type QuestionInput,
    reorderQuestionsBySkill
} from '@/store/modules/questionFlow';
import {
    completeCurrentPracticePlanStep,
    currentPracticePlanStep,
    markPracticePlanRunStepComplete,
    type PracticePlanRun
} from '@/lib/data/practicePlanRunner';
import {
    persistRevengeQueue,
    type RevengeEntry
} from '@/store/modules/revengeQueue';
import {
    RELICS,
    applyGoldBonus,
    applyProgressionReward,
    applyXpBonus,
    buildBossRewardBundle,
    craftRelic
} from '@/store/modules/economyRewards';
import {
    buildUpdatedSkillStats,
    normalizeBlessingModifiers,
    resolveCorrectCombat,
    resolveSelectedOption,
    resolveWrongCombat
} from '@/store/modules/combatResolution';
import {
    clearSavedGameStateSnapshot,
    loadSavedGameStateSnapshot,
    saveGameStateSnapshot
} from '@/store/modules/sessionRecovery';
import {
    buildAnswerLearningEvidence,
    buildUserAnswer
} from '@/store/modules/answerLearningEvidence';
import {
    planLearningProgressReward,
    type LearningProgressReward
} from '@/lib/data/learningProgressRewards';
import {
    decideAdaptiveScaffold,
    type AdaptiveScaffoldDecision,
    type ScaffoldDecisionReason,
    type ScaffoldTransition
} from '@/lib/data/adaptiveScaffolding';
import type {
    AssessmentRole,
    ContentReviewerStatus,
    EvidenceStrength,
    RetentionProbeStage,
    TransferDistance
} from '@/lib/data/learningEvidenceContract';
import type { ObjectiveClassificationStatus } from '@/lib/data/learningObjectives';
import { evidenceStrengthForAttempt } from '@/lib/data/learningEvidenceContract';
import { createCombatSlice } from '@/store/slices/combatSlice';
import { createLearningSlice } from '@/store/slices/learningSlice';
import { createEconomySlice } from '@/store/slices/economySlice';

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
export type SupportLevel = 0 | 1 | 2 | 3;
export type AttemptKind = 'diagnostic' | 'practice' | 'review' | 'transfer';

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
    objectiveConfidence?: number;
    objectiveCatalogVersion?: number;
    objectiveClassificationStatus?: ObjectiveClassificationStatus;
    evidenceContractVersion?: number;
    itemFamilyId?: string;
    contextId?: string;
    equivalenceGroup?: string;
    assessmentRole?: AssessmentRole;
    transferDistance?: TransferDistance;
    reviewerStatus?: ContentReviewerStatus;
    evidenceStrength?: EvidenceStrength;
    probeStage?: RetentionProbeStage;
    probeScheduledFor?: number;
    supportLevel?: SupportLevel;
    attemptKind?: AttemptKind;
    causeTag?: string;
    isImmediateRepair?: boolean;
    bossStage?: number;
    bossTotalStages?: number;
    sourceContextSpan?: string;
    sourceActionId?: string;
    sourceActionPriority?: 'urgent' | 'important' | 'optional';
    sourceActionEstimatedMinutes?: number;
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
export { RELICS };
export const computeSkillPriority = computeSkillPriorityFromModule;

export const BOSS_COMBO_THRESHOLD = 2;

const masteryBonusByState: Record<MasteryState, { xp: number; gold: number }> = {
    new: { xp: 0, gold: 0 },
    learning: { xp: 8, gold: 6 },
    consolidated: { xp: 16, gold: 12 },
    mastered: { xp: 24, gold: 20 }
};

export interface UserAnswer {
    questionId: number;
    questionText: string;
    userChoice: string;
    correctChoice: string;
    isCorrect: boolean;
    learningObjectiveId?: string;
    itemFamilyId?: string;
    assessmentRole?: AssessmentRole;
    evidenceStrength?: EvidenceStrength;
    attemptKind?: AttemptKind;
    supportLevel?: SupportLevel;
    causeTag?: string;
    selfConfidence?: LearningEventSelfConfidence;
    questionHash?: string;
    isImmediateRepair?: boolean;
    progressReward?: LearningProgressReward;
    hintUsed?: boolean;
    scaffoldTransition?: ScaffoldTransition;
    scaffoldReason?: ScaffoldDecisionReason;
    nextSupportLevel?: SupportLevel;
    nextAttemptKind?: AttemptKind;
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

export interface GameState {
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
    activePracticePlanRun: PracticePlanRun | null;
    activePracticePlanStepId: string | null;

    // Actions
    startGame: (questions: Monster[], context: string, source?: LearningEventSource, practicePlanRun?: PracticePlanRun | null) => void;
    answerQuestion: (optionIndex: number, meta?: { userResponse?: string; responseLatencyMs?: number; selfConfidence?: LearningEventSelfConfidence; hintUsed?: boolean }) => {
        correct: boolean;
        explanation: string;
        damageDealt: number;
        isCritical: boolean;
        isSuperEffective: boolean;
        repairQueued?: boolean;
        feedbackFocus?: string;
        progressReward: LearningProgressReward | null;
        scaffoldDecision: AdaptiveScaffoldDecision;
    };
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

export const useGameStore = create<GameState>()((set, get, store) => ({
    ...createCombatSlice(set, get, store),
    ...createLearningSlice(set, get, store),
    ...createEconomySlice({ updateAchievementStats })(set, get, store),

    startGame: (questions, context, source = 'battle', practicePlanRun = null) => {
        const revengeEntries = [...get().revengeQueue];
        const preparedRevenge = revengeEntries.map((entry, idx) =>
            applyLearningMetadataForSource(
                applyQuestionDefaults({ ...entry, id: entry.id || Date.now() + idx, sourceContextSpan: 'revenge' }, idx),
                source
            )
        );
        const preparedIncoming = questions.map((q, idx) =>
            applyLearningMetadataForSource(applyQuestionDefaults(q, preparedRevenge.length + idx), source)
        );
        const combined = expandBossGateQuestions([...preparedRevenge, ...preparedIncoming]);
        const firstHp = combined[0]?.hp || 1;
        const activePracticePlanStepId = currentPracticePlanStep(practicePlanRun)?.id || null;

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
            runObjectiveBonuses: [],
            activePracticePlanRun: practicePlanRun,
            activePracticePlanStepId
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
                set((state) => ({
                    masteryBySkill,
                    reviewRiskBySkill,
                    recentMistakeBySkill,
                    questions: state.questions.map((q) =>
                        applyLearningMetadataForSource(q, source, masteryBySkill[getSkillKey(q)])
                    )
                }));
            })
            .catch(console.error);
    },

    answerQuestion: (optionIndex, meta) => {
        const { questions, currentIndex, health, maxHealth, score, playerStats, currentMonsterHp, userAnswers, skillStats, bossShieldProgress, inventory, questionStartedAt, sessionSource, masteryBySkill, reviewRiskBySkill, recentMistakeBySkill } = get();
        const currentQuestion = questions[currentIndex];
        const isCorrect = optionIndex === currentQuestion.correct_index;
        const answerResult = isCorrect ? 'correct' : 'wrong';
        const skillKey = getSkillKey(currentQuestion);
        const responseLatencyMs = meta?.responseLatencyMs ?? Math.max(0, Date.now() - questionStartedAt);
        const selectedOption = resolveSelectedOption(optionIndex, currentQuestion.options, meta?.userResponse);
        const questionHash = hashQuestion(currentQuestion.question);
        const updatedSkillStats = buildUpdatedSkillStats(skillStats, skillKey, isCorrect);

        // Get active blessing effect
        const blessing = normalizeBlessingModifiers(getCurrentBlessingEffect());
        const rewardEvidenceStrength = evidenceStrengthForAttempt({
            learningObjectiveId: currentQuestion.learningObjectiveId,
            objectiveClassificationStatus: currentQuestion.objectiveClassificationStatus,
            assessmentRole: currentQuestion.assessmentRole,
            transferDistance: currentQuestion.transferDistance,
            reviewerStatus: currentQuestion.reviewerStatus,
            supportLevel: currentQuestion.supportLevel,
            hintUsed: meta?.hintUsed
        });
        const plannedProgressReward = planLearningProgressReward({
            source: sessionSource,
            questionHash,
            isCorrect,
            attemptKind: currentQuestion.attemptKind,
            supportLevel: currentQuestion.supportLevel,
            isImmediateRepair: currentQuestion.isImmediateRepair,
            assessmentRole: currentQuestion.assessmentRole,
            evidenceStrength: rewardEvidenceStrength,
            priorEvidence: userAnswers
        });
        const progressReward = plannedProgressReward?.counted
            ? {
                ...plannedProgressReward,
                xp: Math.floor(
                    applyXpBonus(plannedProgressReward.xp, inventory) *
                    blessing.xpMultiplier *
                    (plannedProgressReward.kind === 'repair-success' ? blessing.repairXpMultiplier : 1)
                ),
                gold: Math.floor(applyGoldBonus(plannedProgressReward.gold, inventory) * blessing.goldMultiplier)
            }
            : plannedProgressReward;

        const scaffoldDecision = decideAdaptiveScaffold({
            current: {
                learningObjectiveId: currentQuestion.learningObjectiveId,
                skillTag: currentQuestion.skillTag,
                isCorrect,
                result: answerResult,
                supportLevel: currentQuestion.supportLevel,
                attemptKind: currentQuestion.attemptKind,
                hintUsed: Boolean(meta?.hintUsed),
                isImmediateRepair: currentQuestion.isImmediateRepair
            },
            priorEvidence: userAnswers
        });

        // Record Answer
        const newAnswer = buildUserAnswer({
            question: currentQuestion,
            selectedOption,
            result: answerResult,
            selfConfidence: meta?.selfConfidence,
            questionHash,
            progressReward,
            hintUsed: meta?.hintUsed,
            scaffoldDecision
        });
        set({ userAnswers: [...userAnswers, newAnswer] });

        let damageDealt = 0;
        let isCritical = false;
        let isSuperEffective = false; // Simplified for now
        let repairQueued = false;
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
            const adaptedQuestions = applyAdaptiveScaffoldDecision(
                reorderedQuestions,
                currentIndex,
                currentQuestion,
                scaffoldDecision
            );
            const combatOutcome = resolveCorrectCombat({
                playerStats,
                currentMonsterHp,
                bossShieldProgress,
                isBoss: Boolean(currentQuestion.isBoss),
                damageMultiplier: blessing.damageMultiplier,
                bossComboThreshold: BOSS_COMBO_THRESHOLD
            });
            damageDealt = combatOutcome.damageDealt;
            isCritical = combatOutcome.isCritical;
            isSuperEffective = combatOutcome.isSuperEffective;
            nextBossShieldProgress = combatOutcome.nextBossShieldProgress;
            nextMonsterHp = combatOutcome.nextMonsterHp;

            // Learning progress evidence determines XP and gold. Combat criticals
            // still affect score and damage, but no longer inflate learning rewards.
            const xpGain = progressReward?.xp || 0;
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

            const goldGain = progressReward?.gold || 0;
            const newStreak = playerStats.streak + 1;

            set({
                score: score + combatOutcome.scoreGain,
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
                questions: adaptedQuestions,
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

            // Blessing: Heal on streak threshold (e.g., Vampiric Wisdom)
            if (blessing.healOnCorrectThreshold > 0 && blessing.healAmount > 0 && newStreak % blessing.healOnCorrectThreshold === 0) {
                get().heal(blessing.healAmount);
            }

            // Trigger Vampire Fangs relic
            if (isCritical && get().inventory.some(i => i.type === 'relic_vampire')) {
                get().heal(1);
            }
        } else {
            const wrongOutcome = resolveWrongCombat({
                health,
                playerGold: playerStats.gold,
                playerXp: playerStats.xp,
                damageTakenMultiplier: blessing.damageTakenMultiplier,
                goldPenalty: blessing.goldPenalty,
                isBoss: Boolean(currentQuestion.isBoss),
                bossShieldProgress
            });

            let nextQuestions = reorderedQuestions;
            if (!wrongOutcome.isGameOver && !currentQuestion.isImmediateRepair && !currentQuestion.isBoss) {
                const repairQuestion = applyLearningMetadataForSource(
                    buildImmediateRepairQuestion(currentQuestion, selectedOption, currentIndex + 1),
                    sessionSource,
                    masteryBySkill[skillKey]
                );
                nextQuestions = [
                    ...reorderedQuestions.slice(0, currentIndex + 1),
                    repairQuestion,
                    ...reorderedQuestions.slice(currentIndex + 1)
                ];
                repairQueued = true;
            }

            set({
                health: wrongOutcome.newHealth,
                isGameOver: wrongOutcome.isGameOver,
                playerStats: {
                    ...playerStats,
                    streak: 0,
                    gold: wrongOutcome.nextGold,
                    xp: wrongOutcome.nextXp
                },
                skillStats: updatedSkillStats,
                questions: nextQuestions,
                bossShieldProgress: wrongOutcome.nextBossShieldProgress,
                recentMistakeBySkill: {
                    ...recentMistakeBySkill,
                    [skillKey]: (recentMistakeBySkill[skillKey] || 0) + 1
                }
            });

            // Track achievement stats for wrong answer
            updateAchievementStats({
                totalWrong: 1,
                totalQuestions: 1,
                currentStreak: 0,
            });
        }

        const evidence = buildAnswerLearningEvidence({
            question: currentQuestion,
            selectedOption,
            result: answerResult,
            questionHash,
            responseLatencyMs,
            source: sessionSource,
            isCritical,
            selfConfidence: meta?.selfConfidence,
            progressReward,
            hintUsed: meta?.hintUsed,
            scaffoldDecision
        });
        if (evidence.mistake) {
            void logMistake(evidence.mistake);
        }
        reviewCard(
            evidence.review.questionHash,
            evidence.review.rating,
            evidence.review.questionData
        ).catch(console.error);
        logLearningEvent(evidence.learningEvent).catch(console.error);
        updateObjectiveMastery(evidence.objectiveMastery).catch(console.error);
        updateSkillMastery(skillKey, evidence.masteryResult)
            .then((record) => {
                const previousState = masteryBySkill[skillKey]?.state || 'new';
                const upgraded = isCorrect && isMasteryUpgrade(previousState, record.state);
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

        return {
            correct: isCorrect,
            explanation: currentQuestion.explanation,
            damageDealt,
            isCritical,
            isSuperEffective,
            repairQueued,
            feedbackFocus: repairQueued ? 'immediate_repair' : undefined,
            progressReward,
            scaffoldDecision
        };
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
            runObjectiveBonuses: [],
            activePracticePlanRun: null,
            activePracticePlanStepId: null
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
            learningObjectiveId: currentQuestion.learningObjectiveId,
            objectiveConfidence: currentQuestion.objectiveConfidence,
            sourceContextSpan: currentQuestion.sourceContextSpan,
            attemptKind: currentQuestion.attemptKind,
            supportLevel: currentQuestion.supportLevel,
            causeTag: currentQuestion.causeTag,
            mode: currentQuestion.questionMode,
            hintUsed: true,
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
        // Per-answer progress rewards already account for review, repair and
        // transfer evidence. Do not grant a second end-of-run payout for the
        // same evidence.
        set({ runObjectiveBonuses: [] });
        const activeStep = currentPracticePlanStep(state.activePracticePlanRun);
        if (state.activePracticePlanRun && activeStep?.id === state.activePracticePlanStepId) {
            set({
                activePracticePlanRun: completeCurrentPracticePlanStep(state.activePracticePlanRun),
                activePracticePlanStepId: null
            });
            markPracticePlanRunStepComplete(state.activePracticePlanRun.planId, activeStep.id, [
                {
                    label: 'Session complete',
                    value: `${totalCorrect}/${Math.max(1, totalAnswers)} correct`,
                    source: 'mastery'
                }
            ]).catch(console.error);
        }
        const sourceActionQuestion = state.questions.find((question) => question.sourceActionId);
        if (sourceActionQuestion?.sourceActionId) {
            upsertStudyActionExecution({
                actionId: sourceActionQuestion.sourceActionId,
                status: 'completed',
                priority: sourceActionQuestion.sourceActionPriority || 'important',
                estimatedMinutes: sourceActionQuestion.sourceActionEstimatedMinutes || Math.max(6, Math.round(state.questions.length * 1.5))
            }).catch(console.error);
        }
        logLearningEvent({
            eventType: 'session_complete',
            source: state.sessionSource
        }).then(() => {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('wordquest:learning-evidence-updated'));
            }
        }).catch(console.error);
    },
    // Error Recovery Methods
    hasSavedGame: () => {
        const saved = loadSavedGameStateSnapshot<Monster, PlayerStats, Item, KnowledgeCard, LearningEventSource>();
        return saved !== null && saved.questions.length > 0 && saved.currentIndex < saved.questions.length;
    },

    resumeGame: () => {
        const saved = loadSavedGameStateSnapshot<Monster, PlayerStats, Item, KnowledgeCard, LearningEventSource>();
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
        const restoredQuestions = saved.questions.map((q, idx) =>
            applyLearningMetadataForSource(applyQuestionDefaults(q, idx), saved.sessionSource)
        );
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
                set((state) => ({
                    masteryBySkill,
                    reviewRiskBySkill,
                    recentMistakeBySkill,
                    questions: state.questions.map((q) =>
                        applyLearningMetadataForSource(q, saved.sessionSource, masteryBySkill[getSkillKey(q)])
                    )
                }));
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
        clearSavedGameStateSnapshot();
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
                saveGameStateSnapshot({
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
            clearSavedGameStateSnapshot();
        }
    });
}
