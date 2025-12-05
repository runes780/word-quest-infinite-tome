'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Lightbulb, Keyboard, PenTool } from 'lucide-react';
import { Monster } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { translations } from '@/lib/translations';
import { playSound } from '@/lib/audio';

interface TypingQuestionProps {
    question: Monster;
    onAnswer: (isCorrect: boolean, userInput: string) => void;
    disabled?: boolean;
}

export function TypingQuestion({ question, onAnswer, disabled }: TypingQuestionProps) {
    const { language, soundEnabled } = useSettingsStore();
    const t = translations[language];
    const isZh = language === 'zh';

    const [userInput, setUserInput] = useState('');
    const [showHint, setShowHint] = useState(false);
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Get correct answer - from correctAnswer field or first option
    const correctAnswer = question.correctAnswer || question.options[question.correct_index];

    // Focus input on mount
    useEffect(() => {
        if (inputRef.current && !disabled) {
            inputRef.current.focus();
        }
    }, [disabled, question.id]);

    // Normalize answer for comparison (lowercase, trim, remove extra spaces)
    const normalizeAnswer = (str: string): string => {
        return str.toLowerCase().trim().replace(/\s+/g, ' ');
    };

    // Check if answer is correct (with some flexibility)
    const checkAnswer = (input: string): boolean => {
        const normalized = normalizeAnswer(input);
        const correct = normalizeAnswer(correctAnswer);

        // Exact match
        if (normalized === correct) return true;

        // Allow minor typos (Levenshtein distance <= 1 for short answers)
        if (correct.length <= 6 && levenshteinDistance(normalized, correct) <= 1) return true;

        // For longer answers, allow up to 2 character difference
        if (correct.length > 6 && levenshteinDistance(normalized, correct) <= 2) return true;

        return false;
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

        // Delay before moving to next question
        setTimeout(() => {
            onAnswer(isCorrect, userInput);
            setUserInput('');
            setFeedback(null);
            setShowHint(false);
        }, 1500);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };

    // Generate hint from correct answer (first letter + blanks)
    const generateHint = (): string => {
        if (correctAnswer.length <= 2) return correctAnswer[0] + '_';
        const hintLength = Math.ceil(correctAnswer.length / 3);
        return correctAnswer.slice(0, hintLength) + '_'.repeat(correctAnswer.length - hintLength);
    };

    return (
        <div className="w-full space-y-4">
            {/* Question mode indicator */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Keyboard className="w-4 h-4" />
                <span>{isZh ? '输入答案' : 'Type your answer'}</span>
            </div>

            {/* Input field */}
            <div className="relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled || !!feedback}
                    placeholder={isZh ? '在这里输入答案...' : 'Type your answer here...'}
                    className={`w-full px-6 py-4 text-lg rounded-2xl border-2 transition-all outline-none
                        ${feedback === 'correct'
                            ? 'border-green-500 bg-green-500/10 text-green-500'
                            : feedback === 'incorrect'
                                ? 'border-red-500 bg-red-500/10 text-red-500'
                                : 'border-border bg-secondary/50 focus:border-primary focus:bg-secondary'
                        }
                        disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                    autoComplete="off"
                    autoCapitalize="off"
                    spellCheck="false"
                />

                {/* Feedback icon */}
                <AnimatePresence>
                    {feedback && (
                        <motion.div
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full ${feedback === 'correct' ? 'bg-green-500' : 'bg-red-500'
                                }`}
                        >
                            {feedback === 'correct'
                                ? <Check className="w-5 h-5 text-white" />
                                : <X className="w-5 h-5 text-white" />
                            }
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Hint and Submit buttons */}
            <div className="flex gap-3">
                <button
                    onClick={() => setShowHint(!showHint)}
                    disabled={!!feedback}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary/50 hover:bg-secondary text-muted-foreground transition-colors disabled:opacity-50"
                >
                    <Lightbulb className="w-4 h-4" />
                    {isZh ? '提示' : 'Hint'}
                </button>

                <button
                    onClick={handleSubmit}
                    disabled={!userInput.trim() || disabled || !!feedback}
                    className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
                        ${!userInput.trim() || disabled || feedback
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25'
                        }`}
                >
                    <PenTool className="w-4 h-4" />
                    {isZh ? '提交答案' : 'Submit Answer'}
                </button>
            </div>

            {/* Hint display */}
            <AnimatePresence>
                {showHint && !feedback && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30"
                    >
                        <div className="flex items-center gap-2 text-amber-500">
                            <Lightbulb className="w-4 h-4" />
                            <span className="font-medium">{isZh ? '提示' : 'Hint'}: </span>
                            <span className="font-mono text-lg">{generateHint()}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

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
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Levenshtein distance for typo tolerance
function levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }

    return matrix[b.length][a.length];
}
