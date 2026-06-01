'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Activity,
    BarChart3,
    Bell,
    BookOpen,
    CalendarDays,
    CheckCircle2,
    ChevronRight,
    Download,
    Flame,
    GraduationCap,
    HelpCircle,
    Home,
    Layers,
    LineChart,
    Loader2,
    Printer,
    RefreshCw,
    Settings,
    ShieldCheck,
    Sparkles,
    Target,
    Trophy,
    Users,
    X
} from 'lucide-react';

import { useSettingsStore } from '@/store/settingsStore';
import { useGameStore } from '@/store/gameStore';
import { translations } from '@/lib/translations';
import type { DashboardSummary, DailyAccuracyRow, SkillAccuracyRow } from '@/lib/data/history';
import type { DataConsistencyAuditSnapshot } from '@/lib/data/consistency';
import type {
    MistakeRecord,
    RepeatedCauseActionSuggestion,
    RepeatedCauseBaselineSummary,
    RepeatedCauseIntensityAlert,
    RepeatedCauseSnapshot,
    RepeatedCauseTrend
} from '@/lib/data/mistakes';
import { getGuardianDashboardViewModel } from '@/lib/data/guardianDashboard';
import type { GuardianActivityFeedItem, GuardianActivityKind } from '@/lib/data/guardianDashboard';
import { downloadNodeAsImage, openNodePrintView } from '@/lib/exportReport';
import {
    computeStudyActionExecutionSummaryFromRows,
    getMemoryStatus,
    logGuardianDashboardEvent,
    upsertStudyActionExecution
} from '@/db/db';
import type {
    AIRequestMonitorSnapshot,
    EngagementMetricRow,
    EngagementSnapshot,
    FSRSCard,
    GuardianAcceptanceSnapshot,
    StudyActionExecution,
    StudyActionExecutionGoalSnapshot,
    StudyActionExecutionSummary,
    StudyActionPriority,
    StudyActionStatus,
    SessionRecoverySnapshot,
    LearningTask,
    MasteryAggregateSnapshot
} from '@/db/db';
import { computeStudyPlanCompletionSnapshot } from '@/lib/data/studyPlan';
import { buildTargetedReviewPack } from '@/lib/data/targetedReview';
import type { Monster } from '@/store/gameStore';
import type { PracticePlan } from '@/lib/data/dailyPracticePlan';

const RANGE_OPTIONS = [7, 14, 30] as const;
type RangeOption = typeof RANGE_OPTIONS[number];

interface TonightActionItem {
    id: string;
    title: string;
    description: string;
    priority: StudyActionPriority;
    estimatedMinutes: number;
    evidence: string;
    evidenceRows: Array<{ label: string; value: string; }>;
    ctaLabel?: string;
    onCta?: () => void;
}

type Tone = 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'slate';

const FALLBACK_REPEATED_GOAL: RepeatedCauseBaselineSummary = {
    targetReduction: 0.2,
    rows: [],
    overallStatus: 'insufficient'
};

