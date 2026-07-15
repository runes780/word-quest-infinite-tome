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
    GlobalPlayerProfile,
    GuardianAcceptanceSnapshot,
    StudyActionExecution,
    StudyActionExecutionGoalSnapshot,
    StudyActionExecutionSummary,
    StudyActionPriority,
    StudyActionStatus,
    SessionRecoverySnapshot,
    LearningTask,
    MasteryAggregateSnapshot,
    ObjectiveMasteryAggregateSnapshot
} from '@/db/db';
import { computeStudyPlanCompletionSnapshot } from '@/lib/data/studyPlan';
import { buildTargetedReviewPack } from '@/lib/data/targetedReview';
import type { Monster } from '@/store/gameStore';
import type { PracticePlan, PracticePlanEvidence } from '@/lib/data/dailyPracticePlan';
import type { DailyFlameStatus } from '@/lib/data/dailyFlame';
import { formatLearningLabel, mapSkillTagToObjectiveId, objectiveTitle } from '@/lib/data/learningObjectives';
import type { CalibrationSummary } from '@/lib/data/metacognitiveCalibration';

const RANGE_OPTIONS = [7, 14, 30] as const;
const MIN_AI_MONITOR_REQUESTS = 5;
type RangeOption = typeof RANGE_OPTIONS[number];
type DashboardSectionId =
    | 'overview'
    | 'mastery'
    | 'review'
    | 'events'
    | 'trend'
    | 'recommendations'
    | 'stability'
    | 'plan'
    | 'repeatedCause'
    | 'acceptance';

interface DashboardNavItem {
    id: DashboardSectionId;
    icon: typeof Home;
    label: string;
    ariaLabel: string;
}

interface TonightActionItem {
    id: string;
    title: string;
    description: string;
    priority: StudyActionPriority;
    estimatedMinutes: number;
    evidence: string;
    evidenceRows: Array<{ label: string; value: string; }>;
    expectedImpact: string;
    followUp: string;
    resultAfterCompletion?: string;
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
    const [playerProfile, setPlayerProfile] = useState<GlobalPlayerProfile | null>(null);
    const [dailyFlameStatus, setDailyFlameStatus] = useState<DailyFlameStatus | null>(null);
    const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
    const [dueCards, setDueCards] = useState<FSRSCard[]>([]);
    const [srsDueCount, setSrsDueCount] = useState(0);
    const [masterySnapshot, setMasterySnapshot] = useState<MasteryAggregateSnapshot | null>(null);
    const [objectiveMasterySnapshot, setObjectiveMasterySnapshot] = useState<ObjectiveMasteryAggregateSnapshot | null>(null);
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
    const [calibrationSummary, setCalibrationSummary] = useState<CalibrationSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState<'image' | 'pdf' | null>(null);
    const [pendingExport, setPendingExport] = useState<'image' | 'pdf' | null>(null);
    const reportRef = useRef<HTMLDivElement | null>(null);
    const exportReportRef = useRef<HTMLDivElement | null>(null);
    const [exportGeneratedAt, setExportGeneratedAt] = useState(() => Date.now());
    const [exportSnapshotMounted, setExportSnapshotMounted] = useState(false);
    const sectionRefs = useRef<Partial<Record<DashboardSectionId, HTMLElement | null>>>({});
    const [activeSection, setActiveSection] = useState<DashboardSectionId>('overview');

    const registerSection = useCallback((id: DashboardSectionId) => (node: HTMLElement | null) => {
        sectionRefs.current[id] = node;
    }, []);

