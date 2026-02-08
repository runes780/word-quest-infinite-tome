'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GraduationCap, LineChart, RefreshCw, Download, Printer, X, Sparkles } from 'lucide-react';

import { useSettingsStore } from '@/store/settingsStore';
import { useGameStore } from '@/store/gameStore';
import { translations } from '@/lib/translations';
import { DashboardSummary, getDashboardSummary } from '@/lib/data/history';
import {
    buildRepeatedCauseActionSuggestion,
    buildRepeatedCauseIntensityAlert,
    evaluateRepeatedCauseGoalAgainstBaseline,
    getMistakes,
    getRepeatedCauseGoalAgainstBaseline,
    getRepeatedCauseSnapshot,
    getRepeatedCauseTrends,
    MistakeRecord,
    RepeatedCauseBaselineSummary,
    RepeatedCauseSnapshot,
    RepeatedCauseTrend
} from '@/lib/data/mistakes';
import { downloadNodeAsImage, openNodePrintView } from '@/lib/exportReport';
import {
    FSRSCard,
    getDueCardsWithPriority,
    getMasteryAggregateSnapshot,
    getMemoryStatus,
    getSRSStats,
    getWeeklyLearningTasks,
    LearningTask,
    MasteryAggregateSnapshot
} from '@/db/db';
import { buildTargetedReviewPack } from '@/lib/data/targetedReview';

const RANGE_OPTIONS = [7, 14, 30] as const;
type RangeOption = typeof RANGE_OPTIONS[number];

