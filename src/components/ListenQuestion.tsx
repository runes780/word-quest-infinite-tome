'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Volume2, Shield, Sword } from 'lucide-react';
import { cn } from '@/lib/utils';
import { speakText } from '@/lib/tts';
import type { Monster } from '@/store/gameStore';

interface ListenQuestionProps {
    question: Monster;
    selectedOption: number | null;
    isCorrect: boolean;
    showResult: boolean;
    disabled?: boolean;
    onAnswer: (index: number) => void;
    hiddenOptions?: number[];
}

export function ListenQuestion({
    question,
    selectedOption,
    isCorrect,
    showResult,
    disabled,
    onAnswer,
    hiddenOptions = [],
}: ListenQuestionProps) {
    // 播目标词（choice 的正确选项即 correctAnswer）
    const target = question.correctAnswer || question.options[question.correct_index] || '';

    useEffect(() => {
        if (!disabled && target) {
            speakText(target, 'en-US');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [question.id]);

    const replay = () => {
        if (target) speakText(target, 'en-US');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 text-xs font-bold uppercase tracking-wider">
                    Listen
                </span>
                <button
                    type="button"
                    onClick={replay}
                    disabled={showResult}
                    className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 disabled:opacity-50"
                >
                    <Volume2 className="w-4 h-4" />
                    Replay
                </button>
            </div>

            <p className="text-sm text-muted-foreground">
                Choose the word you heard.
            </p>

            <div className="grid grid-cols-1 gap-3">
                {question.options.map((option, index) => {
                    const clarityDisabled = hiddenOptions.includes(index);
                    const isSelected = selectedOption === index;
                    return (
                        <motion.button
                            key={index}
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: index * 0.1 }}
                            type="button"
                            onClick={() => onAnswer(index)}
                            disabled={showResult || clarityDisabled}
                            className={cn(
                                'w-full p-4 rounded-xl border-2 text-left font-medium transition-all hover:shadow-md hover:scale-[1.02]',
                                clarityDisabled && 'opacity-40 pointer-events-none grayscale',
                                isSelected
                                    ? isCorrect
                                        ? 'border-green-500 bg-green-500/10 text-green-500'
                                        : 'border-destructive bg-destructive/10 text-destructive'
                                    : 'border-border bg-card hover:border-primary hover:bg-primary/5'
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-lg">{option}</span>
                                {isSelected && (isCorrect
                                    ? <Sword className="w-5 h-5 animate-bounce" />
                                    : <Shield className="w-5 h-5 animate-pulse" />)}
                            </div>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
