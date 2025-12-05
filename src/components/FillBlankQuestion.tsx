'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Lightbulb, FileText } from 'lucide-react';
import { Monster } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { translations } from '@/lib/translations';
import { playSound } from '@/lib/audio';

interface FillBlankQuestionProps {
    question: Monster;
    onAnswer: (isCorrect: boolean, userInput: string) => void;
    disabled?: boolean;
}

export function FillBlankQuestion({ question, onAnswer, disabled }: FillBlankQuestionProps) {
    const { language, soundEnabled } = useSettingsStore();
    const isZh = language === 'zh';

    const [userInput, setUserInput] = useState('');
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Get correct answer
    const correctAnswer = question.correctAnswer || question.options[question.correct_index];

    // Parse question to find blank position (marked with ___ or [blank])
    const parseQuestion = (): { before: string; after: string } => {
        const text = question.question;
        const blankPatterns = ['___', '[blank]', '____', '_____', '______'];

        for (const pattern of blankPatterns) {
            const idx = text.indexOf(pattern);
            if (idx !== -1) {
                return {
                    before: text.slice(0, idx),
                    after: text.slice(idx + pattern.length)
                };
            }
        }

        // If no blank marker, append blank at end
        return { before: text + ' ', after: '' };
    };

    const { before, after } = parseQuestion();

    // Focus input on mount
    useEffect(() => {
        if (inputRef.current && !disabled) {
            inputRef.current.focus();
        }
    }, [disabled, question.id]);

    // Normalize for comparison
    const normalizeAnswer = (str: string): string => {
        return str.toLowerCase().trim().replace(/\s+/g, ' ');
    };

    const checkAnswer = (input: string): boolean => {
        return normalizeAnswer(input) === normalizeAnswer(correctAnswer);
    };

    const handleSubmit = () => {
        if (!userInput.trim() || disabled || feedback) return;

        const isCorrect = checkAnswer(userInput);
        setFeedback(isCorrect ? 'correct' : 'incorrect');

        if (soundEnabled) {
            if (isCorrect) {
                playSound.success();
            } else {
                playSound.error();
            }
        }

        setTimeout(() => {
            onAnswer(isCorrect, userInput);
            setUserInput('');
            setFeedback(null);
        }, 1500);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    // Calculate input width based on correct answer length
    const inputWidth = Math.max(100, correctAnswer.length * 14 + 40);

    return (
        <div className="w-full space-y-6">
            {/* Question mode indicator */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span>{isZh ? '填空题' : 'Fill in the blank'}</span>
            </div>

            {/* Fill-blank sentence */}
            <div className="p-6 rounded-2xl bg-secondary/30 border border-border">
                <p className="text-lg leading-relaxed flex flex-wrap items-center gap-2">
                    <span>{before}</span>
                    <span className="inline-flex items-center">
                        <input
                            ref={inputRef}
                            type="text"
                            value={userInput}
                            onChange={(e) => setUserInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={disabled || !!feedback}
                            style={{ width: `${inputWidth}px` }}
                            className={`px-3 py-2 text-lg font-medium rounded-lg border-2 border-dashed transition-all outline-none text-center
                                ${feedback === 'correct'
                                    ? 'border-green-500 bg-green-500/20 text-green-500'
                                    : feedback === 'incorrect'
                                        ? 'border-red-500 bg-red-500/20 text-red-500'
                                        : 'border-primary/50 bg-primary/5 focus:border-primary focus:bg-primary/10'
                                }
                                disabled:opacity-50
                            `}
                            placeholder="..."
                            autoComplete="off"
                            autoCapitalize="off"
                            spellCheck="false"
                        />

                        {/* Inline feedback icon */}
                        <AnimatePresence>
                            {feedback && (
                                <motion.span
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="ml-2"
                                >
                                    {feedback === 'correct'
                                        ? <Check className="w-5 h-5 text-green-500" />
                                        : <X className="w-5 h-5 text-red-500" />
                                    }
                                </motion.span>
                            )}
                        </AnimatePresence>
                    </span>
                    <span>{after}</span>
                </p>
            </div>

            {/* Submit button */}
            <button
                onClick={handleSubmit}
                disabled={!userInput.trim() || disabled || !!feedback}
                className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all
                    ${!userInput.trim() || disabled || feedback
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25'
                    }`}
            >
                {isZh ? '确认答案' : 'Submit Answer'}
            </button>

            {/* Correct answer reveal on wrong */}
            <AnimatePresence>
                {feedback === 'incorrect' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="p-4 rounded-xl bg-red-500/10 border border-red-500/30"
                    >
                        <div className="text-red-500">
                            <span className="font-medium">{isZh ? '正确答案' : 'Correct answer'}: </span>
                            <span className="font-mono text-lg font-bold">{correctAnswer}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">
                            {before}<strong className="text-green-500">{correctAnswer}</strong>{after}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
