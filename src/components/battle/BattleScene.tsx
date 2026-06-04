'use client';

import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { Monster } from '@/store/gameStore';
import type { translations } from '@/lib/translations';
import { getAttackEffectAsset, getHeroAsset, getMonsterAsset } from '@/lib/battleAssets';

interface Particle {
    id: number;
    x: number;
    y: number;
    color: string;
}

interface DamageText {
    id: number;
    x: number;
    y: number;
    text: string;
    color: string;
    scale: number;
    rotate: number;
}

interface BattleSceneProps {
    currentQuestion: Monster;
    showResult: boolean;
    isCorrect: boolean;
    attackType: 'slash' | 'fireball' | 'lightning';
    particles: Particle[];
    damageText: DamageText[];
    currentMonsterHp: number;
    bossShieldProgress: number;
    playerStreak: number;
    comboScale: number;
    bossComboThreshold: number;
    t: (typeof translations)['en'];
}

export function BattleScene({
    currentQuestion,
    showResult,
    isCorrect,
    attackType,
    particles,
    damageText,
    currentMonsterHp,
    bossShieldProgress,
    playerStreak,
    comboScale,
    bossComboThreshold,
    t
}: BattleSceneProps) {
    const heroAsset = getHeroAsset();
    const monsterAsset = getMonsterAsset(currentQuestion.type);
    const attackEffectAsset = getAttackEffectAsset(attackType);
    const bossStageLabel = currentQuestion.isBoss && currentQuestion.bossStage && currentQuestion.bossTotalStages
        ? `Stage ${currentQuestion.bossStage} / ${currentQuestion.bossTotalStages}`
        : null;
    const monsterLabel = currentQuestion.isBoss
        ? `${currentQuestion.type} ${t.battle.boss}`
        : currentQuestion.type;

    return (
        <div className="relative battle-arena rounded-3xl border-2 border-primary/15 overflow-hidden flex flex-col items-center justify-center p-8 shadow-soft">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(56,189,248,0.24),transparent_46%),radial-gradient(circle_at_84%_78%,rgba(99,102,241,0.20),transparent_44%),radial-gradient(circle_at_52%_96%,rgba(251,191,36,0.16),transparent_42%)] dark:bg-[radial-gradient(circle_at_25%_20%,rgba(168,85,247,0.24),transparent_46%),radial-gradient(circle_at_80%_82%,rgba(14,165,233,0.22),transparent_44%)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-white/55 via-sky-50/30 to-blue-100/45 dark:from-slate-900/35 dark:via-slate-900/15 dark:to-slate-950/35" />
            {bossStageLabel && (
                <div className="absolute right-4 top-4 z-20 rounded-full border border-yellow-400/50 bg-black/55 px-3 py-1 text-xs font-black uppercase tracking-wide text-yellow-200 shadow-lg backdrop-blur">
                    {bossStageLabel}
                </div>
            )}

            <div className="relative z-10 w-full flex justify-between items-center gap-4">
                <div className="flex flex-col items-center">
                    <motion.div
                        animate={
                            showResult && isCorrect
                                ? { x: [0, 100, 0], scale: [1, 1.2, 1], rotate: [0, 10, 0] }
                                : showResult && !isCorrect
                                    ? { x: [-10, 10, -10, 10, 0], color: "#ef4444" }
                                    : { y: [0, -5, 0] }
                        }
                        transition={showResult ? { duration: 0.5 } : { repeat: Infinity, duration: 2, ease: "easeInOut" }}
                        className="relative group"
                    >
                        <div className="absolute inset-0 bg-blue-500/30 blur-xl rounded-full group-hover:bg-blue-500/50 transition-all duration-500" />

                        <div className="relative w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-blue-500/30 to-indigo-700/30 rounded-2xl border-4 border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.6)] flex items-center justify-center transform rotate-3 overflow-visible">
                            <Image
                                src={heroAsset.src}
                                alt={heroAsset.alt}
                                width={220}
                                height={220}
                                sizes="160px"
                                className="h-[118%] w-[118%] object-contain drop-shadow-[0_18px_22px_rgba(15,23,42,0.35)]"
                                draggable={false}
                            />

                            <AnimatePresence>
                                {showResult && isCorrect && (
                                    <>
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, scale: 1.5 }}
                                            exit={{ opacity: 0 }}
                                            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                                        >
                                            <motion.div
                                                initial={{ scale: 0.7, opacity: 0, rotate: attackType === 'slash' ? -8 : 0 }}
                                                animate={{ scale: 1.15, opacity: 1, rotate: attackType === 'slash' ? 4 : 0 }}
                                                transition={{ duration: 0.22 }}
                                                className={cn(
                                                    'absolute h-32 w-32 object-contain drop-shadow-[0_0_16px_rgba(255,255,255,0.75)]',
                                                    attackType === 'fireball' && 'animate-pulse',
                                                    attackType === 'lightning' && 'animate-bounce'
                                                )}
                                            >
                                                <Image
                                                    src={attackEffectAsset.src}
                                                    alt={attackEffectAsset.alt}
                                                    width={128}
                                                    height={128}
                                                    sizes="128px"
                                                    className="h-full w-full object-contain"
                                                    draggable={false}
                                                />
                                            </motion.div>
                                        </motion.div>

                                        {particles.map((p) => (
                                            <motion.div
                                                key={p.id}
                                                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                                                animate={{ x: p.x, y: p.y, opacity: 0, scale: 0 }}
                                                transition={{ duration: 0.6, ease: "easeOut" }}
                                                className="absolute w-2 h-2 rounded-full pointer-events-none z-10"
                                                style={{ backgroundColor: p.color, left: '50%', top: '50%' }}
                                            />
                                        ))}
                                    </>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-1 rounded-full border border-blue-500/50 text-blue-200 text-xs font-bold tracking-widest uppercase">
                            {t.battle.hero}
                        </div>
                    </motion.div>
                </div>

                <div className="text-4xl font-black text-primary/15 dark:text-white/10 italic absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
                    {t.battle.vs}
                </div>

                <AnimatePresence>
                    {playerStreak > 1 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.5, y: 20 }}
                            animate={{ opacity: 1, scale: comboScale, y: 0 }}
                            exit={{ opacity: 0, scale: 0.5, y: 20 }}
                            className="absolute top-24 left-4 z-20 pointer-events-none"
                        >
                            <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-full font-black italic transform -rotate-6 shadow-lg border-2 border-white/20 flex flex-col items-center">
                                <span className="text-xs uppercase tracking-widest opacity-90">{t.battle.combo}</span>
                                <span className="text-3xl leading-none">{playerStreak}x</span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex flex-col items-center">
                    <motion.div
                        animate={
                            showResult && isCorrect
                                ? { x: [10, -10, 10, -10, 0], opacity: [1, 0.5, 1, 0.5, 1], scale: [1, 0.9, 1], filter: ["brightness(1)", "brightness(2)", "brightness(1)"] }
                                : showResult && !isCorrect
                                    ? { x: [0, -100, 0], scale: [1, 1.3, 1], rotate: [0, -10, 0] }
                                    : { y: [0, -10, 0], rotate: [0, 2, -2, 0] }
                        }
                        transition={
                            showResult
                                ? { duration: 0.5 }
                                : { repeat: Infinity, duration: 3, ease: "easeInOut" }
                        }
                        className="relative group"
                    >
                        <div className={cn(
                            "absolute inset-0 blur-xl rounded-full transition-all duration-500",
                            currentQuestion.type === 'grammar' ? "bg-purple-500/30 group-hover:bg-purple-500/50" :
                                currentQuestion.type === 'vocab' ? "bg-orange-500/30 group-hover:bg-orange-500/50" :
                                    "bg-emerald-500/30 group-hover:bg-emerald-500/50"
                        )} />

                        <div className={cn(
                            "relative w-32 h-32 md:w-40 md:h-40 rounded-full border-4 shadow-2xl flex items-center justify-center transition-colors overflow-visible",
                            currentQuestion.type === 'grammar' ? "bg-gradient-to-br from-purple-600 to-fuchsia-800 border-purple-400" :
                                currentQuestion.type === 'vocab' ? "bg-gradient-to-br from-orange-600 to-red-800 border-orange-400" :
                                    "bg-gradient-to-br from-emerald-600 to-teal-800 border-emerald-400"
                        )}>
                            <Image
                                src={monsterAsset.src}
                                alt={monsterAsset.alt}
                                width={220}
                                height={220}
                                sizes="160px"
                                className="relative z-10 h-[118%] w-[118%] object-contain drop-shadow-[0_18px_22px_rgba(15,23,42,0.4)] transform hover:scale-110 transition-transform duration-300"
                                draggable={false}
                            />
                            <div className="absolute inset-0 rounded-full bg-gradient-to-t from-black/40 to-transparent" />
                        </div>

                        <AnimatePresence>
                            {damageText.map((text) => (
                                    <motion.div
                                        key={text.id}
                                        initial={{ opacity: 1, y: -50, x: text.x, scale: 0.5, rotate: text.rotate }}
                                        animate={{ opacity: 0, y: -150, x: text.x * 1.5, scale: text.scale, rotate: 0 }}
                                        transition={{ duration: 0.8, ease: "easeOut" }}
                                    className="absolute top-0 left-1/2 -translate-x-1/2 z-50 font-black pointer-events-none whitespace-nowrap drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
                                    style={{ color: text.color, fontSize: `${2 * text.scale}rem` }}
                                >
                                    {text.text}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        <div className={cn(
                            "absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-1 rounded-full border text-xs font-bold tracking-widest uppercase whitespace-nowrap",
                            currentQuestion.type === 'grammar' ? "border-purple-500/50 text-purple-200" :
                                currentQuestion.type === 'vocab' ? "border-orange-500/50 text-orange-200" :
                                    "border-emerald-500/50 text-emerald-200"
                        )}>
                            {monsterLabel}
                        </div>

                        {currentQuestion.isBoss && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-32 h-4 bg-black/50 backdrop-blur rounded-full border border-white/10 overflow-hidden">
                                <motion.div
                                    className="h-full bg-red-500"
                                    initial={{ width: '100%' }}
                                    animate={{ width: `${(currentMonsterHp / (currentQuestion.maxHp || 3)) * 100}% ` }}
                                />
                            </div>
                        )}

                        {currentQuestion.isBoss && (
                            <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex gap-1">
                                {Array.from({ length: bossComboThreshold }).map((_, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            'w-3 h-1.5 rounded-full border border-yellow-400/60',
                                            idx < bossShieldProgress ? 'bg-yellow-300 shadow-[0_0_6px_rgba(250,204,21,0.7)]' : 'bg-transparent'
                                        )}
                                    />
                                ))}
                            </div>
                        )}

                    </motion.div>
                </div>
            </div>
        </div>
    );
}
