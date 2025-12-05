'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Star, Zap, Heart, Coins, Target, BookOpen, Clock, Flame, Shield, Sparkles, X } from 'lucide-react';
import { playSound } from '@/lib/audio';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Achievement System - Gamification for long-term engagement
 * 
 * Design Philosophy:
 * - Achievements are non-intrusive but rewarding
 * - Mix of skill-based and milestone-based achievements
 * - Tied to educational goals (not just raw grinding)
 */

export type AchievementCategory = 'combat' | 'learning' | 'collection' | 'streak' | 'mastery';
export type AchievementRarity = 'bronze' | 'silver' | 'gold' | 'legendary';

export interface Achievement {
    id: string;
    name: string;
    nameZh: string;
    description: string;
    descriptionZh: string;
    icon: React.ReactNode;
    category: AchievementCategory;
    rarity: AchievementRarity;
    condition: (stats: PlayerAchievementStats) => boolean;
    progress?: (stats: PlayerAchievementStats) => { current: number; target: number };
    reward?: { gold?: number; xp?: number };
    secret?: boolean;
}

export interface PlayerAchievementStats {
    totalCorrect: number;
    totalWrong: number;
    totalQuestions: number;
    maxStreak: number;
    currentStreak: number;
    totalCriticals: number;
    totalGoldEarned: number;
    totalXpEarned: number;
    bossesDefeated: number;
    perfectRuns: number;      // Runs with no wrong answers
    relicsOwned: number;
    potionsUsed: number;
    daysPlayed: number;
    consecutiveDays: number;
    vocabMastered: number;    // Skills with >80% accuracy
    grammarMastered: number;
    fastAnswers: number;      // Answers within 5 seconds
    hintsUsed: number;
    revengeCleared: number;   // Revenge queue questions answered correctly
    levelsCompleted: number;
}

