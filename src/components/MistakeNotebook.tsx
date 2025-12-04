'use client';

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BookMarked, X, RefreshCw, ArrowUpRight } from 'lucide-react';
import { translations } from '@/lib/translations';
import { useSettingsStore } from '@/store/settingsStore';
import { useGameStore, Monster } from '@/store/gameStore';
import { getMistakes, MistakeRecord } from '@/lib/data/mistakes';
import { cn } from '@/lib/utils';

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

export function MistakeNotebook() {
    const { language } = useSettingsStore();
    const t = translations[language];
    const { injectQuestion } = useGameStore();
    const [isOpen, setIsOpen] = useState(false);
    const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        let mounted = true;
        setIsLoading(true);
        getMistakes().then((data) => {
            if (mounted) {
                setMistakes(data);
                setIsLoading(false);
            }
        });
        return () => {
            mounted = false;
        };
    }, [isOpen]);

    const handleQueue = (record: MistakeRecord) => {
        const monster = recordToMonster(record, record.explanation);
        injectQuestion(monster);
        setIsOpen(false);
    };

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
                                    <p className="text-sm text-muted-foreground">{t.notebook.subtitle}</p>
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
                            ) : (
                                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                    {mistakes.map((record) => (
                                        <div key={record.id} className="p-4 border border-border rounded-2xl bg-secondary/40">
                                            <div className="text-xs text-muted-foreground mb-1">
                                                {new Date(record.timestamp).toLocaleString()}
                                            </div>
                                            <p className="font-semibold mb-2">{record.questionText}</p>
                                            <p className="text-sm text-muted-foreground mb-3">{record.mentorAnalysis || record.explanation}</p>
                                            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                <span className="px-2 py-1 rounded-full bg-background/60 border border-border">
                                                    {t.notebook.correct}: {record.correctAnswer}
                                                </span>
                                                <span className="px-2 py-1 rounded-full bg-background/60 border border-border">
                                                    {t.notebook.chosen}: {record.wrongAnswer}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleQueue(record)}
                                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
                                            >
                                                {t.notebook.queue}
                                                <ArrowUpRight className="w-4 h-4" />
                                            </button>
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