const FALLBACK_REPEATED_ACTION: RepeatedCauseActionSuggestion = {
    status: 'insufficient',
    recommendedQuestions: 3,
    reason: 'collect',
    intensity: 'light',
    rationale: 'Collect more mistake and review evidence before escalating targeted practice.'
};

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
    const [studyActionExecutions, setStudyActionExecutions] = useState<StudyActionExecution[]>([]);
    const [studyActionSummary, setStudyActionSummary] = useState<StudyActionExecutionSummary | null>(null);
    const [studyActionGoal, setStudyActionGoal] = useState<StudyActionExecutionGoalSnapshot | null>(null);
    const [engagementSnapshot, setEngagementSnapshot] = useState<EngagementSnapshot | null>(null);
    const [guardianAcceptance, setGuardianAcceptance] = useState<GuardianAcceptanceSnapshot | null>(null);
    const [repeatedCauseSnapshot, setRepeatedCauseSnapshot] = useState<RepeatedCauseSnapshot | null>(null);
    const [repeatedCauseTrends, setRepeatedCauseTrends] = useState<RepeatedCauseTrend[]>([]);
    const [repeatedCauseBaselineGoal, setRepeatedCauseBaselineGoal] = useState<RepeatedCauseBaselineSummary | null>(null);
    const [repeatedActionData, setRepeatedActionData] = useState<RepeatedCauseActionSuggestion | null>(null);
    const [repeatedAlert, setRepeatedAlert] = useState<RepeatedCauseIntensityAlert | null>(null);
    const [consistencyAudit, setConsistencyAudit] = useState<DataConsistencyAuditSnapshot | null>(null);
    const [aiMonitor, setAiMonitor] = useState<AIRequestMonitorSnapshot | null>(null);
    const [sessionRecovery, setSessionRecovery] = useState<SessionRecoverySnapshot | null>(null);
    const [dailyPracticePlan, setDailyPracticePlan] = useState<PracticePlan | null>(null);
    const [activityFeed, setActivityFeed] = useState<GuardianActivityFeedItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState<'image' | 'pdf' | null>(null);
    const reportRef = useRef<HTMLDivElement | null>(null);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const dashboard = await getGuardianDashboardViewModel(range);
            setSnapshot(dashboard.history);
            setMistakes(dashboard.mistakes);
            setDueCards(dashboard.dueCards);
            setSrsDueCount(dashboard.srsStats.due);
            setMasterySnapshot(dashboard.mastery);
            setLearningTasks(dashboard.learningTasks);
            setStudyActionExecutions(dashboard.studyActionExecutions);
            setStudyActionSummary(dashboard.studyActionSummary);
            setStudyActionGoal(dashboard.studyActionGoal);
            setEngagementSnapshot(dashboard.engagement);
            setGuardianAcceptance(dashboard.guardianAcceptance);
            setRepeatedCauseSnapshot(dashboard.repeatedCauseSnapshot);
            setRepeatedCauseTrends(dashboard.repeatedCauseTrends);
            setRepeatedCauseBaselineGoal(dashboard.repeatedCauseBaselineGoal);
            setRepeatedActionData(dashboard.repeatedAction);
            setRepeatedAlert(dashboard.repeatedAlert);
            setConsistencyAudit(dashboard.consistencyAudit);
            setAiMonitor(dashboard.aiMonitor);
            setSessionRecovery(dashboard.sessionRecovery);
            setDailyPracticePlan(dashboard.dailyPracticePlan);
            setActivityFeed(dashboard.activityFeed);
        } catch (err) {
            console.error(err);
            setError(t.dashboard.loadError || 'Failed to load dashboard data.');
        } finally {
            setIsLoading(false);
        }
    }, [range, t.dashboard.loadError]);

    useEffect(() => {
        if (!isOpen) return;
        loadData();
    }, [isOpen, loadData]);

    useEffect(() => {
        if (!isOpen) return;
        logGuardianDashboardEvent('panel_open').catch((err) => {
            console.error(err);
        });
    }, [isOpen]);

    const hasHistory = Boolean(snapshot && snapshot.records.length > 0);
    const dailyRows = snapshot?.daily ?? [];
    const skillRows = snapshot?.skills.slice(0, 5) ?? [];
    const recentMistakes = mistakes.slice(0, 5);
    const weeklyTaskRows = learningTasks.slice(0, 3);
    const primaryMistake = recentMistakes[0];
    const primaryDueCard = dueCards[0];
    const weakestSkill = skillRows[0];
    const dueStatus = primaryDueCard ? getMemoryStatus(primaryDueCard) : null;

    const averageAccuracy = Math.round((snapshot?.totals.accuracy || 0) * 100);
    const masteryAverage = masterySnapshot && masterySnapshot.totalAttempts > 0
        ? Math.round((masterySnapshot.totalCorrect / masterySnapshot.totalAttempts) * 100)
        : averageAccuracy;
    const currentStreak = computeActivityStreak(dailyRows);
    const latestMission = snapshot?.records[0]?.levelTitle || (isZh ? '暂无任务' : 'No mission yet');
    const lastActiveLabel = snapshot?.totals.lastActive
        ? new Date(snapshot.totals.lastActive).toLocaleDateString()
        : (t.dashboard.noHistoryShort || 'No runs yet');

    const actionStatusById = useMemo(() => {
        return studyActionExecutions.reduce((acc, row) => {
            acc[row.actionId] = row.status;
            return acc;
        }, {} as Record<string, StudyActionStatus>);
    }, [studyActionExecutions]);

    const actionSummary = studyActionSummary ?? computeStudyActionExecutionSummaryFromRows(studyActionExecutions, 14);
    const repeatedGoal = repeatedCauseBaselineGoal ?? FALLBACK_REPEATED_GOAL;
    const repeatedAction = repeatedActionData ?? FALLBACK_REPEATED_ACTION;

    const handleStartTargetedReview = useCallback(() => {
        const pack = buildTargetedReviewPack({
            mistakes,
            focusCauseTag: repeatedAction.focusCauseTag,
            weakestSkillTag: weakestSkill?.skill,
            desiredCount: repeatedAction.recommendedQuestions
        });
        if (pack.monsters.length === 0) return;
        void logGuardianDashboardEvent('session_launch');
        startGame(pack.monsters, `Targeted Review: ${repeatedAction.focusCauseTag || 'core_skills'}`, 'battle');
        setIsOpen(false);
    }, [mistakes, repeatedAction.focusCauseTag, repeatedAction.recommendedQuestions, startGame, weakestSkill?.skill]);

    const handleStartSrsFocus = useCallback(() => {
        const reviewCards = dueCards.slice(0, Math.min(8, dueCards.length));
        if (reviewCards.length === 0) return;
        const monsters: Monster[] = reviewCards.map((card, idx) => {
            const options = card.options && card.options.length >= 2
                ? card.options
                : [card.question || 'Review item', 'Option B', 'Option C', 'Option D'];
            const safeIndex = card.correct_index >= 0 && card.correct_index < options.length ? card.correct_index : 0;
            const fallbackType: Monster['type'] = card.type === 'grammar' || card.type === 'reading' ? card.type : 'vocab';
            return {
                id: Number(card.id || Date.now() + idx),
                type: fallbackType,
                question: card.question || 'Review item',
                options,
                correct_index: safeIndex,
                explanation: card.explanation || 'Review the rule and recall actively.',
                hint: card.hint,
                skillTag: card.skillTag || `${fallbackType}_srs`,
                difficulty: 'medium',
                questionMode: 'choice',
                correctAnswer: options[safeIndex]
            };
        });
        void logGuardianDashboardEvent('session_launch');
        startGame(monsters, `SRS Focus: ${reviewCards.length} cards`, 'srs');
        setIsOpen(false);
    }, [dueCards, startGame]);

    const handleSetActionStatus = useCallback(async (
        actionId: string,
        status: StudyActionStatus,
        priority: StudyActionPriority,
        estimatedMinutes: number
    ) => {
        try {
            await upsertStudyActionExecution({
                actionId,
                status,
                priority,
                estimatedMinutes
            });
            await logGuardianDashboardEvent('action_marked');
            await loadData();
        } catch (err) {
            console.error(err);
        }
    }, [loadData]);

    const tonightActions: TonightActionItem[] = useMemo(() => {
        const mistakeEvidence = primaryMistake
            ? `${primaryMistake.questionText.slice(0, 54)} · ${primaryMistake.wrongAnswer} -> ${primaryMistake.correctAnswer}`
            : (isZh ? '暂无错题样本' : 'No recent mistake sample');
        const fsrsEvidence = primaryDueCard
            ? `${primaryDueCard.skillTag || primaryDueCard.type || 'skill'} · ${dueStatus?.statusText.en || 'due'}`
            : (isZh ? '暂无到期复习卡' : 'No due SRS cards');
        return [
            {
                id: 'targeted_pack',
                title: isZh ? '聚焦重复错因' : 'Focus on Repeated Cause',
                description: isZh
                    ? `围绕 ${formatSkillLabel(repeatedAction.focusCauseTag || 'core_skills')} 完成 ${repeatedAction.recommendedQuestions} 题。`
                    : `Run ${repeatedAction.recommendedQuestions} questions on ${formatSkillLabel(repeatedAction.focusCauseTag || 'core_skills')}.`,
                priority: repeatedAction.status === 'not_met' ? 'urgent' : 'important',
                estimatedMinutes: Math.max(8, repeatedAction.recommendedQuestions * 2),
                evidence: isZh
                    ? `重复错因率 ${formatPercent(repeatedCauseSnapshot?.repeatRate || 0)}`
                    : `Repeated-cause rate ${formatPercent(repeatedCauseSnapshot?.repeatRate || 0)}`,
                evidenceRows: [
                    { label: isZh ? '错题证据' : 'Mistake evidence', value: mistakeEvidence },
                    { label: isZh ? '复习证据' : 'Review evidence', value: fsrsEvidence }
                ],
                ctaLabel: isZh ? '开始' : 'Start',
                onCta: handleStartTargetedReview
            },
            {
                id: 'srs_focus',
                title: isZh ? '守住到期记忆' : 'Protect Due Memory',
                description: isZh
                    ? `完成 ${Math.min(8, Math.max(1, srsDueCount))} 张到期卡，优先保护遗忘风险。`
                    : `Finish ${Math.min(8, Math.max(1, srsDueCount))} due cards to protect retention.`,
                priority: srsDueCount >= 5 ? 'urgent' : 'important',
                estimatedMinutes: Math.max(6, Math.min(20, srsDueCount * 2)),
                evidence: isZh ? `当前到期 ${srsDueCount} 张` : `${srsDueCount} cards due now`,
                evidenceRows: [
                    { label: isZh ? '错题证据' : 'Mistake evidence', value: mistakeEvidence },
                    { label: isZh ? '复习证据' : 'Review evidence', value: fsrsEvidence }
                ],
                ctaLabel: dueCards.length > 0 ? (isZh ? '开练' : 'Launch') : undefined,
                onCta: dueCards.length > 0 ? handleStartSrsFocus : undefined
            },
            {
                id: 'questline_push',
                title: isZh ? '推进学习任务线' : 'Expand Questline',
                description: isZh
                    ? `本周任务完成 ${weeklyTaskRows.filter((task) => task.status === 'completed').length}/${Math.max(1, weeklyTaskRows.length)}。`
                    : `Weekly quest progress is ${weeklyTaskRows.filter((task) => task.status === 'completed').length}/${Math.max(1, weeklyTaskRows.length)}.`,
                priority: weeklyTaskRows.some((task) => task.status === 'active') ? 'important' : 'optional',
                estimatedMinutes: 10,
                evidence: isZh
                    ? `任务完成率 ${formatPercent(engagementSnapshot?.weeklyTaskCompletion.currentRate || 0)}`
                    : `Quest completion ${formatPercent(engagementSnapshot?.weeklyTaskCompletion.currentRate || 0)}`,
                evidenceRows: [
                    { label: isZh ? '错题证据' : 'Mistake evidence', value: mistakeEvidence },
                    { label: isZh ? '复习证据' : 'Review evidence', value: fsrsEvidence }
                ]
            }
        ];
    }, [
        dueCards.length,
        dueStatus?.statusText.en,
        engagementSnapshot?.weeklyTaskCompletion.currentRate,
        handleStartSrsFocus,
        handleStartTargetedReview,
        isZh,
        primaryDueCard,
        primaryMistake,
        repeatedAction.focusCauseTag,
        repeatedAction.recommendedQuestions,
        repeatedAction.status,
        repeatedCauseSnapshot?.repeatRate,
        srsDueCount,
        weeklyTaskRows
    ]);

    const planSnapshot = useMemo(() => {
        return computeStudyPlanCompletionSnapshot(
            tonightActions.map((action) => ({
                id: action.id,
                title: action.title,
                estimatedMinutes: action.estimatedMinutes
            })),
            actionStatusById
        );
    }, [actionStatusById, tonightActions]);

    const learningEvents = useMemo(() => {
        return activityFeed.map((event) => ({
            ...event,
            icon: activityIconForKind(event.kind)
        })) as Array<{
            id: string;
            icon: typeof CheckCircle2;
            tone: Tone;
            title: string;
            detail: string;
            meta: string;
        }>;
    }, [activityFeed]);

    const handleExportImage = async () => {
        if (!reportRef.current || !hasHistory) return;
        setExporting('image');
        try {
            await downloadNodeAsImage(reportRef.current, `word-quest-report-${range}d.png`);
            await logGuardianDashboardEvent('report_export');
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
            await logGuardianDashboardEvent('report_export');
        } finally {
            setExporting(null);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/25 hover:scale-105"
                aria-label={t.dashboard.open}
            >
                <GraduationCap className="h-6 w-6" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 bg-slate-950/75 p-2 backdrop-blur-sm sm:p-4"
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.98, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.98, opacity: 0 }}
                            className="mx-auto flex h-[calc(100vh-1rem)] w-full max-w-[1560px] overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 text-slate-950 shadow-2xl sm:h-[calc(100vh-2rem)]"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <aside className="hidden w-72 shrink-0 flex-col border-r border-slate-200 bg-white p-5 lg:flex">
                                <div className="mb-8 flex items-center gap-3">
                                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20">
                                        <BookOpen className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-black tracking-tight">Guardian Dashboard</h2>
                                        <p className="text-xs font-medium text-slate-500">AI Learning Companion</p>
                                    </div>
                                </div>

                                <nav className="space-y-1">
                                    <SidebarItem icon={Home} label={isZh ? '总览' : 'Overview'} active />
                                    <SidebarItem icon={Users} label={isZh ? '学习者' : 'Learners'} />
                                    <SidebarItem icon={Layers} label={isZh ? '任务' : 'Missions'} />
                                    <SidebarItem icon={BookOpen} label={isZh ? '知识库' : 'Knowledge'} />
                                    <SidebarItem icon={BarChart3} label={isZh ? '报告' : 'Reports'} />
                                    <SidebarItem icon={Sparkles} label={isZh ? '建议' : 'Recommendations'} />
                                    <SidebarItem icon={Settings} label={isZh ? '设置' : 'Settings'} />
                                    <SidebarItem icon={HelpCircle} label={isZh ? '帮助' : 'Help & Support'} />
                                </nav>

                                <div className="mt-auto space-y-4">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="mb-3 flex items-center gap-2">
                                            <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                                                <CheckCircle2 className="h-4 w-4" />
                                            </span>
                                            <div>
                                                <p className="text-sm font-bold">{isZh ? '系统状态' : 'System Status'}</p>
                                                <p className="text-xs text-emerald-600">{systemStatusLabel(aiMonitor?.status)}</p>
                                            </div>
                                        </div>
                                        <p className="text-xs text-slate-500">
                                            {isZh ? '最近更新' : 'Last updated'}: {new Date().toLocaleTimeString()}
                                        </p>
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                                        <p className="mb-3 text-sm font-bold">{isZh ? '快捷操作' : 'Quick Actions'}</p>
                                        <div className="space-y-2">
                                            <button
                                                onClick={handleStartTargetedReview}
                                                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:border-blue-200 hover:bg-blue-50"
                                            >
                                                <span>{isZh ? '创建定向任务' : 'Create Mission'}</span>
                                                <Target className="h-4 w-4 text-blue-600" />
                                            </button>
                                            <button
                                                onClick={handleStartSrsFocus}
                                                disabled={dueCards.length === 0}
                                                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:border-blue-200 hover:bg-blue-50 disabled:opacity-50"
                                            >
                                                <span>{isZh ? '复习到期卡' : 'Review Cards'}</span>
                                                <BookOpen className="h-4 w-4 text-blue-600" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </aside>

                            <div className="flex min-w-0 flex-1 flex-col">
                                <header className="flex shrink-0 flex-col gap-4 border-b border-slate-200 bg-white px-4 py-4 md:flex-row md:items-center md:justify-between md:px-7">
                                    <div className="flex items-center gap-4">
                                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-500">
                                            <Sparkles className="h-7 w-7" />
                                        </div>
                                        <div>
                                            <h1 className="text-2xl font-black tracking-tight md:text-3xl">
                                                {isZh ? '早上好，守护者！' : 'Good morning, Guardian!'}
                                            </h1>
                                            <p className="text-sm text-slate-500">
                                                {isZh ? '这是学习者今天和近期的关键学习证据。' : "Here's what's happening with your learners today."}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                                            <CalendarDays className="h-4 w-4 text-slate-500" />
                                            <span>{range}d</span>
                                            <div className="ml-2 flex gap-1">
                                                {RANGE_OPTIONS.map((option) => (
                                                    <button
                                                        key={option}
                                                        onClick={() => setRange(option)}
                                                        className={`rounded-lg px-2 py-1 text-xs ${range === option ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-200'}`}
                                                    >
                                                        {option}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <button className="relative grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white">
                                            <Bell className="h-5 w-5 text-slate-600" />
                                            {repeatedAlert?.active && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500" />}
                                        </button>
                                        <button
                                            onClick={handleExportImage}
                                            disabled={!hasHistory || isLoading || exporting !== null}
                                            className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700 disabled:opacity-50"
                                        >
                                            {exporting === 'image' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                            {isZh ? '导出报告' : 'Export Report'}
                                        </button>
                                        <button
                                            onClick={() => setIsOpen(false)}
                                            aria-label="Close dashboard"
                                            className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white hover:bg-slate-100"
                                        >
                                            <X className="h-5 w-5 text-slate-500" />
                                        </button>
                                    </div>
                                </header>

                                <div ref={reportRef} className="min-h-0 flex-1 overflow-y-auto p-4 md:p-7">
                                    {error && (
                                        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                                            {error}
                                        </div>
                                    )}

                                    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                                        <KpiCard
                                            title={isZh ? '平均掌握度' : 'Mastery Score (Avg.)'}
                                            value={`${masteryAverage}%`}
                                            helper={isZh ? `窗口 ${range} 天` : `From last ${range} days`}
                                            tone="blue"
                                            icon={LineChart}
                                            ringValue={masteryAverage}
                                        />
                                        <KpiCard
                                            title={isZh ? '完成任务' : 'Missions Completed'}
                                            value={formatNumber(snapshot?.totals.missions || 0)}
                                            helper={latestMission}
                                            tone="amber"
                                            icon={Trophy}
                                        />
                                        <KpiCard
                                            title={isZh ? '已回答题目' : 'Questions Answered'}
                                            value={formatNumber(snapshot?.totals.total || 0)}
                                            helper={isZh ? `正确 ${snapshot?.totals.correct || 0}` : `${snapshot?.totals.correct || 0} correct`}
                                            tone="green"
                                            icon={HelpCircle}
                                        />
                                        <KpiCard
                                            title={isZh ? '平均正确率' : 'Avg. Accuracy'}
                                            value={`${averageAccuracy}%`}
                                            helper={engagementSnapshot ? statusCopy(engagementSnapshot.dailyChallengeParticipation.status, isZh) : lastActiveLabel}
                                            tone="purple"
                                            icon={Target}
                                        />
                                        <KpiCard
                                            title={isZh ? '连续学习' : 'Streak'}
                                            value={currentStreak}
                                            helper={isZh ? '天连续活跃' : 'days in a row'}
                                            tone="red"
                                            icon={Flame}
                                        />
                                    </section>

                                    <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
                                        <Panel title={isZh ? '掌握进度' : 'Mastery Progress'} subtitle={isZh ? '按技能域查看平均掌握度' : 'Average mastery by domain'} icon={LineChart}>
                                            {skillRows.length > 0 ? (
                                                <div className="space-y-4">
                                                    {skillRows.map((skill, index) => (
                                                        <SkillProgressRow key={skill.skill} row={skill} tone={progressTones[index % progressTones.length]} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <EmptyState message={t.dashboard.noSkillData || 'No skill data yet.'} />
                                            )}
                                        </Panel>

                                        <Panel title="Review Queue" subtitle={isZh ? '需要优先关注的复习项目' : 'Items that need attention'} icon={ShieldCheck} badge={String(srsDueCount)}>
                                            {dueCards.length > 0 ? (
                                                <div className="space-y-3">
                                                    {dueCards.slice(0, 4).map((card, index) => (
                                                        <ReviewQueueRow key={card.id || index} card={card} index={index} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <EmptyState message={isZh ? '暂无到期复习卡。' : 'No due review cards.'} />
                                            )}
                                        </Panel>

                                        <Panel title="Learning Events" subtitle={isZh ? '近期学习证据流' : 'Recent activity feed'} icon={Activity}>
                                            {learningEvents.length > 0 ? (
                                                <div className="space-y-4">
                                                    {learningEvents.map((event) => (
                                                        <TimelineRow key={event.id} {...event} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <EmptyState message={isZh ? '暂无学习事件。' : 'No learning events yet.'} />
                                            )}
                                        </Panel>
                                    </section>

                                    <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
                                        <Panel title={isZh ? '每周趋势' : 'Weekly Trend'} subtitle={isZh ? '正确率与任务量走势' : 'Accuracy and mission volume'} icon={BarChart3}>
                                            <WeeklyTrend rows={dailyRows} />
                                        </Panel>

                                        <Panel title="Guardian Recommendations" subtitle={isZh ? '基于证据的今晚行动' : 'Personalized tips to help learners grow'} icon={Sparkles}>
                                            {dailyPracticePlan && (
                                                <div className="mb-3 rounded-2xl border border-blue-100 bg-blue-50 p-3">
                                                    <div className="mb-2 flex items-center justify-between gap-3">
                                                        <p className="text-sm font-black text-blue-950">
                                                            {isZh ? '今日推荐依据' : 'Why This Plan'}
                                                        </p>
                                                        <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-blue-700">
                                                            {dailyPracticePlan.estimatedMinutes}m
                                                        </span>
                                                    </div>
                                                    <p className="text-xs leading-relaxed text-blue-800">
                                                        {dailyPracticePlan.rationale}
                                                    </p>
                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                        {dailyPracticePlan.evidence.slice(0, 3).map((row, index) => (
                                                            <span key={`${row.label}-${index}`} className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-blue-700">
                                                                {row.label}: {row.value}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <div className="space-y-3">
                                                {tonightActions.map((action) => (
                                                    <RecommendationRow
                                                        key={action.id}
                                                        action={action}
                                                        status={actionStatusById[action.id] || 'pending'}
                                                        onSetStatus={handleSetActionStatus}
                                                    />
                                                ))}
                                            </div>
                                        </Panel>

                                        <Panel title="Stability Monitor" subtitle={isZh ? '系统性能与可靠性' : 'System performance and reliability'} icon={ShieldCheck}>
                                            <div className="grid grid-cols-3 gap-2">
                                                <StabilityMetric label={isZh ? '成功率' : 'Success'} value={aiMonitor ? formatPercent(aiMonitor.successRate.currentRate) : '--'} />
                                                <StabilityMetric label={isZh ? '响应' : 'Avg. Response'} value={aiMonitor ? `${Math.round(aiMonitor.avgLatencyMs)}ms` : '--'} />
                                                <StabilityMetric label={isZh ? '重试压力' : 'Retry Rate'} value={aiMonitor ? formatPercent(aiMonitor.retryPressureRate) : '--'} />
                                            </div>
                                            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px]">
                                                <div className="space-y-2 text-sm">
                                                    <ServiceRow label="Content Service" status="operational" />
                                                    <ServiceRow label="AI Inference" status={aiMonitor?.status || 'insufficient'} />
                                                    <ServiceRow label="Analytics Service" status={consistencyAudit?.overallStatus === 'warning' ? 'warning' : 'operational'} />
                                                    <ServiceRow label="Session Recovery" status={sessionRecovery?.status || 'insufficient'} />
                                                </div>
                                                <div className="grid place-items-center rounded-2xl bg-blue-50 p-4 text-center">
                                                    <ShieldCheck className="mb-2 h-14 w-14 text-blue-600" />
                                                    <p className="text-sm font-black text-slate-900">{systemStatusLabel(aiMonitor?.status)}</p>
                                                    <p className="text-xs text-slate-500">{isZh ? '无重大事件' : 'No incidents reported'}</p>
                                                </div>
                                            </div>
                                        </Panel>
                                    </section>

                                    <section className="mt-4 grid gap-4 xl:grid-cols-3">
                                        <Panel title={isZh ? '计划执行' : 'Plan vs Completion'} subtitle={isZh ? '今晚建议执行回写' : 'Guardian action follow-through'} icon={CheckCircle2}>
                                            <div className="grid grid-cols-3 gap-3">
                                                <MiniMetric label={isZh ? '计划' : 'Planned'} value={planSnapshot.totalActions} />
                                                <MiniMetric label={isZh ? '完成' : 'Done'} value={planSnapshot.completedActions} />
                                                <MiniMetric label={isZh ? '分钟' : 'Minutes'} value={`${planSnapshot.completedMinutes}/${planSnapshot.plannedMinutes}`} />
                                            </div>
                                            <p className="mt-3 text-xs text-slate-500">
                                                {isZh ? '建议执行率' : 'Execution rate'}: {formatPercent(actionSummary.executionRate)}
                                                {studyActionGoal ? ` · ${statusCopy(studyActionGoal.executionRate.status, isZh)}` : ''}
                                            </p>
                                        </Panel>

                                        <Panel title={isZh ? '重复错因目标' : 'Repeated-Cause Goal'} subtitle={isZh ? '对比基线是否下降 20%' : 'Baseline comparison for 20% reduction'} icon={Target}>
                                            <div className="flex items-center justify-between gap-4">
                                                <div>
                                                    <p className="text-3xl font-black">{formatPercent(repeatedCauseSnapshot?.repeatRate || 0)}</p>
                                                    <p className="text-sm text-slate-500">
                                                        {repeatedCauseSnapshot
                                                            ? `${repeatedCauseSnapshot.repeatedMistakes}/${repeatedCauseSnapshot.taggedMistakes} tagged mistakes`
                                                            : (isZh ? '暂无样本' : 'No samples yet')}
                                                    </p>
                                                </div>
                                                <StatusPill status={repeatedGoal.overallStatus} isZh={isZh} />
                                            </div>
                                            {repeatedCauseTrends.length > 0 && (
                                                <div className="mt-3 space-y-2">
                                                    {repeatedCauseTrends.slice(0, 3).map((trend) => (
                                                        <div key={trend.windowDays} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs">
                                                            <span>{trend.windowDays}d</span>
                                                            <span>{formatPercent(trend.current.repeatRate)}</span>
                                                            <span className={trend.deltaRate <= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                                                {trend.deltaRate <= 0 ? '↓' : '↑'} {Math.abs(trend.deltaRate * 100).toFixed(1)}pp
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </Panel>

                                        <Panel title={isZh ? '监护人采纳' : 'Guardian Acceptance'} subtitle={isZh ? '面板周活与建议追踪' : 'Weekly usage and recommendation loop'} icon={Users}>
                                            <MetricTile metric={guardianAcceptance?.weeklyActiveRate} label={isZh ? '周活跃率' : 'Weekly active'} isZh={isZh} />
                                            <MetricTile metric={engagementSnapshot?.nextDayRetention} label={isZh ? '次日留存' : 'Next-day retention'} isZh={isZh} />
                                        </Panel>
                                    </section>

                                    <div className="mt-5 flex flex-wrap gap-3">
                                        <button
                                            onClick={handleExportImage}
                                            disabled={!hasHistory || isLoading || exporting !== null}
                                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                                        >
                                            <Download className="h-4 w-4" />
                                            {t.dashboard.exportImage}
                                        </button>
                                        <button
                                            onClick={handleExportPdf}
                                            disabled={!hasHistory || isLoading || exporting !== null}
                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
                                        >
                                            <Printer className="h-4 w-4" />
                                            {t.dashboard.exportPdf}
                                        </button>
                                        <button
                                            onClick={loadData}
                                            disabled={isLoading}
                                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                                            {t.dashboard.refresh}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function SidebarItem({ icon: Icon, label, active = false }: { icon: typeof Home; label: string; active?: boolean; }) {
    return (
        <button
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
        >
            <Icon className="h-5 w-5" />
            {label}
        </button>
    );
}

function KpiCard({
    title,
    value,
    helper,
    icon: Icon,
    tone,
    ringValue
}: {
    title: string;
    value: string | number;
    helper: string;
    icon: typeof LineChart;
    tone: Tone;
    ringValue?: number;
}) {
    const toneClass = iconToneClass(tone);
    return (
        <div className="min-h-[124px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-700">{title}</p>
                    <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
                    <p className="mt-2 text-xs font-medium leading-snug text-slate-500">{helper}</p>
                </div>
                {typeof ringValue === 'number' ? (
                    <MasteryRing value={ringValue} />
                ) : (
                    <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${toneClass.bg} ${toneClass.text}`}>
                        <Icon className="h-7 w-7" />
                    </div>
                )}
            </div>
        </div>
    );
}

function Panel({
    title,
    subtitle,
    icon: Icon,
    badge,
    children
}: {
    title: string;
    subtitle: string;
    icon: typeof LineChart;
    badge?: string;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <header className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600">
                        <Icon className="h-5 w-5" />
                    </span>
                    <div>
                        <h3 className="font-black tracking-tight text-slate-950">{title}</h3>
                        <p className="text-sm text-slate-500">{subtitle}</p>
                    </div>
                </div>
                {badge && (
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-black text-blue-700">{badge}</span>
                )}
            </header>
            {children}
        </section>
    );
}

const progressTones: Tone[] = ['blue', 'green', 'purple', 'amber', 'slate'];

function SkillProgressRow({ row, tone }: { row: SkillAccuracyRow; tone: Tone; }) {
    const toneClass = progressToneClass(tone);
    const percentage = Math.round(row.accuracy * 100);
    return (
        <div className="grid grid-cols-[minmax(120px,1fr)_minmax(110px,180px)_44px] items-center gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
            <div className="flex min-w-0 items-center gap-3">
                <span className={`grid h-8 w-8 place-items-center rounded-xl ${toneClass.bg} ${toneClass.text}`}>
                    <BookOpen className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{formatSkillLabel(row.skill)}</p>
                    <p className="text-xs text-slate-500">{row.correct}/{row.total} correct</p>
                </div>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${toneClass.bar}`} style={{ width: `${Math.max(4, percentage)}%` }} />
            </div>
            <span className="text-right text-sm font-black text-slate-700">{percentage}%</span>
        </div>
    );
}

function ReviewQueueRow({ card, index }: { card: FSRSCard; index: number; }) {
    const status = getMemoryStatus(card);
    const priority = index === 0 ? 'High' : index < 3 ? 'Medium' : 'Low';
    const tone = priority === 'High' ? 'red' : priority === 'Medium' ? 'amber' : 'blue';
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconToneClass(tone).bg} ${iconToneClass(tone).text}`}>
                <BookOpen className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-900">{formatSkillLabel(card.skillTag || card.type || 'review')}</p>
                <p className="truncate text-xs text-slate-500">{card.question}</p>
            </div>
            <div className="text-right">
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${priorityToneClass(priority)}`}>{priority}</span>
                <p className="mt-1 text-xs text-slate-500">{status.statusText.en}</p>
            </div>
        </div>
    );
}

function activityIconForKind(kind: GuardianActivityKind): typeof CheckCircle2 {
    switch (kind) {
        case 'mission':
            return CheckCircle2;
        case 'answer':
            return HelpCircle;
        case 'session':
            return Activity;
        case 'hint':
            return Sparkles;
        case 'mistake':
            return Target;
        case 'task':
            return Trophy;
        default:
            return CheckCircle2;
    }
}

function TimelineRow({
    icon: Icon,
    tone,
    title,
    detail,
    meta
}: {
    icon: typeof CheckCircle2;
    tone: Tone;
    title: string;
    detail: string;
    meta: string;
}) {
    const toneClass = iconToneClass(tone);
    return (
        <div className="relative flex gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${toneClass.bg} ${toneClass.text}`}>
                <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 border-b border-slate-100 pb-3 last:border-0">
                <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-black text-slate-900">{title}</p>
                    <span className="text-xs font-semibold text-slate-500">{meta}</span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
            </div>
        </div>
    );
}

function WeeklyTrend({ rows }: { rows: DailyAccuracyRow[]; }) {
    if (rows.length === 0) return <EmptyState message="No weekly trend yet." />;
    const accuracyPath = buildSparkPath(rows.map((row) => row.accuracy), 320, 130);
    const missionPath = buildSparkPath(rows.map((row) => row.missions), 320, 130);
    const labelStep = Math.max(1, Math.ceil(rows.length / 6));
    return (
        <div>
            <div className="mb-3 flex items-center justify-end gap-4 text-xs font-semibold">
                <span className="inline-flex items-center gap-1 text-blue-700"><span className="h-2 w-2 rounded-full bg-blue-600" /> Accuracy</span>
                <span className="inline-flex items-center gap-1 text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Missions</span>
            </div>
            <svg viewBox="0 0 360 170" className="h-48 w-full overflow-visible">
                {[0, 1, 2, 3].map((line) => (
                    <line key={line} x1="28" x2="344" y1={24 + line * 36} y2={24 + line * 36} stroke="#e2e8f0" strokeWidth="1" />
                ))}
                <path d={`${accuracyPath} L 344 148 L 28 148 Z`} fill="rgba(37, 99, 235, 0.08)" />
                <path d={accuracyPath} fill="none" stroke="#2563eb" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" />
                <path d={missionPath} fill="none" stroke="#10b981" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                {rows.map((row, index) => {
                    const shouldShowLabel = index === 0 ||
                        index === rows.length - 1 ||
                        (index % labelStep === 0 && index < rows.length - labelStep);
                    if (!shouldShowLabel) return null;
                    const x = 28 + (index / Math.max(1, rows.length - 1)) * 316;
                    return (
                        <text key={row.date} x={x} y="166" textAnchor="middle" className="fill-slate-500 text-[10px] font-semibold">
                            {row.label}
                        </text>
                    );
                })}
            </svg>
        </div>
    );
}

function RecommendationRow({
    action,
    status,
    onSetStatus
}: {
    action: TonightActionItem;
    status: StudyActionStatus;
    onSetStatus: (actionId: string, status: StudyActionStatus, priority: StudyActionPriority, estimatedMinutes: number) => void;
}) {
    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                    <Target className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-black text-slate-900">{action.title}</p>
                        <PriorityBadge priority={action.priority} />
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{action.description}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-600">{action.evidence}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {action.ctaLabel && action.onCta && (
                            <button onClick={action.onCta} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white">
                                {action.ctaLabel}
                            </button>
                        )}
                        <button
                            onClick={() => onSetStatus(action.id, 'completed', action.priority, action.estimatedMinutes)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-black ${status === 'completed' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
                        >
                            Done
                        </button>
                        <button
                            onClick={() => onSetStatus(action.id, 'skipped', action.priority, action.estimatedMinutes)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-black ${status === 'skipped' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
                        >
                            Skip
                        </button>
                    </div>
                </div>
                <ChevronRight className="mt-3 h-4 w-4 shrink-0 text-slate-400" />
            </div>
        </div>
    );
}

function StabilityMetric({ label, value }: { label: string; value: string; }) {
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-500">{label}</p>
            <p className="mt-1 text-lg font-black text-slate-950">{value}</p>
            <div className="mt-2 h-6 overflow-hidden rounded bg-white">
                <svg viewBox="0 0 120 24" className="h-full w-full">
                    <path d="M0 18 L10 13 L20 16 L30 10 L40 14 L50 8 L60 13 L70 7 L80 12 L90 9 L100 14 L120 10" fill="none" stroke="#10b981" strokeWidth="3" />
                </svg>
            </div>
        </div>
    );
}

function ServiceRow({ label, status }: { label: string; status: string; }) {
    const healthy = status === 'healthy' || status === 'operational' || status === 'ok';
    const warning = status === 'warning' || status === 'insufficient';
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
                <CheckCircle2 className={`h-4 w-4 ${healthy ? 'text-emerald-600' : warning ? 'text-amber-500' : 'text-red-500'}`} />
                {label}
            </span>
            <span className={`text-xs font-black ${healthy ? 'text-emerald-600' : warning ? 'text-amber-600' : 'text-red-600'}`}>
                {healthy ? 'Operational' : warning ? 'Watch' : 'Issue'}
            </span>
        </div>
    );
}

function MiniMetric({ label, value }: { label: string; value: string | number; }) {
    return (
        <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
        </div>
    );
}

function MetricTile({ metric, label, isZh }: { metric?: EngagementMetricRow; label: string; isZh: boolean; }) {
    return (
        <div className="mt-3 rounded-xl bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-black text-slate-900">{label}</p>
                <span className={`text-xs font-black ${metricStatusClass(metric?.status)}`}>{statusCopy(metric?.status || 'insufficient', isZh)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
                {isZh ? '当前' : 'Current'}: {formatPercent(metric?.currentRate || 0)} · {isZh ? '上期' : 'Prev'}: {formatPercent(metric?.previousRate || 0)}
            </p>
        </div>
    );
}

function EmptyState({ message }: { message: string; }) {
    return (
        <div className="grid min-h-[120px] place-items-center rounded-2xl bg-slate-50 text-center text-sm font-medium text-slate-500">
            <div>
                <LineChart className="mx-auto mb-2 h-6 w-6" />
                <p>{message}</p>
            </div>
        </div>
    );
}

function MasteryRing({ value }: { value: number; }) {
    const safe = Math.max(0, Math.min(100, value));
    const circumference = 2 * Math.PI * 22;
    const offset = circumference - (safe / 100) * circumference;
    return (
        <div className="relative h-16 w-16 shrink-0">
            <svg viewBox="0 0 56 56" className="h-16 w-16 rotate-[-90deg]">
                <circle cx="28" cy="28" r="22" stroke="#dbeafe" strokeWidth="7" fill="none" />
                <circle
                    cx="28"
                    cy="28"
                    r="22"
                    stroke="#2563eb"
                    strokeWidth="7"
                    strokeLinecap="round"
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                />
            </svg>
            <span className="absolute inset-0 grid place-items-center text-sm font-black text-blue-700">{safe}%</span>
        </div>
    );
}

function PriorityBadge({ priority }: { priority: StudyActionPriority; }) {
    const classes = priority === 'urgent'
        ? 'bg-red-50 text-red-700'
        : priority === 'important'
            ? 'bg-amber-50 text-amber-700'
            : 'bg-blue-50 text-blue-700';
    return <span className={`rounded-full px-2 py-1 text-[11px] font-black uppercase ${classes}`}>{priority}</span>;
}

function StatusPill({ status, isZh }: { status: 'passed' | 'not_met' | 'insufficient'; isZh: boolean; }) {
    const classes = status === 'passed'
        ? 'bg-emerald-50 text-emerald-700'
        : status === 'not_met'
            ? 'bg-red-50 text-red-700'
            : 'bg-slate-100 text-slate-600';
    return <span className={`rounded-full px-3 py-1 text-xs font-black ${classes}`}>{statusCopy(status, isZh)}</span>;
}

function computeActivityStreak(rows: DailyAccuracyRow[]) {
    let streak = 0;
    for (let index = rows.length - 1; index >= 0; index--) {
        if ((rows[index]?.missions || 0) <= 0) break;
        streak += 1;
    }
    return streak;
}

function buildSparkPath(values: number[], width: number, height: number) {
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const spread = Math.max(0.01, max - min);
    const left = 28;
    const top = 18;
    const plotWidth = width - 4;
    const plotHeight = height;
    return values.map((value, index) => {
        const x = left + (index / Math.max(1, values.length - 1)) * plotWidth;
        const y = top + (1 - (value - min) / spread) * plotHeight;
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
}

function formatSkillLabel(value: string) {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPercent(value: number) {
    return `${Math.round(value * 100)}%`;
}

function formatNumber(value: number) {
    return new Intl.NumberFormat().format(value);
}

function statusCopy(status: string, isZh: boolean) {
    if (status === 'met' || status === 'passed') return isZh ? '达标' : 'Met';
    if (status === 'not_met') return isZh ? '未达标' : 'Not Met';
    if (status === 'healthy' || status === 'ok') return isZh ? '健康' : 'Healthy';
    if (status === 'warning') return isZh ? '预警' : 'Warning';
    if (status === 'critical') return isZh ? '严重' : 'Critical';
    return isZh ? '样本不足' : 'Insufficient';
}

function systemStatusLabel(status?: string) {
    if (status === 'critical') return 'Needs Attention';
    if (status === 'warning') return 'Monitoring';
    if (status === 'insufficient') return 'Collecting Data';
    return 'All Systems Operational';
}

function metricStatusClass(status?: string) {
    if (status === 'met' || status === 'passed') return 'text-emerald-600';
    if (status === 'not_met' || status === 'critical') return 'text-red-600';
    if (status === 'warning') return 'text-amber-600';
    return 'text-slate-500';
}

function priorityToneClass(priority: string) {
    if (priority === 'High') return 'bg-red-50 text-red-700';
    if (priority === 'Medium') return 'bg-amber-50 text-amber-700';
    return 'bg-blue-50 text-blue-700';
}

function iconToneClass(tone: Tone) {
    return {
        blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
        green: { bg: 'bg-emerald-50', text: 'text-emerald-600' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600' },
        purple: { bg: 'bg-violet-50', text: 'text-violet-600' },
        red: { bg: 'bg-red-50', text: 'text-red-600' },
        slate: { bg: 'bg-slate-100', text: 'text-slate-600' }
    }[tone];
}

function progressToneClass(tone: Tone) {
    return {
        blue: { bg: 'bg-blue-50', text: 'text-blue-600', bar: 'bg-blue-600' },
        green: { bg: 'bg-emerald-50', text: 'text-emerald-600', bar: 'bg-emerald-500' },
        amber: { bg: 'bg-amber-50', text: 'text-amber-600', bar: 'bg-amber-500' },
        purple: { bg: 'bg-violet-50', text: 'text-violet-600', bar: 'bg-violet-500' },
        red: { bg: 'bg-red-50', text: 'text-red-600', bar: 'bg-red-500' },
        slate: { bg: 'bg-slate-100', text: 'text-slate-600', bar: 'bg-slate-500' }
    }[tone];
}
