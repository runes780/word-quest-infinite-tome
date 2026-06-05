
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useGameStore, Monster } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { OpenRouterClient } from '@/lib/ai/openrouter';
import { translations } from '@/lib/translations';
import { LEVEL_GENERATOR_SYSTEM_PROMPT, generateLevelPrompt } from '@/lib/ai/prompts';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, BookOpen, AlertCircle, Settings, ImageIcon, RefreshCw, Trophy, Brain, PlayCircle, Route, Clock, Target } from 'lucide-react';
import { SAMPLE_LEVELS, SampleLevel } from '@/lib/sampleLevels';
import { BlessingSelection, Blessing, BlessingEffect } from './BlessingSelection';
import { DailyChallenge } from './DailyChallenge';
import { SRSDashboard } from './SRSDashboard';
import { FSRSCard, getPlayerProfile } from '@/db/db';
import { normalizeMissionMonsters } from '@/lib/data/missionSanitizer';
import { getDailyPracticePlan, PracticePlan, PracticePlanStep } from '@/lib/data/dailyPracticePlan';
import { buildDailyFlameStatus, DailyFlameStatus } from '@/lib/data/dailyFlame';
import { objectiveTitle, supportLevelLabel } from '@/lib/data/learningObjectives';
import {
    createPracticePlanRun,
    currentPracticePlanStep,
    loadPracticePlanStepLaunch
} from '@/lib/data/practicePlanRunner';
import { DailyFlameCard } from './DailyFlameCard';
import type { AIProvider } from '@/lib/ai/modelOptions';

// Store blessing effect for the current run (passed to game state)
let currentBlessingEffect: BlessingEffect | null = null;
export function getCurrentBlessingEffect() { return currentBlessingEffect; }

function cardsToMonsters(cards: FSRSCard[], step?: PracticePlanStep): Monster[] {
    return cards.map((card, idx) => ({
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
        correctAnswer: card.options[card.correct_index] || '',
        learningObjectiveId: step?.objectiveId,
        supportLevel: step?.supportLevel,
        attemptKind: step?.attemptKind,
        sourceContextSpan: 'daily_plan'
    }));
}

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
    const [practicePlan, setPracticePlan] = useState<PracticePlan | null>(null);
    const [dailyFlameStatus, setDailyFlameStatus] = useState<DailyFlameStatus | null>(null);
    const [isPlanLoading, setIsPlanLoading] = useState(false);
    const [planError, setPlanError] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const { startGame } = useGameStore();
    const { apiKey, apiProvider, model, setSettingsOpen, language } = useSettingsStore();
    const t = translations[language];

    const refreshPracticePlan = useCallback(async () => {
        setIsPlanLoading(true);
        setPlanError('');
        try {
            const [nextPlan, profile] = await Promise.all([
                getDailyPracticePlan(),
                getPlayerProfile()
            ]);
            setPracticePlan(nextPlan);
            setDailyFlameStatus(buildDailyFlameStatus({ profile }));
        } catch (err) {
            console.error(err);
            setPlanError(language === 'zh' ? '今日计划暂时无法读取。' : 'Practice plan is unavailable right now.');
        } finally {
            setIsPlanLoading(false);
        }
    }, [language]);

    useEffect(() => {
        refreshPracticePlan();
    }, [refreshPracticePlan]);

    const startStarterPlan = useCallback((step?: PracticePlanStep) => {
        const sample = SAMPLE_LEVELS[0];
        const monsters = normalizeMissionMonsters(sample.monsters).map((monster) => ({
            ...monster,
            learningObjectiveId: step?.objectiveId || monster.learningObjectiveId,
            supportLevel: step?.supportLevel ?? monster.supportLevel,
            attemptKind: step?.attemptKind || 'diagnostic',
            sourceContextSpan: 'daily_plan'
        }));
        currentBlessingEffect = null;
        startGame(monsters, `Daily Learning Path\n${sample.title}`, 'battle');
    }, [startGame]);

    const handleStartPracticePlan = useCallback(async () => {
        setIsPlanLoading(true);
        setPlanError('');
        try {
            const freshPlan = await getDailyPracticePlan();
            setPracticePlan(freshPlan);
            const run = createPracticePlanRun(freshPlan);
            const primary = currentPracticePlanStep(run);
            if (!primary) {
                startStarterPlan();
                return;
            }

            const launch = await loadPracticePlanStepLaunch(primary);
            currentBlessingEffect = null;
            startGame(launch.monsters, launch.context, launch.source, run);
        } catch (err) {
            console.error(err);
            setPlanError(language === 'zh' ? '启动今日计划失败。' : 'Could not launch today\'s plan.');
        } finally {
            setIsPlanLoading(false);
        }
    }, [language, startGame, startStarterPlan]);

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
            const profile = await getPlayerProfile();
            const data = await fetchMissionWithRetry(input, apiKey, model, apiProvider, profile.globalLevel);
            if (!data.monsters || !Array.isArray(data.monsters)) {
                throw new Error('Invalid data format received from AI');
            }

            // Store questions and show blessing selection
            const normalizedMonsters = normalizeMissionMonsters(data.monsters);
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
        const normalizedMonsters = normalizeMissionMonsters(fallbackLevel.monsters);
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
                    const monsters = cardsToMonsters(cards);
                    const normalized = normalizeMissionMonsters(monsters);
                    if (normalized.length > 0) {
                        startGame(normalized, 'SRS Review', 'srs');
                    }
                }}
            />

            <div className="w-full max-w-2xl mx-auto p-6">
                {dailyFlameStatus && (
                    <DailyFlameCard status={dailyFlameStatus} language={language} />
                )}

                <PracticePlanPanel
                    plan={practicePlan}
                    isLoading={isPlanLoading}
                    error={planError}
                    language={language}
                    onStart={handleStartPracticePlan}
                    onRefresh={refreshPracticePlan}
                    onOpenSrs={() => setShowSRSDashboard(true)}
                    onOpenDaily={() => setShowDailyChallenge(true)}
                />

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

