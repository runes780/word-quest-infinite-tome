'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { Coins } from 'lucide-react';
import { AchievementToast } from '@/components/AchievementSystem';
import type { Achievement } from '@/components/AchievementSystem';
import { formatLearningLabel } from '@/lib/data/learningObjectives';
import { getItemAsset } from '@/lib/battleAssets';
import type { Item, MasteryCelebration } from '@/store/gameStore';
import type { Language } from '@/store/settingsStore';
import { formatMasteryStateLabel } from './battleInterfaceLogic';
import type { FlyingCoin } from './useBattleFeedback';

export function BattleGeneratingBanner({ visible, label }: { visible: boolean; label: string }) {
    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="fixed top-20 left-1/2 -translate-x-1/2 bg-yellow-500/90 text-black px-6 py-2 rounded-full font-bold shadow-lg z-50 flex items-center gap-2"
                >
                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    {label}
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export function FlyingCoinBurst({ coins }: { coins: FlyingCoin[] }) {
    return (
        <AnimatePresence>
            {coins.map((coin) => (
                <motion.div
                    key={coin.id}
                    initial={{ opacity: 1, x: 0, y: 0, scale: 0.5, rotate: 0 }}
                    animate={{
                        opacity: [1, 1, 0],
                        x: [0, 100, window.innerWidth / 2 - 80],
                        y: [0, -50, -window.innerHeight / 2 + 60],
                        scale: [0.5, 1.2, 0.5],
                        rotate: 720
                    }}
                    transition={{ duration: 1.5, ease: 'easeInOut', delay: coin.delay }}
                    className="fixed top-1/2 left-1/2 z-[100] text-yellow-400 pointer-events-none"
                >
                    <Coins className="w-8 h-8 drop-shadow-lg" />
                </motion.div>
            ))}
        </AnimatePresence>
    );
}

interface BattleInventoryBarProps {
    inventory: Item[];
    emptyLabel: string;
    onUseItem: (itemId: string) => void;
}

export function BattleInventoryBar({ inventory, emptyLabel, onUseItem }: BattleInventoryBarProps) {
    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/80 backdrop-blur rounded-2xl border border-white/10 shadow-xl z-40">
            {inventory.length === 0 && (
                <div className="px-4 py-2 text-xs text-muted-foreground italic">{emptyLabel}</div>
            )}
            {inventory.map((item) => {
                const itemAsset = getItemAsset(item.type);
                return (
                    <button
                        key={item.id}
                        onClick={() => onUseItem(item.id)}
                        className="w-10 h-10 bg-slate-800 rounded-lg border border-white/20 flex items-center justify-center p-1 hover:scale-110 hover:bg-slate-700 transition-all relative group"
                        title={item.name}
                    >
                        <Image
                            src={itemAsset.src}
                            alt={itemAsset.alt}
                            width={40}
                            height={40}
                            sizes="40px"
                            className="h-full w-full object-contain drop-shadow"
                            draggable={false}
                        />
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black px-2 py-1 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                            {item.name}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

interface BattleNotificationsProps {
    activeAchievement: Achievement | null;
    onCloseAchievement: () => void;
    activeMasteryCelebration: MasteryCelebration | null;
    language: Language;
}

export function BattleNotifications({
    activeAchievement,
    onCloseAchievement,
    activeMasteryCelebration,
    language
}: BattleNotificationsProps) {
    return (
        <>
            <AnimatePresence>
                {activeAchievement && (
                    <AchievementToast
                        achievement={activeAchievement}
                        onClose={onCloseAchievement}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {activeMasteryCelebration && (
                    <motion.div
                        key={activeMasteryCelebration.id}
                        initial={{ x: -240, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -240, opacity: 0 }}
                        className="fixed top-20 left-4 z-50 bg-emerald-50 border-2 border-emerald-400 text-emerald-900 rounded-xl p-4 shadow-xl max-w-xs"
                    >
                        <p className="text-xs font-semibold uppercase tracking-wide">
                            {language === 'zh' ? '技能进阶' : 'Mastery Up'}
                        </p>
                        <p className="font-bold text-sm mt-1">
                            {formatLearningLabel(activeMasteryCelebration.skillTag, language)}
                        </p>
                        <p className="text-xs mt-1">
                            {formatMasteryStateLabel(activeMasteryCelebration.fromState, language)} -&gt;{' '}
                            {formatMasteryStateLabel(activeMasteryCelebration.toState, language)}
                        </p>
                        <div className="mt-2 text-xs font-semibold flex items-center gap-3">
                            <span>+{activeMasteryCelebration.bonusXp} XP</span>
                            <span>+{activeMasteryCelebration.bonusGold} Gold</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
