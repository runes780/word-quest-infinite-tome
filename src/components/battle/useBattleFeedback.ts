'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { playSound } from '@/lib/audio';

export type BattleAttackType = 'slash' | 'fireball' | 'lightning';

export interface BattleParticle {
    id: number;
    x: number;
    y: number;
    color: string;
}

export interface BattleDamageText {
    id: number;
    x: number;
    y: number;
    text: string;
    color: string;
    scale: number;
    rotate: number;
}

export interface FlyingCoin {
    id: number;
    delay: number;
}

interface CorrectCombatResult {
    damageDealt: number;
    isCritical: boolean;
    isSuperEffective: boolean;
}

interface BattleFeedbackOptions {
    soundEnabled: boolean;
    criticalLabel: string;
    weaknessLabel: string;
}

export function useBattleFeedback({
    soundEnabled,
    criticalLabel,
    weaknessLabel
}: BattleFeedbackOptions) {
    const [attackType, setAttackType] = useState<BattleAttackType>('slash');
    const [particles, setParticles] = useState<BattleParticle[]>([]);
    const [damageText, setDamageText] = useState<BattleDamageText[]>([]);
    const [flyingCoins, setFlyingCoins] = useState<FlyingCoin[]>([]);
    const [comboScale, setComboScale] = useState(1);
    const [goldScale, setGoldScale] = useState(1);
    const timers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

    const schedule = useCallback((callback: () => void, delay: number) => {
        const timer = setTimeout(() => {
            timers.current.delete(timer);
            callback();
        }, delay);
        timers.current.add(timer);
        return timer;
    }, []);

    useEffect(() => () => {
        timers.current.forEach(clearTimeout);
        timers.current.clear();
    }, []);

    const markWrongFeedback = useCallback(() => {
        if (soundEnabled) playSound.hit();
    }, [soundEnabled]);

    const triggerCorrectFeedback = useCallback((result: CorrectCombatResult) => {
        const types: BattleAttackType[] = ['slash', 'fireball', 'lightning'];
        const nextAttackType = types[Math.floor(Math.random() * types.length)];
        setAttackType(nextAttackType);

        if (soundEnabled) {
            if (nextAttackType === 'slash') playSound.attackSlash();
            else if (nextAttackType === 'fireball') playSound.attackFire();
            else playSound.attackZap();
        }

        const timestamp = Date.now();
        setParticles(Array.from({ length: 12 }, (_, index) => ({
            id: timestamp + index,
            x: Math.random() * 100 - 50,
            y: Math.random() * 100 - 50,
            color: nextAttackType === 'fireball'
                ? '#f97316'
                : nextAttackType === 'lightning'
                    ? '#facc15'
                    : '#ffffff'
        })));
        schedule(() => setParticles([]), 1000);

        let text = `-${result.damageDealt}`;
        let color = '#ffffff';
        let scale = 1;

        if (result.isCritical) {
            text = `${criticalLabel} -${result.damageDealt}`;
            color = '#ef4444';
            scale = 1.5;
            if (soundEnabled) schedule(() => playSound.crit(), 100);
        } else if (result.isSuperEffective) {
            text = `${weaknessLabel} -${result.damageDealt}`;
            color = '#facc15';
            scale = 1.3;
            if (soundEnabled) schedule(() => playSound.attackZap(), 150);
        } else if (soundEnabled) {
            schedule(() => playSound.hit(), 200);
        }

        setDamageText([{
            id: timestamp,
            x: Math.random() * 40 - 20,
            y: -50,
            text,
            color,
            scale,
            rotate: Math.random() * 10 - 5
        }]);
        schedule(() => setDamageText([]), 1000);

        setComboScale(1.5);
        schedule(() => setComboScale(1), 200);

        const coins = Array.from({ length: 8 }, (_, index) => ({
            id: timestamp + index,
            delay: index * 0.15
        }));
        setFlyingCoins(coins);
        schedule(() => setFlyingCoins([]), 3000);

        coins.forEach((_, index) => {
            if (soundEnabled) schedule(() => playSound.coin(), index * 150 + 500);
            schedule(() => {
                setGoldScale(1.5);
                schedule(() => setGoldScale(1), 150);
            }, 1000 + (index * 150));
        });
    }, [criticalLabel, schedule, soundEnabled, weaknessLabel]);

    const resetAttack = useCallback(() => setAttackType('slash'), []);

    return {
        attackType,
        particles,
        damageText,
        flyingCoins,
        comboScale,
        goldScale,
        markWrongFeedback,
        triggerCorrectFeedback,
        resetAttack
    };
}

