'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Shield, Zap, Heart, Coins, BookOpen, Target } from 'lucide-react';
import { playSound } from '@/lib/audio';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Blessing System - Slay the Spire inspired roguelike mechanic
 * 
 * Design Philosophy:
 * - Each blessing provides a meaningful strategic choice
 * - Trade-offs are balanced (risk vs reward)
 * - Effects are tied to learning goals (not just raw power)
 */

export interface Blessing {
    id: string;
    name: string;
    nameZh: string;
    description: string;
    descriptionZh: string;
    icon: React.ReactNode;
    rarity: 'common' | 'uncommon' | 'rare';
    effect: BlessingEffect;
}

export interface BlessingEffect {
    // Stat modifiers
    maxHealthMod?: number;      // +/- max health
    goldMultiplier?: number;    // Gold gain multiplier
    xpMultiplier?: number;      // XP gain multiplier
    damageMultiplier?: number;  // Damage dealt multiplier

    // Special effects
    startingGold?: number;      // Bonus starting gold
    critChanceBonus?: number;   // +% crit chance
    healOnCorrect?: number;     // Heal X on correct answer
    shieldOnStreak?: number;    // Gain shield after X streak

    // Educational effects
    hintRevealChance?: number;  // % chance to auto-reveal hint
    wrongAnswerXp?: number;     // XP even on wrong answers (learning reward)
    bonusForSpeed?: boolean;    // Bonus XP for fast answers

    // Negative trade-offs (for balance)
    damageTaken?: number;       // Extra damage on wrong answer
    goldPenalty?: number;       // Lose gold on streak break
}

// Blessing Pool - Balanced for learning-focused gameplay
export const BLESSING_POOL: Blessing[] = [
    // === COMMON (High consistency, low risk) ===
    {
        id: 'scholars_path',
        name: "Scholar's Path",
        nameZh: '学者之路',
        description: '+20% XP gain. Knowledge is the true treasure.',
        descriptionZh: '经验值获取 +20%。知识才是真正的财富。',
        icon: <BookOpen className="w-8 h-8" />,
        rarity: 'common',
        effect: { xpMultiplier: 1.2 }
    },
    {
        id: 'merchant_favor',
        name: "Merchant's Favor",
        nameZh: '商人的眷顾',
        description: 'Start with 50 bonus gold.',
        descriptionZh: '初始获得 50 金币。',
        icon: <Coins className="w-8 h-8" />,
        rarity: 'common',
        effect: { startingGold: 50 }
    },
    {
        id: 'iron_will',
        name: 'Iron Will',
        nameZh: '钢铁意志',
        description: '+1 max health. Endurance wins battles.',
        descriptionZh: '最大生命值 +1。坚持就是胜利。',
        icon: <Heart className="w-8 h-8" />,
        rarity: 'common',
        effect: { maxHealthMod: 1 }
    },

    // === UNCOMMON (Strategic trade-offs) ===
    {
        id: 'glass_cannon',
        name: 'Glass Cannon',
        nameZh: '玻璃大炮',
        description: '+50% damage, but -1 max health. High risk, high reward.',
        descriptionZh: '伤害 +50%，但最大生命值 -1。高风险，高回报。',
        icon: <Zap className="w-8 h-8" />,
        rarity: 'uncommon',
        effect: { damageMultiplier: 1.5, maxHealthMod: -1 }
    },
    {
        id: 'fortune_seeker',
        name: 'Fortune Seeker',
        nameZh: '财富猎人',
        description: '+30% gold, but lose 10 gold on wrong answer.',
        descriptionZh: '金币获取 +30%，但答错失去 10 金币。',
        icon: <Coins className="w-8 h-8" />,
        rarity: 'uncommon',
        effect: { goldMultiplier: 1.3, goldPenalty: 10 }
    },
    {
        id: 'quick_learner',
        name: 'Quick Learner',
        nameZh: '快速学习者',
        description: 'Gain 5 XP even on wrong answers. Mistakes are lessons.',
        descriptionZh: '答错也能获得 5 经验值。错误也是学习。',
        icon: <BookOpen className="w-8 h-8" />,
        rarity: 'uncommon',
        effect: { wrongAnswerXp: 5 }
    },
    {
        id: 'intuition',
        name: 'Intuition',
        nameZh: '直觉',
        description: '25% chance to auto-reveal hint at battle start.',
        descriptionZh: '25% 几率在战斗开始时自动显示提示。',
        icon: <Sparkles className="w-8 h-8" />,
        rarity: 'uncommon',
        effect: { hintRevealChance: 0.25 }
    },

    // === RARE (Powerful, defines the run) ===
    {
        id: 'vampiric_wisdom',
        name: 'Vampiric Wisdom',
        nameZh: '吸血智慧',
        description: 'Heal 1 HP on every 3rd correct answer.',
        descriptionZh: '每答对 3 题恢复 1 生命值。',
        icon: <Heart className="w-8 h-8" />,
        rarity: 'rare',
        effect: { healOnCorrect: 1, shieldOnStreak: 3 }
    },
    {
        id: 'perfectionists_burden',
        name: "Perfectionist's Burden",
        nameZh: '完美主义者的负担',
        description: '+100% XP & gold, but take double damage on mistakes.',
        descriptionZh: '经验值和金币 +100%，但答错受到双倍伤害。',
        icon: <Target className="w-8 h-8" />,
        rarity: 'rare',
        effect: { xpMultiplier: 2, goldMultiplier: 2, damageTaken: 2 }
    },
    {
        id: 'stoic_shield',
        name: 'Stoic Shield',
        nameZh: '坚毅之盾',
        description: '+2 max health, but -20% XP. Survival over glory.',
        descriptionZh: '最大生命值 +2，但经验值 -20%。生存优先。',
        icon: <Shield className="w-8 h-8" />,
        rarity: 'rare',
        effect: { maxHealthMod: 2, xpMultiplier: 0.8 }
    },
];

