'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookMarked, X, RefreshCw, ArrowUpRight, Trash2, Brain, Clock, TrendingUp } from 'lucide-react';
import { translations } from '@/lib/translations';
import { useSettingsStore } from '@/store/settingsStore';
import { useGameStore, Monster } from '@/store/gameStore';
import { getMistakes, MistakeRecord, deleteMistake } from '@/lib/data/mistakes';
import { getCardByQuestionText, getMemoryStatus, FSRSCard } from '@/db/db';

function buildFallbackOptions(record: MistakeRecord) {
    const base = new Set<string>();
    if (record.correctAnswer) base.add(record.correctAnswer);
    if (record.wrongAnswer) base.add(record.wrongAnswer);
    let fillerIndex = 1;
    while (base.size < 4) {
        base.add(`Option ${fillerIndex++}`);
    }
    return Array.from(base);
}

function recordToMonster(record: MistakeRecord, fallbackExplanation: string): Monster {
    const revenge = record.revengeQuestion;
    if (revenge) {
        return {
            id: Date.now(),
            type: (revenge.type || record.type || 'vocab') as Monster['type'],
            question: revenge.question,
            options: revenge.options,
            correct_index: revenge.correct_index,
            explanation: revenge.explanation || fallbackExplanation,
            skillTag: record.skillTag || `${record.type || 'vocab'}_review`,
            difficulty: 'medium',
            questionMode: 'choice',
            correctAnswer: revenge.options[revenge.correct_index] || record.correctAnswer
        };
    }

    const options = record.options && record.options.length >= 2 ? record.options : buildFallbackOptions(record);
    const correctIndex = record.correctIndex ?? options.indexOf(record.correctAnswer);

    return {
        id: Date.now(),
        type: (record.type || 'vocab'),
        question: record.questionText,
        options,
        correct_index: correctIndex >= 0 ? correctIndex : 0,
        explanation: record.mentorAnalysis || fallbackExplanation || 'Revisit this concept.',
        skillTag: record.skillTag || `${record.type || 'vocab'}_review`,
        difficulty: 'medium',
        questionMode: 'choice',
        correctAnswer: record.correctAnswer
    } as Monster;
}

// Extended type with FSRS data
interface MistakeWithFSRS extends MistakeRecord {
    fsrsCard?: FSRSCard | null;
    memoryStatus?: ReturnType<typeof getMemoryStatus>;
}

