'use client';

import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookMarked, X, RefreshCw, ArrowUpRight, Trash2, Brain, Clock, TrendingUp } from 'lucide-react';
import { translations } from '@/lib/translations';
import { useSettingsStore } from '@/store/settingsStore';
import { useGameStore, Monster } from '@/store/gameStore';
import { getMistakes, MistakeRecord, deleteMistake } from '@/lib/data/mistakes';
import { getCardByQuestionText, getMemoryStatus, FSRSCard } from '@/db/db';
import { VirtualList } from './VirtualList';

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
            explanation: revenge.explanation || fallbackExplanation
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
        explanation: record.mentorAnalysis || fallbackExplanation || 'Revisit this concept.'
    } as Monster;
}

// Extended type with FSRS data
interface MistakeWithFSRS extends MistakeRecord {
    fsrsCard?: FSRSCard | null;
    memoryStatus?: ReturnType<typeof getMemoryStatus>;
}

// Item height for virtual scrolling
const ITEM_HEIGHT = 220;

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

    // Memory status indicator component
    const MemoryIndicator = ({ status }: { status?: ReturnType<typeof getMemoryStatus> }) => {
        if (!status) {
            return (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Brain className="w-3 h-3" />
                    <span>{isZh ? '未追踪' : 'Not tracked'}</span>
                </div>
            );
        }

        const retrievabilityPercent = Math.round(status.retrievability * 100);
        const stabilityDays = Math.round(status.stability * 10) / 10;

        // Color based on retrievability
        const barColor = status.retrievability >= 0.9
            ? 'bg-green-500'
            : status.retrievability >= 0.7
                ? 'bg-yellow-500'
                : status.retrievability >= 0.5
                    ? 'bg-orange-500'
                    : 'bg-red-500';

        return (
            <div className="space-y-2 mt-3 p-3 rounded-xl bg-background/50 border border-border/50">
                <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1">
                        <span>{status.statusEmoji}</span>
                        <span className="font-medium">
                            {isZh ? status.statusText.zh : status.statusText.en}
                        </span>
                    </div>
                    <span className="text-muted-foreground">
                        {status.daysUntilDue > 0
                            ? `${Math.ceil(status.daysUntilDue)}${isZh ? '天后复习' : 'd until review'}`
                            : isZh ? '需要复习' : 'Due now'
                        }
                    </span>
                </div>

                {/* Retrievability bar */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            {isZh ? '可提取性' : 'Retrievability'}
                        </span>
                        <span className="font-mono">{retrievabilityPercent}%</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                            className={`h-full ${barColor} transition-all`}
                            style={{ width: `${retrievabilityPercent}%` }}
                        />
                    </div>
                </div>

                {/* Stability indicator */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {isZh ? '稳定性' : 'Stability'}
                    </span>
                    <span className="font-mono">
                        {stabilityDays} {isZh ? '天' : 'days'}
                    </span>
                </div>
            </div>
        );
    };

    // Render a single mistake item
    const renderMistakeItem = useCallback((record: MistakeWithFSRS) => (
        <div className="p-4 border border-border rounded-2xl bg-secondary/40 mb-3 mr-2 relative">
            {/* Delete button */}
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirm(record.id!);
                }}
                className="absolute top-3 right-3 p-2 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-500 transition-colors"
                title={isZh ? '删除记录' : 'Delete record'}
            >
                <Trash2 className="w-4 h-4" />
            </button>

            {/* Delete confirmation */}
            <AnimatePresence>
                {deleteConfirm === record.id && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute inset-0 bg-card/95 backdrop-blur rounded-2xl flex flex-col items-center justify-center z-10"
                    >
                        <p className="text-sm mb-4">
                            {isZh ? '确定删除这条记录吗？' : 'Delete this record?'}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm"
                            >
                                {isZh ? '取消' : 'Cancel'}
                            </button>
                            <button
                                onClick={() => handleDelete(record.id!)}
                                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm"
                            >
                                {isZh ? '删除' : 'Delete'}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="text-xs text-muted-foreground mb-1">
                {new Date(record.timestamp).toLocaleString()}
            </div>
            <p className="font-semibold mb-2 line-clamp-2 pr-8">{record.questionText}</p>
            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                {record.mentorAnalysis || record.explanation}
            </p>

            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="px-2 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-600">
                    ✓ {record.correctAnswer}
                </span>
                <span className="px-2 py-1 rounded-full bg-red-500/10 border border-red-500/30 text-red-500">
                    ✗ {record.wrongAnswer}
                </span>
            </div>

            {/* FSRS Memory Status */}
            <MemoryIndicator status={record.memoryStatus} />

            <button
                onClick={() => handleQueue(record)}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
            >
                {t.notebook.queue}
                <ArrowUpRight className="w-4 h-4" />
            </button>
        </div>
    ), [t.notebook, handleQueue, handleDelete, deleteConfirm, isZh]);

    const useVirtual = mistakes.length > 10;

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
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur"
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 40, opacity: 0 }}
                            animate={{ scale: 1, y: 0, opacity: 1 }}
                            exit={{ scale: 0.9, y: 40, opacity: 0 }}
                            className="w-full max-w-3xl bg-card border border-border rounded-3xl p-6 m-4"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-2xl font-bold text-primary">{t.notebook.title}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {t.notebook.subtitle}
                                        {mistakes.length > 10 && (
                                            <span className="ml-2 text-xs text-green-500">
                                                ⚡ {isZh ? '虚拟滚动启用' : 'Virtual scroll enabled'}
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <button onClick={() => setIsOpen(false)}>
                                    <X className="w-6 h-6 text-muted-foreground" />
                                </button>
                            </div>

                            {isLoading ? (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    {t.notebook.loading}
                                </div>
                            ) : mistakes.length === 0 ? (
                                <p className="text-muted-foreground text-sm">{t.notebook.empty}</p>
                            ) : useVirtual ? (
                                <VirtualList
                                    items={mistakes}
                                    itemHeight={ITEM_HEIGHT}
                                    containerHeight={Math.min(60 * 16, typeof window !== 'undefined' ? window.innerHeight * 0.6 : 500)}
                                    renderItem={renderMistakeItem}
                                    className="pr-2"
                                />
                            ) : (
                                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                                    {mistakes.map((record) => (
                                        <div key={record.id}>
                                            {renderMistakeItem(record)}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