// Select 3 random blessings for the player to choose from
export function getRandomBlessings(count: number = 3): Blessing[] {
    const shuffled = [...BLESSING_POOL].sort(() => Math.random() - 0.5);

    // Ensure good distribution: at least 1 common, try to include 1 rare
    const common = shuffled.filter(b => b.rarity === 'common');
    const uncommon = shuffled.filter(b => b.rarity === 'uncommon');
    const rare = shuffled.filter(b => b.rarity === 'rare');

    const result: Blessing[] = [];
    if (common.length > 0) result.push(common[0]);
    if (uncommon.length > 0) result.push(uncommon[0]);
    if (rare.length > 0 && Math.random() > 0.5) {
        result.push(rare[0]);
    } else if (uncommon.length > 1) {
        result.push(uncommon[1]);
    } else if (common.length > 1) {
        result.push(common[1]);
    }

    // Fill remaining slots
    while (result.length < count) {
        const remaining = shuffled.filter(b => !result.includes(b));
        if (remaining.length === 0) break;
        result.push(remaining[0]);
    }

    return result.slice(0, count);
}

interface BlessingSelectionProps {
    onSelect: (blessing: Blessing) => void;
    onSkip?: () => void;
}

export function BlessingSelection({ onSelect, onSkip }: BlessingSelectionProps) {
    const [blessings] = useState(() => getRandomBlessings(3));
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isConfirming, setIsConfirming] = useState(false);
    const { language, soundEnabled } = useSettingsStore();
    const isZh = language === 'zh';

    const handleSelect = (blessing: Blessing) => {
        if (soundEnabled) playSound.click();
        setSelectedId(blessing.id);
    };

    const handleConfirm = () => {
        const selected = blessings.find(b => b.id === selectedId);
        if (selected) {
            if (soundEnabled) playSound.success();
            setIsConfirming(true);
            setTimeout(() => onSelect(selected), 500);
        }
    };

    const rarityColors = {
        common: 'border-slate-300 bg-slate-50',
        uncommon: 'border-blue-400 bg-blue-50',
        rare: 'border-amber-400 bg-amber-50',
    };

    const rarityLabels = {
        common: isZh ? '普通' : 'Common',
        uncommon: isZh ? '稀有' : 'Uncommon',
        rare: isZh ? '传说' : 'Rare',
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm p-4"
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="w-full max-w-4xl"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <motion.div
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <Sparkles className="w-12 h-12 mx-auto mb-4 text-primary" />
                        <h2 className="text-3xl font-bold text-foreground mb-2">
                            {isZh ? '选择你的祝福' : 'Choose Your Blessing'}
                        </h2>
                        <p className="text-muted-foreground">
                            {isZh
                                ? '每次冒险只能选择一个祝福，请谨慎抉择'
                                : 'Choose one blessing to guide your journey'}
                        </p>
                    </motion.div>
                </div>

                {/* Blessing Cards */}
                <div className="grid md:grid-cols-3 gap-4 mb-8">
                    <AnimatePresence>
                        {blessings.map((blessing, index) => (
                            <motion.button
                                key={blessing.id}
                                initial={{ opacity: 0, y: 30 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 + index * 0.1 }}
                                onClick={() => handleSelect(blessing)}
                                disabled={isConfirming}
                                className={`
                                    relative p-6 rounded-2xl border-2 text-left
                                    transition-all duration-200
                                    ${rarityColors[blessing.rarity]}
                                    ${selectedId === blessing.id
                                        ? 'ring-2 ring-primary ring-offset-2 scale-[1.02] shadow-lg'
                                        : 'hover:shadow-md hover:-translate-y-1'}
                                    ${isConfirming && selectedId !== blessing.id ? 'opacity-50' : ''}
                                `}
                            >
                                {/* Rarity Badge */}
                                <span className={`
                                    absolute top-3 right-3 text-xs font-medium px-2 py-0.5 rounded-full
                                    ${blessing.rarity === 'rare' ? 'bg-amber-200 text-amber-800' :
                                        blessing.rarity === 'uncommon' ? 'bg-blue-200 text-blue-800' :
                                            'bg-slate-200 text-slate-600'}
                                `}>
                                    {rarityLabels[blessing.rarity]}
                                </span>

                                {/* Icon */}
                                <div className={`
                                    w-16 h-16 rounded-xl flex items-center justify-center mb-4
                                    ${blessing.rarity === 'rare' ? 'bg-amber-100 text-amber-600' :
                                        blessing.rarity === 'uncommon' ? 'bg-blue-100 text-blue-600' :
                                            'bg-slate-100 text-slate-600'}
                                `}>
                                    {blessing.icon}
                                </div>

                                {/* Name */}
                                <h3 className="text-lg font-bold text-foreground mb-2">
                                    {isZh ? blessing.nameZh : blessing.name}
                                </h3>

                                {/* Description */}
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    {isZh ? blessing.descriptionZh : blessing.description}
                                </p>

                                {/* Selection indicator */}
                                {selectedId === blessing.id && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center"
                                    >
                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </motion.div>
                                )}
                            </motion.button>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Actions */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="flex justify-center gap-4"
                >
                    {onSkip && (
                        <button
                            onClick={onSkip}
                            disabled={isConfirming}
                            className="px-6 py-3 text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {isZh ? '跳过' : 'Skip'}
                        </button>
                    )}
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedId || isConfirming}
                        className={`
                            px-8 py-3 rounded-xl font-bold text-white
                            transition-all duration-200
                            ${selectedId && !isConfirming
                                ? 'bg-primary hover:shadow-lg hover:-translate-y-0.5'
                                : 'bg-slate-300 cursor-not-allowed'}
                        `}
                    >
                        {isConfirming
                            ? (isZh ? '应用中...' : 'Applying...')
                            : (isZh ? '确认选择' : 'Confirm Selection')}
                    </button>
                </motion.div>
            </motion.div>
        </motion.div>
    );
}
