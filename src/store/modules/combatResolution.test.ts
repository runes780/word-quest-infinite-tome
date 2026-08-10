import {
    buildUpdatedSkillStats,
    normalizeBlessingModifiers,
    resolveCorrectCombat,
    resolveSelectedOption,
    resolveWrongCombat
} from '@/store/modules/combatResolution';

describe('combatResolution', () => {
    it('resolves selected option with fallback text for typing', () => {
        expect(resolveSelectedOption(1, ['A', 'B', 'C', 'D'])).toBe('B');
        expect(resolveSelectedOption(-1, ['A', 'B', 'C', 'D'], 'classroom')).toBe('classroom');
        expect(resolveSelectedOption(-1, ['A', 'B', 'C', 'D'])).toBe('[typed_response]');
    });

    it('updates skill stats consistently', () => {
        const next = buildUpdatedSkillStats({ vocab: { correct: 1, total: 2 } }, 'vocab', true);
        expect(next.vocab).toEqual({ correct: 2, total: 3 });
    });

    it('normalizes blessing defaults', () => {
        expect(normalizeBlessingModifiers()).toEqual({
            xpMultiplier: 1,
            goldMultiplier: 1,
            damageMultiplier: 1,
            damageTakenMultiplier: 1,
            repairXpMultiplier: 1,
            healOnCorrectThreshold: 0,
            healAmount: 0,
            goldPenalty: 0
        });
    });

    it('resolves non-boss correct combat outcome', () => {
        const outcome = resolveCorrectCombat({
            playerStats: { level: 1, xp: 0, maxXp: 100, streak: 2, gold: 0 },
            currentMonsterHp: 3,
            bossShieldProgress: 0,
            isBoss: false,
            damageMultiplier: 1,
            bossComboThreshold: 2,
            randomFn: () => 0.9
        });

        expect(outcome.isCritical).toBe(true);
        expect(outcome.isSuperEffective).toBe(true);
        expect(outcome.damageDealt).toBe(3);
        expect(outcome.nextMonsterHp).toBe(0);
        expect(outcome.nextBossShieldProgress).toBe(0);
        expect(outcome.scoreGain).toBe(25); // 10 base + 5 critical + 5 superEffective + 5 lucky (0.9 > 0.85)
    });

    it('resolves boss shield accumulation and break', () => {
        const keepShield = resolveCorrectCombat({
            playerStats: { level: 1, xp: 0, maxXp: 100, streak: 0, gold: 0 },
            currentMonsterHp: 2,
            bossShieldProgress: 0,
            isBoss: true,
            damageMultiplier: 1,
            bossComboThreshold: 2,
            randomFn: () => 0
        });
        expect(keepShield.damageDealt).toBe(0);
        expect(keepShield.nextBossShieldProgress).toBe(1);
        expect(keepShield.nextMonsterHp).toBe(2);

        const breakShield = resolveCorrectCombat({
            playerStats: { level: 1, xp: 0, maxXp: 100, streak: 0, gold: 0 },
            currentMonsterHp: 2,
            bossShieldProgress: 1,
            isBoss: true,
            damageMultiplier: 1,
            bossComboThreshold: 2,
            randomFn: () => 0
        });
        expect(breakShield.damageDealt).toBe(1);
        expect(breakShield.nextBossShieldProgress).toBe(0);
        expect(breakShield.nextMonsterHp).toBe(1);
    });

    it('resolves wrong combat penalties', () => {
        const outcome = resolveWrongCombat({
            health: 3,
            playerGold: 10,
            playerXp: 5,
            damageTakenMultiplier: 2,
            goldPenalty: 4,
            isBoss: true,
            bossShieldProgress: 1
        });

        expect(outcome.newHealth).toBe(1);
        expect(outcome.isGameOver).toBe(false);
        expect(outcome.nextGold).toBe(6);
        expect(outcome.nextXp).toBe(5);
        expect(outcome.nextBossShieldProgress).toBe(0);
    });

    describe('resolveCorrectCombat — lucky', () => {
        const baseInput = {
            playerStats: { level: 1, xp: 0, maxXp: 100, streak: 0, gold: 0 },
            currentMonsterHp: 5,
            bossShieldProgress: 0,
            isBoss: false,
            damageMultiplier: 1,
            bossComboThreshold: 2,
        };

        test('isLucky is true when randomFn > 0.85', () => {
            const out = resolveCorrectCombat({ ...baseInput, randomFn: () => 0.9 });
            expect(out.isLucky).toBe(true);
        });

        test('isLucky is false when randomFn <= 0.85', () => {
            const out = resolveCorrectCombat({ ...baseInput, randomFn: () => 0.5 });
            expect(out.isLucky).toBe(false);
        });

        test('lucky grants a score bonus', () => {
            const lucky = resolveCorrectCombat({ ...baseInput, randomFn: () => 0.9 });
            const normal = resolveCorrectCombat({ ...baseInput, randomFn: () => 0.5 });
            expect(lucky.scoreGain).toBeGreaterThan(normal.scoreGain);
        });

        test('lucky does not change damage (reward bonus, not a damage event)', () => {
            // Compare 0.9 (lucky + superEffective) vs 0.82 (not-lucky + superEffective)
            // Both have superEffective so both do +1 damage, proving lucky doesn't affect damage
            const lucky = resolveCorrectCombat({ ...baseInput, randomFn: () => 0.9 });
            const notLucky = resolveCorrectCombat({ ...baseInput, randomFn: () => 0.82 });
            expect(lucky.damageDealt).toBe(notLucky.damageDealt); // Both: 1 base + 1 superEffective = 2
            expect(lucky.isLucky).toBe(true);
            expect(notLucky.isLucky).toBe(false);
            expect(lucky.isSuperEffective).toBe(true);
            expect(notLucky.isSuperEffective).toBe(true);
        });
    });
});