// Achievement Pool - 25 achievements across categories
export const ACHIEVEMENTS: Achievement[] = [
    // === COMBAT (Bronze → Gold progression) ===
    {
        id: 'first_blood',
        name: 'First Blood',
        nameZh: '首战告捷',
        description: 'Answer your first question correctly',
        descriptionZh: '答对第一道题',
        icon: <Zap className="w-6 h-6" />,
        category: 'combat',
        rarity: 'bronze',
        condition: (s) => s.totalCorrect >= 1,
        reward: { gold: 10 }
    },
    {
        id: 'monster_slayer',
        name: 'Monster Slayer',
        nameZh: '怪物猎手',
        description: 'Answer 50 questions correctly',
        descriptionZh: '答对 50 道题',
        icon: <Target className="w-6 h-6" />,
        category: 'combat',
        rarity: 'silver',
        condition: (s) => s.totalCorrect >= 50,
        progress: (s) => ({ current: s.totalCorrect, target: 50 }),
        reward: { gold: 50, xp: 100 }
    },
    {
        id: 'centurion',
        name: 'Centurion',
        nameZh: '百战勇士',
        description: 'Answer 100 questions correctly',
        descriptionZh: '答对 100 道题',
        icon: <Shield className="w-6 h-6" />,
        category: 'combat',
        rarity: 'gold',
        condition: (s) => s.totalCorrect >= 100,
        progress: (s) => ({ current: s.totalCorrect, target: 100 }),
        reward: { gold: 100, xp: 200 }
    },
    {
        id: 'boss_hunter',
        name: 'Boss Hunter',
        nameZh: 'Boss 猎人',
        description: 'Defeat 5 bosses',
        descriptionZh: '击败 5 个 Boss',
        icon: <Trophy className="w-6 h-6" />,
        category: 'combat',
        rarity: 'gold',
        condition: (s) => s.bossesDefeated >= 5,
        progress: (s) => ({ current: s.bossesDefeated, target: 5 }),
        reward: { gold: 150 }
    },
    {
        id: 'critical_master',
        name: 'Critical Master',
        nameZh: '暴击大师',
        description: 'Land 20 critical hits',
        descriptionZh: '打出 20 次暴击',
        icon: <Sparkles className="w-6 h-6" />,
        category: 'combat',
        rarity: 'silver',
        condition: (s) => s.totalCriticals >= 20,
        progress: (s) => ({ current: s.totalCriticals, target: 20 }),
        reward: { xp: 150 }
    },

    // === STREAK (Encouraging consistency) ===
    {
        id: 'hot_streak',
        name: 'Hot Streak',
        nameZh: '连击新手',
        description: 'Get a 5x streak',
        descriptionZh: '达成 5 连击',
        icon: <Flame className="w-6 h-6" />,
        category: 'streak',
        rarity: 'bronze',
        condition: (s) => s.maxStreak >= 5,
        reward: { gold: 20 }
    },
    {
        id: 'unstoppable',
        name: 'Unstoppable',
        nameZh: '势不可挡',
        description: 'Get a 10x streak',
        descriptionZh: '达成 10 连击',
        icon: <Flame className="w-6 h-6" />,
        category: 'streak',
        rarity: 'silver',
        condition: (s) => s.maxStreak >= 10,
        reward: { gold: 50, xp: 100 }
    },
    {
        id: 'legendary_streak',
        name: 'Legendary Streak',
        nameZh: '传奇连击',
        description: 'Get a 20x streak',
        descriptionZh: '达成 20 连击',
        icon: <Flame className="w-6 h-6" />,
        category: 'streak',
        rarity: 'legendary',
        condition: (s) => s.maxStreak >= 20,
        reward: { gold: 200, xp: 300 }
    },
    {
        id: 'daily_warrior',
        name: 'Daily Warrior',
        nameZh: '每日勇士',
        description: 'Play for 7 consecutive days',
        descriptionZh: '连续学习 7 天',
        icon: <Clock className="w-6 h-6" />,
        category: 'streak',
        rarity: 'gold',
        condition: (s) => s.consecutiveDays >= 7,
        progress: (s) => ({ current: s.consecutiveDays, target: 7 }),
        reward: { gold: 100, xp: 200 }
    },

    // === LEARNING (Educational achievements) ===
    {
        id: 'vocab_apprentice',
        name: 'Vocab Apprentice',
        nameZh: '词汇学徒',
        description: 'Master 5 vocabulary skills (>80% accuracy)',
        descriptionZh: '掌握 5 个词汇技能 (正确率>80%)',
        icon: <BookOpen className="w-6 h-6" />,
        category: 'learning',
        rarity: 'silver',
        condition: (s) => s.vocabMastered >= 5,
        progress: (s) => ({ current: s.vocabMastered, target: 5 }),
        reward: { xp: 150 }
    },
    {
        id: 'grammar_guru',
        name: 'Grammar Guru',
        nameZh: '语法大师',
        description: 'Master 5 grammar skills (>80% accuracy)',
        descriptionZh: '掌握 5 个语法技能 (正确率>80%)',
        icon: <BookOpen className="w-6 h-6" />,
        category: 'learning',
        rarity: 'silver',
        condition: (s) => s.grammarMastered >= 5,
        progress: (s) => ({ current: s.grammarMastered, target: 5 }),
        reward: { xp: 150 }
    },
    {
        id: 'quick_thinker',
        name: 'Quick Thinker',
        nameZh: '快速思考者',
        description: 'Answer 10 questions within 5 seconds each',
        descriptionZh: '10 道题在 5 秒内作答',
        icon: <Zap className="w-6 h-6" />,
        category: 'learning',
        rarity: 'gold',
        condition: (s) => s.fastAnswers >= 10,
        progress: (s) => ({ current: s.fastAnswers, target: 10 }),
        reward: { gold: 80, xp: 100 }
    },
    {
        id: 'revenge_complete',
        name: 'Revenge Complete',
        nameZh: '复仇成功',
        description: 'Clear 10 revenge queue questions',
        descriptionZh: '在复仇队列中答对 10 道题',
        icon: <Target className="w-6 h-6" />,
        category: 'learning',
        rarity: 'silver',
        condition: (s) => s.revengeCleared >= 10,
        progress: (s) => ({ current: s.revengeCleared, target: 10 }),
        reward: { xp: 100 }
    },

    // === COLLECTION (Roguelike progression) ===
    {
        id: 'treasure_hunter',
        name: 'Treasure Hunter',
        nameZh: '宝藏猎人',
        description: 'Earn 500 gold total',
        descriptionZh: '累计获得 500 金币',
        icon: <Coins className="w-6 h-6" />,
        category: 'collection',
        rarity: 'silver',
        condition: (s) => s.totalGoldEarned >= 500,
        progress: (s) => ({ current: s.totalGoldEarned, target: 500 }),
        reward: { gold: 50 }
    },
    {
        id: 'gold_hoarder',
        name: 'Gold Hoarder',
        nameZh: '黄金囤积者',
        description: 'Earn 2000 gold total',
        descriptionZh: '累计获得 2000 金币',
        icon: <Coins className="w-6 h-6" />,
        category: 'collection',
        rarity: 'gold',
        condition: (s) => s.totalGoldEarned >= 2000,
        progress: (s) => ({ current: s.totalGoldEarned, target: 2000 }),
        reward: { gold: 100 }
    },
    {
        id: 'relic_collector',
        name: 'Relic Collector',
        nameZh: '遗物收藏家',
        description: 'Own 3 different relics',
        descriptionZh: '拥有 3 种不同遗物',
        icon: <Star className="w-6 h-6" />,
        category: 'collection',
        rarity: 'gold',
        condition: (s) => s.relicsOwned >= 3,
        progress: (s) => ({ current: s.relicsOwned, target: 3 }),
        reward: { xp: 200 }
    },
    {
        id: 'potion_master',
        name: 'Potion Master',
        nameZh: '药剂大师',
        description: 'Use 10 potions',
        descriptionZh: '使用 10 瓶药水',
        icon: <Heart className="w-6 h-6" />,
        category: 'collection',
        rarity: 'bronze',
        condition: (s) => s.potionsUsed >= 10,
        progress: (s) => ({ current: s.potionsUsed, target: 10 }),
        reward: { gold: 30 }
    },

    // === MASTERY (Elite achievements) ===
    {
        id: 'perfectionist',
        name: 'Perfectionist',
        nameZh: '完美主义者',
        description: 'Complete a run without wrong answers',
        descriptionZh: '完成一次无错误的战斗',
        icon: <Trophy className="w-6 h-6" />,
        category: 'mastery',
        rarity: 'legendary',
        condition: (s) => s.perfectRuns >= 1,
        reward: { gold: 200, xp: 300 }
    },
    {
        id: 'level_master',
        name: 'Level Master',
        nameZh: '关卡大师',
        description: 'Complete 10 levels',
        descriptionZh: '完成 10 个关卡',
        icon: <Trophy className="w-6 h-6" />,
        category: 'mastery',
        rarity: 'gold',
        condition: (s) => s.levelsCompleted >= 10,
        progress: (s) => ({ current: s.levelsCompleted, target: 10 }),
        reward: { gold: 150, xp: 250 }
    },
    {
        id: 'no_hints',
        name: 'No Hints Needed',
        nameZh: '不需要提示',
        description: 'Complete a level without using hints',
        descriptionZh: '完成一个关卡且不使用提示',
        icon: <Target className="w-6 h-6" />,
        category: 'mastery',
        rarity: 'silver',
        condition: (s) => s.levelsCompleted >= 1 && s.hintsUsed === 0,
        secret: true,
        reward: { xp: 100 }
    },
];

