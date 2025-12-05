'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Timer, Trophy, Flame, Target, Play, X, Award } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import { translations } from '@/lib/translations';
import { getBalancedFallbackQuestions, FallbackQuestion } from '@/lib/data/fallbackQuestions';
import { playSound } from '@/lib/audio';

// Map event names to playSound methods
const sound = {
    click: () => playSound.click(),
    correct: () => playSound.success(),
    wrong: () => playSound.defeat(),
    victory: () => playSound.victory()
};

// Daily challenge configuration
const DAILY_CHALLENGE_TIME = 60; // 60 seconds
const DAILY_CHALLENGE_QUESTIONS = 10;

interface DailyChallengeStats {
    date: string; // YYYY-MM-DD
    score: number;
    correct: number;
    total: number;
    timeUsed: number;
    completed: boolean;
}

// LocalStorage key
const DAILY_STATS_KEY = 'word-quest-daily-challenge';

function getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
}

function loadDailyStats(): DailyChallengeStats | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(DAILY_STATS_KEY);
        if (!raw) return null;
        const stats = JSON.parse(raw) as DailyChallengeStats;
        // Only return if it's today's challenge
        if (stats.date === getTodayKey()) {
            return stats;
        }
        return null;
    } catch {
        return null;
    }
}

function saveDailyStats(stats: DailyChallengeStats): void {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(DAILY_STATS_KEY, JSON.stringify(stats));
    } catch (e) {
        console.error('Failed to save daily stats:', e);
    }
}

interface DailyChallengeProps {
    isOpen: boolean;
    onClose: () => void;
}

