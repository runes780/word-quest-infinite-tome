'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, Clock, Flame, Target, ChevronRight, X,
    Brain, TrendingUp, Calendar, Zap, Star, Award
} from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import { translations } from '@/lib/translations';
import {
    getSRSStats, getDueCardsWithPriority, FSRSCard,
    getPlayerProfile, GlobalPlayerProfile, xpProgressInLevel
} from '@/db/db';

interface SRSDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    onStartReview: (cards: FSRSCard[]) => void;
}

export function SRSDashboard({ isOpen, onClose, onStartReview }: SRSDashboardProps) {
    const { language } = useSettingsStore();
    const t = translations[language];
    const isZh = language === 'zh';

    const [stats, setStats] = useState<{ total: number; due: number; new: number; learning: number; review: number } | null>(null);
    const [profile, setProfile] = useState<GlobalPlayerProfile | null>(null);
    const [dueCards, setDueCards] = useState<FSRSCard[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Load data
    useEffect(() => {
        if (!isOpen) return;

        const loadData = async () => {
            setIsLoading(true);
            try {
                const [srsStats, playerProfile, cards] = await Promise.all([
                    getSRSStats(),
                    getPlayerProfile(),
                    getDueCardsWithPriority(5)
                ]);
                setStats(srsStats);
                setProfile(playerProfile);
                setDueCards(cards);
            } catch (e) {
                console.error('Failed to load SRS data:', e);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [isOpen]);

    const handleStartReview = useCallback(() => {
        if (dueCards.length > 0) {
            onStartReview(dueCards);
            onClose();
        }
    }, [dueCards, onStartReview, onClose]);

    // XP progress calculation
    const xpProgress = profile ? xpProgressInLevel(profile.totalXp, profile.globalLevel) : { current: 0, needed: 100 };
    const xpPercent = Math.min(100, (xpProgress.current / xpProgress.needed) * 100);

    // Daily progress
    const dailyPercent = profile ? Math.min(100, (profile.dailyXpEarned / profile.dailyXpGoal) * 100) : 0;

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={onClose}
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    exit={{ scale: 0.9, y: 20 }}
                    className="w-full max-w-2xl bg-gradient-to-br from-card via-card to-card/90 border border-border rounded-3xl shadow-2xl overflow-hidden"
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header with gradient */}
                    <div className="relative bg-gradient-to-r from-primary/20 via-purple-500/20 to-pink-500/20 p-6 border-b border-border/50">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5 text-muted-foreground" />
                        </button>

                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/20 rounded-2xl">
                                <Brain className="w-10 h-10 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-foreground">
                                    {isZh ? '复习看板' : 'Review Dashboard'}
                                </h2>
                                <p className="text-muted-foreground text-sm">
                                    {isZh ? 'FSRS 智能间隔重复' : 'FSRS Spaced Repetition'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="p-12 flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="p-6 space-y-6">
                            {/* Player Stats Bar */}
                            {profile && (
                                <div className="grid grid-cols-4 gap-3">
                                    <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl p-4 text-center border border-yellow-500/20">
                                        <Star className="w-6 h-6 mx-auto mb-1 text-yellow-500" />
                                        <div className="text-2xl font-bold text-yellow-500">Lv.{profile.globalLevel}</div>
                                        <div className="text-xs text-muted-foreground">{isZh ? '等级' : 'Level'}</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl p-4 text-center border border-blue-500/20">
                                        <Zap className="w-6 h-6 mx-auto mb-1 text-blue-500" />
                                        <div className="text-2xl font-bold text-blue-500">{profile.totalXp}</div>
                                        <div className="text-xs text-muted-foreground">XP</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-2xl p-4 text-center border border-orange-500/20">
                                        <Flame className="w-6 h-6 mx-auto mb-1 text-orange-500" />
                                        <div className="text-2xl font-bold text-orange-500">{profile.dailyStreak}</div>
                                        <div className="text-xs text-muted-foreground">{isZh ? '连续天数' : 'Streak'}</div>
                                    </div>
                                    <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-2xl p-4 text-center border border-green-500/20">
                                        <Award className="w-6 h-6 mx-auto mb-1 text-green-500" />
                                        <div className="text-2xl font-bold text-green-500">{profile.lessonsCompleted}</div>
                                        <div className="text-xs text-muted-foreground">{isZh ? '已完成' : 'Done'}</div>
                                    </div>
                                </div>
                            )}

                            {/* XP Progress Bar */}
                            {profile && (
                                <div className="bg-secondary/40 rounded-2xl p-4 border border-border/50">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-muted-foreground">
                                            {isZh ? '升级进度' : 'Level Progress'}
                                        </span>
                                        <span className="font-medium text-primary">
                                            {xpProgress.current} / {xpProgress.needed} XP
                                        </span>
                                    </div>
                                    <div className="h-3 bg-background/50 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${xpPercent}%` }}
                                            transition={{ duration: 0.5, delay: 0.2 }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Daily Goal */}
                            {profile && (
                                <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-2xl p-4 border border-green-500/20">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Target className="w-5 h-5 text-green-500" />
                                            <span className="font-medium text-green-500">
                                                {isZh ? '今日目标' : "Today's Goal"}
                                            </span>
                                        </div>
                                        <span className="text-sm text-muted-foreground">
                                            {profile.dailyXpEarned} / {profile.dailyXpGoal} XP
                                        </span>
                                    </div>
                                    <div className="h-2 bg-background/50 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${dailyPercent}%` }}
                                            transition={{ duration: 0.5, delay: 0.3 }}
                                        />
                                    </div>
                                    {dailyPercent >= 100 && (
                                        <div className="mt-2 text-center text-sm text-green-500 font-medium">
                                            🎉 {isZh ? '今日目标已完成！' : 'Daily goal achieved!'}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* SRS Stats Cards */}
                            {stats && (
                                <div className="grid grid-cols-3 gap-3">
                                    <div className="bg-blue-500/10 rounded-xl p-4 text-center border border-blue-500/20">
                                        <div className="text-3xl font-bold text-blue-500">{stats.new}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {isZh ? '新卡片' : 'New'}
                                        </div>
                                    </div>
                                    <div className="bg-orange-500/10 rounded-xl p-4 text-center border border-orange-500/20">
                                        <div className="text-3xl font-bold text-orange-500">{stats.learning}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {isZh ? '学习中' : 'Learning'}
                                        </div>
                                    </div>
                                    <div className="bg-green-500/10 rounded-xl p-4 text-center border border-green-500/20">
                                        <div className="text-3xl font-bold text-green-500">{stats.review}</div>
                                        <div className="text-xs text-muted-foreground mt-1">
                                            {isZh ? '待复习' : 'Review'}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Due Cards Preview */}
                            {dueCards.length > 0 && (
                                <div className="bg-secondary/30 rounded-2xl p-4 border border-border/50">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Clock className="w-4 h-4 text-primary" />
                                        <span className="font-medium text-sm">
                                            {isZh ? '待复习卡片' : 'Due for Review'}
                                        </span>
                                        <span className="ml-auto text-xs text-muted-foreground">
                                            {stats?.due || 0} {isZh ? '张到期' : 'cards due'}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {dueCards.slice(0, 3).map((card, idx) => (
                                            <div
                                                key={card.id || idx}
                                                className="p-3 bg-background/50 rounded-xl border border-border/50 flex items-center gap-3"
                                            >
                                                <div className={`w-2 h-2 rounded-full ${card.state === 0 ? 'bg-blue-500' :
                                                        card.state === 1 ? 'bg-orange-500' :
                                                            card.state === 3 ? 'bg-red-500' : 'bg-green-500'
                                                    }`} />
                                                <span className="text-sm truncate flex-1">
                                                    {card.question.slice(0, 50)}...
                                                </span>
                                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Start Review Button */}
                            <button
                                onClick={handleStartReview}
                                disabled={!stats?.due}
                                className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${stats?.due
                                        ? 'bg-gradient-to-r from-primary to-purple-500 text-white hover:opacity-90 shadow-lg shadow-primary/25'
                                        : 'bg-secondary text-muted-foreground cursor-not-allowed'
                                    }`}
                            >
                                <BookOpen className="w-6 h-6" />
                                {stats?.due
                                    ? (isZh ? `开始复习 (${stats.due}张)` : `Start Review (${stats.due} cards)`)
                                    : (isZh ? '暂无待复习卡片' : 'No cards due')
                                }
                            </button>

                            {/* Tips */}
                            <div className="text-center text-xs text-muted-foreground">
                                <TrendingUp className="w-4 h-4 inline mr-1" />
                                {isZh
                                    ? 'FSRS 根据你的表现智能调整复习间隔'
                                    : 'FSRS intelligently adjusts intervals based on performance'
                                }
                            </div>
                        </div>
                    )}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}