// Achievement storage key
const ACHIEVEMENT_STORAGE_KEY = 'word-quest-achievements';
const STATS_STORAGE_KEY = 'word-quest-achievement-stats';

// Load unlocked achievements from localStorage
export function loadUnlockedAchievements(): string[] {
    if (typeof window === 'undefined') return [];
    try {
        const stored = localStorage.getItem(ACHIEVEMENT_STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

// Save unlocked achievements to localStorage
export function saveUnlockedAchievements(ids: string[]) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(ids));
}

// Load player stats from localStorage
export function loadPlayerStats(): PlayerAchievementStats {
    if (typeof window === 'undefined') return getDefaultStats();
    try {
        const stored = localStorage.getItem(STATS_STORAGE_KEY);
        return stored ? { ...getDefaultStats(), ...JSON.parse(stored) } : getDefaultStats();
    } catch {
        return getDefaultStats();
    }
}

// Save player stats to localStorage
export function savePlayerStats(stats: PlayerAchievementStats) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(stats));
}

function getDefaultStats(): PlayerAchievementStats {
    return {
        totalCorrect: 0,
        totalWrong: 0,
        totalQuestions: 0,
        maxStreak: 0,
        currentStreak: 0,
        totalCriticals: 0,
        totalGoldEarned: 0,
        totalXpEarned: 0,
        bossesDefeated: 0,
        perfectRuns: 0,
        relicsOwned: 0,
        potionsUsed: 0,
        daysPlayed: 0,
        consecutiveDays: 0,
        vocabMastered: 0,
        grammarMastered: 0,
        fastAnswers: 0,
        hintsUsed: 0,
        revengeCleared: 0,
        levelsCompleted: 0,
    };
}

