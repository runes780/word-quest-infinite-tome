'use client';

import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { createAIClient } from '@/lib/ai/providerClient';
import { buildReportSystemPrompt, generateReportPrompt } from '@/lib/ai/prompts';
import { motion } from 'framer-motion';
import { Brain, Trophy, XCircle, RotateCcw, Sparkles, FileText, Target, PlusCircle, PlayCircle, Route } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useMemo, useState } from 'react';
import { logMissionHistory } from '@/lib/data/history';
import { updatePlayerProfile } from '@/db/db';
import {
    formatLearningLabel,
    objectiveTitle,
    practicePlanStepRationale,
    practicePlanStepTitle,
    supportLevelLabel
} from '@/lib/data/learningObjectives';
import {
    currentPracticePlanStep,
    isPracticePlanComplete,
    loadPracticePlanStepLaunch,
    practicePlanProgressText
} from '@/lib/data/practicePlanRunner';
import { buildSessionLearningClosure } from '@/lib/data/sessionLearningClosure';
import { buildCalibrationSummary } from '@/lib/data/metacognitiveCalibration';
import { buildLearningProgressRewardSummary } from '@/lib/data/learningProgressRewards';

import { translations } from '@/lib/translations';

export function MissionReport() {
    const {
        score,
        questions,
        resetGame,
        isVictory,
        userAnswers,
        context,
        skillStats,
        addToRevengeQueue,
        recordRunCompletion,
        activePracticePlanRun,
        startGame
    } = useGameStore();
    const { apiKey, apiProvider, model, language, setSettingsOpen } = useSettingsStore();
    const t = translations[language];
    const hasApiKey = Boolean(apiKey?.trim());
    const [analysis, setAnalysis] = useState<{ mvp_skill: string; weakness: string; advice: string; mistake_analysis?: string } | null>(null);
    const [analysisSource, setAnalysisSource] = useState<'ai' | 'local' | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isContinuingPlan, setIsContinuingPlan] = useState(false);
    const [continuePlanError, setContinuePlanError] = useState<string | null>(null);
    const [queuedIds, setQueuedIds] = useState<Set<number>>(new Set());
    const [historyLogged, setHistoryLogged] = useState(false);
    const nextPlanStep = currentPracticePlanStep(activePracticePlanRun);
    const planComplete = isPracticePlanComplete(activePracticePlanRun);
    const calibrationSummary = useMemo(() => buildCalibrationSummary(userAnswers), [userAnswers]);
    const progressRewardSummary = useMemo(() => buildLearningProgressRewardSummary(userAnswers), [userAnswers]);

    useEffect(() => {
        if (historyLogged || questions.length === 0 || userAnswers.length === 0) return;
        const title = context?.trim() ? context.trim().split('\n')[0].slice(0, 60) : 'Custom Mission';
        const totalCorrect = userAnswers.filter((answer) => answer.isCorrect).length;
        logMissionHistory({
            score,
            totalQuestions: questions.length,
            levelTitle: title,
            skillStats,
            totalCorrect,
            accuracy: questions.length ? totalCorrect / questions.length : 0
        });
        recordRunCompletion();
        const masteryDeltas = calculateMasteryDeltas(skillStats);
        updatePlayerProfile({
            lessonsCompleted: 1,
            totalStudyMinutes: Math.max(1, Math.round(questions.length * 0.4)),
            perfectLessons: totalCorrect === questions.length ? 1 : 0,
            masteryDeltas
        }).catch(console.error);
        setHistoryLogged(true);
    }, [historyLogged, questions.length, score, context, skillStats, userAnswers, recordRunCompletion]);

    const skillEntries = useMemo(() => {
        return Object.entries(skillStats).map(([key, stats]) => ({
            key,
            accuracy: stats.total ? (stats.correct / stats.total) : 0,
            attempts: stats.total
        })).sort((a, b) => a.accuracy - b.accuracy);
    }, [skillStats]);

    const learningClosure = useMemo(() => {
        return buildLearningClosure(userAnswers, language);
    }, [userAnswers, language]);
    const sessionClosure = useMemo(() => {
        return buildSessionLearningClosure(userAnswers, language);
    }, [userAnswers, language]);

    const wrongDetails = useMemo(() => {
        const map = new Map(questions.map((q) => [q.id, q]));
        return userAnswers
            .filter((answer) => !answer.isCorrect)
            .map((answer) => {
                const original = map.get(answer.questionId);
                if (!original) return null;
                return {
                    answer,
                    question: original
                };
            })
            .filter(Boolean) as { answer: typeof userAnswers[number]; question: typeof questions[number] }[];
    }, [userAnswers, questions]);

    const handleQueue = (questionId: number, question: typeof questions[number]) => {
        addToRevengeQueue(question);
        setQueuedIds((prev) => new Set(prev).add(questionId));
    };

    const handleAnalyze = async () => {
        if (!hasApiKey) {
            setAnalysisSource(null);
            setAnalysisError(t.mentor.noKey);
            return;
        }
        setIsLoading(true);
        setAnalysisError(null);
        try {
            const client = createAIClient({ apiKey, model, provider: apiProvider });
            const prompt = generateReportPrompt(score, questions.length, userAnswers);
            const jsonStr = await client.generate(prompt, buildReportSystemPrompt(language));
            const cleanJson = jsonStr.replace(/```json\n?|\n?```/g, '').trim();
            setAnalysis(JSON.parse(cleanJson));
            setAnalysisSource('ai');
        } catch (e) {
            console.error(e);
            const fallback = buildLocalDebrief(skillEntries, language, score, questions.length);
            setAnalysis(fallback);
            setAnalysisSource('local');
            setAnalysisError(t.report.offlineAnalysis);
        } finally {
            setIsLoading(false);
        }
    };

    const handleContinuePracticePlan = async () => {
        if (!activePracticePlanRun || !nextPlanStep) return;
        setIsContinuingPlan(true);
        setContinuePlanError(null);
        try {
            const launch = await loadPracticePlanStepLaunch(nextPlanStep);
            startGame(launch.monsters, launch.context, launch.source, activePracticePlanRun);
        } catch (error) {
            console.error(error);
            setContinuePlanError(language === 'zh' ? '无法继续今日学习路径。' : 'Could not continue today\'s path.');
        } finally {
            setIsContinuingPlan(false);
        }
    };

    // Simple stats calculation
    // Note: In a real app we might want to track exactly which questions were answered correctly/incorrectly in the store
    // For now, we can infer some data or just show the score. 
    // To make it better, let's assume we want to show a list of all questions and their status?
    // The current store doesn't track "user answers" history for the session explicitly in a list, 
    // but we can add that later. For now, let's show the Score and a summary.

    return (
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-2xl mx-auto p-6"
        >
            <div className="bg-card border-2 border-primary/20 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />

                <div className="relative z-10">
                    <motion.div
                        initial={{ y: -20 }}
                        animate={{ y: 0 }}
                        className="mb-6 flex justify-center"
                    >
                        {isVictory ? (
                            <div className="p-6 bg-yellow-500/20 rounded-full">
                                <Trophy className="w-20 h-20 text-yellow-500 animate-bounce" />
                            </div>
                        ) : (
                            <div className="p-6 bg-destructive/20 rounded-full">
                                <XCircle className="w-20 h-20 text-destructive" />
                            </div>
                        )}
                    </motion.div>

                    <h2 className="text-4xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                        {isVictory ? t.report.missionAccomplished : t.report.missionFailed}
                    </h2>

                    <p className="text-xl text-muted-foreground mb-8">
                        {isVictory ? t.report.victoryMessage : t.report.defeatMessage}
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-secondary/50 p-4 rounded-2xl">
                            <div className="text-sm text-muted-foreground uppercase tracking-wider font-bold mb-1">{t.report.finalScore}</div>
                            <div className="text-3xl font-mono font-bold text-primary">{score}</div>
                        </div>
                        <div className="bg-secondary/50 p-4 rounded-2xl">
                            <div className="text-sm text-muted-foreground uppercase tracking-wider font-bold mb-1">{t.report.totalTargets}</div>
                            <div className="text-3xl font-mono font-bold text-foreground">{questions.length}</div>
                        </div>
                    </div>

                    {progressRewardSummary.countedRewards > 0 && (
                        <div className="mb-8 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-left">
                            <div className="flex items-start gap-3">
                                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-sm font-black text-foreground">
                                            {language === 'zh' ? '学习进步奖励' : 'Learning Progress Rewards'}
                                        </p>
                                        <span className="rounded-full bg-background/70 px-2 py-1 text-xs font-black text-emerald-700 dark:text-emerald-300">
                                            +{progressRewardSummary.totalXp} XP · +{progressRewardSummary.totalGold} Gold
                                        </span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                        <ProgressRewardMetric
                                            label={language === 'zh' ? '进步证据' : 'Evidence'}
                                            value={progressRewardSummary.countedRewards}
                                        />
                                        <ProgressRewardMetric
                                            label={language === 'zh' ? '错因修复' : 'Repairs'}
                                            value={progressRewardSummary.byKind['repair-success']}
                                        />
                                        <ProgressRewardMetric
                                            label={language === 'zh' ? '到期提取' : 'Due recall'}
                                            value={progressRewardSummary.byKind['delayed-recall']}
                                        />
                                        <ProgressRewardMetric
                                            label={language === 'zh' ? '迁移成功' : 'Transfer'}
                                            value={progressRewardSummary.byKind['transfer-success']}
                                        />
                                    </div>
                                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                                        {language === 'zh'
                                            ? `XP 与金币来自可回溯的学习证据；分数和连击只保留战斗反馈。${progressRewardSummary.protectedAttempts > 0 ? `另有 ${progressRewardSummary.protectedAttempts} 次重复或超限练习已记录但未重复发奖。` : ''}`
                                            : `XP and gold come from traceable learning evidence; score and combo remain battle feedback only.${progressRewardSummary.protectedAttempts > 0 ? ` ${progressRewardSummary.protectedAttempts} repeated or capped attempts were recorded without another payout.` : ''}`}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {skillEntries.length > 0 && (
                        <div className="mb-8 bg-secondary/40 rounded-2xl p-6 border border-border/50">
                            <div className="flex items-center gap-2 mb-4">
                                <Target className="w-5 h-5 text-primary" />
                                <h3 className="font-bold text-primary text-sm tracking-wide uppercase">{t.report.skillAccuracy}</h3>
                            </div>
                            <div className="space-y-3">
                                {skillEntries.map((entry) => (
                                    <div key={entry.key}>
                                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                            <span>{formatLearningLabel(entry.key, language)}</span>
                                            <span>{Math.round(entry.accuracy * 100)}% · {entry.attempts} {t.report.attempts}</span>
                                        </div>
                                        <div className="h-2 bg-background/20 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-primary"
                                                style={{ width: `${Math.max(5, entry.accuracy * 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mb-8 grid gap-3 text-left md:grid-cols-3">
                        <ClosureTile
                            title={language === 'zh' ? '已掌握目标' : 'Secured Objective'}
                            value={learningClosure.mastered}
                            detail={learningClosure.masteredDetail}
                        />
                        <ClosureTile
                            title={language === 'zh' ? '当前瓶颈' : 'Current Bottleneck'}
                            value={learningClosure.bottleneck}
                            detail={learningClosure.bottleneckDetail}
                        />
                        <ClosureTile
                            title={language === 'zh' ? '下一次练习' : 'Next Practice'}
                            value={learningClosure.nextAction}
                            detail={learningClosure.nextActionDetail}
                        />
                    </div>

                    {sessionClosure.objectiveEvidence.length > 0 && (
                        <div className="mb-8 rounded-2xl border border-primary/20 bg-primary/10 p-5 text-left">
                            <div className="mb-4 flex items-center gap-3">
                                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                                    <Target className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-sm font-black text-foreground">
                                        {language === 'zh' ? '本轮证据快照' : 'Learning Evidence Snapshot'}
                                    </p>
                                    <p className="text-xs font-semibold text-muted-foreground">
                                        {sessionClosure.headline}
                                    </p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {sessionClosure.objectiveEvidence.map((row) => (
                                    <div key={row.objectiveId} className="rounded-xl border border-border/60 bg-background/50 p-4">
                                        <div className="flex flex-wrap items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-black text-foreground">{row.title}</p>
                                                <p className="mt-1 text-xs text-muted-foreground">{row.detail}</p>
                                            </div>
                                            <span className={cn(
                                                'rounded-full px-3 py-1 text-xs font-black',
                                                row.state === 'needs-repair'
                                                    ? 'bg-destructive/10 text-destructive'
                                                    : row.state === 'transfer-ready'
                                                        ? 'bg-emerald-500/10 text-emerald-500'
                                                        : 'bg-secondary text-muted-foreground'
                                            )}>
                                                {evidenceStateLabel(row.state, language)}
                                            </span>
                                        </div>
                                        <p className="mt-3 text-xs font-semibold text-primary">{row.nextAction}</p>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-4 text-xs font-semibold text-muted-foreground">
                                {sessionClosure.followUp}
                            </p>
                        </div>
                    )}

                    {calibrationSummary.ratedAnswers > 0 && (
                        <div className="mb-8 rounded-2xl border border-blue-500/25 bg-blue-500/10 p-5 text-left">
                            <div className="flex items-start gap-3">
                                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-300">
                                    <Brain className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-sm font-black text-foreground">
                                            {language === 'zh' ? '把握度校准摘要' : 'Confidence Calibration Summary'}
                                        </p>
                                        <span className="rounded-full bg-background/70 px-2 py-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                                            {language === 'zh'
                                                ? `${calibrationSummary.ratedAnswers} 次可选自评`
                                                : `${calibrationSummary.ratedAnswers} optional ratings`}
                                        </span>
                                    </div>
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                        <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                                            <p className="text-xs font-semibold text-muted-foreground">
                                                {language === 'zh' ? '高把握错误' : 'High-confidence errors'}
                                            </p>
                                            <p className="mt-1 text-xl font-black text-foreground">{calibrationSummary.highConfidenceErrors}</p>
                                        </div>
                                        <div className="rounded-xl border border-border/60 bg-background/50 p-3">
                                            <p className="text-xs font-semibold text-muted-foreground">
                                                {language === 'zh' ? '低把握正确' : 'Low-confidence correct'}
                                            </p>
                                            <p className="mt-1 text-xl font-black text-foreground">{calibrationSummary.lowConfidenceCorrect}</p>
                                        </div>
                                    </div>
                                    <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                                        {language === 'zh'
                                            ? '这些信号只帮助选择复盘重点，不参与掌握度或最终评价。'
                                            : 'These signals only help prioritize review; they do not affect mastery or final judgments.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* AI Analysis Section */}
                    {analysis ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-primary/10 border border-primary/20 rounded-xl p-6 mb-8 text-left"
                        >
                            <h3 className="flex items-center gap-2 font-bold text-primary mb-4">
                                <FileText className="w-5 h-5" /> {t.report.missionDebrief}
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex gap-2">
                                    <span className="font-bold text-green-500 shrink-0">{t.report.mvpSkill}</span>
                                    <span>{analysis.mvp_skill}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="font-bold text-destructive shrink-0">{t.report.weakness}</span>
                                    <span>{analysis.weakness}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="italic">&ldquo;{analysis.advice}&rdquo;</span>
                                </div>
                                {analysis.mistake_analysis && (
                                    <div className="mt-4 pt-4 border-t border-primary/20">
                                        <div className="font-bold text-primary mb-1">{t.report.tacticalAnalysis}</div>
                                        <p className="text-muted-foreground">{analysis.mistake_analysis}</p>
                                    </div>
                                )}
                                {analysisSource === 'local' && analysisError && (
                                    <p className="text-xs text-yellow-400 mt-4">{analysisError}</p>
                                )}
                            </div>

                        </motion.div>
                    ) : (
                        <>
                            <button
                                onClick={handleAnalyze}
                                disabled={isLoading || !hasApiKey}
                                className="w-full mb-4 py-3 bg-secondary/50 hover:bg-secondary text-secondary-foreground rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                                {isLoading ? (
                                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Sparkles className="w-4 h-4" />
                                )}
                                {t.report.generateAnalysis}
                            </button>
                            {(analysisError || !hasApiKey) && (
                                <div className="mb-6 flex items-center justify-between gap-3 text-left">
                                    <p className={cn('text-xs', !hasApiKey ? 'text-destructive' : 'text-yellow-400')}>
                                        {analysisError || t.mentor.noKey}
                                    </p>
                                    {!hasApiKey && (
                                        <button
                                            type="button"
                                            onClick={() => setSettingsOpen(true)}
                                            className="text-xs px-3 py-1 rounded-md border border-primary/50 text-primary hover:bg-primary/10 transition-colors shrink-0"
                                        >
                                            {t.input.configureKey}
                                        </button>
                                    )}
                                </div>
                            )}
                        </>
                    )}

                    <div className="mt-6 bg-secondary/30 border border-border/60 rounded-2xl p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <PlusCircle className="w-5 h-5 text-primary" />
                            <h3 className="font-semibold text-primary uppercase tracking-wide text-sm">{t.report.revengeQueue}</h3>
                        </div>
                        {wrongDetails.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t.report.noMistakes}</p>
                        ) : (
                            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                                {wrongDetails.map(({ answer, question }, index) => (
                                    <div key={`${answer.questionId}-${index}`} className="p-3 rounded-xl border border-border bg-background/40">
                                        <p className="text-sm font-semibold mb-1">{question.question}</p>
                                        <p className="text-xs text-muted-foreground mb-3">{t.report.correct}: {question.options[question.correct_index]}</p>
                                        <button
                                            onClick={() => handleQueue(answer.questionId, question)}
                                            disabled={queuedIds.has(answer.questionId)}
                                            className={cn(
                                                'text-xs px-3 py-1.5 rounded-lg font-semibold flex items-center gap-2',
                                                queuedIds.has(answer.questionId)
                                                    ? 'bg-secondary text-muted-foreground cursor-not-allowed'
                                                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                                            )}
                                        >
                                            {queuedIds.has(answer.questionId) ? t.report.queued : t.report.queueForNext}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {activePracticePlanRun && (
                        <div className="mt-6 rounded-2xl border border-primary/25 bg-primary/10 p-5 text-left">
                            <div className="mb-3 flex items-center gap-3">
                                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                                    <Route className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-black text-foreground">
                                        {language === 'zh' ? '今日学习路径' : 'Today\'s Learning Path'}
                                    </p>
                                    <p className="text-xs font-semibold text-muted-foreground">
                                        {practicePlanProgressText(activePracticePlanRun)} {language === 'zh' ? '已完成' : 'complete'}
                                    </p>
                                </div>
                            </div>
                            {planComplete ? (
                                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-500">
                                    {language === 'zh'
                                        ? '今天的路径已经完成。下一次系统会根据这次表现重新安排复习和迁移题。'
                                        : 'Today\'s path is complete. The next plan will use this evidence to rebalance review and transfer.'}
                                </div>
                            ) : nextPlanStep ? (
                                <div className="space-y-3">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                                            {language === 'zh' ? '下一步' : 'Next Step'}
                                        </p>
                                        <p className="mt-1 text-sm font-black text-foreground">
                                            {practicePlanStepTitle(nextPlanStep.type, nextPlanStep.objectiveId, language)}
                                        </p>
                                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                                            {practicePlanStepRationale(nextPlanStep.type, language)}
                                        </p>
                                    </div>
                                    {continuePlanError && (
                                        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
                                            {continuePlanError}
                                        </p>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleContinuePracticePlan}
                                        disabled={isContinuingPlan}
                                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-black text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                                    >
                                        {isContinuingPlan ? (
                                            <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                        ) : (
                                            <PlayCircle className="h-4 w-4" />
                                        )}
                                        {language === 'zh' ? '继续路径' : 'Continue Path'}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                    )}

                    <button
                        onClick={resetGame}
                        className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                    >
                        <RotateCcw className="w-5 h-5" />
                        {t.report.initializeNewMission}
                    </button>
                </div>
            </div>
        </motion.div >
    );
}

function ClosureTile({ title, value, detail }: { title: string; value: string; detail: string }) {
    return (
        <div className="rounded-2xl border border-border/60 bg-background/40 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="mt-2 text-sm font-black text-foreground">{value}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
        </div>
    );
}

function ProgressRewardMetric({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border border-border/60 bg-background/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="mt-1 text-xl font-black text-foreground">{value}</p>
        </div>
    );
}

function evidenceStateLabel(state: string, language: 'en' | 'zh') {
    if (language === 'zh') {
        return {
            secured: '已稳定',
            'transfer-ready': '可迁移',
            'needs-repair': '需修复',
            practice: '练习中'
        }[state] || '练习中';
    }
    return {
        secured: 'Stable',
        'transfer-ready': 'Transfer ready',
        'needs-repair': 'Needs repair',
        practice: 'Practicing'
    }[state] || 'Practicing';
}

function buildLearningClosure(
    answers: ReturnType<typeof useGameStore.getState>['userAnswers'],
    language: 'en' | 'zh'
) {
    const byObjective = new Map<string, { total: number; correct: number; transfer: number; supportLevels: number[] }>();
    const causeCounts = new Map<string, number>();

    answers.forEach((answer) => {
        const objectiveId = answer.learningObjectiveId || 'core';
        const row = byObjective.get(objectiveId) || { total: 0, correct: 0, transfer: 0, supportLevels: [] };
        row.total += 1;
        row.correct += answer.isCorrect ? 1 : 0;
        row.transfer += answer.isCorrect && answer.attemptKind === 'transfer' ? 1 : 0;
        if (typeof answer.supportLevel === 'number') row.supportLevels.push(answer.supportLevel);
        byObjective.set(objectiveId, row);

        if (!answer.isCorrect && answer.causeTag) {
            causeCounts.set(answer.causeTag, (causeCounts.get(answer.causeTag) || 0) + 1);
        }
    });

    const mastered = Array.from(byObjective.entries())
        .map(([objectiveId, row]) => ({
            objectiveId,
            accuracy: row.total > 0 ? row.correct / row.total : 0,
            row
        }))
        .filter((entry) => entry.row.total >= 1 && (entry.accuracy >= 0.8 || entry.row.transfer > 0))
        .sort((a, b) => b.accuracy - a.accuracy)[0];

    const bottleneck = Array.from(causeCounts.entries()).sort((a, b) => b[1] - a[1])[0];
    const weakest = Array.from(byObjective.entries())
        .map(([objectiveId, row]) => ({ objectiveId, accuracy: row.total > 0 ? row.correct / row.total : 0, row }))
        .sort((a, b) => a.accuracy - b.accuracy)[0];

    const masteredLabel = mastered
        ? objectiveTitle(mastered.objectiveId, language)
        : (language === 'zh' ? '还在收集证据' : 'Collecting evidence');
    const masteredDetail = mastered
        ? (language === 'zh'
            ? `正确率 ${Math.round(mastered.accuracy * 100)}%${mastered.row.transfer > 0 ? ` · ${supportLevelLabel(0, language)}` : ''}`
            : `${Math.round(mastered.accuracy * 100)}% accuracy${mastered.row.transfer > 0 ? ` · ${supportLevelLabel(0, language)}` : ''}`)
        : (language === 'zh' ? '完成更多题后会显示稳定掌握目标。' : 'Complete more answers to identify a stable objective.');

    const bottleneckLabel = bottleneck
        ? formatLearningLabel(bottleneck[0], language)
        : (weakest ? objectiveTitle(weakest.objectiveId, language) : (language === 'zh' ? '暂无明显瓶颈' : 'No clear bottleneck'));
    const bottleneckDetail = bottleneck
        ? (language === 'zh'
            ? `本轮 ${bottleneck[1]} 次错因信号`
            : `${bottleneck[1]} mistake signal${bottleneck[1] === 1 ? '' : 's'} in this run`)
        : (weakest
            ? (language === 'zh'
                ? `${objectiveTitle(weakest.objectiveId, language)} 正确率 ${Math.round(weakest.accuracy * 100)}%`
                : `${Math.round(weakest.accuracy * 100)}% accuracy on ${objectiveTitle(weakest.objectiveId, language)}`)
            : (language === 'zh' ? '本局没有错因信号。' : 'No mistake cause signal in this run.'));

    const nextObjective = weakest?.objectiveId || mastered?.objectiveId || 'vocab_context_meaning';
    const nextAction = objectiveTitle(nextObjective, language);
    const nextActionDetail = language === 'zh'
        ? '下次从有提示练习开始，再切到填空或输入迁移。'
        : 'Start with guided practice, then move to fill-blank or typing transfer.';

    return {
        mastered: masteredLabel,
        masteredDetail,
        bottleneck: bottleneckLabel,
        bottleneckDetail,
        nextAction,
        nextActionDetail
    };
}

function buildLocalDebrief(
    skills: { key: string; accuracy: number; attempts: number; }[],
    language: 'en' | 'zh',
    score: number,
    totalQuestions: number
) {
    const sorted = [...skills].filter((entry) => entry.attempts > 0).sort((a, b) => b.accuracy - a.accuracy);
    const best = sorted[0];
    const weakest = sorted[sorted.length - 1];
    const overallPercent = totalQuestions > 0 ? Math.round((score / (totalQuestions * 10)) * 100) : 0;

    const formatSkill = (entry?: { key: string; accuracy: number; attempts: number }) => {
        if (!entry) return language === 'zh' ? '暂无数据' : 'N/A';
        const label = formatLearningLabel(entry.key, language);
        const percent = Math.round(entry.accuracy * 100);
        return language === 'zh'
            ? `${label} · 正确率 ${percent}%`
            : `${label} · ${percent}% accuracy`;
    };

    const advice = language === 'zh'
        ? `巩固 ${best ? formatLearningLabel(best.key, language) : '基础技能'}，并针对 ${weakest ? formatLearningLabel(weakest.key, language) : '薄弱点'} 做 2-3 题复习。`
        : `Solidify ${best ? formatLearningLabel(best.key, language) : 'core skills'} and revisit ${weakest ? formatLearningLabel(weakest.key, language) : 'weaker spots'} with a few focused reps.`;

    return {
        mvp_skill: formatSkill(best),
        weakness: formatSkill(weakest),
        advice,
        mistake_analysis: language === 'zh'
            ? `本地估算总正确率约 ${overallPercent}% 。网络恢复后可再次请求 AI 分析。`
            : `Local estimate puts total accuracy near ${overallPercent}%. When the connection stabilizes, rerun the AI analysis for deeper insight.`
    };
}

function calculateMasteryDeltas(skillStats: Record<string, { correct: number; total: number }>) {
    const entries = Object.entries(skillStats).filter(([, value]) => value.total >= 2);
    const byType = {
        vocab: [] as number[],
        grammar: [] as number[],
        reading: [] as number[]
    };

    entries.forEach(([key, value]) => {
        const accuracy = value.correct / value.total;
        if (key.startsWith('vocab')) byType.vocab.push(accuracy);
        else if (key.startsWith('grammar')) byType.grammar.push(accuracy);
        else byType.reading.push(accuracy);
    });

    const toDelta = (accList: number[]) => {
        if (accList.length === 0) return 0;
        const avg = accList.reduce((sum, value) => sum + value, 0) / accList.length;
        if (avg >= 0.85) return 2;
        if (avg >= 0.7) return 1;
        if (avg <= 0.4) return -1;
        return 0;
    };

    return {
        vocab: toDelta(byType.vocab),
        grammar: toDelta(byType.grammar),
        reading: toDelta(byType.reading)
    };
}
