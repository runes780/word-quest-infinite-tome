import type { PlayerStats } from '@/store/gameStore';

interface SkillStat {
    correct: number;
    total: number;
}

export interface BlessingCombatModifiers {
    xpMultiplier: number;
    goldMultiplier: number;
    damageMultiplier: number;
    damageTakenMultiplier: number;
    wrongAnswerXp: number;
    healOnCorrectThreshold: number;
    healAmount: number;
    goldPenalty: number;
}

export interface BlessingEffectInput {
    xpMultiplier?: number;
    goldMultiplier?: number;
    damageMultiplier?: number;
    damageTaken?: number;
    wrongAnswerXp?: number;
    shieldOnStreak?: number;
    healOnCorrect?: number;
    goldPenalty?: number;
}

export interface CorrectCombatOutcome {
    damageDealt: number;
    isCritical: boolean;
    isSuperEffective: boolean;
    nextBossShieldProgress: number;
    nextMonsterHp: number;
    scoreGain: number;
}

interface ResolveCorrectCombatInput {
    playerStats: PlayerStats;
    currentMonsterHp: number;
    bossShieldProgress: number;
    isBoss: boolean;
    damageMultiplier: number;
    bossComboThreshold: number;
    randomFn?: () => number;
}

interface ResolveWrongCombatInput {
    health: number;
    playerGold: number;
    playerXp: number;
    damageTakenMultiplier: number;
    goldPenalty: number;
    wrongAnswerXp: number;
    isBoss: boolean;
    bossShieldProgress: number;
}

export function resolveSelectedOption(optionIndex: number, options: string[], userResponse?: string): string {
    if (optionIndex >= 0 && optionIndex < options.length) {
        return options[optionIndex];
    }
    return userResponse || '[typed_response]';
}

export function buildUpdatedSkillStats(
    skillStats: Record<string, SkillStat>,
    skillKey: string,
    isCorrect: boolean
): Record<string, SkillStat> {
    const prevStats = skillStats[skillKey] || { correct: 0, total: 0 };
    return {
        ...skillStats,
        [skillKey]: {
            total: prevStats.total + 1,
            correct: prevStats.correct + (isCorrect ? 1 : 0)
        }
    };
}

export function normalizeBlessingModifiers(effect?: BlessingEffectInput | null): BlessingCombatModifiers {
    return {
        xpMultiplier: effect?.xpMultiplier ?? 1,
        goldMultiplier: effect?.goldMultiplier ?? 1,
        damageMultiplier: effect?.damageMultiplier ?? 1,
        damageTakenMultiplier: effect?.damageTaken ?? 1,
        wrongAnswerXp: effect?.wrongAnswerXp ?? 0,
        healOnCorrectThreshold: effect?.shieldOnStreak ?? 0,
        healAmount: effect?.healOnCorrect ?? 0,
        goldPenalty: effect?.goldPenalty ?? 0
    };
}

export function resolveCorrectCombat(input: ResolveCorrectCombatInput): CorrectCombatOutcome {
    const {
        playerStats,
        currentMonsterHp,
        bossShieldProgress,
        isBoss,
        damageMultiplier,
        bossComboThreshold,
        randomFn = Math.random
    } = input;
    const isCritical = playerStats.streak >= 2;
    const isSuperEffective = randomFn() > 0.8;

    let damageDealt = 0;
    let nextBossShieldProgress = bossShieldProgress;
    let nextMonsterHp = currentMonsterHp;
    if (isBoss) {
        nextBossShieldProgress = bossShieldProgress + 1;
        if (nextBossShieldProgress >= bossComboThreshold) {
            damageDealt = 1;
            nextBossShieldProgress = 0;
            nextMonsterHp = Math.max(0, currentMonsterHp - damageDealt);
        }
    } else {
        let baseDamage = 1;
        if (isCritical) baseDamage += 1;
        if (isSuperEffective) baseDamage += 1;
        damageDealt = Math.floor(baseDamage * damageMultiplier);
        nextMonsterHp = Math.max(0, currentMonsterHp - damageDealt);
        nextBossShieldProgress = 0;
    }

    return {
        damageDealt,
        isCritical,
        isSuperEffective,
        nextBossShieldProgress,
        nextMonsterHp,
        scoreGain: 10 + (isCritical ? 5 : 0) + (isSuperEffective ? 5 : 0)
    };
}

export function resolveWrongCombat(input: ResolveWrongCombatInput) {
    const damageToTake = Math.floor(1 * input.damageTakenMultiplier);
    const newHealth = Math.max(0, input.health - damageToTake);
    const nextGold = Math.max(0, input.playerGold - input.goldPenalty);
    const nextXp = input.wrongAnswerXp > 0 ? input.playerXp + input.wrongAnswerXp : input.playerXp;

    return {
        newHealth,
        isGameOver: newHealth <= 0,
        nextGold,
        nextXp,
        nextBossShieldProgress: input.isBoss ? 0 : input.bossShieldProgress
    };
}
