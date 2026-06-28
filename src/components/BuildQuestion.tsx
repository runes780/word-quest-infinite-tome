'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, PenTool, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Monster } from '@/store/gameStore';

interface BuildQuestionProps {
    question: Monster;
    onAnswer: (isCorrect: boolean, userInput: string) => void;
    disabled?: boolean;
}

function normalizeSentence(s: string): string {
    return s.toLowerCase().replace(/[^a-z''\s]/g, '').replace(/\s+/g, ' ').trim();
}

export function BuildQuestion({ question, onAnswer, disabled }: BuildQuestionProps) {
    const tiles: string[] = question.options ?? [];
    const target = question.correctAnswer ?? '';
    const [arranged, setArranged] = useState<number[]>([]);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);

    const remaining = tiles.map((_, i) => i).filter((i) => !arranged.includes(i));

    const addTile = (i: number) => {
        if (disabled || feedback) return;
        setArranged((prev) => [...prev, i]);
    };
    const removeLast = () => {
        if (disabled || feedback) return;
        setArranged((prev) => prev.slice(0, -1));
    };
    const reset = () => {
        if (disabled || feedback) return;
        setArranged([]);
    };

    const submit = () => {
        if (arranged.length !== tiles.length || disabled || feedback) return;
        const built = arranged.map((i) => tiles[i]).join(' ');
        const isCorrect = normalizeSentence(built) === normalizeSentence(target);
        setFeedback(isCorrect ? 'correct' : 'incorrect');
        setTimeout(() => {
            onAnswer(isCorrect, built);
            setArranged([]);
            setFeedback(null);
        }, 1500);
    };

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PenTool className="w-4 h-4" />
                <span>Rebuild the sentence</span>
            </div>

            <div className={cn(
                'min-h-[64px] p-4 rounded-2xl border-2 border-dashed transition-all flex flex-wrap gap-2 items-start',
                feedback === 'correct' ? 'border-green-500 bg-green-500/10'
                    : feedback === 'incorrect' ? 'border-red-500 bg-red-500/10'
                    : 'border-border bg-secondary/40'
            )}>
                {arranged.length === 0 && (
                    <span className="text-sm text-muted-foreground italic">Tap the words in order…</span>
                )}
                {arranged.map((tileIdx, pos) => (
                    <span key={pos} className="px-3 py-2 rounded-xl bg-card border border-border text-lg font-medium shadow-sm">
                        {tiles[tileIdx]}
                    </span>
                ))}
                <AnimatePresence>
                    {feedback && (
                        <motion.span
                            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                            className={cn('ml-auto self-center p-2 rounded-full', feedback === 'correct' ? 'bg-green-500' : 'bg-red-500')}
                        >
                            {feedback === 'correct' ? <Check className="w-4 h-4 text-white" /> : <X className="w-4 h-4 text-white" />}
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>

            <div className="flex flex-wrap gap-2">
                {remaining.map((i) => (
                    <motion.button
                        key={i}
                        type="button"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        onClick={() => addTile(i)}
                        disabled={disabled || !!feedback}
                        className="px-4 py-3 rounded-xl bg-primary/10 border-2 border-primary/20 text-lg font-medium hover:bg-primary/20 hover:border-primary/40 transition-all disabled:opacity-40"
                    >
                        {tiles[i]}
                    </motion.button>
                ))}
            </div>

            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={removeLast}
                    disabled={!arranged.length || disabled || !!feedback}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary/50 hover:bg-secondary text-muted-foreground transition-colors disabled:opacity-50"
                >
                    <RotateCcw className="w-4 h-4" />
                    Undo
                </button>
                <button
                    type="button"
                    onClick={reset}
                    disabled={!arranged.length || disabled || !!feedback}
                    className="px-4 py-3 rounded-xl bg-secondary/50 hover:bg-secondary text-muted-foreground transition-colors disabled:opacity-50"
                >
                    Clear
                </button>
                <button
                    type="button"
                    onClick={submit}
                    disabled={arranged.length !== tiles.length || disabled || !!feedback}
                    className={cn(
                        'flex-1 py-3 rounded-xl font-bold transition-all',
                        arranged.length !== tiles.length || disabled || feedback
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25'
                    )}
                >
                    Submit
                </button>
            </div>

            <AnimatePresence>
                {feedback === 'incorrect' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                        className="p-4 rounded-xl bg-red-500/10 border border-red-500/30"
                    >
                        <div className="text-red-500">
                            <span className="font-medium">Correct sentence: </span>
                            <span className="font-bold">{target}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