export function MistakeNotebook() {
    const { language } = useSettingsStore();
    const t = translations[language];
    const isZh = language === 'zh';
    const { injectQuestion } = useGameStore();
    const [isOpen, setIsOpen] = useState(false);
    const [mistakes, setMistakes] = useState<MistakeWithFSRS[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        let mounted = true;

        const fetchMistakes = async () => {
            setIsLoading(true);
            try {
                const data = await getMistakes();

                // Fetch FSRS data for each mistake
                const withFSRS = await Promise.all(
                    data.map(async (record) => {
                        const fsrsCard = await getCardByQuestionText(record.questionText);
                        const memoryStatus = fsrsCard ? getMemoryStatus(fsrsCard) : undefined;
                        return { ...record, fsrsCard, memoryStatus };
                    })
                );

                if (mounted) {
                    setMistakes(withFSRS);
                }
            } finally {
                if (mounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchMistakes();

        return () => {
            mounted = false;
        };
    }, [isOpen]);

    const handleQueue = useCallback((record: MistakeRecord) => {
        const monster = recordToMonster(record, record.explanation);
        injectQuestion(monster);
        setIsOpen(false);
    }, [injectQuestion]);

    const handleDelete = useCallback(async (id: number) => {
        await deleteMistake(id);
        setMistakes(prev => prev.filter(m => m.id !== id));
        setDeleteConfirm(null);
    }, []);

    // Memory status indicator component - compact for mobile
    const MemoryIndicator = ({ status }: { status?: ReturnType<typeof getMemoryStatus> }) => {
        if (!status) {
            return (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
                    <Brain className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{isZh ? '未追踪' : 'Not tracked'}</span>
                </div>
            );
        }

        const retrievabilityPercent = Math.round(status.retrievability * 100);
        const stabilityDays = Math.round(status.stability * 10) / 10;

        const barColor = status.retrievability >= 0.9
            ? 'bg-green-500'
            : status.retrievability >= 0.7
                ? 'bg-yellow-500'
                : status.retrievability >= 0.5
                    ? 'bg-orange-500'
                    : 'bg-red-500';

        return (
            <div className="mt-3 p-2.5 sm:p-3 rounded-xl bg-background/60 border border-border/50 space-y-2">
                {/* Header row */}
                <div className="flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="flex-shrink-0">{status.statusEmoji}</span>
                        <span className="font-medium truncate">
                            {isZh ? status.statusText.zh : status.statusText.en}
                        </span>
                    </div>
                    <span className="text-muted-foreground flex-shrink-0 text-right">
                        {status.daysUntilDue > 0
                            ? `${Math.ceil(status.daysUntilDue)}${isZh ? '天后' : 'd'}`
                            : isZh ? '需复习' : 'Due'
                        }
                    </span>
                </div>

                {/* Retrievability bar */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 flex-shrink-0" />
                            <span className="hidden sm:inline">{isZh ? '可提取性' : 'Retrievability'}</span>
                            <span className="sm:hidden">{isZh ? '提取' : 'R'}</span>
                        </span>
                        <span className="font-mono">{retrievabilityPercent}%</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                            className={`h-full ${barColor} transition-all duration-300`}
                            style={{ width: `${retrievabilityPercent}%` }}
                        />
                    </div>
                </div>

                {/* Stability */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 flex-shrink-0" />
                        <span className="hidden sm:inline">{isZh ? '稳定性' : 'Stability'}</span>
                        <span className="sm:hidden">{isZh ? '稳定' : 'S'}</span>
                    </span>
                    <span className="font-mono">
                        {stabilityDays} {isZh ? '天' : 'd'}
                    </span>
                </div>
            </div>
        );
    };

    // Single mistake item - proper layout
    const MistakeItem = ({ record }: { record: MistakeWithFSRS }) => (
        <div className="p-3 sm:p-4 border border-border rounded-xl sm:rounded-2xl bg-secondary/40 relative overflow-hidden">
            {/* Delete button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(record.id!);
                }}
                className="absolute top-2 right-2 sm:top-3 sm:right-3 p-1.5 sm:p-2 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-colors z-[5]"
                title={isZh ? '删除记录' : 'Delete record'}
            >
                <Trash2 className="w-4 h-4" />
            </button>

            {/* Delete confirmation overlay */}
            <AnimatePresence>
                {deleteConfirm === record.id && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-card/95 backdrop-blur-sm rounded-xl sm:rounded-2xl flex flex-col items-center justify-center z-20 p-4"
                    >
                        <p className="text-sm mb-4 text-center">
                            {isZh ? '确定删除这条记录吗？' : 'Delete this record?'}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-3 sm:px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm"
                            >
                                {isZh ? '取消' : 'Cancel'}
                            </button>
                            <button
                                onClick={() => handleDelete(record.id!)}
                                className="px-3 sm:px-4 py-2 rounded-lg bg-red-500 text-white text-sm"
                            >
                                {isZh ? '删除' : 'Delete'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Content wrapper */}
            <div className="pr-8 sm:pr-10">
                {/* Timestamp */}
                <div className="text-xs text-muted-foreground mb-1">
                    {new Date(record.timestamp).toLocaleString()}
                </div>

                {/* Question */}
                <p className="font-semibold text-sm sm:text-base mb-1.5 sm:mb-2 line-clamp-2">
                    {record.questionText}
                </p>

                {/* Explanation */}
                <p className="text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3 line-clamp-2">
                    {record.mentorAnalysis || record.explanation}
                </p>

                {/* Answer badges */}
                <div className="flex flex-wrap gap-1.5 sm:gap-2 text-xs">
                    <span className="px-2 py-0.5 sm:py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-600 dark:text-green-400 truncate max-w-[45%]">
                        ✓ {record.correctAnswer}
                    </span>
                    <span className="px-2 py-0.5 sm:py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 truncate max-w-[45%]">
                        ✗ {record.wrongAnswer}
                    </span>
                </div>

                {/* FSRS Memory Status */}
                <MemoryIndicator status={record.memoryStatus} />

                {/* Queue button */}
                <button
                    onClick={() => handleQueue(record)}
                    className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                    {t.notebook.queue}
                    <ArrowUpRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-16 p-3 rounded-full bg-secondary/70 backdrop-blur text-primary-foreground hover:bg-secondary z-40"
                aria-label={t.notebook.open}
            >
                <BookMarked className="w-6 h-6" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur p-2 sm:p-4"
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.95, y: 20, opacity: 0 }}
                            className="w-full max-w-3xl max-h-[90vh] bg-card border border-border rounded-2xl sm:rounded-3xl flex flex-col overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-border flex-shrink-0">
                                <div className="min-w-0 flex-1 pr-4">
                                    <h3 className="text-xl sm:text-2xl font-bold text-primary truncate">
                                        {t.notebook.title}
                                    </h3>
                                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                        {t.notebook.subtitle}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 rounded-lg hover:bg-secondary transition-colors flex-shrink-0"
                                >
                                    <X className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
                                {isLoading ? (
                                    <div className="flex items-center justify-center gap-2 text-muted-foreground py-8">
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        {t.notebook.loading}
                                    </div>
                                ) : mistakes.length === 0 ? (
                                    <div className="text-center py-8">
                                        <BookMarked className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                                        <p className="text-muted-foreground text-sm">{t.notebook.empty}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {mistakes.map((record) => (
                                            <MistakeItem key={record.id} record={record} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