    const scrollToSection = useCallback((id: DashboardSectionId) => {
        setActiveSection(id);
        const node = sectionRefs.current[id];
        const container = reportRef.current;
        if (!node) return;
        if (!container) {
            node.scrollIntoView({ behavior: 'smooth', block: 'start' });
            node.focus({ preventScroll: true });
            return;
        }

        const containerRect = container.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const targetTop = Math.max(0, container.scrollTop + nodeRect.top - containerRect.top - 8);
        if (typeof container.scrollTo === 'function') {
            container.scrollTo({ top: targetTop, behavior: 'smooth' });
        } else {
            container.scrollTop = targetTop;
        }

        const focusNode = () => node.focus({ preventScroll: true });
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            window.requestAnimationFrame(focusNode);
        } else {
            focusNode();
        }
    }, []);

    const dashboardNavItems = useMemo<DashboardNavItem[]>(() => [
        {
            id: 'overview',
            icon: Home,
            label: isZh ? '总览' : 'Overview',
            ariaLabel: isZh ? '打开总览证据' : 'Open Overview insights'
        },
        {
            id: 'acceptance',
            icon: Users,
            label: isZh ? '学习者' : 'Learners',
            ariaLabel: isZh ? '打开学习者证据' : 'Open Learner engagement insights'
        },
        {
            id: 'plan',
            icon: Layers,
            label: isZh ? '任务执行' : 'Missions',
            ariaLabel: isZh ? '打开任务执行' : 'Open Mission follow-through'
        },
        {
            id: 'mastery',
            icon: BookOpen,
            label: isZh ? '知识库' : 'Knowledge',
            ariaLabel: isZh ? '打开知识复习证据' : 'Open Knowledge review insights'
        },
        {
            id: 'trend',
            icon: BarChart3,
            label: isZh ? '报告' : 'Reports',
            ariaLabel: isZh ? '打开报告趋势' : 'Open Report trends'
        },
        {
            id: 'recommendations',
            icon: Sparkles,
            label: isZh ? '建议' : 'Recommendations',
            ariaLabel: isZh ? '打开建议' : 'Open Recommendations'
        },
        {
            id: 'stability',
            icon: Settings,
            label: isZh ? '设置' : 'Settings',
            ariaLabel: isZh ? '打开系统状态' : 'Open System status'
        },
        {
            id: 'repeatedCause',
            icon: HelpCircle,
            label: isZh ? '帮助' : 'Help & Support',
            ariaLabel: isZh ? '打开帮助建议' : 'Open Help and support guidance'
        }
    ], [isZh]);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const dashboard = await getGuardianDashboardViewModel(range);
            setSnapshot(dashboard.history);
            setPlayerProfile(dashboard.playerProfile);
            setDailyFlameStatus(dashboard.dailyFlameStatus);
            setMistakes(dashboard.mistakes);
            setDueCards(dashboard.dueCards);
            setSrsDueCount(dashboard.srsStats.due);
            setMasterySnapshot(dashboard.mastery);
            setObjectiveMasterySnapshot(dashboard.objectiveMastery ?? null);
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
            setCalibrationSummary(dashboard.calibrationSummary ?? null);
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

    useEffect(() => {
        if (!isOpen || typeof window === 'undefined') return;
        const handleEvidenceUpdate = () => {
            loadData();
        };
        window.addEventListener('wordquest:learning-evidence-updated', handleEvidenceUpdate);
        return () => {
            window.removeEventListener('wordquest:learning-evidence-updated', handleEvidenceUpdate);
        };
    }, [isOpen, loadData]);

    useEffect(() => {
        if (isOpen) return;
        setExportSnapshotMounted(false);
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
    const profileMasteryAverage = playerProfile
        ? Math.round((playerProfile.vocabMastery + playerProfile.grammarMastery + playerProfile.readingMastery) / 3)
        : null;
    const masteryAverage = objectiveMasterySnapshot && objectiveMasterySnapshot.byObjective.length > 0
        ? objectiveMasterySnapshot.averageScore
        : profileMasteryAverage ??
        (masterySnapshot && masterySnapshot.totalAttempts > 0
            ? Math.round((masterySnapshot.totalCorrect / masterySnapshot.totalAttempts) * 100)
            : averageAccuracy);
    const currentStreak = dailyFlameStatus?.streakDays ?? playerProfile?.dailyStreak ?? computeActivityStreak(dailyRows);
    const completedMissions = playerProfile?.lessonsCompleted ?? snapshot?.totals.missions ?? 0;
    const profileLevelHelper = playerProfile
        ? (isZh
            ? `等级 ${playerProfile.globalLevel} · ${playerProfile.totalXp} XP`
            : `Level ${playerProfile.globalLevel} · ${playerProfile.totalXp} XP`)
        : (isZh ? `窗口 ${range} 天` : `From last ${range} days`);
    const dailyFlameHelper = dailyFlameStatus
        ? (isZh
            ? `今日 ${dailyFlameStatus.dailyXpEarned}/${dailyFlameStatus.dailyXpGoal} XP`
            : `${dailyFlameStatus.dailyXpEarned}/${dailyFlameStatus.dailyXpGoal} XP today`)
        : (isZh ? '天连续活跃' : 'days in a row');
    const latestMission = snapshot?.records[0]?.levelTitle || (isZh ? '暂无任务' : 'No mission yet');
    const lastActiveLabel = snapshot?.totals.lastActive
        ? new Date(snapshot.totals.lastActive).toLocaleDateString()
        : (t.dashboard.noHistoryShort || 'No runs yet');

    const actionExecutionById = useMemo(() => {
        return studyActionExecutions.reduce((acc, row) => {
            const existing = acc[row.actionId];
            if (!existing || row.updatedAt >= existing.updatedAt) {
                acc[row.actionId] = row;
            }
            return acc;
        }, {} as Record<string, StudyActionExecution>);
    }, [studyActionExecutions]);
    const actionStatusById = useMemo(() => {
        return Object.entries(actionExecutionById).reduce((acc, [actionId, row]) => {
            acc[actionId] = row.status;
            return acc;
        }, {} as Record<string, StudyActionStatus>);
    }, [actionExecutionById]);

    const actionSummary = studyActionSummary ?? computeStudyActionExecutionSummaryFromRows(studyActionExecutions, 14);
    const repeatedGoal = repeatedCauseBaselineGoal ?? FALLBACK_REPEATED_GOAL;
    const repeatedAction = repeatedActionData ?? FALLBACK_REPEATED_ACTION;
    const dashboardDataStatus = !consistencyAudit
        ? 'insufficient'
        : consistencyAudit.overallStatus === 'warning'
            ? 'warning'
            : 'healthy';

    const handleStartTargetedReview = useCallback(() => {
        const pack = buildTargetedReviewPack({
            mistakes,
            focusCauseTag: repeatedAction.focusCauseTag,
            weakestSkillTag: weakestSkill?.skill,
            desiredCount: repeatedAction.recommendedQuestions
        });
        if (pack.monsters.length === 0) return;
        void logGuardianDashboardEvent('session_launch');
        startGame(pack.monsters.map((monster) => ({
            ...monster,
            sourceActionId: 'targeted_pack',
            sourceActionPriority: repeatedAction.status === 'not_met' ? 'urgent' : 'important',
            sourceActionEstimatedMinutes: Math.max(8, repeatedAction.recommendedQuestions * 2)
        })), `Targeted Review: ${repeatedAction.focusCauseTag || 'core_skills'}`, 'battle');
        setIsOpen(false);
    }, [mistakes, repeatedAction.focusCauseTag, repeatedAction.recommendedQuestions, repeatedAction.status, startGame, weakestSkill?.skill]);

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
                questionMode: card.questionMode || 'choice',
                correctAnswer: card.correctAnswer || options[safeIndex],
                learningObjectiveId: card.learningObjectiveId,
                sourceContextSpan: card.sourceContextSpan,
                sourceActionId: 'srs_focus',
                sourceActionPriority: srsDueCount >= 5 ? 'urgent' : 'important',
                sourceActionEstimatedMinutes: Math.max(6, Math.min(20, srsDueCount * 2))
            };
        });
        void logGuardianDashboardEvent('session_launch');
        startGame(monsters, `SRS Focus: ${reviewCards.length} cards`, 'srs');
        setIsOpen(false);
    }, [dueCards, srsDueCount, startGame]);

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
            ? `${formatSkillLabel(primaryDueCard.skillTag || primaryDueCard.type || 'skill', isZh)} · ${isZh ? dueStatus?.statusText.zh || '到期' : dueStatus?.statusText.en || 'due'}`
            : (isZh ? '暂无到期复习卡' : 'No due SRS cards');
        return [
            {
                id: 'targeted_pack',
                title: isZh ? '聚焦重复错因' : 'Focus on Repeated Cause',
                description: isZh
                    ? `围绕 ${formatSkillLabel(repeatedAction.focusCauseTag || 'core_skills', true)} 完成 ${repeatedAction.recommendedQuestions} 题。`
                    : `Run ${repeatedAction.recommendedQuestions} questions on ${formatSkillLabel(repeatedAction.focusCauseTag || 'core_skills')}.`,
                priority: repeatedAction.status === 'not_met' ? 'urgent' : 'important',
                estimatedMinutes: Math.max(8, repeatedAction.recommendedQuestions * 2),
                evidence: isZh
                    ? `重复错因率 ${formatPercent(repeatedCauseSnapshot?.repeatRate || 0)}`
                    : `Repeated-cause rate ${formatPercent(repeatedCauseSnapshot?.repeatRate || 0)}`,
                expectedImpact: isZh
                    ? '预期降低重复错因，并把错误原因转成可迁移练习。'
                    : 'Expected to reduce repeated causes and turn the error pattern into transfer practice.',
                followUp: isZh
                    ? '完成后追踪重复错因率和本轮定向正确率。'
                    : 'After completion, track repeated-cause rate and targeted accuracy.',
                resultAfterCompletion: actionResultAfterCompletion(actionExecutionById.targeted_pack, isZh),
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
                expectedImpact: isZh
                    ? '预期降低遗忘风险，保护已学知识点。'
                    : 'Expected to lower forgetting risk and protect learned objectives.',
                followUp: isZh
                    ? '完成后追踪到期卡数量和下一次复习时间。'
                    : 'After completion, track due-card count and next review dates.',
                resultAfterCompletion: actionResultAfterCompletion(actionExecutionById.srs_focus, isZh),
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
                expectedImpact: isZh
                    ? '预期提升稳定练习量，让系统获得更多诊断证据。'
                    : 'Expected to increase steady practice volume and collect better diagnostic evidence.',
                followUp: isZh
                    ? '完成后追踪周任务进度和次日回访。'
                    : 'After completion, track weekly task progress and next-day return.',
                resultAfterCompletion: actionResultAfterCompletion(actionExecutionById.questline_push, isZh),
                evidenceRows: [
                    { label: isZh ? '错题证据' : 'Mistake evidence', value: mistakeEvidence },
                    { label: isZh ? '复习证据' : 'Review evidence', value: fsrsEvidence }
                ]
            }
        ];
    }, [
        actionExecutionById,
        dueCards.length,
        dueStatus?.statusText.en,
        dueStatus?.statusText.zh,
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
            ...localizeGuardianActivity(event, isZh),
            icon: activityIconForKind(event.kind)
        })) as Array<{
            id: string;
            icon: typeof CheckCircle2;
            tone: Tone;
            title: string;
            detail: string;
            meta: string;
        }>;
    }, [activityFeed, isZh]);

    const prepareExportSnapshot = useCallback(async () => {
        const nextTimestamp = Date.now();
        setExportGeneratedAt(nextTimestamp);
        setExportSnapshotMounted(true);
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
            await new Promise<void>((resolve) => {
                window.requestAnimationFrame(() => resolve());
            });
        }
        return nextTimestamp;
    }, []);

    const handleExportImage = async () => {
        if (!hasHistory) return;
        setExporting('image');
        try {
            const generatedAt = await prepareExportSnapshot();
            if (!exportReportRef.current) return;
            await downloadNodeAsImage(
                exportReportRef.current,
                `word-quest-report-${range}d-${formatExportFileTimestamp(generatedAt)}.png`,
                { backgroundColor: '#f8fafc' }
            );
            await logGuardianDashboardEvent('report_export');
        } catch (err) {
            console.error(err);
        } finally {
            setExporting(null);
        }
    };

    const handleExportPdf = async () => {
        if (!hasHistory) return;
        setExporting('pdf');
        try {
            const generatedAt = await prepareExportSnapshot();
            if (!exportReportRef.current) return;
            openNodePrintView(
                exportReportRef.current,
                `Word Quest Progress Report ${formatExportFileTimestamp(generatedAt)}`
            );
            await logGuardianDashboardEvent('report_export');
        } finally {
            setExporting(null);
        }
    };

    const handleConfirmedExport = async () => {
        const exportType = pendingExport;
        setPendingExport(null);
        if (exportType === 'image') await handleExportImage();
        if (exportType === 'pdf') await handleExportPdf();
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
                                    {dashboardNavItems.map((item) => (
                                        <SidebarItem
                                            key={item.id}
                                            icon={item.icon}
                                            label={item.label}
                                            ariaLabel={item.ariaLabel}
                                            active={activeSection === item.id}
                                            onClick={() => scrollToSection(item.id)}
                                        />
                                    ))}
                                </nav>

                                <div className="mt-auto space-y-4">
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="mb-3 flex items-center gap-2">
                                            <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-100 text-emerald-600">
                                                <CheckCircle2 className="h-4 w-4" />
                                            </span>
                                            <div>
                                                <p className="text-sm font-bold">{isZh ? '系统状态' : 'System Status'}</p>
                                                <p className={statusTextClass(aiMonitor?.status)}>{systemStatusLabel(aiMonitor?.status, isZh)}</p>
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
                                                        aria-label={isZh ? `显示 ${option} 天数据` : `Show ${option} day range`}
                                                        className={`rounded-lg px-2 py-1 text-xs ${range === option ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-200'}`}
                                                    >
                                                        {option}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => scrollToSection(repeatedAlert?.active ? 'repeatedCause' : 'stability')}
                                            aria-label={isZh ? '查看仪表盘提醒' : 'View dashboard alerts'}
                                            className="relative grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white hover:bg-slate-50"
                                        >
                                            <Bell className="h-5 w-5 text-slate-600" />
                                            {repeatedAlert?.active && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500" />}
                                        </button>
                                        <button
                                            onClick={() => setPendingExport('image')}
                                            disabled={!hasHistory || isLoading || exporting !== null}
                                            aria-describedby="report-export-privacy-summary"
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

                                <div ref={reportRef} className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-7">
                                    {error && (
                                        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                                            {error}
                                        </div>
                                    )}

                                    <section
                                        ref={registerSection('overview')}
                                        tabIndex={-1}
                                        aria-label={isZh ? '仪表盘总览' : 'Dashboard overview'}
                                        className="grid gap-4 outline-none sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5"
                                    >
                                        <KpiCard
                                            title={isZh ? '平均掌握度' : 'Mastery Score (Avg.)'}
                                            value={`${masteryAverage}%`}
                                            helper={profileLevelHelper}
                                            tone="blue"
                                            icon={LineChart}
                                            ringValue={masteryAverage}
                                            ariaLabel={isZh ? '打开掌握度证据' : 'Open mastery evidence'}
                                            onClick={() => scrollToSection('mastery')}
                                        />
                                        <KpiCard
                                            title={isZh ? '完成任务' : 'Missions Completed'}
                                            value={formatNumber(completedMissions)}
                                            helper={latestMission}
                                            tone="amber"
                                            icon={Trophy}
                                            ariaLabel={isZh ? '打开任务证据' : 'Open mission evidence'}
                                            onClick={() => scrollToSection('plan')}
                                        />
                                        <KpiCard
                                            title={isZh ? '已回答题目' : 'Questions Answered'}
                                            value={formatNumber(snapshot?.totals.total || 0)}
                                            helper={isZh ? `正确 ${snapshot?.totals.correct || 0}` : `${snapshot?.totals.correct || 0} correct`}
                                            tone="green"
                                            icon={HelpCircle}
                                            ariaLabel={isZh ? '打开答题证据' : 'Open question evidence'}
                                            onClick={() => scrollToSection('events')}
                                        />
                                        <KpiCard
                                            title={isZh ? '平均正确率' : 'Avg. Accuracy'}
                                            value={`${averageAccuracy}%`}
                                            helper={engagementSnapshot ? statusCopy(engagementSnapshot.dailyChallengeParticipation.status, isZh) : lastActiveLabel}
                                            tone="purple"
                                            icon={Target}
                                            ariaLabel={isZh ? '打开正确率证据' : 'Open accuracy evidence'}
                                            onClick={() => scrollToSection('trend')}
                                        />
                                        <KpiCard
                                            title={isZh ? '连续学习' : 'Streak'}
                                            value={currentStreak}
                                            helper={dailyFlameHelper}
                                            tone="red"
                                            icon={Flame}
                                            ariaLabel={isZh ? '打开连续学习证据' : 'Open streak evidence'}
                                            onClick={() => scrollToSection('recommendations')}
                                        />
                                    </section>

                                    <section className="mt-4 grid gap-4 xl:grid-cols-2 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.35fr)_minmax(0,0.9fr)]">
                                        <Panel title={isZh ? '掌握进度' : 'Mastery Progress'} subtitle={isZh ? '按技能域查看平均掌握度' : 'Average mastery by domain'} icon={LineChart} sectionRef={registerSection('mastery')}>
                                            {skillRows.length > 0 ? (
                                                <div className="space-y-4">
                                                    {skillRows.map((skill, index) => (
                                                        <SkillProgressRow key={skill.skill} row={skill} tone={progressTones[index % progressTones.length]} isZh={isZh} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <EmptyState message={t.dashboard.noSkillData || 'No skill data yet.'} />
                                            )}
                                        </Panel>

                                        <Panel title={isZh ? '复习队列' : 'Review Queue'} subtitle={isZh ? '需要优先关注的复习项目' : 'Items that need attention'} icon={ShieldCheck} badge={String(srsDueCount)} sectionRef={registerSection('review')}>
                                            {dueCards.length > 0 ? (
                                                <div className="space-y-3">
                                                    {dueCards.slice(0, 4).map((card, index) => (
                                                        <ReviewQueueRow key={card.id || index} card={card} index={index} isZh={isZh} />
                                                    ))}
                                                </div>
                                            ) : (
                                                <EmptyState message={isZh ? '暂无到期复习卡。' : 'No due review cards.'} />
                                            )}
                                        </Panel>

                                        <Panel title={isZh ? '学习事件' : 'Learning Events'} subtitle={isZh ? '近期学习证据流' : 'Recent activity feed'} icon={Activity} sectionRef={registerSection('events')}>
                                            {calibrationSummary && calibrationSummary.ratedAnswers > 0 && (
                                                <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-left">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <p className="text-sm font-black text-blue-950">
                                                            {isZh ? '把握度校准信号' : 'Confidence Calibration Signals'}
                                                        </p>
                                                        <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-blue-700">
                                                            {isZh
                                                                ? `${calibrationSummary.ratedAnswers} 次可选自评`
                                                                : `${calibrationSummary.ratedAnswers} optional ratings`}
                                                        </span>
                                                    </div>
                                                    <div className="mt-3 grid grid-cols-2 gap-2">
                                                        <MiniMetric
                                                            label={isZh ? '高把握错误' : 'High-confidence errors'}
                                                            value={calibrationSummary.highConfidenceErrors}
                                                        />
                                                        <MiniMetric
                                                            label={isZh ? '低把握正确' : 'Low-confidence correct'}
                                                            value={calibrationSummary.lowConfidenceCorrect}
                                                        />
                                                    </div>
                                                    <p className="mt-3 text-xs leading-relaxed text-blue-800">
                                                        {isZh
                                                            ? '仅用于选择复盘重点，不参与掌握度、排名或最终评价。'
                                                            : 'Used only to prioritize review; it does not affect mastery, ranking, or final judgments.'}
                                                    </p>
                                                </div>
                                            )}
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

                                    <section className="mt-4 grid gap-4 xl:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)]">
                                        <Panel title={isZh ? '每周趋势' : 'Weekly Trend'} subtitle={isZh ? '正确率与任务量走势' : 'Accuracy and mission volume'} icon={BarChart3} sectionRef={registerSection('trend')}>
                                            <WeeklyTrend rows={dailyRows} isZh={isZh} />
                                        </Panel>

                                        <Panel title={isZh ? '守护者建议' : 'Guardian Recommendations'} subtitle={isZh ? '基于证据的今晚行动' : 'Personalized tips to help learners grow'} icon={Sparkles} sectionRef={registerSection('recommendations')}>
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
                                                        {practicePlanRationaleText(dailyPracticePlan, isZh)}
                                                    </p>
                                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                                        {dailyPracticePlan.evidence.slice(0, 3).map((row, index) => (
                                                            <span key={`${row.label}-${index}`} className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-blue-700">
                                                                {practicePlanEvidenceLabel(row.label, isZh)}: {practicePlanEvidenceValue(row, isZh)}
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
                                                        isZh={isZh}
                                                    />
                                                ))}
                                            </div>
                                        </Panel>

                                        <Panel title={isZh ? 'AI 请求监控' : 'AI Request Monitor'} subtitle={isZh ? '来自本机的近期真实请求记录' : 'Recent local request telemetry'} icon={ShieldCheck} sectionRef={registerSection('stability')}>
                                            <div className="grid grid-cols-3 gap-2">
                                                <StabilityMetric
                                                    label={isZh ? 'AI 成功率' : 'AI Success'}
                                                    value={aiSuccessValue(aiMonitor)}
                                                    detail={aiSuccessDetail(aiMonitor, isZh)}
                                                    status={aiMonitor?.successRate.status || 'insufficient'}
                                                />
                                                <StabilityMetric
                                                    label={isZh ? '响应时间' : 'Response Time'}
                                                    value={aiLatencyValue(aiMonitor)}
                                                    detail={aiLatencyDetail(aiMonitor, isZh)}
                                                    status={aiMonitor?.status || 'insufficient'}
                                                />
                                                <StabilityMetric
                                                    label={isZh ? '重试压力' : 'Retry Pressure'}
                                                    value={aiRetryValue(aiMonitor)}
                                                    detail={aiRetryDetail(aiMonitor, isZh)}
                                                    status={aiRetryStatus(aiMonitor)}
                                                />
                                            </div>
                                            <div className="mt-4 grid gap-3 md:grid-cols-[1fr_160px]">
                                                <div className="space-y-2 text-sm">
                                                    <ServiceRow label={isZh ? '本地题库' : 'Local question bank'} status="operational" isZh={isZh} />
                                                    <ServiceRow label={isZh ? 'AI 生成请求' : 'AI generation requests'} status={aiMonitor?.status || 'insufficient'} isZh={isZh} />
                                                    <ServiceRow label={isZh ? '数据一致性' : 'Dashboard data consistency'} status={dashboardDataStatus} isZh={isZh} />
                                                    <ServiceRow label={isZh ? '会话恢复' : 'Session recovery'} status={sessionRecovery?.status || 'insufficient'} isZh={isZh} />
                                                </div>
                                                <div className={`grid place-items-center rounded-2xl p-4 text-center ${statusPanelClass(aiMonitor?.status)}`}>
                                                    <ShieldCheck className={`mb-2 h-14 w-14 ${statusIconClass(aiMonitor?.status)}`} />
                                                    <p className="text-sm font-black text-slate-900">{systemStatusLabel(aiMonitor?.status, isZh)}</p>
                                                    <p className="text-xs leading-relaxed text-slate-500">{systemStatusDetail(aiMonitor, isZh)}</p>
                                                </div>
                                            </div>
                                        </Panel>
                                    </section>

                                    <section className="mt-4 grid gap-4 xl:grid-cols-[repeat(3,minmax(0,1fr))]">
                                        <Panel title={isZh ? '计划执行' : 'Plan vs Completion'} subtitle={isZh ? '今晚建议执行回写' : 'Guardian action follow-through'} icon={CheckCircle2} sectionRef={registerSection('plan')}>
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

                                        <Panel title={isZh ? '重复错因目标' : 'Repeated-Cause Goal'} subtitle={isZh ? '对比基线是否下降 20%' : 'Baseline comparison for 20% reduction'} icon={Target} sectionRef={registerSection('repeatedCause')}>
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

                                        <Panel title={isZh ? '监护人采纳' : 'Guardian Acceptance'} subtitle={isZh ? '面板周活与建议追踪' : 'Weekly usage and recommendation loop'} icon={Users} sectionRef={registerSection('acceptance')}>
                                            <MetricTile metric={guardianAcceptance?.weeklyActiveRate} label={isZh ? '周活跃率' : 'Weekly active'} isZh={isZh} />
                                            <MetricTile metric={engagementSnapshot?.nextDayRetention} label={isZh ? '次日留存' : 'Next-day retention'} isZh={isZh} />
                                        </Panel>
                                    </section>

                                    <div className="mt-5 flex flex-wrap gap-3">
                                        <div
                                            id="report-export-privacy-summary"
                                            data-export-private="true"
                                            className="w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
                                        >
                                            <div className="flex items-start gap-3">
                                                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                                                <div>
                                                    <p className="font-black">
                                                        {isZh ? '导出前请检查隐私' : 'Check privacy before exporting'}
                                                    </p>
                                                    <p className="mt-1 leading-relaxed text-amber-900/80">
                                                        {isZh
                                                            ? '导出只包含聚合指标和受控学习分类，不包含原文、题目、答案、错题文本、任务标题或 API Key。文件会离开浏览器本地存储，分享前仍需人工检查。'
                                                            : 'Exports include aggregate metrics and controlled learning categories only. Source text, questions, answers, mistake text, mission/task titles, and API keys are excluded. The file leaves browser-local storage, so review it before sharing.'}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => setPendingExport('image')}
                                            disabled={!hasHistory || isLoading || exporting !== null}
                                            aria-describedby="report-export-privacy-summary"
                                            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                                        >
                                            <Download className="h-4 w-4" />
                                            {t.dashboard.exportImage}
                                        </button>
                                        <button
                                            onClick={() => setPendingExport('pdf')}
                                            disabled={!hasHistory || isLoading || exporting !== null}
                                            aria-describedby="report-export-privacy-summary"
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
                        {hasHistory && exportSnapshotMounted && (
                            <div aria-hidden="true" className="pointer-events-none fixed left-[-12000px] top-0">
                                <ExportReportSnapshot
                                    reportRef={exportReportRef}
                                    isZh={isZh}
                                    range={range}
                                    generatedAt={exportGeneratedAt}
                                    masteryAverage={masteryAverage}
                                    profileLevelHelper={profileLevelHelper}
                                    completedMissions={completedMissions}
                                    totalQuestions={snapshot?.totals.total || 0}
                                    correctQuestions={snapshot?.totals.correct || 0}
                                    averageAccuracy={averageAccuracy}
                                    currentStreak={currentStreak}
                                    dailyFlameHelper={dailyFlameHelper}
                                    skillRows={skillRows}
                                    dueCards={dueCards}
                                    srsDueCount={srsDueCount}
                                    dailyRows={dailyRows}
                                    dailyPracticePlan={dailyPracticePlan}
                                    tonightActions={tonightActions}
                                    planSnapshot={planSnapshot}
                                    actionExecutionRate={actionSummary.executionRate}
                                    aiMonitor={aiMonitor}
                                    sessionRecovery={sessionRecovery}
                                />
                            </div>
                        )}
                        {pendingExport && (
                            <ReportExportPrivacyDialog
                                exportType={pendingExport}
                                isZh={isZh}
                                onCancel={() => setPendingExport(null)}
                                onConfirm={() => void handleConfirmedExport()}
                            />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function ReportExportPrivacyDialog({
    exportType,
    isZh,
    onCancel,
    onConfirm
}: {
    exportType: 'image' | 'pdf';
    isZh: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    const [acknowledged, setAcknowledged] = useState(false);
    const actionLabel = exportType === 'image'
        ? (isZh ? '创建 PNG 报告' : 'Create PNG report')
        : (isZh ? '打开打印 / PDF' : 'Open print / PDF');

    return (
        <div
            className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/70 p-4"
            onClick={onCancel}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="report-export-privacy-title"
                className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-slate-950 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start gap-3">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-100 text-amber-700">
                        <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 id="report-export-privacy-title" className="text-xl font-black">
                            {isZh ? '确认报告导出隐私' : 'Confirm report export privacy'}
                        </h2>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600">
                            {isZh
                                ? '这不是完整学习数据备份。报告经过少披露处理，但下载或打印后的文件可以被复制、同步或公开分享。'
                                : 'This is not a full learning-data backup. The report is privacy-minimized, but a downloaded or printed file can still be copied, synced, or shared publicly.'}
                        </p>
                    </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
                        <p className="font-black text-emerald-900">{isZh ? '包含' : 'Included'}</p>
                        <p className="mt-1 leading-relaxed text-emerald-800">
                            {isZh ? '聚合掌握度、正确率、数量、复习状态和受控学习分类。' : 'Aggregate mastery, accuracy, counts, review status, and controlled learning categories.'}
                        </p>
                    </div>
                    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm">
                        <p className="font-black text-blue-900">{isZh ? '已排除' : 'Excluded'}</p>
                        <p className="mt-1 leading-relaxed text-blue-800">
                            {isZh ? '原文、题目、答案、错题、任务标题、自由文本和凭据。' : 'Source text, questions, answers, mistakes, titles, free text, and credentials.'}
                        </p>
                    </div>
                </div>

                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-slate-700">
                    <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(event) => setAcknowledged(event.target.checked)}
                        className="mt-0.5 h-4 w-4"
                    />
                    <span>
                        {isZh
                            ? '我知道文件将离开浏览器本地存储，并会在分享前检查其中是否仍有隐私信息。'
                            : 'I understand this file leaves browser-local storage, and I will review it for private information before sharing.'}
                    </span>
                </label>

                <div className="mt-5 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
                    >
                        {isZh ? '取消' : 'Cancel'}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={!acknowledged}
                        className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {actionLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}

function ExportReportSnapshot({
    reportRef,
    isZh,
    range,
    generatedAt,
    masteryAverage,
    profileLevelHelper,
    completedMissions,
    totalQuestions,
    correctQuestions,
    averageAccuracy,
    currentStreak,
    dailyFlameHelper,
    skillRows,
    dueCards,
    srsDueCount,
    dailyRows,
    dailyPracticePlan,
    tonightActions,
    planSnapshot,
    actionExecutionRate,
    aiMonitor,
    sessionRecovery
}: {
    reportRef: React.RefObject<HTMLDivElement | null>;
    isZh: boolean;
    range: RangeOption;
    generatedAt: number;
    masteryAverage: number;
    profileLevelHelper: string;
    completedMissions: number;
    totalQuestions: number;
    correctQuestions: number;
    averageAccuracy: number;
    currentStreak: number;
    dailyFlameHelper: string;
    skillRows: SkillAccuracyRow[];
    dueCards: FSRSCard[];
    srsDueCount: number;
    dailyRows: DailyAccuracyRow[];
    dailyPracticePlan: PracticePlan | null;
    tonightActions: TonightActionItem[];
    planSnapshot: {
        totalActions: number;
        completedActions: number;
        plannedMinutes: number;
        completedMinutes: number;
    };
    actionExecutionRate: number;
    aiMonitor: AIRequestMonitorSnapshot | null;
    sessionRecovery: SessionRecoverySnapshot | null;
}) {
    const rangeLabel = isZh ? `最近 ${range} 天` : `Last ${range} days`;
    const generatedLabel = isZh
        ? `生成时间：${formatReportTimestamp(generatedAt, isZh)}`
        : `Generated: ${formatReportTimestamp(generatedAt, isZh)}`;
    const timezoneLabel = getLocalTimeZoneLabel(isZh);
    const visibleSkills = skillRows.slice(0, 5);
    const visibleDueCards = dueCards.slice(0, 4);
    const visibleActions = tonightActions.slice(0, 3);

    return (
        <div
            ref={reportRef}
            data-testid="guardian-export-report"
            className="w-[1180px] bg-slate-50 p-8 text-slate-950"
        >
            <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
                <header className="border-b border-slate-200 bg-white p-8">
                    <div className="flex items-start justify-between gap-8">
                        <div>
                            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black uppercase tracking-[0.18em] text-blue-700">
                                <ShieldCheck className="h-4 w-4" />
                                {isZh ? '学习证据报告' : 'Learning Evidence Report'}
                            </div>
                            <h1 className="text-4xl font-black tracking-tight text-slate-950">
                                {isZh ? 'Word Quest 学习报告' : 'Word Quest Progress Report'}
                            </h1>
                            <p className="mt-3 max-w-3xl text-base leading-relaxed text-slate-600">
                                {isZh
                                    ? '基于本机学习记录、复习队列和任务执行情况生成，用于快速判断今天最需要关注的学习证据。'
                                    : 'Generated from local learning records, review queue, and action follow-through so the report reflects current learner evidence.'}
                            </p>
                        </div>
                        <div className="min-w-[260px] rounded-2xl border border-slate-200 bg-slate-50 p-4 text-right">
                            <p className="text-sm font-black text-slate-900">{rangeLabel}</p>
                            <p className="mt-2 text-xs font-semibold text-slate-500">{generatedLabel}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">{timezoneLabel}</p>
                        </div>
                    </div>
                </header>

                <main className="space-y-6 p-8">
                    <section className="grid grid-cols-5 gap-4">
                        <ExportStatCard
                            label={isZh ? '平均掌握度' : 'Avg. Mastery'}
                            value={`${masteryAverage}%`}
                            helper={profileLevelHelper}
                            icon={LineChart}
                            tone="blue"
                        />
                        <ExportStatCard
                            label={isZh ? '完成任务' : 'Missions'}
                            value={formatNumber(completedMissions)}
                            helper={isZh ? '仅导出任务数量，不包含任务标题' : 'Mission titles are excluded from exports'}
                            icon={Trophy}
                            tone="amber"
                        />
                        <ExportStatCard
                            label={isZh ? '已答题目' : 'Questions'}
                            value={formatNumber(totalQuestions)}
                            helper={isZh ? `正确 ${correctQuestions}` : `${correctQuestions} correct`}
                            icon={HelpCircle}
                            tone="green"
                        />
                        <ExportStatCard
                            label={isZh ? '平均正确率' : 'Avg. Accuracy'}
                            value={`${averageAccuracy}%`}
                            helper={totalQuestions > 0 ? `${correctQuestions}/${totalQuestions}` : (isZh ? '暂无样本' : 'No samples')}
                            icon={Target}
                            tone="purple"
                        />
                        <ExportStatCard
                            label={isZh ? '连续学习' : 'Streak'}
                            value={currentStreak}
                            helper={dailyFlameHelper}
                            icon={Flame}
                            tone="red"
                        />
                    </section>

                    <section className="grid grid-cols-[1fr_1fr] gap-6">
                        <ExportSection
                            title={isZh ? '掌握进度' : 'Mastery Progress'}
                            subtitle={isZh ? '按技能域查看平均表现' : 'Average performance by skill area'}
                            icon={LineChart}
                        >
                            {visibleSkills.length > 0 ? (
                                <div className="space-y-3">
                                    {visibleSkills.map((skill, index) => (
                                        <ExportSkillRow
                                            key={`${skill.skill}-${index}`}
                                            row={skill}
                                            tone={progressTones[index % progressTones.length]}
                                            isZh={isZh}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <ExportEmptyLine message={isZh ? '暂无技能数据' : 'No skill data yet'} />
                            )}
                        </ExportSection>

                        <ExportSection
                            title={isZh ? '复习队列' : 'Review Queue'}
                            subtitle={isZh ? '优先复习项目' : 'Items that need attention first'}
                            icon={ShieldCheck}
                            badge={`${srsDueCount}`}
                        >
                            {visibleDueCards.length > 0 ? (
                                <div className="space-y-3">
                                    {visibleDueCards.map((card, index) => (
                                        <ExportReviewRow
                                            key={`${card.id || card.questionHash || card.question}-${index}`}
                                            card={card}
                                            index={index}
                                            isZh={isZh}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <ExportEmptyLine message={isZh ? '暂无到期复习卡' : 'No due review cards'} />
                            )}
                        </ExportSection>
                    </section>

                    <section className="grid grid-cols-[1.05fr_0.95fr] gap-6">
                        <ExportSection
                            title={isZh ? '近期趋势' : 'Recent Trend'}
                            subtitle={isZh ? '正确率与任务量' : 'Accuracy and mission volume'}
                            icon={BarChart3}
                        >
                            <ExportDailyTrend rows={dailyRows} isZh={isZh} />
                        </ExportSection>

                        <ExportSection
                            title={isZh ? '今晚建议' : 'Recommended Next Actions'}
                            subtitle={isZh ? '基于本机聚合证据生成；原题和原文不导出' : 'Based on aggregate local evidence; source text and questions are excluded'}
                            icon={Sparkles}
                            badge={dailyPracticePlan ? `${dailyPracticePlan.estimatedMinutes}m` : undefined}
                        >
                            {dailyPracticePlan && dailyPracticePlan.evidence.length > 0 && (
                                <div className="mb-4 flex flex-wrap gap-2">
                                    {dailyPracticePlan.evidence.slice(0, 3).map((row, index) => (
                                        <span key={`${row.label}-${index}`} className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                                            {practicePlanEvidenceLabel(row.label, isZh)}: {exportPracticeEvidenceValue(row, isZh)}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="space-y-3">
                                {visibleActions.map((action) => (
                                    <ExportActionRow key={action.id} action={action} isZh={isZh} />
                                ))}
                            </div>
                        </ExportSection>
                    </section>

                    <section className="grid grid-cols-3 gap-6">
                        <ExportSection
                            title={isZh ? '计划执行' : 'Plan Follow-through'}
                            subtitle={isZh ? '建议任务完成情况' : 'Suggested action completion'}
                            icon={CheckCircle2}
                        >
                            <div className="grid grid-cols-3 gap-3">
                                <ExportMiniMetric label={isZh ? '计划' : 'Planned'} value={planSnapshot.totalActions} />
                                <ExportMiniMetric label={isZh ? '完成' : 'Done'} value={planSnapshot.completedActions} />
                                <ExportMiniMetric label={isZh ? '分钟' : 'Minutes'} value={`${planSnapshot.completedMinutes}/${planSnapshot.plannedMinutes}`} />
                            </div>
                            <p className="mt-4 text-sm font-semibold text-slate-600">
                                {isZh ? '执行率' : 'Execution rate'}: {formatPercent(actionExecutionRate)}
                            </p>
                        </ExportSection>

                        <ExportSection
                            title={isZh ? 'AI 请求' : 'AI Requests'}
                            subtitle={isZh ? '本机真实请求样本' : 'Real local request samples'}
                            icon={Activity}
                        >
                            <div className="space-y-3">
                                <ExportSignalRow label={isZh ? '成功率' : 'Success'} value={aiSuccessValue(aiMonitor)} detail={aiSuccessDetail(aiMonitor, isZh)} />
                                <ExportSignalRow label={isZh ? '响应' : 'Latency'} value={aiLatencyValue(aiMonitor)} detail={aiLatencyDetail(aiMonitor, isZh)} />
                            </div>
                        </ExportSection>

                        <ExportSection
                            title={isZh ? '系统状态' : 'System Status'}
                            subtitle={isZh ? '导出时刻的健康状态' : 'Health at export time'}
                            icon={ShieldCheck}
                        >
                            <div className={`rounded-2xl p-4 ${statusPanelClass(aiMonitor?.status)}`}>
                                <p className={`text-2xl font-black ${metricStatusClass(aiMonitor?.status)}`}>
                                    {systemStatusLabel(aiMonitor?.status, isZh)}
                                </p>
                                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                                    {systemStatusDetail(aiMonitor, isZh)}
                                </p>
                            </div>
                            <p className="mt-3 text-xs font-semibold text-slate-500">
                                {isZh ? '会话恢复' : 'Session recovery'}: {serviceStatusCopy(sessionRecovery?.status || 'insufficient', isZh)}
                            </p>
                        </ExportSection>
                    </section>
                </main>
            </div>
        </div>
    );
}

function ExportStatCard({
    label,
    value,
    helper,
    icon: Icon,
    tone
}: {
    label: string;
    value: string | number;
    helper: string;
    icon: typeof LineChart;
    tone: Tone;
}) {
    const toneClass = iconToneClass(tone);
    return (
        <div className="min-h-[124px] rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-black text-slate-600">{label}</p>
                    <p className="mt-3 text-3xl font-black tracking-tight text-slate-950">{value}</p>
                </div>
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${toneClass.bg} ${toneClass.text}`}>
                    <Icon className="h-5 w-5" />
                </span>
            </div>
            <p className="mt-3 line-clamp-2 text-xs font-semibold leading-snug text-slate-500">{helper}</p>
        </div>
    );
}

function ExportSection({
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
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <header className="mb-4 flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                        <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <h2 className="text-lg font-black leading-tight tracking-tight text-slate-950">{title}</h2>
                        <p className="mt-1 line-clamp-2 text-sm leading-snug text-slate-500">{subtitle}</p>
                    </div>
                </div>
                {badge && (
                    <span className="shrink-0 rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{badge}</span>
                )}
            </header>
            {children}
        </section>
    );
}

function ExportSkillRow({ row, tone, isZh }: { row: SkillAccuracyRow; tone: Tone; isZh: boolean; }) {
    const percentage = Math.round(row.accuracy * 100);
    const toneClass = progressToneClass(tone);
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_190px_48px] items-center gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
            <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-900">{exportObjectiveLabel(row.skill, isZh)}</p>
                <p className="text-xs font-semibold text-slate-500">{row.correct}/{row.total} {isZh ? '正确' : 'correct'}</p>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100">
                <div
                    className={`h-full rounded-full ${toneClass.bar}`}
                    style={{ width: `${percentage > 0 ? Math.max(4, percentage) : 0}%` }}
                />
            </div>
            <p className="text-right text-sm font-black text-slate-700">{percentage}%</p>
        </div>
    );
}

function ExportReviewRow({ card, index, isZh }: { card: FSRSCard; index: number; isZh: boolean; }) {
    const status = getMemoryStatus(card);
    const priority = index === 0 ? 'High' : index < 3 ? 'Medium' : 'Low';
    const tone = index === 0 ? 'red' : 'amber';
    const toneClass = iconToneClass(tone);
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${toneClass.bg} ${toneClass.text}`}>
                <BookOpen className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-900">{exportObjectiveLabel(card.skillTag || card.type || 'review', isZh)}</p>
                <p className="truncate text-xs font-semibold text-slate-500">
                    {isZh ? '题目原文已从导出中排除' : 'Question text excluded from export'}
                </p>
            </div>
            <div className="shrink-0 text-right">
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${priorityToneClass(priority)}`}>{priority}</span>
                <p className="mt-1 text-xs font-semibold text-slate-500">{isZh ? status.statusText.zh : status.statusText.en}</p>
            </div>
        </div>
    );
}

function ExportDailyTrend({ rows, isZh }: { rows: DailyAccuracyRow[]; isZh: boolean; }) {
    const visibleRows = rows.slice(-7);
    if (visibleRows.length === 0) return <ExportEmptyLine message={isZh ? '暂无趋势数据' : 'No trend data yet'} />;
    const maxMissions = Math.max(...visibleRows.map((row) => row.missions), 1);
    return (
        <div>
            <div className="grid h-40 grid-cols-7 items-end gap-3 rounded-2xl bg-slate-50 px-4 pb-4 pt-5">
                {visibleRows.map((row) => (
                    <div key={row.date} className="flex h-full min-w-0 flex-col justify-end gap-2">
                        <div className="flex flex-1 items-end gap-1.5">
                            <div
                                className="w-full rounded-t-lg bg-blue-500"
                                style={{ height: `${Math.max(8, row.accuracy * 100)}%` }}
                                aria-label={`${row.label} accuracy ${formatPercent(row.accuracy)}`}
                            />
                            <div
                                className="w-full rounded-t-lg bg-emerald-500"
                                style={{ height: `${Math.max(8, (row.missions / maxMissions) * 100)}%` }}
                                aria-label={`${row.label} missions ${row.missions}`}
                            />
                        </div>
                        <p className="truncate text-center text-[11px] font-bold text-slate-500">{row.label}</p>
                    </div>
                ))}
            </div>
            <div className="mt-3 flex items-center justify-end gap-4 text-xs font-bold">
                <span className="inline-flex items-center gap-1 text-blue-700"><span className="h-2 w-2 rounded-full bg-blue-500" />{isZh ? '正确率' : 'Accuracy'}</span>
                <span className="inline-flex items-center gap-1 text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" />{isZh ? '任务' : 'Missions'}</span>
            </div>
        </div>
    );
}

function ExportActionRow({ action, isZh }: { action: TonightActionItem; isZh: boolean; }) {
    const description = exportActionDescription(action.id, isZh);
    return (
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <p className="text-sm font-black text-slate-900">{action.title}</p>
                    <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{description}</p>
                </div>
                <PriorityBadge priority={action.priority} />
            </div>
            <p className="mt-2 text-xs font-black text-slate-600">{action.evidence}</p>
        </div>
    );
}

function exportObjectiveLabel(value: string, isZh: boolean) {
    const objectiveId = mapSkillTagToObjectiveId({ skillTag: value, type: value });
    return objectiveTitle(objectiveId, isZh ? 'zh' : 'en');
}

function exportActionDescription(actionId: string, isZh: boolean) {
    if (actionId === 'targeted_pack') {
        return isZh ? '完成一组针对近期重复错误类型的练习。' : 'Complete a short practice set for a recent repeated error type.';
    }
    if (actionId === 'srs_focus') {
        return isZh ? '优先完成到期复习，降低遗忘风险。' : 'Prioritize due reviews to reduce forgetting risk.';
    }
    if (actionId === 'questline_push') {
        return isZh ? '完成一个短学习任务，保持练习节奏。' : 'Complete one short learning task to maintain practice rhythm.';
    }
    return isZh ? '根据聚合学习证据安排短练习。' : 'Use aggregate learning evidence to schedule a short practice.';
}

function ExportMiniMetric({ label, value }: { label: string; value: string | number; }) {
    return (
        <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs font-black text-slate-500">{label}</p>
            <p className="mt-1 text-xl font-black text-slate-950">{value}</p>
        </div>
    );
}

function ExportSignalRow({ label, value, detail }: { label: string; value: string; detail: string; }) {
    return (
        <div className="rounded-xl bg-slate-50 p-3">
            <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-black text-slate-700">{label}</p>
                <p className="text-sm font-black text-slate-950">{value}</p>
            </div>
            <p className="mt-2 text-xs font-semibold leading-snug text-slate-500">{detail}</p>
        </div>
    );
}

function ExportEmptyLine({ message }: { message: string; }) {
    return (
        <div className="grid min-h-[92px] place-items-center rounded-2xl bg-slate-50 text-center text-sm font-bold text-slate-500">
            {message}
        </div>
    );
}

function SidebarItem({
    icon: Icon,
    label,
    ariaLabel,
    active = false,
    onClick
}: {
    icon: typeof Home;
    label: string;
    ariaLabel: string;
    active?: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={ariaLabel}
            aria-current={active ? 'true' : undefined}
            className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
        >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="truncate">{label}</span>
        </button>
    );
}

function KpiCard({
    title,
    value,
    helper,
    icon: Icon,
    tone,
    ringValue,
    ariaLabel,
    onClick
}: {
    title: string;
    value: string | number;
    helper: string;
    icon: typeof LineChart;
    tone: Tone;
    ringValue?: number;
    ariaLabel?: string;
    onClick?: () => void;
}) {
    const toneClass = iconToneClass(tone);
    const content = (
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
    );

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                aria-label={ariaLabel}
                className="min-h-[124px] min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
                {content}
            </button>
        );
    }

    return (
        <div className="min-h-[124px] min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {content}
        </div>
    );
}

function Panel({
    title,
    subtitle,
    icon: Icon,
    badge,
    sectionRef,
    children
}: {
    title: string;
    subtitle: string;
    icon: typeof LineChart;
    badge?: string;
    sectionRef?: (node: HTMLElement | null) => void;
    children: React.ReactNode;
}) {
    return (
        <section
            ref={sectionRef}
            tabIndex={sectionRef ? -1 : undefined}
            aria-label={title}
            className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
            <header className="mb-4 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                        <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                        <h3 className="break-words font-black leading-tight tracking-tight text-slate-950">{title}</h3>
                        <p className="break-words text-sm leading-snug text-slate-500">{subtitle}</p>
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

function SkillProgressRow({ row, tone, isZh }: { row: SkillAccuracyRow; tone: Tone; isZh: boolean; }) {
    const toneClass = progressToneClass(tone);
    const percentage = Math.round(row.accuracy * 100);
    return (
        <div className="grid grid-cols-[minmax(120px,1fr)_minmax(110px,180px)_44px] items-center gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0">
            <div className="flex min-w-0 items-center gap-3">
                <span className={`grid h-8 w-8 place-items-center rounded-xl ${toneClass.bg} ${toneClass.text}`}>
                    <BookOpen className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800">{formatSkillLabel(row.skill, isZh)}</p>
                    <p className="text-xs text-slate-500">{row.correct}/{row.total} {isZh ? '正确' : 'correct'}</p>
                </div>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${toneClass.bar}`} style={{ width: `${Math.max(4, percentage)}%` }} />
            </div>
            <span className="text-right text-sm font-black text-slate-700">{percentage}%</span>
        </div>
    );
}

function ReviewQueueRow({ card, index, isZh }: { card: FSRSCard; index: number; isZh: boolean; }) {
    const status = getMemoryStatus(card);
    const priority = index === 0 ? 'High' : index < 3 ? 'Medium' : 'Low';
    const priorityLabel = isZh
        ? (priority === 'High' ? '高' : priority === 'Medium' ? '中' : '低')
        : priority;
    const tone = priority === 'High' ? 'red' : priority === 'Medium' ? 'amber' : 'blue';
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconToneClass(tone).bg} ${iconToneClass(tone).text}`}>
                <BookOpen className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-slate-900">{formatSkillLabel(card.skillTag || card.type || 'review', isZh)}</p>
                <p className="truncate text-xs text-slate-500">{card.question}</p>
            </div>
            <div className="shrink-0 text-right">
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${priorityToneClass(priority)}`}>{priorityLabel}</span>
                <p className="mt-1 text-xs text-slate-500">{isZh ? status.statusText.zh : status.statusText.en}</p>
            </div>
        </div>
    );
}

function localizeGuardianActivity(event: GuardianActivityFeedItem, isZh: boolean): GuardianActivityFeedItem {
    if (!isZh) return event;
    return {
        ...event,
        title: localizeActivityTitle(event),
        detail: localizeActivityDetail(event.detail),
        meta: localizeActivityMeta(event.meta)
    };
}

function localizeActivityTitle(event: GuardianActivityFeedItem) {
    if (event.kind === 'mission') return '任务完成';
    if (event.kind === 'session') return '学习场次完成';
    if (event.kind === 'hint') return '使用提示';
    if (event.kind === 'mistake') return '发现复习信号';
    if (event.kind === 'task') return '任务线更新';
    if (event.kind === 'answer') {
        if (/^Correct/i.test(event.title)) return '答对一题';
        if (/^Wrong/i.test(event.title)) return '答错一题';
        return '记录答题';
    }
    return event.title;
}

function localizeActivityDetail(value: string) {
    const fixed: Record<string, string> = {
        'Learning session recorded': '已记录学习场次',
        'Hint evidence logged': '已记录提示证据',
        'Question evidence logged': '已记录答题证据',
        'Custom Mission': '自定义任务'
    };
    if (fixed[value]) return fixed[value];
    return formatSkillLabel(value, true);
}

function localizeActivityMeta(value: string) {
    if (value === 'Now') return '刚刚';
    const minuteMatch = /^(\d+)m ago$/.exec(value);
    if (minuteMatch) return `${minuteMatch[1]} 分钟前`;
    const hourMatch = /^(\d+)h ago$/.exec(value);
    if (hourMatch) return `${hourMatch[1]} 小时前`;
    const dayMatch = /^(\d+)d ago$/.exec(value);
    if (dayMatch) return `${dayMatch[1]} 天前`;
    const accuracyMatch = /^(\d+)% accuracy$/.exec(value);
    if (accuracyMatch) return `${accuracyMatch[1]}% 正确率`;
    if (value === 'completed') return '已完成';
    if (value === 'active') return '进行中';
    if (value === 'paused') return '已暂停';
    return value;
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
                    <span className="shrink-0 text-xs font-semibold text-slate-500">{meta}</span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{detail}</p>
            </div>
        </div>
    );
}

function WeeklyTrend({ rows, isZh }: { rows: DailyAccuracyRow[]; isZh: boolean; }) {
    if (rows.length === 0) return <EmptyState message={isZh ? '暂无每周趋势。' : 'No weekly trend yet.'} />;
    const accuracyPath = buildSparkPath(rows.map((row) => row.accuracy), 320, 130);
    const missionPath = buildSparkPath(rows.map((row) => row.missions), 320, 130);
    const labelStep = Math.max(1, Math.ceil(rows.length / 6));
    return (
        <div>
            <div className="mb-3 flex items-center justify-end gap-4 text-xs font-semibold">
                <span className="inline-flex items-center gap-1 text-blue-700"><span className="h-2 w-2 rounded-full bg-blue-600" /> {isZh ? '正确率' : 'Accuracy'}</span>
                <span className="inline-flex items-center gap-1 text-emerald-700"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {isZh ? '任务数' : 'Missions'}</span>
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
    onSetStatus,
    isZh
}: {
    action: TonightActionItem;
    status: StudyActionStatus;
    onSetStatus: (actionId: string, status: StudyActionStatus, priority: StudyActionPriority, estimatedMinutes: number) => void;
    isZh: boolean;
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
                    <div className="mt-2 grid gap-1 rounded-xl bg-white px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-100">
                        <p><span className="font-black text-slate-800">{isZh ? '预期效果' : 'Expected impact'}:</span> {action.expectedImpact}</p>
                        <p><span className="font-black text-slate-800">{isZh ? '完成后追踪' : 'Follow-up'}:</span> {action.followUp}</p>
                        {action.resultAfterCompletion && (
                            <p><span className="font-black text-slate-800">{isZh ? '完成后结果' : 'Result after completion'}:</span> {action.resultAfterCompletion}</p>
                        )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {action.ctaLabel && action.onCta && (
                            <button
                                onClick={action.onCta}
                                aria-label={isZh ? `开始${action.title}` : `Start ${action.title}`}
                                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-black text-white hover:bg-blue-700"
                            >
                                {action.ctaLabel}
                            </button>
                        )}
                        <button
                            onClick={() => onSetStatus(action.id, 'completed', action.priority, action.estimatedMinutes)}
                            aria-label={isZh ? `标记${action.title}完成` : `Mark ${action.title} done`}
                            className={`rounded-lg px-3 py-1.5 text-xs font-black ${status === 'completed' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
                        >
                            {isZh ? '完成' : 'Done'}
                        </button>
                        <button
                            onClick={() => onSetStatus(action.id, 'skipped', action.priority, action.estimatedMinutes)}
                            aria-label={isZh ? `跳过${action.title}` : `Skip ${action.title}`}
                            className={`rounded-lg px-3 py-1.5 text-xs font-black ${status === 'skipped' ? 'bg-slate-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`}
                        >
                            {isZh ? '跳过' : 'Skip'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function actionResultAfterCompletion(row: StudyActionExecution | undefined, isZh: boolean) {
    if (!row) return undefined;
    const minutes = Math.max(1, row.estimatedMinutes);
    if (isZh) {
        if (row.status === 'completed') return `今天已完成 · 已记录 ${minutes} 分钟`;
        if (row.status === 'skipped') return `今天已跳过 · ${minutes} 分钟建议未执行`;
        return `今天待执行 · 预计 ${minutes} 分钟`;
    }
    if (row.status === 'completed') return `Completed today · ${minutes} min tracked`;
    if (row.status === 'skipped') return `Skipped today · ${minutes} min not executed`;
    return `Pending today · ${minutes} min planned`;
}

function StabilityMetric({
    label,
    value,
    detail,
    status
}: {
    label: string;
    value: string;
    detail: string;
    status: string;
}) {
    const tone = metricStatusClass(status);
    return (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-bold text-slate-500">{label}</p>
            <p className={`mt-1 text-lg font-black ${tone}`}>{value}</p>
            <p className="mt-2 min-h-8 text-[11px] font-semibold leading-snug text-slate-500">{detail}</p>
        </div>
    );
}

function ServiceRow({ label, status, isZh }: { label: string; status: string; isZh: boolean; }) {
    const healthy = status === 'healthy' || status === 'operational' || status === 'ok';
    const collecting = status === 'insufficient';
    const warning = status === 'warning';
    const iconClass = healthy
        ? 'text-emerald-600'
        : collecting
            ? 'text-slate-400'
            : warning
                ? 'text-amber-500'
                : 'text-red-500';
    const textClass = healthy
        ? 'text-emerald-600'
        : collecting
            ? 'text-slate-500'
            : warning
                ? 'text-amber-600'
                : 'text-red-600';
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
                <CheckCircle2 className={`h-4 w-4 ${iconClass}`} />
                {label}
            </span>
            <span className={`text-xs font-black ${textClass}`}>
                {serviceStatusCopy(status, isZh)}
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

function formatSkillLabel(value: string, isZh = false) {
    return formatLearningLabel(value, isZh ? 'zh' : 'en');
}

function practicePlanRationaleText(plan: PracticePlan, isZh: boolean) {
    if (!isZh) return plan.rationale;
    if (plan.planId.includes('starter')) return '暂无本地学习证据时，先用短路径建立词汇和阅读基线。';
    return '综合到期复习、近期错题、掌握状态和任务线证据，安排 10-15 分钟学习路径。';
}

function practicePlanEvidenceLabel(label: string, isZh: boolean) {
    if (!isZh) return label;
    const normalized = label.trim().toLowerCase();
    if (normalized === 'due review') return '到期复习';
    if (normalized === 'recent mistake') return '近期错题';
    if (normalized === 'mastery') return '掌握证据';
    if (normalized === 'transfer ready') return '可迁移';
    if (normalized === 'questline') return '任务线';
    if (normalized === 'starter path') return '起步路径';
    return label;
}

function practicePlanEvidenceValue(row: PracticePlanEvidence, isZh: boolean) {
    if (!isZh) return row.value;
    if (row.source === 'srs') return '有到期卡片需要优先复习';
    if (row.source === 'mistake') return '近期错因需要带支架回炉';
    if (row.source === 'mastery') return '掌握度证据提示需要短练习';
    if (row.source === 'task') return row.value.replace(' - ', ' · ');
    if (row.source === 'starter') return '先收集第一轮本地学习证据';
    return row.value;
}

function exportPracticeEvidenceValue(row: PracticePlanEvidence, isZh: boolean) {
    if (row.source === 'srs') return isZh ? '存在到期复习项目' : 'Due review items detected';
    if (row.source === 'mistake') return isZh ? '存在近期错误信号' : 'Recent error signals detected';
    if (row.source === 'mastery') return isZh ? '掌握状态需要短练习' : 'Mastery state needs short practice';
    if (row.source === 'task') return isZh ? '存在进行中的学习任务' : 'An active learning task is available';
    return isZh ? '正在建立本机学习基线' : 'Building a local learning baseline';
}

function formatPercent(value: number) {
    return `${Math.round(value * 100)}%`;
}

function formatLatencyMs(value?: number) {
    if (!value || value <= 0) return '--';
    return `${Math.round(value)}ms`;
}

function formatNumber(value: number) {
    return new Intl.NumberFormat().format(value);
}

function formatReportTimestamp(value: number, isZh: boolean) {
    return new Intl.DateTimeFormat(isZh ? 'zh-CN' : 'en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(new Date(value));
}

function formatExportFileTimestamp(value: number) {
    const date = new Date(value);
    const pad = (part: number) => String(part).padStart(2, '0');
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join('') + `-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function getLocalTimeZoneLabel(isZh: boolean) {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || (isZh ? '本地时间' : 'Local time');
    return isZh ? `时区：${timeZone}` : `Time zone: ${timeZone}`;
}

function statusCopy(status: string, isZh: boolean) {
    if (status === 'met' || status === 'passed') return isZh ? '达标' : 'Met';
    if (status === 'not_met') return isZh ? '未达标' : 'Not Met';
    if (status === 'healthy' || status === 'ok') return isZh ? '健康' : 'Healthy';
    if (status === 'warning') return isZh ? '预警' : 'Warning';
    if (status === 'critical') return isZh ? '严重' : 'Critical';
    return isZh ? '样本不足' : 'Insufficient';
}

function hasEnoughAiSamples(aiMonitor?: AIRequestMonitorSnapshot | null) {
    return Boolean(aiMonitor && aiMonitor.totalRequests >= MIN_AI_MONITOR_REQUESTS && aiMonitor.successRate.status !== 'insufficient');
}

function aiSuccessValue(aiMonitor?: AIRequestMonitorSnapshot | null) {
    return hasEnoughAiSamples(aiMonitor) ? formatPercent(aiMonitor!.successRate.currentRate) : '--';
}

function aiSuccessDetail(aiMonitor: AIRequestMonitorSnapshot | null, isZh: boolean) {
    if (!aiMonitor || aiMonitor.totalRequests === 0) {
        return isZh ? '暂无 AI 请求记录' : 'No AI requests logged';
    }
    if (!hasEnoughAiSamples(aiMonitor)) {
        return isZh
            ? `${aiMonitor.totalRequests}/${MIN_AI_MONITOR_REQUESTS} 次请求已记录`
            : `${aiMonitor.totalRequests}/${MIN_AI_MONITOR_REQUESTS} requests collected`;
    }
    return isZh
        ? `${aiMonitor.successRate.numerator}/${aiMonitor.successRate.denominator} 次成功`
        : `${aiMonitor.successRate.numerator}/${aiMonitor.successRate.denominator} successful`;
}

function aiLatencyValue(aiMonitor?: AIRequestMonitorSnapshot | null) {
    if (!aiMonitor || aiMonitor.totalRequests === 0) return '--';
    return formatLatencyMs(aiMonitor.avgLatencyMs);
}

function aiLatencyDetail(aiMonitor: AIRequestMonitorSnapshot | null, isZh: boolean) {
    if (!aiMonitor || aiMonitor.totalRequests === 0) {
        return isZh ? '等待真实请求样本' : 'Waiting for real samples';
    }
    const sampleLabel = aiMonitor.totalRequests === 1 ? 'sample' : 'samples';
    return isZh
        ? `${aiMonitor.totalRequests} 个样本 · P95 ${formatLatencyMs(aiMonitor.p95LatencyMs)}`
        : `${aiMonitor.totalRequests} ${sampleLabel} · p95 ${formatLatencyMs(aiMonitor.p95LatencyMs)}`;
}

function aiRetryStatus(aiMonitor?: AIRequestMonitorSnapshot | null) {
    if (!hasEnoughAiSamples(aiMonitor)) return 'insufficient';
    if (aiMonitor!.retryPressureRate >= 0.6) return 'critical';
    if (aiMonitor!.retryPressureRate >= 0.35) return 'warning';
    return 'healthy';
}

function aiRetryValue(aiMonitor?: AIRequestMonitorSnapshot | null) {
    return hasEnoughAiSamples(aiMonitor) ? formatPercent(aiMonitor!.retryPressureRate) : '--';
}

function aiRetryDetail(aiMonitor: AIRequestMonitorSnapshot | null, isZh: boolean) {
    if (!aiMonitor || aiMonitor.totalRequests === 0) {
        return isZh ? '暂无重试记录' : 'No retry data yet';
    }
    if (!hasEnoughAiSamples(aiMonitor)) {
        return isZh ? `满 ${MIN_AI_MONITOR_REQUESTS} 次请求后显示` : `Shown after ${MIN_AI_MONITOR_REQUESTS} requests`;
    }
    return isZh ? `${aiMonitor.windowDays} 天窗口` : `${aiMonitor.windowDays}d window`;
}

function systemStatusLabel(status: string | undefined, isZh = false) {
    if (status === 'critical') return isZh ? '需要处理' : 'Needs Attention';
    if (status === 'warning') return isZh ? '观察中' : 'Monitoring';
    if (status === 'insufficient') return isZh ? '正在收集数据' : 'Collecting Data';
    return isZh ? '运行稳定' : 'Stable';
}

function systemStatusDetail(aiMonitor: AIRequestMonitorSnapshot | null, isZh: boolean) {
    if (!aiMonitor || aiMonitor.totalRequests === 0) {
        return isZh ? '本机还没有 AI 请求记录。' : 'No AI requests have been logged on this device yet.';
    }
    if (aiMonitor.status === 'insufficient') {
        return isZh
            ? `已记录 ${aiMonitor.totalRequests}/${MIN_AI_MONITOR_REQUESTS} 次请求，样本足够后再判断可靠性。`
            : `${aiMonitor.totalRequests}/${MIN_AI_MONITOR_REQUESTS} requests logged. Reliability will be scored after enough samples.`;
    }
    if (aiMonitor.status === 'critical') {
        return isZh
            ? `近 ${aiMonitor.windowDays} 天成功率 ${formatPercent(aiMonitor.successRate.currentRate)}，重试压力 ${formatPercent(aiMonitor.retryPressureRate)}。`
            : `Last ${aiMonitor.windowDays} days: ${formatPercent(aiMonitor.successRate.currentRate)} success, ${formatPercent(aiMonitor.retryPressureRate)} retry pressure.`;
    }
    if (aiMonitor.status === 'warning') {
        return isZh
            ? `近 ${aiMonitor.windowDays} 天请求有波动，建议继续观察。`
            : `Recent AI requests are uneven. Keep monitoring this window.`;
    }
    return isZh
        ? `近 ${aiMonitor.windowDays} 天 ${aiMonitor.totalRequests} 次 AI 请求，未发现可靠性异常。`
        : `${aiMonitor.totalRequests} AI requests in the last ${aiMonitor.windowDays} days with no reliability issues.`;
}

function serviceStatusCopy(status: string, isZh: boolean) {
    if (status === 'healthy' || status === 'operational' || status === 'ok') return isZh ? '正常' : 'Operational';
    if (status === 'insufficient') return isZh ? '收集中' : 'Collecting';
    if (status === 'warning') return isZh ? '观察' : 'Watch';
    return isZh ? '异常' : 'Issue';
}

function statusTextClass(status?: string) {
    return `text-xs ${metricStatusClass(status)}`;
}

function statusPanelClass(status?: string) {
    if (status === 'critical') return 'bg-red-50';
    if (status === 'warning') return 'bg-amber-50';
    if (status === 'insufficient') return 'bg-slate-50';
    return 'bg-emerald-50';
}

function statusIconClass(status?: string) {
    if (status === 'critical') return 'text-red-600';
    if (status === 'warning') return 'text-amber-600';
    if (status === 'insufficient') return 'text-slate-500';
    return 'text-emerald-600';
}

function metricStatusClass(status?: string) {
    if (status === 'met' || status === 'passed' || status === 'healthy' || status === 'operational' || status === 'ok') return 'text-emerald-600';
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