// Check for newly unlocked achievements
export function checkAchievements(stats: PlayerAchievementStats): Achievement[] {
    const unlocked = loadUnlockedAchievements();
    const newlyUnlocked: Achievement[] = [];

    for (const achievement of ACHIEVEMENTS) {
        if (!unlocked.includes(achievement.id) && achievement.condition(stats)) {
            newlyUnlocked.push(achievement);
            unlocked.push(achievement.id);
        }
    }

    if (newlyUnlocked.length > 0) {
        saveUnlockedAchievements(unlocked);
    }

    return newlyUnlocked;
}

// Achievement Toast Component
interface AchievementToastProps {
    achievement: Achievement;
    onClose: () => void;
}

export function AchievementToast({ achievement, onClose }: AchievementToastProps) {
    const { language, soundEnabled } = useSettingsStore();
    const isZh = language === 'zh';

    useEffect(() => {
        if (soundEnabled) playSound.success();
        const timer = setTimeout(onClose, 4000);
        return () => clearTimeout(timer);
    }, [onClose, soundEnabled]);

    const rarityColors = {
        bronze: 'border-amber-600 bg-amber-50',
        silver: 'border-slate-400 bg-slate-50',
        gold: 'border-yellow-500 bg-yellow-50',
        legendary: 'border-purple-500 bg-purple-50',
    };

    const rarityLabels = {
        bronze: isZh ? '青铜' : 'Bronze',
        silver: isZh ? '白银' : 'Silver',
        gold: isZh ? '黄金' : 'Gold',
        legendary: isZh ? '传说' : 'Legendary',
    };

    return (
        <motion.div
            initial={{ x: 300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 300, opacity: 0 }}
            className={`fixed top-4 right-4 z-50 p-4 rounded-xl border-2 shadow-lg ${rarityColors[achievement.rarity]}`}
        >
            <div className="flex items-center gap-3">
                <div className={`
                    w-12 h-12 rounded-lg flex items-center justify-center
                    ${achievement.rarity === 'legendary' ? 'bg-purple-100 text-purple-600' :
                        achievement.rarity === 'gold' ? 'bg-yellow-100 text-yellow-600' :
                            achievement.rarity === 'silver' ? 'bg-slate-100 text-slate-600' :
                                'bg-amber-100 text-amber-600'}
                `}>
                    {achievement.icon}
                </div>
                <div className="flex-1">
                    <p className="text-xs font-medium text-muted-foreground">
                        {isZh ? '成就解锁' : 'Achievement Unlocked'}
                    </p>
                    <p className="font-bold text-foreground">
                        {isZh ? achievement.nameZh : achievement.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {isZh ? achievement.descriptionZh : achievement.description}
                    </p>
                </div>
                <span className={`
                    text-xs font-medium px-2 py-0.5 rounded-full
                    ${achievement.rarity === 'legendary' ? 'bg-purple-200 text-purple-800' :
                        achievement.rarity === 'gold' ? 'bg-yellow-200 text-yellow-800' :
                            achievement.rarity === 'silver' ? 'bg-slate-200 text-slate-700' :
                                'bg-amber-200 text-amber-800'}
                `}>
                    {rarityLabels[achievement.rarity]}
                </span>
            </div>
            {achievement.reward && (
                <div className="mt-2 pt-2 border-t border-border flex gap-3 text-xs">
                    {achievement.reward.gold && (
                        <span className="flex items-center gap-1 text-yellow-600">
                            <Coins className="w-3 h-3" /> +{achievement.reward.gold}
                        </span>
                    )}
                    {achievement.reward.xp && (
                        <span className="flex items-center gap-1 text-blue-600">
                            <Star className="w-3 h-3" /> +{achievement.reward.xp} XP
                        </span>
                    )}
                </div>
            )}
        </motion.div>
    );
}

// Achievement Gallery Modal
interface AchievementGalleryProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AchievementGallery({ isOpen, onClose }: AchievementGalleryProps) {
    const { language } = useSettingsStore();
    const isZh = language === 'zh';
    const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
    const [stats, setStats] = useState<PlayerAchievementStats>(getDefaultStats());

    useEffect(() => {
        if (isOpen) {
            setUnlockedIds(loadUnlockedAchievements());
            setStats(loadPlayerStats());
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const categories: { key: AchievementCategory; label: string; labelZh: string }[] = [
        { key: 'combat', label: 'Combat', labelZh: '战斗' },
        { key: 'streak', label: 'Streak', labelZh: '连击' },
        { key: 'learning', label: 'Learning', labelZh: '学习' },
        { key: 'collection', label: 'Collection', labelZh: '收藏' },
        { key: 'mastery', label: 'Mastery', labelZh: '精通' },
    ];

    const unlockedCount = unlockedIds.length;
    const totalCount = ACHIEVEMENTS.filter(a => !a.secret).length;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-3xl max-h-[80vh] bg-card rounded-2xl shadow-xl overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <div className="flex items-center gap-3">
                        <Trophy className="w-6 h-6 text-primary" />
                        <div>
                            <h2 className="text-lg font-bold">{isZh ? '成就' : 'Achievements'}</h2>
                            <p className="text-sm text-muted-foreground">
                                {unlockedCount} / {totalCount} {isZh ? '已解锁' : 'Unlocked'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Achievement List */}
                <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
                    {categories.map(({ key, label, labelZh }) => {
                        const categoryAchievements = ACHIEVEMENTS.filter(
                            a => a.category === key && (!a.secret || unlockedIds.includes(a.id))
                        );

                        return (
                            <div key={key} className="mb-6">
                                <h3 className="text-sm font-bold text-muted-foreground mb-3">
                                    {isZh ? labelZh : label}
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {categoryAchievements.map(achievement => {
                                        const isUnlocked = unlockedIds.includes(achievement.id);
                                        const progress = achievement.progress?.(stats);

                                        return (
                                            <div
                                                key={achievement.id}
                                                className={`
                                                    p-3 rounded-xl border transition-all
                                                    ${isUnlocked
                                                        ? 'bg-card border-border'
                                                        : 'bg-muted/30 border-transparent opacity-60'}
                                                `}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className={`
                                                        w-10 h-10 rounded-lg flex items-center justify-center
                                                        ${isUnlocked
                                                            ? achievement.rarity === 'legendary' ? 'bg-purple-100 text-purple-600' :
                                                                achievement.rarity === 'gold' ? 'bg-yellow-100 text-yellow-600' :
                                                                    achievement.rarity === 'silver' ? 'bg-slate-100 text-slate-600' :
                                                                        'bg-amber-100 text-amber-600'
                                                            : 'bg-muted text-muted-foreground'}
                                                    `}>
                                                        {achievement.icon}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm truncate">
                                                            {isZh ? achievement.nameZh : achievement.name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {isZh ? achievement.descriptionZh : achievement.description}
                                                        </p>
                                                        {progress && !isUnlocked && (
                                                            <div className="mt-1">
                                                                <div className="h-1 bg-muted rounded-full overflow-hidden">
                                                                    <div
                                                                        className="h-full bg-primary rounded-full transition-all"
                                                                        style={{ width: `${Math.min(100, (progress.current / progress.target) * 100)}%` }}
                                                                    />
                                                                </div>
                                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                                    {progress.current} / {progress.target}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {isUnlocked && (
                                                        <span className="text-green-500">✓</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </motion.div>
        </motion.div>
    );
}
