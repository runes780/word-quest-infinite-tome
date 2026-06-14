
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useGameStore, Monster } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { translations } from '@/lib/translations';
import { generateQuestionPack } from '@/lib/ai/questionPipeline';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    BookOpen,
    AlertCircle,
    Settings,
    ImageIcon,
    RefreshCw,
    Trophy,
    Brain,
    PlayCircle,
    Route,
    Clock,
    Target,
    Paperclip,
    FileText,
    CheckCircle2,
    X
} from 'lucide-react';
import { SAMPLE_LEVELS, SampleLevel } from '@/lib/sampleLevels';
import { BlessingSelection, Blessing, BlessingEffect } from './BlessingSelection';
import { DailyChallenge } from './DailyChallenge';
import { SRSDashboard } from './SRSDashboard';
import { FSRSCard, getPlayerProfile } from '@/db/db';
import { normalizeMissionMonsters } from '@/lib/data/missionSanitizer';
import { getDailyPracticePlan, PracticePlan, PracticePlanStep } from '@/lib/data/dailyPracticePlan';
import { buildDailyFlameStatus, DailyFlameStatus } from '@/lib/data/dailyFlame';
import {
    objectiveTitle,
    practicePlanStepRationale,
    practicePlanStepTitle,
    supportLevelLabel
} from '@/lib/data/learningObjectives';
import {
    createPracticePlanRun,
    currentPracticePlanStep,
    loadPracticePlanStepLaunch,
    savePracticePlanRunRecord,
    createPracticePlanRunRecord
} from '@/lib/data/practicePlanRunner';
import { DailyFlameCard } from './DailyFlameCard';
import type { AIProvider } from '@/lib/ai/modelOptions';
import { recognizeImageText } from '@/lib/ocr/tesseractOcr';

// Store blessing effect for the current run (passed to game state)
let currentBlessingEffect: BlessingEffect | null = null;
export function getCurrentBlessingEffect() { return currentBlessingEffect; }

type AttachmentSource = 'picker' | 'paste' | 'drop';
type AttachmentStatus = 'extracting' | 'ready' | 'error' | 'unsupported';
type AttachmentKind = 'image' | 'text' | 'document' | 'unsupported';

interface MaterialAttachment {
    id: string;
    name: string;
    size: number;
    mimeType: string;
    source: AttachmentSource;
    kind: AttachmentKind;
    status: AttachmentStatus;
    previewUrl?: string;
    extractedText?: string;
    insertedText?: string;
    error?: string;
}

const MATERIAL_ACCEPT = [
    'image/*',
    '.txt',
    '.md',
    '.markdown',
    '.csv',
    '.pdf',
    '.doc',
    '.docx',
    'text/plain',
    'text/markdown',
    'text/csv',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
].join(',');

