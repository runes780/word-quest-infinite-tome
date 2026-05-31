'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, Check, X, AlertCircle } from 'lucide-react';
import { useSpeechRecognition } from '@/lib/speechRecognition';
import { useSettingsStore } from '@/store/settingsStore';
import { playSound } from '@/lib/audio';

interface VoiceInputProps {
    correctAnswer: string;
    onAnswer: (isCorrect: boolean, spokenText: string) => void;
    disabled?: boolean;
    options?: string[]; // For multiple choice, match spoken text to options
}

export function VoiceInput({ correctAnswer, onAnswer, disabled, options }: VoiceInputProps) {
    const { language, soundEnabled } = useSettingsStore();
    const isZh = language === 'zh';
    const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const processedTranscriptRef = useRef<string | null>(null);

    const {
        isSupported,
        isListening,
        transcript,
        interimTranscript,
        error,
        startListening,
        stopListening,
        resetTranscript
    } = useSpeechRecognition({
        language: isZh ? 'zh-CN' : 'en-US',
        continuous: false,
        interimResults: true
    });

    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);
    const [matchedOption, setMatchedOption] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            if (submitTimerRef.current) {
                clearTimeout(submitTimerRef.current);
            }
        };
    }, []);

    // Normalize text for comparison
    const normalizeText = (text: string): string => {
        return text.toLowerCase().trim()
            .replace(/[.,!?;:'"]/g, '')
            .replace(/\s+/g, ' ');
    };

    // Check if spoken text matches correct answer or any option
    const checkMatch = useCallback((spoken: string): { isCorrect: boolean; matched: string | null } => {
        const normalizedSpoken = normalizeText(spoken);
        const normalizedCorrect = normalizeText(correctAnswer);

        // Direct match with correct answer
        if (normalizedSpoken === normalizedCorrect ||
            normalizedSpoken.includes(normalizedCorrect) ||
            normalizedCorrect.includes(normalizedSpoken)) {
            return { isCorrect: true, matched: correctAnswer };
        }

        // Match against options if provided
        if (options) {
            for (const option of options) {
                const normalizedOption = normalizeText(option);
                if (normalizedSpoken === normalizedOption ||
                    normalizedSpoken.includes(normalizedOption) ||
                    normalizedOption.includes(normalizedSpoken)) {
                    const isCorrect = normalizeText(option) === normalizeText(correctAnswer);
                    return { isCorrect, matched: option };
                }
            }

            // Try to match by number or letter (A, B, C, D or 1, 2, 3, 4)
            const numberMatch = normalizedSpoken.match(/^([1-4一二三四])$/);
            const letterMatch = normalizedSpoken.match(/^([a-d])$/);

            if (numberMatch) {
                const numMap: Record<string, number> = { '1': 0, '2': 1, '3': 2, '4': 3, '一': 0, '二': 1, '三': 2, '四': 3 };
                const idx = numMap[numberMatch[1]];
                if (idx !== undefined && idx < options.length) {
                    const isCorrect = options[idx] === correctAnswer;
                    return { isCorrect, matched: options[idx] };
                }
            }

            if (letterMatch) {
                const idx = letterMatch[1].charCodeAt(0) - 'a'.charCodeAt(0);
                if (idx < options.length) {
                    const isCorrect = options[idx] === correctAnswer;
                    return { isCorrect, matched: options[idx] };
                }
            }
        }

        return { isCorrect: false, matched: null };
    }, [correctAnswer, options]);

    // Handle completed speech
    useEffect(() => {
        if (isListening || !transcript || feedback || processedTranscriptRef.current === transcript) return;

        processedTranscriptRef.current = transcript;
        const result = checkMatch(transcript);
        const feedbackTimer = setTimeout(() => {
            setMatchedOption(result.matched);
            setFeedback(result.isCorrect ? 'correct' : 'incorrect');

            if (soundEnabled) {
                if (result.isCorrect) {
                    playSound.success();
                } else {
                    playSound.error();
                }
            }

            submitTimerRef.current = setTimeout(() => {
                onAnswer(result.isCorrect, transcript);
                resetTranscript();
                setFeedback(null);
                setMatchedOption(null);
                processedTranscriptRef.current = null;
                submitTimerRef.current = null;
            }, 1500);
        }, 0);

        return () => clearTimeout(feedbackTimer);
    }, [isListening, transcript, feedback, checkMatch, onAnswer, resetTranscript, soundEnabled]);

    const handleMicClick = () => {
        if (disabled || feedback) return;

        if (isListening) {
            stopListening();
        } else {
            resetTranscript();
            startListening();
            if (soundEnabled) {
                playSound.click();
            }
        }
    };

    if (!isSupported) {
        return (
            <div className="p-4 rounded-xl bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="w-5 h-5" />
                    <span className="text-sm">
                        {isZh ? '您的浏览器不支持语音识别' : 'Speech recognition not supported in your browser'}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Voice Input Button */}
            <div className="flex justify-center">
                <motion.button
                    onClick={handleMicClick}
                    disabled={disabled || !!feedback}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`relative p-6 rounded-full transition-all ${isListening
                            ? 'bg-red-500 text-white shadow-lg shadow-red-500/50'
                            : feedback === 'correct'
                                ? 'bg-green-500 text-white'
                                : feedback === 'incorrect'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25'
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                    {/* Pulsing ring when listening */}
                    {isListening && (
                        <>
                            <motion.div
                                className="absolute inset-0 rounded-full border-4 border-red-400"
                                initial={{ scale: 1, opacity: 1 }}
                                animate={{ scale: 1.5, opacity: 0 }}
                                transition={{ duration: 1, repeat: Infinity }}
                            />
                            <motion.div
                                className="absolute inset-0 rounded-full border-4 border-red-400"
                                initial={{ scale: 1, opacity: 1 }}
                                animate={{ scale: 1.3, opacity: 0 }}
                                transition={{ duration: 1, repeat: Infinity, delay: 0.5 }}
                            />
                        </>
                    )}

                    {feedback === 'correct' ? (
                        <Check className="w-8 h-8" />
                    ) : feedback === 'incorrect' ? (
                        <X className="w-8 h-8" />
                    ) : isListening ? (
                        <MicOff className="w-8 h-8" />
                    ) : (
                        <Mic className="w-8 h-8" />
                    )}
                </motion.button>
            </div>

            {/* Status text */}
            <p className="text-center text-sm text-muted-foreground">
                {isListening ? (
                    <span className="flex items-center justify-center gap-2">
                        <Volume2 className="w-4 h-4 animate-pulse" />
                        {isZh ? '正在聆听...' : 'Listening...'}
                    </span>
                ) : feedback ? (
                    feedback === 'correct'
                        ? (isZh ? '✨ 正确!' : '✨ Correct!')
                        : (isZh ? '💥 错误' : '💥 Incorrect')
                ) : (
                    isZh ? '点击麦克风开始说话' : 'Tap the microphone to speak'
                )}
            </p>

            {/* Transcript display */}
            <AnimatePresence>
                {(transcript || interimTranscript) && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`p-4 rounded-xl border-2 ${feedback === 'correct'
                                ? 'bg-green-500/10 border-green-500/30'
                                : feedback === 'incorrect'
                                    ? 'bg-red-500/10 border-red-500/30'
                                    : 'bg-secondary/50 border-border'
                            }`}
                    >
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Volume2 className="w-4 h-4" />
                            <span>{isZh ? '您说的是' : 'You said'}:</span>
                        </div>
                        <p className="text-lg font-medium">
                            {transcript}
                            {interimTranscript && (
                                <span className="text-muted-foreground opacity-60">
                                    {interimTranscript}
                                </span>
                            )}
                        </p>
                        {matchedOption && feedback === 'incorrect' && (
                            <p className="text-sm text-muted-foreground mt-2">
                                {isZh ? '识别为' : 'Matched'}: <strong>{matchedOption}</strong>
                            </p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error display */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 text-sm"
                    >
                        <AlertCircle className="w-4 h-4 inline mr-2" />
                        {error === 'no-speech'
                            ? (isZh ? '未检测到语音' : 'No speech detected')
                            : error === 'audio-capture'
                                ? (isZh ? '无法访问麦克风' : 'Could not access microphone')
                                : error
                        }
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
