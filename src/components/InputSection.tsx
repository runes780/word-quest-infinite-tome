
'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useGameStore, Monster } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { OpenRouterClient } from '@/lib/ai/openrouter';
import { translations } from '@/lib/translations';
import { LEVEL_GENERATOR_SYSTEM_PROMPT, generateLevelPrompt } from '@/lib/ai/prompts';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, BookOpen, AlertCircle, Settings, ImageIcon, RefreshCw, Trophy, Brain } from 'lucide-react';
import { SAMPLE_LEVELS, SampleLevel } from '@/lib/sampleLevels';
import { BlessingSelection, Blessing, BlessingEffect } from './BlessingSelection';
import { DailyChallenge } from './DailyChallenge';
import { SRSDashboard } from './SRSDashboard';
import { FSRSCard } from '@/db/db';
import { rebalanceQuestionModes } from '@/lib/data/questionModes';

// Store blessing effect for the current run (passed to game state)
let currentBlessingEffect: BlessingEffect | null = null;
export function getCurrentBlessingEffect() { return currentBlessingEffect; }

export function InputSection() {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [fallbackLevel, setFallbackLevel] = useState<SampleLevel | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isOcrLoading, setIsOcrLoading] = useState(false);
    const [ocrMessage, setOcrMessage] = useState('');
    const [showBlessingSelection, setShowBlessingSelection] = useState(false);
    const [pendingQuestions, setPendingQuestions] = useState<{ monsters: Monster[]; context: string } | null>(null);
    const [showDailyChallenge, setShowDailyChallenge] = useState(false);
    const [showSRSDashboard, setShowSRSDashboard] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const { startGame } = useGameStore();
    const { apiKey, model, setSettingsOpen, language } = useSettingsStore();
    const t = translations[language];


    const handleGenerate = async () => {
        if (!input.trim()) return;
        if (!apiKey) {
            setSettingsOpen(true);
            return;
        }

        setIsLoading(true);
        setError('');
        setFallbackLevel(null);

        try {
            const data = await fetchMissionWithRetry(input, apiKey, model);
            if (!data.monsters || !Array.isArray(data.monsters)) {
                throw new Error('Invalid data format received from AI');
            }

            // Store questions and show blessing selection
            const normalizedMonsters = normalizeMonsters(data.monsters);
            setPendingQuestions({ monsters: normalizedMonsters, context: input });
            setShowBlessingSelection(true);
            setFallbackLevel(null);
            setError('');
        } catch (err) {
            const message = err instanceof Error ? err.message : '';
            console.error(err);
            const isRateLimit = /429|rate limit|Too Many Requests/i.test(message);
            setError(isRateLimit ? t.input.throttled : t.input.error);
            const sample = SAMPLE_LEVELS[Math.floor(Math.random() * SAMPLE_LEVELS.length)];
            setFallbackLevel(sample);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUseSample = () => {
        if (!fallbackLevel) return;
        const normalizedMonsters = normalizeMonsters(fallbackLevel.monsters);
        // Store sample and show blessing selection
        setPendingQuestions({
            monsters: normalizedMonsters,
            context: `${fallbackLevel.title}\n${fallbackLevel.context}`
        });
        setShowBlessingSelection(true);
        setFallbackLevel(null);
        setError('');
    };

    const handleBlessingSelected = (blessing: Blessing) => {
        if (!pendingQuestions) return;

        // Store the blessing effect for game state to use
        currentBlessingEffect = blessing.effect;

        // Apply starting gold bonus if present
        const { startGame: start, addGold, heal } = useGameStore.getState();

        // Start the game
        start(pendingQuestions.monsters, pendingQuestions.context);

        // Apply blessing effects
        if (blessing.effect.startingGold) {
            addGold(blessing.effect.startingGold);
        }
        if (blessing.effect.maxHealthMod && blessing.effect.maxHealthMod > 0) {
            heal(blessing.effect.maxHealthMod);
        }

        // Clean up
        setShowBlessingSelection(false);
        setPendingQuestions(null);
    };

    const handleSkipBlessing = () => {
        if (!pendingQuestions) return;
        currentBlessingEffect = null;
        startGame(pendingQuestions.monsters, pendingQuestions.context);
        setShowBlessingSelection(false);
        setPendingQuestions(null);
    };


    useEffect(() => {
        return () => {
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
            }
        };
    }, [imagePreview]);

    const simulateOcr = async (file: File) => {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return `${t.input.imageStubText}: ${file.name}\n${t.input.imageDemoNotice}`;
    };

    const handleImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (imagePreview) URL.revokeObjectURL(imagePreview);
        setImagePreview(URL.createObjectURL(file));
        setIsOcrLoading(true);
        setOcrMessage('');
        try {
            const text = await simulateOcr(file);
            setInput((prev) => (prev ? `${prev}\n\n${text}` : text));
            setOcrMessage(t.input.imageDetected);
        } catch (err) {
            console.error(err);
            setError(t.input.error);
        } finally {
            setIsOcrLoading(false);
        }
    };

    const handleOpenFilePicker = () => {
        fileInputRef.current?.click();
    };


    return (
        <>
            {/* Blessing Selection Modal */}
            <AnimatePresence>
                {showBlessingSelection && (
                    <BlessingSelection
                        onSelect={handleBlessingSelected}
                        onSkip={handleSkipBlessing}
                    />
                )}
            </AnimatePresence>

            {/* Daily Challenge Modal */}
            <DailyChallenge
                isOpen={showDailyChallenge}
                onClose={() => setShowDailyChallenge(false)}
            />

            {/* SRS Dashboard Modal */}
            <SRSDashboard
                isOpen={showSRSDashboard}
                onClose={() => setShowSRSDashboard(false)}
                onStartReview={(cards: FSRSCard[]) => {
                    // Convert FSRS cards to Monster format for game
                    const monsters = cards.map((card, idx) => ({
                        id: card.id || Date.now() + idx,
                        type: card.type || 'vocab' as const,
                        question: card.question,
                        options: card.options,
                        correct_index: card.correct_index,
                        explanation: card.explanation || '',
                        hint: card.hint,
                        skillTag: card.skillTag || `${card.type || 'vocab'}_review`,
                        difficulty: 'medium' as const,
                        questionMode: 'choice' as const,
                        correctAnswer: card.options[card.correct_index] || ''
                    }));
                    if (monsters.length > 0) {
                        startGame(monsters, 'SRS Review', 'srs');
                    }
                }}
            />

            <div className="w-full max-w-2xl mx-auto p-6">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="bg-card/50 backdrop-blur-sm border border-border rounded-3xl p-8 shadow-2xl"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-primary/20 rounded-xl">
                            <BookOpen className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-foreground">{t.input.title}</h2>
                            <p className="text-muted-foreground">{t.input.subtitle}</p>
                        </div>
                    </div>

                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={t.input.placeholder}
                        className="w-full h-48 bg-secondary/50 border border-input rounded-xl p-4 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none resize-none mb-6 transition-all"
                    />

                    <div className="mb-6 border border-dashed border-border rounded-2xl p-4 bg-secondary/30">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4" /> {t.input.imageUpload}
                                </p>
                                <p className="text-xs text-muted-foreground">{t.input.imageHint}</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenFilePicker}
                                disabled={isOcrLoading}
                                className="px-3 py-1.5 text-xs rounded-lg border border-primary text-primary hover:bg-primary/10 disabled:opacity-60"
                            >
                                {imagePreview ? t.input.imageReplace : t.input.imageUploadButton}
                            </button>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleImageSelected}
                        />
                        <div className="relative flex items-center justify-center h-32 bg-background/40 rounded-xl overflow-hidden">
                            {imagePreview ? (
                                <Image
                                    src={imagePreview}
                                    alt="Selected study material"
                                    fill
                                    sizes="128px"
                                    className="object-contain"
                                    unoptimized
                                />
                            ) : (
                                <p className="text-xs text-muted-foreground">PNG/JPG, under 5MB recommended.</p>
                            )}
                            {isOcrLoading && (
                                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center text-white text-xs gap-2">
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    {t.input.imageProcessing}
                                </div>
                            )}
                        </div>
                        {ocrMessage && (
                            <p className="text-xs text-green-500 mt-2">{ocrMessage}</p>
                        )}
                    </div>

                    {error && (
                        <div className="space-y-3 mb-4">
                            <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg">
                                <AlertCircle className="w-5 h-5" />
                                <p className="text-sm font-medium">{error}</p>
                            </div>
                            {fallbackLevel && (
                                <div className="flex flex-col gap-3 bg-secondary/40 border border-border rounded-xl p-4">
                                    <div>
                                        <p className="text-sm font-bold">{t.input.fallbackTitle}</p>
                                        <p className="text-xs text-muted-foreground">{t.input.fallbackSubtitle}</p>
                                    </div>
                                    <button
                                        onClick={handleUseSample}
                                        className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
                                    >
                                        {t.input.useSample}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {!apiKey ? (
                        <button
                            onClick={() => setSettingsOpen(true)}
                            className="w-full py-4 bg-secondary text-secondary-foreground rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-secondary/80 transition-all"
                        >
                            <Settings className="w-5 h-5" />
                            {t.input.configureKey}
                        </button>
                    ) : (
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowSRSDashboard(true)}
                                className="px-4 py-4 bg-purple-500/20 border-2 border-purple-500 text-purple-500 rounded-xl font-bold hover:bg-purple-500/30 transition-all flex items-center gap-2"
                                title={language === 'zh' ? '复习看板' : 'Review Dashboard'}
                            >
                                <Brain className="w-6 h-6" />
                            </button>
                            <button
                                onClick={() => setShowDailyChallenge(true)}
                                className="px-4 py-4 bg-accent/20 border-2 border-accent text-accent rounded-xl font-bold hover:bg-accent/30 transition-all flex items-center gap-2"
                                title={language === 'zh' ? '每日挑战' : 'Daily Challenge'}
                            >
                                <Trophy className="w-6 h-6" />
                            </button>
                            <button
                                onClick={handleGenerate}
                                disabled={isLoading || !input.trim()}
                                className={`flex-1 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all
                  ${isLoading || !input.trim()
                                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                        : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/25'
                                    }`}
                            >
                                {isLoading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                        {t.input.analyzing}
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        {t.input.initialize}
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                    {(isLoading || model.endsWith(':free')) && (
                        <p className="text-xs text-muted-foreground mt-3 text-center">
                            {t.input.throttled}
                        </p>
                    )}
                </motion.div>
            </div>
        </>
    );
}

const DEFAULT_MODE_SEQUENCE: Array<'choice' | 'typing' | 'fill-blank'> = [
    'choice', 'choice', 'choice', 'choice', 'choice',
    'typing', 'typing', 'typing',
    'fill-blank', 'fill-blank'
];

function normalizeMonsters(input: unknown[]): Monster[] {
    if (!Array.isArray(input)) return [];
    const normalized = input.map((raw, index) => {
        const source = (raw || {}) as Partial<Monster>;
        const options = Array.isArray(source.options) ? source.options.filter(Boolean) : [];
        const safeOptions = options.length >= 2
            ? options.slice(0, 4)
            : ['A', 'B', 'C', 'D'];
        const safeCorrectIndex = typeof source.correct_index === 'number' && source.correct_index >= 0 && source.correct_index < safeOptions.length
            ? source.correct_index
            : 0;
        const questionMode = source.questionMode || DEFAULT_MODE_SEQUENCE[index % DEFAULT_MODE_SEQUENCE.length];
        const correctAnswer = (source.correctAnswer && source.correctAnswer.trim()) || safeOptions[safeCorrectIndex] || '';

        return {
            id: source.id ?? Date.now() + index,
            type: source.type || 'vocab',
            question: source.question || `Question ${index + 1}`,
            options: safeOptions,
            correct_index: safeCorrectIndex,
            explanation: source.explanation || '',
            hint: source.hint,
            skillTag: source.skillTag || `${source.type || 'vocab'}_core`,
            difficulty: source.difficulty || 'medium',
            questionMode,
            correctAnswer,
            learningObjectiveId: source.learningObjectiveId,
            sourceContextSpan: source.sourceContextSpan
        };
    });
    return rebalanceQuestionModes(normalized) as Monster[];
}

const safeParseMission = (payload: string) => {
    const trimmed = payload.trim();
    if (!trimmed) {
        console.warn('Mission JSON parse skipped (empty payload). Will retry.');
        throw new Error('MISSION_EMPTY');
    }

    try {
        return JSON.parse(trimmed);
    } catch (error) {
        const fallback = extractJsonBlock(trimmed);
        if (fallback) {
            try {
                return JSON.parse(fallback);
            } catch (inner) {
                console.warn('Mission JSON fallback parse failed. Will retry.', { fallback, inner });
            }
        }
        console.warn('Mission JSON parse failed. Will retry.', { error });
        throw new Error('MISSION_PARSE_FAILED');
    }
};

const extractJsonBlock = (input: string) => {
    const start = input.indexOf('{');
    const end = input.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        return null;
    }
    return input.slice(start, end + 1);
};

const fetchMissionWithRetry = async (text: string, apiKey: string, model: string) => {
    const client = new OpenRouterClient(apiKey, model);
    const attempts = model.endsWith(':free') ? 3 : 2;
    const baseDelay = model.endsWith(':free') ? 2000 : 1000;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
        try {
            const prompt = generateLevelPrompt(text);
            const jsonStr = await client.generate(prompt, LEVEL_GENERATOR_SYSTEM_PROMPT);
            const cleanJson = jsonStr.replace(/```json\n?|\n?```/g, '').trim();
            return safeParseMission(cleanJson);
        } catch (error) {
            lastError = error as Error;
            if (attempt < attempts - 1) {
                const jitter = 0.5 + Math.random();
                await wait(baseDelay * (attempt + 1) * jitter);
                continue;
            }
        }
    }

    throw lastError || new Error('MISSION_UNKNOWN');
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