const createAttachmentId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `attachment-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const extensionFor = (fileName: string) => {
    const match = /\.([^.]+)$/.exec(fileName.toLowerCase());
    return match?.[1] || '';
};

const materialKindFor = (file: File): AttachmentKind => {
    const extension = extensionFor(file.name);
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('text/')) return 'text';
    if (['txt', 'md', 'markdown', 'csv'].includes(extension)) return 'text';
    if (file.type === 'application/pdf' || extension === 'pdf') return 'document';
    if (
        file.type === 'application/msword' ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        ['doc', 'docx'].includes(extension)
    ) {
        return 'document';
    }
    return 'unsupported';
};

const formatAttachmentSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

const appendMaterialText = (current: string, inserted: string) => {
    if (!inserted.trim()) return current;
    return current.trim() ? `${current}\n\n${inserted}` : inserted;
};

const removeInsertedText = (current: string, inserted: string) => {
    const variants = [
        `\n\n${inserted}`,
        `${inserted}\n\n`,
        inserted
    ];

    for (const variant of variants) {
        if (current.includes(variant)) {
            return current.replace(variant, '').replace(/\n{3,}/g, '\n\n').trimStart();
        }
    }

    return current;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const readFileAsText = (file: File) => {
    if (typeof file.text === 'function') {
        return file.text();
    }

    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Could not read file'));
        reader.readAsText(file);
    });
};

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
        questionMode: card.questionMode || 'choice' as const,
        correctAnswer: card.correctAnswer || card.options[card.correct_index] || '',
        learningObjectiveId: card.learningObjectiveId || step?.objectiveId,
        supportLevel: step?.supportLevel,
        attemptKind: step?.attemptKind,
        sourceContextSpan: card.sourceContextSpan || 'daily_plan'
    }));
}

export function InputSection() {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [fallbackLevel, setFallbackLevel] = useState<SampleLevel | null>(null);
    const [attachments, setAttachments] = useState<MaterialAttachment[]>([]);
    const [showBlessingSelection, setShowBlessingSelection] = useState(false);
    const [pendingQuestions, setPendingQuestions] = useState<{ monsters: Monster[]; context: string } | null>(null);
    const [showDailyChallenge, setShowDailyChallenge] = useState(false);
    const [showSRSDashboard, setShowSRSDashboard] = useState(false);
    const [practicePlan, setPracticePlan] = useState<PracticePlan | null>(null);
    const [dailyFlameStatus, setDailyFlameStatus] = useState<DailyFlameStatus | null>(null);
    const [isPlanLoading, setIsPlanLoading] = useState(false);
    const [planError, setPlanError] = useState('');
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const previewUrlsRef = useRef<Set<string>>(new Set());
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

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const handleEvidenceUpdate = () => {
            refreshPracticePlan();
        };
        window.addEventListener('wordquest:learning-evidence-updated', handleEvidenceUpdate);
        return () => {
            window.removeEventListener('wordquest:learning-evidence-updated', handleEvidenceUpdate);
        };
    }, [refreshPracticePlan]);

    const startStarterPlan = useCallback((step?: PracticePlanStep) => {
        const sample = SAMPLE_LEVELS[0];
        const monsters = normalizeMissionMonsters(sample.monsters, {
            sourceText: `${sample.title}\n${sample.context}`
        }).map((monster) => ({
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
            await savePracticePlanRunRecord(createPracticePlanRunRecord(freshPlan));
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

            // Monsters are already normalized by the orchestrator (plan -> generate -> critique).
            setPendingQuestions({ monsters: data.monsters as Monster[], context: input });
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
        const normalizedMonsters = normalizeMissionMonsters(fallbackLevel.monsters, {
            sourceText: `${fallbackLevel.title}\n${fallbackLevel.context}`
        });
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
        const previewUrls = previewUrlsRef.current;
        return () => {
            previewUrls.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
            previewUrls.clear();
        };
    }, []);

    const extractAttachmentText = async (file: File, kind: AttachmentKind) => {
        if (kind === 'text') {
            const text = await readFileAsText(file);
            return `${t.input.textFileImported}: ${file.name}\n${text}`;
        }
        if (kind === 'image') {
            const text = await recognizeImageText(file);
            return `${t.input.imageStubText}: ${file.name}\n${text}`;
        }
        if (kind === 'document') {
            await delay(600);
            return `${t.input.documentStubText}: ${file.name}\n${t.input.documentDemoNotice}`;
        }
        throw new Error(t.input.attachmentUnsupported);
    };

    const addFiles = (files: File[], source: AttachmentSource) => {
        if (files.length === 0) return;

        for (const file of files) {
            const kind = materialKindFor(file);
            const previewUrl = kind === 'image' ? URL.createObjectURL(file) : undefined;
            if (previewUrl) previewUrlsRef.current.add(previewUrl);

            const attachment: MaterialAttachment = {
                id: createAttachmentId(),
                name: file.name,
                size: file.size,
                mimeType: file.type || 'unknown',
                source,
                kind,
                status: kind === 'unsupported' ? 'unsupported' : 'extracting',
                previewUrl,
                error: kind === 'unsupported' ? t.input.attachmentUnsupported : undefined
            };

            setAttachments((prev) => [...prev, attachment]);

            if (kind === 'unsupported') continue;

            void extractAttachmentText(file, kind)
                .then((text) => {
                    const insertedText = text.trim();
                    setInput((prev) => appendMaterialText(prev, insertedText));
                    setAttachments((prev) => prev.map((item) => item.id === attachment.id
                        ? {
                            ...item,
                            status: 'ready',
                            extractedText: insertedText,
                            insertedText
                        }
                        : item));
                })
                .catch(() => {
                    setAttachments((prev) => prev.map((item) => item.id === attachment.id
                        ? {
                            ...item,
                            status: 'error',
                            error: t.input.attachmentError
                        }
                        : item));
                });
        }
    };

    const filesFromClipboard = (clipboardData: DataTransfer) => {
        const directFiles = Array.from(clipboardData.files || []);
        if (directFiles.length > 0) return directFiles;

        return Array.from(clipboardData.items || [])
            .filter((item) => item.kind === 'file')
            .map((item) => item.getAsFile())
            .filter((file): file is File => Boolean(file));
    };

    const handlePaste = (event: React.ClipboardEvent<HTMLElement>) => {
        const files = filesFromClipboard(event.clipboardData);
        if (files.length === 0) return;
        event.preventDefault();
        addFiles(files, 'paste');
    };

    const handleDrop = (event: React.DragEvent<HTMLElement>) => {
        event.preventDefault();
        const files = Array.from(event.dataTransfer.files || []);
        addFiles(files, 'drop');
    };

    const handleDragOver = (event: React.DragEvent<HTMLElement>) => {
        event.preventDefault();
    };

    const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.target.files || []);
        addFiles(files, 'picker');
        event.target.value = '';
    };

    const handleOpenFilePicker = () => {
        fileInputRef.current?.click();
    };

    const handleRemoveAttachment = (attachmentId: string) => {
        const target = attachments.find((attachment) => attachment.id === attachmentId);
        if (!target) return;
        if (target.previewUrl) {
            URL.revokeObjectURL(target.previewUrl);
            previewUrlsRef.current.delete(target.previewUrl);
        }
        if (target.insertedText) {
            setInput((prev) => removeInsertedText(prev, target.insertedText!));
        }
        setAttachments((prev) => prev.filter((attachment) => attachment.id !== attachmentId));
    };

    const attachmentStatusLabel = (attachment: MaterialAttachment) => {
        if (attachment.status === 'extracting') return t.input.attachmentExtracting;
        if (attachment.status === 'ready') return t.input.attachmentReady;
        if (attachment.status === 'unsupported') return t.input.attachmentUnsupported;
        return attachment.error || t.input.attachmentError;
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

                    <section
                        role="group"
                        aria-label={t.input.materialComposerLabel}
                        onPaste={handlePaste}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        className="mb-6 rounded-2xl border border-dashed border-border bg-secondary/30 p-4 transition-colors focus-within:border-primary focus-within:bg-secondary/40"
                    >
                        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <Paperclip className="h-4 w-4" />
                                    {t.input.materialComposerTitle}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t.input.materialHint}</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleOpenFilePicker}
                                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-primary px-3 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/10"
                            >
                                <FileText className="h-4 w-4" />
                                {t.input.attachFiles}
                            </button>
                        </div>

                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder={t.input.placeholder}
                            className="h-52 w-full resize-none rounded-xl border border-input bg-background/70 p-4 text-foreground outline-none transition-all placeholder:text-muted-foreground focus:ring-2 focus:ring-primary"
                        />
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={MATERIAL_ACCEPT}
                            multiple
                            className="hidden"
                            onChange={handleFilesSelected}
                        />

                        {attachments.length > 0 ? (
                            <ul className="mt-3 grid gap-2" aria-label={t.input.attachmentListLabel}>
                                {attachments.map((attachment) => (
                                    <li
                                        key={attachment.id}
                                        className="flex items-center gap-3 rounded-xl border border-border/70 bg-background/60 p-2"
                                    >
                                        <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-secondary text-muted-foreground">
                                            {attachment.previewUrl ? (
                                                <Image
                                                    src={attachment.previewUrl}
                                                    alt={attachment.name}
                                                    fill
                                                    sizes="48px"
                                                    className="object-cover"
                                                    unoptimized
                                                />
                                            ) : attachment.kind === 'image' ? (
                                                <ImageIcon className="h-5 w-5" />
                                            ) : (
                                                <FileText className="h-5 w-5" />
                                            )}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-sm font-bold text-foreground">{attachment.name}</p>
                                            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                                                <span>{formatAttachmentSize(attachment.size)}</span>
                                                <span className="inline-flex items-center gap-1">
                                                    {attachment.status === 'extracting' && <RefreshCw className="h-3 w-3 animate-spin" />}
                                                    {attachment.status === 'ready' && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                                                    {attachment.status === 'unsupported' && <AlertCircle className="h-3 w-3 text-destructive" />}
                                                    {attachmentStatusLabel(attachment)}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveAttachment(attachment.id)}
                                            aria-label={`${t.input.removeAttachment} ${attachment.name}`}
                                            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="mt-2 text-xs text-muted-foreground">{t.input.supportedFilesHint}</p>
                        )}
                    </section>

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
                                    {objectiveTitle(primary.objectiveId, language)}
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
                                <p className="text-sm font-bold text-foreground">
                                    {practicePlanStepTitle(step.type, step.objectiveId, language)}
                                </p>
                                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                    {supportLevelLabel(step.supportLevel, language)}
                                </span>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                {practicePlanStepRationale(step.type, language)}
                            </p>
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

const fetchMissionWithRetry = async (text: string, apiKey: string, model: string, apiProvider: AIProvider, learnerLevel?: number) => {
    // The plan -> generate -> critique orchestrator handles LLM calls, normalization,
    // lexical-grounding/1T/reading-skill gating, and graceful degradation. The
    // monsters it returns are already normalized, so the caller uses them directly.
    const result = await generateQuestionPack(text, {
        apiKey,
        model,
        apiProvider,
        learnerLevel,
        criticEnabled: true,
        material: text
    });
    if (result.monsters.length >= 5) {
        return { level_title: result.plan?.levelTitle ?? 'Mission', monsters: result.monsters };
    }
    throw new Error('MISSION_EMPTY');
};