export function DailyChallenge({ isOpen, onClose }: DailyChallengeProps) {
    const { language, soundEnabled } = useSettingsStore();
    const t = translations[language];

    const [phase, setPhase] = useState<'intro' | 'playing' | 'result'>('intro');
    const [questions, setQuestions] = useState<FallbackQuestion[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [score, setScore] = useState(0);
    const [correct, setCorrect] = useState(0);
    const [timeLeft, setTimeLeft] = useState(DAILY_CHALLENGE_TIME);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [todayStats, setTodayStats] = useState<DailyChallengeStats | null>(null);
    const [streak, setStreak] = useState(0);

    // Load today's stats on mount
    useEffect(() => {
        if (isOpen) {
            const stats = loadDailyStats();
            setTodayStats(stats);
            if (stats?.completed) {
                setPhase('result');
                setScore(stats.score);
                setCorrect(stats.correct);
            } else {
                setPhase('intro');
            }
        }
    }, [isOpen]);

    // Timer countdown
    useEffect(() => {
        if (phase !== 'playing' || timeLeft <= 0) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    endChallenge();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [phase, timeLeft]);

    const startChallenge = useCallback(() => {
        const challengeQuestions = getBalancedFallbackQuestions(DAILY_CHALLENGE_QUESTIONS);
        setQuestions(challengeQuestions);
        setCurrentIndex(0);
        setScore(0);
        setCorrect(0);
        setStreak(0);
        setTimeLeft(DAILY_CHALLENGE_TIME);
        setSelectedOption(null);
        setShowFeedback(false);
        setPhase('playing');
        if (soundEnabled) sound.click();
    }, [soundEnabled]);

    const endChallenge = useCallback(() => {
        const stats: DailyChallengeStats = {
            date: getTodayKey(),
            score,
            correct,
            total: currentIndex,
            timeUsed: DAILY_CHALLENGE_TIME - timeLeft,
            completed: true
        };
        saveDailyStats(stats);
        setTodayStats(stats);
        setPhase('result');
        if (soundEnabled) sound.victory();
    }, [score, correct, currentIndex, timeLeft, soundEnabled]);

    const handleAnswer = (optionIndex: number) => {
        if (selectedOption !== null || showFeedback) return;

        setSelectedOption(optionIndex);
        const currentQ = questions[currentIndex];
        const isCorrect = optionIndex === currentQ.correct_index;

        if (isCorrect) {
            const newStreak = streak + 1;
            setStreak(newStreak);
            const points = 10 + (newStreak > 1 ? newStreak * 2 : 0); // Streak bonus
            setScore(prev => prev + points);
            setCorrect(prev => prev + 1);
            if (soundEnabled) sound.correct();
        } else {
            setStreak(0);
            if (soundEnabled) sound.wrong();
        }

        setShowFeedback(true);

        setTimeout(() => {
            if (currentIndex + 1 >= questions.length) {
                endChallenge();
            } else {
                setCurrentIndex(prev => prev + 1);
                setSelectedOption(null);
                setShowFeedback(false);
            }
        }, 800);
    };

    const currentQuestion = questions[currentIndex];

    // Intro screen
    const renderIntro = () => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
        >
            <div className="w-20 h-20 mx-auto mb-6 bg-accent/20 rounded-full flex items-center justify-center">
                <Trophy className="w-10 h-10 text-accent" />
            </div>
            <h2 className="text-2xl font-bold mb-2">
                {language === 'zh' ? '每日挑战' : 'Daily Challenge'}
            </h2>
            <p className="text-muted-foreground mb-6">
                {language === 'zh'
                    ? `${DAILY_CHALLENGE_QUESTIONS} 道题，${DAILY_CHALLENGE_TIME} 秒内完成！`
                    : `${DAILY_CHALLENGE_QUESTIONS} questions in ${DAILY_CHALLENGE_TIME} seconds!`
                }
            </p>

            <div className="grid grid-cols-3 gap-4 mb-8 text-sm">
                <div className="bg-secondary/50 p-3 rounded-lg">
                    <Timer className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <div className="font-medium">{DAILY_CHALLENGE_TIME}s</div>
                    <div className="text-muted-foreground text-xs">
                        {language === 'zh' ? '时间限制' : 'Time Limit'}
                    </div>
                </div>
                <div className="bg-secondary/50 p-3 rounded-lg">
                    <Target className="w-5 h-5 mx-auto mb-1 text-primary" />
                    <div className="font-medium">{DAILY_CHALLENGE_QUESTIONS}</div>
                    <div className="text-muted-foreground text-xs">
                        {language === 'zh' ? '题目数量' : 'Questions'}
                    </div>
                </div>
                <div className="bg-secondary/50 p-3 rounded-lg">
                    <Flame className="w-5 h-5 mx-auto mb-1 text-accent" />
                    <div className="font-medium">x2</div>
                    <div className="text-muted-foreground text-xs">
                        {language === 'zh' ? '连击加分' : 'Streak Bonus'}
                    </div>
                </div>
            </div>

            <button
                onClick={startChallenge}
                className="px-8 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-lg hover:opacity-90 transition-opacity flex items-center gap-2 mx-auto"
            >
                <Play className="w-5 h-5" />
                {language === 'zh' ? '开始挑战' : 'Start Challenge'}
            </button>
        </motion.div>
    );

    // Playing screen
    const renderPlaying = () => (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            {/* Timer bar */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium flex items-center gap-1">
                        <Timer className="w-4 h-4" />
                        {timeLeft}s
                    </span>
                    <span className="text-sm text-muted-foreground">
                        {currentIndex + 1}/{questions.length}
                    </span>
                    <span className="text-sm font-medium flex items-center gap-1">
                        <Trophy className="w-4 h-4 text-accent" />
                        {score}
                    </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-primary"
                        initial={{ width: '100%' }}
                        animate={{ width: `${(timeLeft / DAILY_CHALLENGE_TIME) * 100}%` }}
                        transition={{ duration: 0.5 }}
                    />
                </div>
            </div>

            {/* Streak indicator */}
            {streak > 1 && (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center justify-center gap-1 mb-4 text-accent font-bold"
                >
                    <Flame className="w-5 h-5" />
                    {streak}x {language === 'zh' ? '连击' : 'Streak'}!
                </motion.div>
            )}

            {/* Question */}
            {currentQuestion && (
                <div className="space-y-4">
                    <div className="text-center mb-6">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">
                            {currentQuestion.type}
                        </span>
                        <h3 className="text-lg font-medium mt-1">
                            {currentQuestion.question}
                        </h3>
                    </div>

                    <div className="grid gap-3">
                        {currentQuestion.options.map((option, idx) => {
                            const isSelected = selectedOption === idx;
                            const isCorrectAnswer = idx === currentQuestion.correct_index;
                            let buttonClass = 'p-4 rounded-xl border-2 text-left transition-all ';

                            if (showFeedback) {
                                if (isCorrectAnswer) {
                                    buttonClass += 'border-green-500 bg-green-500/10 text-green-700 dark:text-green-300';
                                } else if (isSelected && !isCorrectAnswer) {
                                    buttonClass += 'border-red-500 bg-red-500/10 text-red-700 dark:text-red-300';
                                } else {
                                    buttonClass += 'border-border bg-secondary/30 opacity-50';
                                }
                            } else {
                                buttonClass += 'border-border hover:border-primary hover:bg-primary/5';
                            }

                            return (
                                <motion.button
                                    key={idx}
                                    onClick={() => handleAnswer(idx)}
                                    disabled={showFeedback}
                                    className={buttonClass}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    {option}
                                </motion.button>
                            );
                        })}
                    </div>
                </div>
            )}
        </motion.div>
    );

    // Result screen
    const renderResult = () => {
        const accuracy = todayStats ? Math.round((todayStats.correct / todayStats.total) * 100) : 0;
        const grade = accuracy >= 90 ? 'S' : accuracy >= 70 ? 'A' : accuracy >= 50 ? 'B' : 'C';

        return (
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
            >
                <div className="w-24 h-24 mx-auto mb-6 bg-accent/20 rounded-full flex items-center justify-center">
                    <Award className="w-12 h-12 text-accent" />
                </div>

                <h2 className="text-2xl font-bold mb-2">
                    {language === 'zh' ? '今日挑战完成！' : 'Challenge Complete!'}
                </h2>

                <div className="text-6xl font-bold text-primary my-6">{grade}</div>

                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-secondary/50 p-4 rounded-xl">
                        <div className="text-2xl font-bold text-primary">{todayStats?.score || score}</div>
                        <div className="text-sm text-muted-foreground">
                            {language === 'zh' ? '得分' : 'Score'}
                        </div>
                    </div>
                    <div className="bg-secondary/50 p-4 rounded-xl">
                        <div className="text-2xl font-bold text-green-500">
                            {todayStats?.correct || correct}/{todayStats?.total || DAILY_CHALLENGE_QUESTIONS}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {language === 'zh' ? '正确' : 'Correct'}
                        </div>
                    </div>
                    <div className="bg-secondary/50 p-4 rounded-xl">
                        <div className="text-2xl font-bold">{accuracy}%</div>
                        <div className="text-sm text-muted-foreground">
                            {language === 'zh' ? '准确率' : 'Accuracy'}
                        </div>
                    </div>
                </div>

                <p className="text-muted-foreground mb-6">
                    {language === 'zh'
                        ? '明天再来挑战新纪录！'
                        : 'Come back tomorrow for a new challenge!'
                    }
                </p>

                <button
                    onClick={onClose}
                    className="px-8 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity"
                >
                    {language === 'zh' ? '关闭' : 'Close'}
                </button>
            </motion.div>
        );
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                    onClick={phase === 'intro' || phase === 'result' ? onClose : undefined}
                >
                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Close button */}
                        {phase !== 'playing' && (
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-1 rounded-full hover:bg-secondary"
                            >
                                <X className="w-5 h-5 text-muted-foreground" />
                            </button>
                        )}

                        {phase === 'intro' && renderIntro()}
                        {phase === 'playing' && renderPlaying()}
                        {phase === 'result' && renderResult()}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