export function ParentDashboard() {
    const { language } = useSettingsStore();
    const t = translations[language];
    const isZh = language === 'zh';
    const { startGame } = useGameStore();
    const [isOpen, setIsOpen] = useState(false);
    const [range, setRange] = useState<RangeOption>(14);
    const [snapshot, setSnapshot] = useState<DashboardSummary | null>(null);
    const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
    const [dueCards, setDueCards] = useState<FSRSCard[]>([]);
    const [srsDueCount, setSrsDueCount] = useState(0);
    const [masterySnapshot, setMasterySnapshot] = useState<MasteryAggregateSnapshot | null>(null);
    const [learningTasks, setLearningTasks] = useState<LearningTask[]>([]);
    const [repeatedCauseSnapshot, setRepeatedCauseSnapshot] = useState<RepeatedCauseSnapshot | null>(null);
    const [repeatedCauseTrends, setRepeatedCauseTrends] = useState<RepeatedCauseTrend[]>([]);
    const [repeatedCauseBaselineGoal, setRepeatedCauseBaselineGoal] = useState<RepeatedCauseBaselineSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState<'image' | 'pdf' | null>(null);
    const reportRef = useRef<HTMLDivElement | null>(null);

    const hasHistory = snapshot && snapshot.records.length > 0;

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [
                historyData,
                mistakeData,
                dueCardData,
                srsStats,
                masteryData,
                weeklyTasks,
                repeatedCauseData,
                repeatedCauseTrendData,
                repeatedCauseBaseline
            ] = await Promise.all([
                getDashboardSummary(range, range * 6),
                getMistakes(40),
                getDueCardsWithPriority(3),
                getSRSStats(),
                getMasteryAggregateSnapshot(range),
                getWeeklyLearningTasks(),
                getRepeatedCauseSnapshot(range),
                getRepeatedCauseTrends([7, 14, 30]),
                getRepeatedCauseGoalAgainstBaseline([7, 14, 30], 0.2, 5, 8, 800)
            ]);
            setSnapshot(historyData);
            setMistakes(mistakeData);
            setDueCards(dueCardData);
            setSrsDueCount(srsStats.due);
            setMasterySnapshot(masteryData);
            setLearningTasks(weeklyTasks);
            setRepeatedCauseSnapshot(repeatedCauseData);
            setRepeatedCauseTrends(repeatedCauseTrendData);
            setRepeatedCauseBaselineGoal(repeatedCauseBaseline);
        } catch (err) {
            console.error(err);
            setError(t.dashboard.loadError || 'Failed to load');
        } finally {
            setIsLoading(false);
        }
    }, [range, t.dashboard.loadError]);

    useEffect(() => {
        if (!isOpen) return;
        loadData();
    }, [isOpen, loadData]);

    const lastActiveLabel = useMemo(() => {
        if (!snapshot?.totals.lastActive) return t.dashboard.noHistoryShort || '—';
        return new Date(snapshot.totals.lastActive).toLocaleDateString();
    }, [snapshot, t.dashboard.noHistoryShort]);

    const averageAccuracy = snapshot ? Math.round((snapshot.totals.accuracy || 0) * 100) : 0;
    const targetedSummary = snapshot?.targetedReview;
    const repeatedGoal = repeatedCauseBaselineGoal ?? evaluateRepeatedCauseGoalAgainstBaseline(mistakes, [7, 14, 30], 0.2, 5, 8);
    const repeatedAction = buildRepeatedCauseActionSuggestion(repeatedGoal, repeatedCauseSnapshot || undefined, {
        targetedSessions: targetedSummary?.sessions || 0,
        targetedAvgAccuracy: targetedSummary?.avgAccuracy || 0,
        targetedSuccessRuns: targetedSummary?.successRuns || 0,
        targetedConsecutiveLowRuns: targetedSummary?.consecutiveLowAccuracyRuns || 0
    });
    const repeatedAlert = buildRepeatedCauseIntensityAlert(repeatedAction, {
        targetedConsecutiveLowRuns: targetedSummary?.consecutiveLowAccuracyRuns || 0
    });

    const skillRows = snapshot?.skills.slice(0, 6) ?? [];
    const dailyRows = snapshot?.daily ?? [];
    const weeklyTaskRows = learningTasks.slice(0, 3);

    const recentMistakes = mistakes.slice(0, 5);
    const weakestSkill = skillRows[0];

    const handleStartTargetedReview = () => {
        const pack = buildTargetedReviewPack({
            mistakes,
            focusCauseTag: repeatedAction.focusCauseTag,
            weakestSkillTag: weakestSkill?.skill,
            desiredCount: repeatedAction.recommendedQuestions
        });
        if (pack.monsters.length === 0) return;
        startGame(pack.monsters, `Targeted Review: ${repeatedAction.focusCauseTag || 'core_skills'}`, 'battle');
        setIsOpen(false);
    };

    const handleExportImage = async () => {
        if (!reportRef.current || !hasHistory) return;
        setExporting('image');
        try {
            await downloadNodeAsImage(reportRef.current, `word-quest-report-${range}d.png`);
        } catch (err) {
            console.error(err);
        } finally {
            setExporting(null);
        }
    };

    const handleExportPdf = async () => {
        if (!reportRef.current || !hasHistory) return;
        setExporting('pdf');
        try {
            openNodePrintView(reportRef.current, 'Word Quest Progress Report');
        } finally {
            setExporting(null);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 p-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform z-40"
                aria-label={t.dashboard.open}
            >
                <GraduationCap className="w-6 h-6" />
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
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-5xl bg-card border border-border rounded-3xl p-6 m-4 overflow-y-auto max-h-[90vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                <div>
                                    <h3 className="text-3xl font-bold text-primary flex items-center gap-2">
                                        <GraduationCap className="w-7 h-7" /> {t.dashboard.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">{t.dashboard.subtitle}</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="uppercase tracking-widest text-muted-foreground">{t.dashboard.rangeLabel}</span>
                                    <div className="flex gap-2">
                                        {RANGE_OPTIONS.map((days) => {
                                            const label = t.dashboard.rangeOptions?.[String(days) as keyof typeof t.dashboard.rangeOptions] ?? `${days}d`;
                                            return (
                                                <button
                                                    key={days}
                                                    onClick={() => setRange(days)}
                                                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${range === days ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <button onClick={() => setIsOpen(false)} className="ml-auto">
                                    <X className="w-5 h-5 text-muted-foreground" />
                                </button>
                            </div>

                            <div className="flex justify-between items-center mb-4">
                                <div className="text-sm text-muted-foreground">
                                    {isLoading ? t.dashboard.refreshing : t.dashboard.updatedLabel.replace('{date}', new Date().toLocaleTimeString())}
                                </div>
                                <button
                                    onClick={loadData}
                                    className="flex items-center gap-2 text-sm text-primary"
                                    disabled={isLoading}
                                >
                                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                    {t.dashboard.refresh}
                                </button>
                            </div>

                            {error && (
                                <div className="mb-4 text-sm text-destructive">{error}</div>
                            )}

                            <div ref={reportRef} className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <SummaryCard
                                        label={t.dashboard.lastActive}
                                        value={hasHistory ? lastActiveLabel : '—'}
                                        helper={hasHistory ? t.dashboard.latestMission : t.dashboard.noHistory}
                                    />
                                    <SummaryCard
                                        label={t.dashboard.missions}
                                        value={snapshot?.totals.missions ?? 0}
                                        helper={t.dashboard.sessionsLabel.replace('{count}', String(snapshot?.totals.missions ?? 0))}
                                    />
                                    <SummaryCard
                                        label={t.dashboard.avgAccuracy}
                                        value={`${averageAccuracy}%`}
                                        helper={t.dashboard.accuracyHelper}
                                    />
                                    <SummaryCard
                                        label={t.dashboard.totalQuestions}
                                        value={snapshot?.totals.total ?? 0}
                                        helper={t.dashboard.targetsHelper}
                                    />
                                </div>

                                <section className="p-4 rounded-2xl bg-secondary/35 border border-border">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                            {isZh ? '学习目标摘要' : 'Learning Goal Summary'}
                                        </div>
                                        <span className={
                                            repeatedGoal.overallStatus === 'passed'
                                                ? 'text-green-500 text-xs font-semibold'
                                                : repeatedGoal.overallStatus === 'not_met'
                                                    ? 'text-destructive text-xs font-semibold'
                                                    : 'text-muted-foreground text-xs font-semibold'
                                        }>
                                            {repeatedGoal.overallStatus === 'passed'
                                                ? (isZh ? '重复错因目标达标' : 'Repeated-cause goal passed')
                                                : repeatedGoal.overallStatus === 'not_met'
                                                    ? (isZh ? '重复错因目标未达标' : 'Repeated-cause goal not met')
                                                    : (isZh ? '重复错因样本不足' : 'Repeated-cause sample insufficient')}
                                        </span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {isZh
                                            ? `建议今晚聚焦${repeatedAction.priorityWindowDays || range}天窗口，围绕 ${repeatedAction.focusCauseTag || '核心错因'} 完成 ${repeatedAction.recommendedQuestions} 题定向练习。`
                                            : `Tonight focus on the ${repeatedAction.priorityWindowDays || range}d window and run ${repeatedAction.recommendedQuestions} targeted questions on ${repeatedAction.focusCauseTag || 'the top cause tag'}.`}
                                    </div>
                                    <div className="text-[11px] text-muted-foreground mt-1">
                                        {isZh
                                            ? `建议强度：${repeatedAction.intensity} · ${repeatedAction.rationale}`
                                            : `Intensity: ${repeatedAction.intensity} · ${repeatedAction.rationale}`}
                                    </div>
                                    {repeatedAlert && (
                                        <div className={`mt-2 text-[11px] rounded-lg border px-2 py-1 ${
                                            repeatedAlert.level === 'critical'
                                                ? 'bg-destructive/10 border-destructive/30 text-destructive'
                                                : 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                                        }`}>
                                            {isZh
                                                ? `连续高强度预警（${repeatedAlert.consecutiveLowRuns}轮）：建议拆分为短时复习并加强导师陪练。`
                                                : `Sustained high-intensity alert (${repeatedAlert.consecutiveLowRuns} runs): split into shorter sessions with active mentor support.`}
                                        </div>
                                    )}
                                    <div className="mt-3 flex justify-end">
                                        <button
                                            onClick={handleStartTargetedReview}
                                            className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90"
                                        >
                                            {isZh ? '开始定向复习包' : 'Start Targeted Pack'}
                                        </button>
                                    </div>
                                </section>

                                <section className="p-4 rounded-2xl bg-secondary/35 border border-border">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                            {isZh ? '定向复习执行结果' : 'Targeted Pack Outcomes'}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {targetedSummary?.sessions || 0} {isZh ? '次' : 'runs'}
                                        </span>
                                    </div>
                                    {(targetedSummary?.sessions || 0) > 0 ? (
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                                            <div className="p-2 rounded-lg bg-background/40 border border-border/40">
                                                <div className="text-muted-foreground">{isZh ? '平均正确率' : 'Avg Accuracy'}</div>
                                                <div className="font-semibold">{Math.round((targetedSummary?.avgAccuracy || 0) * 100)}%</div>
                                            </div>
                                            <div className="p-2 rounded-lg bg-background/40 border border-border/40">
                                                <div className="text-muted-foreground">{isZh ? '平均得分' : 'Avg Score'}</div>
                                                <div className="font-semibold">{Math.round(targetedSummary?.avgScore || 0)}</div>
                                            </div>
                                            <div className="p-2 rounded-lg bg-background/40 border border-border/40">
                                                <div className="text-muted-foreground">{isZh ? '高质量轮次' : 'High-quality Runs'}</div>
                                                <div className="font-semibold">{targetedSummary?.successRuns || 0}</div>
                                            </div>
                                            <div className="p-2 rounded-lg bg-background/40 border border-border/40">
                                                <div className="text-muted-foreground">{isZh ? '最近焦点' : 'Last Focus'}</div>
                                                <div className="font-semibold truncate">{targetedSummary?.lastFocusTag || '-'}</div>
                                            </div>
                                            <div className="p-2 rounded-lg bg-background/40 border border-border/40">
                                                <div className="text-muted-foreground">{isZh ? '连续低正确率' : 'Consecutive Low Runs'}</div>
                                                <div className="font-semibold">{targetedSummary?.consecutiveLowAccuracyRuns || 0}</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-muted-foreground">
                                            {isZh ? '还没有定向复习执行记录。建议先启动一次定向复习包。' : 'No targeted execution yet. Start one targeted pack to establish baseline outcomes.'}
                                        </div>
                                    )}
                                </section>

                                <section className="p-4 rounded-2xl bg-secondary/35 border border-border">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                            {isZh ? '学习任务线（本周）' : 'Learning Questline (This Week)'}
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            {weeklyTaskRows.filter((task) => task.status === 'completed').length}/{weeklyTaskRows.length} {isZh ? '完成' : 'done'}
                                        </span>
                                    </div>
                                    {weeklyTaskRows.length > 0 ? (
                                        <div className="space-y-3">
                                            {weeklyTaskRows.map((task) => {
                                                const progressRatio = task.goal > 0 ? task.progress / task.goal : 0;
                                                const statusTone = task.status === 'completed'
                                                    ? 'text-green-500'
                                                    : task.status === 'expired'
                                                        ? 'text-muted-foreground'
                                                        : 'text-amber-500';
                                                const latestEvidence = task.evidence[0];
                                                return (
                                                    <div key={task.taskId} className="p-3 rounded-xl bg-background/40 border border-border/40">
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <div className="text-sm font-semibold">{task.title}</div>
                                                                <div className="text-xs text-muted-foreground">{task.description}</div>
                                                            </div>
                                                            <div className={`text-xs font-semibold ${statusTone}`}>
                                                                {task.status === 'completed'
                                                                    ? (isZh ? '已完成' : 'Completed')
                                                                    : task.status === 'expired'
                                                                        ? (isZh ? '已过期' : 'Expired')
                                                                        : (isZh ? '进行中' : 'In Progress')}
                                                            </div>
                                                        </div>
                                                        <div className="mt-2 h-2 bg-background/40 rounded-full overflow-hidden">
                                                            <div className="h-full bg-gradient-to-r from-primary to-emerald-400" style={{ width: `${Math.max(4, Math.min(100, progressRatio * 100))}%` }} />
                                                        </div>
                                                        <div className="mt-2 text-xs flex justify-between text-muted-foreground">
                                                            <span>{task.progress}/{task.goal}</span>
                                                            <span>+{task.rewardXp} XP · +{task.rewardGold} Gold</span>
                                                        </div>
                                                        {latestEvidence && (
                                                            <div className="mt-1 text-[11px] text-muted-foreground">
                                                                {isZh ? '最新证据' : 'Latest evidence'}: {latestEvidence.source}/{latestEvidence.eventType}
                                                                {latestEvidence.skillTag ? ` · ${latestEvidence.skillTag}` : ''}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-muted-foreground">
                                            {isZh ? '暂无任务线数据，完成一次战斗或每日挑战后会自动生成。' : 'No questline data yet. Complete one battle or daily run to initialize weekly tasks.'}
                                        </div>
                                    )}
                                </section>

                                <div className="grid lg:grid-cols-2 gap-6">
                                    <section className="p-5 rounded-2xl bg-secondary/30 border border-border">
                                        <header className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                                <LineChart className="w-4 h-4 text-primary" />
                                                {t.dashboard.dailyAccuracy}
                                            </div>
                                            <span className="text-xs text-muted-foreground">{t.dashboard.rangeSummary.replace('{days}', String(range))}</span>
                                        </header>
                                        {hasHistory ? (
                                            <div className="flex gap-2 h-32 items-end">
                                                {dailyRows.map((day) => (
                                                    <div key={day.date} className="flex flex-col items-center flex-1">
                                                        <div className="w-full bg-primary/20 rounded-t-lg relative" style={{ height: `${Math.max(5, day.accuracy * 100)}%` }}>
                                                            <span className="absolute -top-6 text-[10px] font-semibold text-primary">
                                                                {Math.round(day.accuracy * 100)}%
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground mt-2">{day.label}</span>
                                                        <span className="text-[10px] text-muted-foreground">{day.missions} {t.dashboard.sessionsShort}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <EmptyState message={t.dashboard.emptyReport} />)
                                        }
                                    </section>

                                    <section className="p-5 rounded-2xl bg-secondary/30 border border-border">
                                        <header className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                                            <Sparkles className="w-4 h-4 text-primary" />
                                            {t.dashboard.skillBreakdown}
                                        </header>
                                        {skillRows.length > 0 ? (
                                            <div className="space-y-3">
                                                {skillRows.map((row) => (
                                                    <div key={row.skill} className="text-sm">
                                                        <div className="flex justify-between text-xs text-muted-foreground">
                                                            <span>{row.skill.replace(/_/g, ' ')}</span>
                                                            <span>{Math.round(row.accuracy * 100)}% · {row.total} {t.dashboard.attempts}</span>
                                                        </div>
                                                        <div className="h-2 bg-background/40 rounded-full overflow-hidden mt-1">
                                                            <div className="h-full bg-gradient-to-r from-primary to-purple-400" style={{ width: `${Math.max(5, row.accuracy * 100)}%` }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <EmptyState message={t.dashboard.noSkillData} />)
                                        }
                                    </section>
                                </div>

                                <section className="p-5 rounded-2xl bg-secondary/30 border border-border">
                                    <header className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                            <Sparkles className="w-4 h-4 text-primary" />
                                            Action Plan
                                        </div>
                                        <span className="text-xs text-muted-foreground">{srsDueCount} SRS due</span>
                                    </header>
                                    <div className="space-y-2 text-sm">
                                        {masterySnapshot && (
                                            <div className="p-3 rounded-xl bg-background/40 border border-border/40">
                                                <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                                                    {isZh ? '掌握度脉冲' : 'Mastery Pulse'} ({masterySnapshot.windowDays}d)
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {isZh ? '作答' : 'Attempts'}: {masterySnapshot.totalAttempts} · {isZh ? '正确' : 'Correct'}: {masterySnapshot.totalCorrect}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {isZh ? '状态' : 'States'}: new {masterySnapshot.stateCounts.new}, learning {masterySnapshot.stateCounts.learning}, consolidated {masterySnapshot.stateCounts.consolidated}, mastered {masterySnapshot.stateCounts.mastered}
                                                </div>
                                                {masterySnapshot.bySkill.slice(0, 2).map((row) => (
                                                    <div key={row.skillTag} className="mt-2 text-xs">
                                                        <span className="font-medium">{row.skillTag.replace(/_/g, ' ')}</span>
                                                        <span className="text-muted-foreground"> · {Math.round(row.smoothedAccuracy * 100)}% · {row.currentState}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="p-3 rounded-xl bg-background/40 border border-border/40">
                                            1. {weakestSkill
                                                ? `Review weakest skill "${weakestSkill.skill.replace(/_/g, ' ')}" with 3-5 targeted questions.`
                                                : 'Complete one mission to identify the weakest skill.'}
                                        </div>
                                        <div className="p-3 rounded-xl bg-background/40 border border-border/40">
                                            2. Finish {Math.min(5, Math.max(1, srsDueCount))} due FSRS cards tonight to protect retention.
                                        </div>
                                        <div className="p-3 rounded-xl bg-background/40 border border-border/40">
                                            3. Review one recent mistake and explain the rule aloud in your own words.
                                        </div>
                                        {repeatedCauseSnapshot && (
                                            <div className="p-3 rounded-xl bg-background/40 border border-border/40 text-xs">
                                                <div className="uppercase tracking-wide text-muted-foreground mb-1">
                                                    {isZh ? '重复错因率' : 'Repeated Cause Rate'} ({repeatedCauseSnapshot.windowDays}d)
                                                </div>
                                                <div className="font-medium">
                                                    {(repeatedCauseSnapshot.repeatRate * 100).toFixed(1)}% ({repeatedCauseSnapshot.repeatedMistakes}/{repeatedCauseSnapshot.taggedMistakes})
                                                </div>
                                                {repeatedCauseSnapshot.topCauses.length > 0 && (
                                                    <div className="mt-1 text-muted-foreground">
                                                        Top: {repeatedCauseSnapshot.topCauses.map((row) => `${row.causeTag}(${row.count})`).join(', ')}
                                                    </div>
                                                )}
                                                {repeatedCauseTrends.length > 0 && (
                                                    <div className="mt-3 pt-2 border-t border-border/40 space-y-1">
                                                        <div className="flex justify-between font-medium">
                                                            <span>{isZh ? '目标(-20%)' : 'Goal (-20%)'}</span>
                                                            <span className={
                                                                repeatedGoal.overallStatus === 'passed'
                                                                    ? 'text-green-500'
                                                                    : repeatedGoal.overallStatus === 'not_met'
                                                                        ? 'text-destructive'
                                                                        : 'text-muted-foreground'
                                                            }>
                                                                {repeatedGoal.overallStatus === 'passed'
                                                                    ? (isZh ? '达标' : 'Passed')
                                                                    : repeatedGoal.overallStatus === 'not_met'
                                                                        ? (isZh ? '未达标' : 'Not Met')
                                                                        : (isZh ? '样本不足' : 'Insufficient')}
                                                            </span>
                                                        </div>
                                                        {repeatedCauseTrends.map((trend) => {
                                                            const currentPct = (trend.current.repeatRate * 100).toFixed(1);
                                                            const previousPct = (trend.previous.repeatRate * 100).toFixed(1);
                                                            const deltaPct = Math.abs(trend.deltaRate * 100).toFixed(1);
                                                            const improving = trend.deltaRate <= 0;
                                                            const tone = improving ? 'text-green-500' : 'text-destructive';
                                                            const goalRow = repeatedGoal.rows.find((row) => row.windowDays === trend.windowDays);
                                                            const goalTone = goalRow?.status === 'passed'
                                                                ? 'text-green-500'
                                                                : goalRow?.status === 'not_met'
                                                                    ? 'text-destructive'
                                                                    : 'text-muted-foreground';
                                                            const baselinePct = goalRow ? `${(goalRow.baselineRate * 100).toFixed(1)}%` : '--';
                                                            const reductionPct = goalRow ? `${Math.max(0, goalRow.reductionFromBaseline * 100).toFixed(1)}%` : '--';
                                                            return (
                                                                <div key={trend.windowDays} className="flex justify-between">
                                                                    <span className="text-muted-foreground">{trend.windowDays}d</span>
                                                                    <span>{currentPct}% vs {previousPct}%</span>
                                                                    <span className={tone}>
                                                                        {improving ? '↓' : '↑'} {deltaPct}pp
                                                                    </span>
                                                                    <span className="text-muted-foreground">
                                                                        B:{baselinePct}
                                                                    </span>
                                                                    <span className={goalTone}>
                                                                        {goalRow?.status === 'passed'
                                                                            ? `✓ ${reductionPct}`
                                                                            : goalRow?.status === 'not_met'
                                                                                ? `× ${reductionPct}`
                                                                                : '…'}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {dueCards.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-border/40 space-y-2">
                                            <div className="text-xs uppercase tracking-wide text-muted-foreground">Evidence Chain (FSRS Due)</div>
                                            {dueCards.map((card, idx) => {
                                                const status = getMemoryStatus(card);
                                                return (
                                                    <div key={card.id || idx} className="p-3 rounded-xl bg-background/30 border border-border/30 text-xs">
                                                        <div className="flex justify-between mb-1">
                                                            <span className="font-medium">{card.skillTag || card.type || 'skill'}</span>
                                                            <span>{status.statusEmoji} {status.statusText.en}</span>
                                                        </div>
                                                        <div className="text-muted-foreground truncate">{card.question}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>

                                <section className="p-5 rounded-2xl bg-secondary/30 border border-border">
                                    <header className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                            <GraduationCap className="w-4 h-4 text-primary" />
                                            {t.dashboard.recentMistakes}
                                        </div>
                                        <span className="text-xs text-muted-foreground">{t.dashboard.reviewHint}</span>
                                    </header>
                                    {recentMistakes.length > 0 ? (
                                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                            {recentMistakes.map((mistake) => (
                                                <div key={mistake.id} className="p-3 rounded-2xl bg-background/40 border border-border/40">
                                                    <div className="text-xs text-muted-foreground flex justify-between">
                                                        <span>{new Date(mistake.timestamp).toLocaleString()}</span>
                                                        {mistake.skillTag && (
                                                            <span className="uppercase tracking-wide">{mistake.skillTag}</span>
                                                        )}
                                                    </div>
                                                    <p className="font-semibold text-sm mt-2">{mistake.questionText}</p>
                                                    <div className="flex flex-wrap gap-2 text-xs mt-3">
                                                        <span className="px-2 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400">
                                                            {t.dashboard.correct}: {mistake.correctAnswer}
                                                        </span>
                                                        <span className="px-2 py-1 rounded-full bg-destructive/10 border border-destructive/20 text-destructive">
                                                            {t.dashboard.chosen}: {mistake.wrongAnswer}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyState message={t.dashboard.noMistakes} />)
                                    }
                                </section>
                            </div>

                            <div className="flex flex-wrap gap-3 mt-6">
                                <button
                                    onClick={handleExportImage}
                                    disabled={!hasHistory || isLoading || exporting !== null}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                                >
                                    <Download className="w-4 h-4" />
                                    {t.dashboard.exportImage}
                                </button>
                                <button
                                    onClick={handleExportPdf}
                                    disabled={!hasHistory || isLoading || exporting !== null}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-foreground border border-border disabled:opacity-50"
                                >
                                    <Printer className="w-4 h-4" />
                                    {t.dashboard.exportPdf}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function SummaryCard({ label, value, helper }: { label: string; value: string | number; helper?: string; }) {
    return (
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border/60">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
            {helper && <div className="text-[11px] text-muted-foreground mt-1">{helper}</div>}
        </div>
    );
}

function EmptyState({ message }: { message: string; }) {
    return (
        <div className="flex flex-col items-center justify-center text-center gap-2 text-sm text-muted-foreground py-6">
            <LineChart className="w-6 h-6" />
            <p>{message}</p>
        </div>
    );
}