function PracticePlanPanel({
    plan,
    isLoading,
    error,
    language,
    onStart,
    onRefresh,
    onOpenSrs,
    onOpenDaily
}: {
    plan: PracticePlan | null;
    isLoading: boolean;
    error: string;
    language: 'en' | 'zh';
    onStart: () => void;
    onRefresh: () => void;
    onOpenSrs: () => void;
    onOpenDaily: () => void;
}) {
    const primary = plan?.steps[0];
    const isZh = language === 'zh';

    return (
        <motion.section
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mb-5 rounded-3xl border border-primary/20 bg-card/70 p-5 shadow-xl backdrop-blur-sm"
        >
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
                        <Route className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-foreground">
                            {isZh ? '今日学习路径' : 'Today\'s Learning Path'}
                        </h2>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-xs font-semibold text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {plan ? `${plan.estimatedMinutes} min` : '-- min'}
                            </span>
                            {primary && (
                                <span className="inline-flex items-center gap-1">
                                    <Target className="h-3.5 w-3.5" />
                                    {objectiveTitle(primary.objectiveId)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="grid h-10 w-10 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-secondary disabled:opacity-50"
                        aria-label={isZh ? '刷新今日计划' : 'Refresh practice plan'}
                    >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        type="button"
                        onClick={onStart}
                        disabled={isLoading}
                        className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                        <PlayCircle className="h-4 w-4" />
                        {isZh ? '开始' : 'Start'}
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                    {error}
                </div>
            )}

            <div className="space-y-2">
                {(plan?.steps || []).slice(0, 3).map((step, index) => (
                    <div key={step.id} className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/40 p-3">
                        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-black text-primary">
                            {index + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-bold text-foreground">{step.title}</p>
                                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                    {supportLevelLabel(step.supportLevel)}
                                </span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.rationale}</p>
                        </div>
                    </div>
                ))}
                {!plan && (
                    <div className="rounded-2xl border border-border/60 bg-background/40 p-3 text-sm text-muted-foreground">
                        {isLoading
                            ? (isZh ? '正在读取本地学习证据...' : 'Reading local learning evidence...')
                            : (isZh ? '暂无今日计划。' : 'No practice plan loaded.')}
                    </div>
                )}
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                    type="button"
                    onClick={onOpenSrs}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-500/40 bg-purple-500/10 px-3 py-2 text-sm font-bold text-purple-400 hover:bg-purple-500/20"
                >
                    <Brain className="h-4 w-4" />
                    {isZh ? '复习卡片' : 'SRS Review'}
                </button>
                <button
                    type="button"
                    onClick={onOpenDaily}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-bold text-accent hover:bg-accent/20"
                >
                    <Trophy className="h-4 w-4" />
                    {isZh ? '每日挑战' : 'Daily Challenge'}
                </button>
            </div>
        </motion.section>
    );
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

const fetchMissionWithRetry = async (text: string, apiKey: string, model: string, apiProvider: AIProvider, learnerLevel?: number) => {
    const client = new OpenRouterClient(apiKey, model, apiProvider);
    const parseRetryLimit = 1;
    let lastError: Error | null = null;

    // OpenRouterClient already has built-in retry/backoff.
    // Keep only a lightweight retry here for parse-only failures.
    for (let attempt = 0; attempt <= parseRetryLimit; attempt++) {
        try {
            const prompt = generateLevelPrompt(text, { learnerLevel });
            const jsonStr = await client.generate(prompt, LEVEL_GENERATOR_SYSTEM_PROMPT);
            const cleanJson = jsonStr.replace(/```json\n?|\n?```/g, '').trim();
            return safeParseMission(cleanJson);
        } catch (error) {
            lastError = error as Error;
            const isParseError = lastError.message === 'MISSION_EMPTY' || lastError.message === 'MISSION_PARSE_FAILED';
            if (isParseError && attempt < parseRetryLimit) {
                await wait(500);
                continue;
            }
            break;
        }
    }

    throw lastError || new Error('MISSION_UNKNOWN');
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
