import {
    AIRequestMonitorSnapshot,
    EngagementSnapshot,
    FSRSCard,
    GuardianAcceptanceSnapshot,
    GlobalPlayerProfile,
    LearningEvent,
    LearningTask,
    MasteryAggregateSnapshot,
    ObjectiveMasteryAggregateSnapshot,
    SessionRecoverySnapshot,
    StudyActionExecution,
    StudyActionExecutionGoalSnapshot,
    StudyActionExecutionSummary,
    computeStudyActionExecutionSummaryFromRows,
    db,
    getAIRequestMonitorSnapshot,
    getDueCardsWithPriority,
    getEngagementSnapshot,
    getGuardianAcceptanceSnapshot,
    getMasteryAggregateSnapshot,
    getObjectiveMasteryAggregateSnapshot,
    getPlayerProfile,
    getSRSStats,
    getSessionRecoverySnapshot,
    getStudyActionExecutionGoalSnapshot,
    getStudyActionExecutions,
    getStudyActionExecutionSummary,
    getWeeklyLearningTasks
} from '@/db/db';
import { DashboardSummary, getDashboardSummary } from '@/lib/data/history';
import { DataConsistencyAuditSnapshot, getDataConsistencyAuditSnapshot } from '@/lib/data/consistency';
import {
    buildRepeatedCauseActionSuggestion,
    buildRepeatedCauseIntensityAlert,
    evaluateRepeatedCauseGoalAgainstBaseline,
    getMistakes,
    getRepeatedCauseGoalAgainstBaseline,
    getRepeatedCauseSnapshot,
    getRepeatedCauseTrends,
    MistakeRecord,
    RepeatedCauseActionSuggestion,
    RepeatedCauseIntensityAlert,
    RepeatedCauseBaselineSummary,
    RepeatedCauseSnapshot,
    RepeatedCauseTrend
} from '@/lib/data/mistakes';
import type { HistoryRecord } from '@/db/db';
import { buildDailyPracticePlan, PracticePlan } from '@/lib/data/dailyPracticePlan';
import { objectiveTitle } from '@/lib/data/learningObjectives';
import { buildDailyFlameStatus, DailyFlameStatus } from '@/lib/data/dailyFlame';
import { buildCalibrationSummary, type CalibrationSummary } from '@/lib/data/metacognitiveCalibration';
import {
    buildLearningProgressRewardSummary,
    type LearningProgressRewardSummary
} from '@/lib/data/learningProgressRewards';

const DAY_MS = 24 * 60 * 60 * 1000;

export type GuardianActivityKind = 'mission' | 'answer' | 'session' | 'hint' | 'mistake' | 'task';
export type GuardianActivityTone = 'blue' | 'green' | 'amber' | 'purple' | 'red' | 'slate';

export interface GuardianActivityFeedItem {
    id: string;
    kind: GuardianActivityKind;
    tone: GuardianActivityTone;
    title: string;
    detail: string;
    meta: string;
    timestamp: number;
}

export interface GuardianDashboardViewModel {
    history: DashboardSummary;
    playerProfile: GlobalPlayerProfile;
    dailyFlameStatus: DailyFlameStatus;
    mistakes: MistakeRecord[];
    dueCards: FSRSCard[];
    srsStats: { total: number; due: number; new: number; learning: number; review: number; };
    mastery: MasteryAggregateSnapshot;
    objectiveMastery: ObjectiveMasteryAggregateSnapshot;
    learningTasks: LearningTask[];
    studyActionExecutions: StudyActionExecution[];
    studyActionSummary: StudyActionExecutionSummary;
    studyActionGoal: StudyActionExecutionGoalSnapshot;
    engagement: EngagementSnapshot;
    guardianAcceptance: GuardianAcceptanceSnapshot;
    repeatedCauseSnapshot: RepeatedCauseSnapshot;
    repeatedCauseTrends: RepeatedCauseTrend[];
    repeatedCauseBaselineGoal: RepeatedCauseBaselineSummary;
    repeatedAction: RepeatedCauseActionSuggestion;
    repeatedAlert: RepeatedCauseIntensityAlert | null;
    consistencyAudit: DataConsistencyAuditSnapshot;
    aiMonitor: AIRequestMonitorSnapshot;
    sessionRecovery: SessionRecoverySnapshot;
    dailyPracticePlan: PracticePlan;
    activityFeed: GuardianActivityFeedItem[];
    calibrationSummary: CalibrationSummary;
    progressRewardSummary: LearningProgressRewardSummary;
}

export interface GuardianActivityFeedInput {
    learningEvents: LearningEvent[];
    historyRecords: HistoryRecord[];
    mistakes: MistakeRecord[];
    learningTasks: LearningTask[];
    now?: number;
    limit?: number;
}

function formatSkillLabel(value?: string) {
    if (!value) return 'Core Skill';
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatRelativeTime(timestamp: number, now: number) {
    const diffMs = Math.max(0, now - timestamp);
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return 'Now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
}

function missionAccuracy(record: HistoryRecord) {
    if (typeof record.accuracy === 'number') return Math.round(record.accuracy * 100);
    if (typeof record.totalCorrect === 'number' && record.totalQuestions > 0) {
        return Math.round((record.totalCorrect / record.totalQuestions) * 100);
    }
    return null;
}

function sourceLabel(source: LearningEvent['source']) {
    if (source === 'srs') return 'SRS';
    if (source === 'daily') return 'Daily';
    return 'Battle';
}

function taskTimestamp(task: LearningTask) {
    return task.completedAt || task.updatedAt || task.periodStart;
}

export function buildGuardianActivityFeed(input: GuardianActivityFeedInput): GuardianActivityFeedItem[] {
    const now = input.now ?? Date.now();
    const limit = input.limit ?? 8;

    const eventItems = input.learningEvents.map((event, index): GuardianActivityFeedItem => {
        if (event.eventType === 'session_complete') {
            return {
                id: `event-session-${event.id ?? index}-${event.timestamp}`,
                kind: 'session',
                tone: event.source === 'daily' ? 'purple' : 'green',
                title: `${sourceLabel(event.source)} session complete`,
                detail: event.learningObjectiveId
                    ? objectiveTitle(event.learningObjectiveId)
                    : event.skillTag ? formatSkillLabel(event.skillTag) : 'Learning session recorded',
                meta: formatRelativeTime(event.timestamp, now),
                timestamp: event.timestamp
            };
        }

        if (event.eventType === 'hint') {
            return {
                id: `event-hint-${event.id ?? index}-${event.timestamp}`,
                kind: 'hint',
                tone: 'amber',
                title: `${sourceLabel(event.source)} hint used`,
                detail: event.causeTag
                    ? formatSkillLabel(event.causeTag)
                    : event.learningObjectiveId
                        ? objectiveTitle(event.learningObjectiveId)
                        : event.skillTag ? formatSkillLabel(event.skillTag) : 'Hint evidence logged',
                meta: formatRelativeTime(event.timestamp, now),
                timestamp: event.timestamp
            };
        }

        const correct = event.result === 'correct';
        return {
            id: `event-answer-${event.id ?? index}-${event.timestamp}`,
            kind: 'answer',
            tone: correct ? 'green' : event.result === 'wrong' ? 'red' : 'blue',
            title: `${correct ? 'Correct' : event.result === 'wrong' ? 'Wrong' : 'Recorded'} ${sourceLabel(event.source).toLowerCase()} answer`,
            detail: event.learningObjectiveId
                ? objectiveTitle(event.learningObjectiveId)
                : event.skillTag ? formatSkillLabel(event.skillTag) : event.questionHash || 'Question evidence logged',
            meta: formatRelativeTime(event.timestamp, now),
            timestamp: event.timestamp
        };
    });

    const historyItems = input.historyRecords.map((record, index): GuardianActivityFeedItem => {
        const accuracy = missionAccuracy(record);
        return {
            id: `history-${record.id ?? index}-${record.timestamp}`,
            kind: 'mission',
            tone: 'green',
            title: 'Mission completed',
            detail: record.levelTitle || 'Custom Mission',
            meta: accuracy === null ? formatRelativeTime(record.timestamp, now) : `${accuracy}% accuracy`,
            timestamp: record.timestamp
        };
    });

    const mistakeItems = input.mistakes.map((mistake, index): GuardianActivityFeedItem => ({
        id: `mistake-${mistake.id ?? index}-${mistake.timestamp}`,
        kind: 'mistake',
        tone: 'amber',
        title: 'Review signal detected',
        detail: formatSkillLabel(mistake.mentorCauseTag || mistake.skillTag) || mistake.questionText,
        meta: formatRelativeTime(mistake.timestamp, now),
        timestamp: mistake.timestamp
    }));

    const taskItems = input.learningTasks.map((task, index): GuardianActivityFeedItem => ({
        id: `task-${task.id ?? index}-${task.taskId}-${taskTimestamp(task)}`,
        kind: 'task',
        tone: task.status === 'completed' ? 'purple' : 'blue',
        title: 'Questline update',
        detail: `${task.title} - ${task.progress}/${task.goal}`,
        meta: task.status,
        timestamp: taskTimestamp(task)
    }));

    return [...eventItems, ...historyItems, ...mistakeItems, ...taskItems]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, limit);
}

export async function getGuardianActivityFeed(input: {
    historyRecords?: HistoryRecord[];
    mistakes?: MistakeRecord[];
    learningTasks?: LearningTask[];
    limit?: number;
    lookbackDays?: number;
    now?: number;
} = {}): Promise<GuardianActivityFeedItem[]> {
    const now = input.now ?? Date.now();
    const lookbackDays = input.lookbackDays ?? 30;
    const start = now - lookbackDays * DAY_MS;

    const [learningEvents, historyRecords, mistakes, learningTasks] = await Promise.all([
        db.learningEvents
            .where('timestamp')
            .aboveOrEqual(start)
            .toArray(),
        input.historyRecords ?? db.history.orderBy('timestamp').reverse().limit(input.limit ?? 8).toArray(),
        input.mistakes ?? getMistakes(input.limit ?? 8),
        input.learningTasks ?? getWeeklyLearningTasks(now)
    ]);

    return buildGuardianActivityFeed({
        learningEvents,
        historyRecords,
        mistakes,
        learningTasks,
        now,
        limit: input.limit ?? 8
    });
}

export async function getGuardianDashboardViewModel(range: number, now = Date.now()): Promise<GuardianDashboardViewModel> {
    const [
        history,
        mistakes,
        dueCards,
        srsStats,
        mastery,
        objectiveMastery,
        learningTasks,
        studyActionExecutions,
        studyActionSummary,
        studyActionGoal,
        engagement,
        guardianAcceptance,
        repeatedCauseSnapshot,
        repeatedCauseTrends,
        repeatedCauseBaselineGoal,
        consistencyAudit,
        aiMonitor,
        sessionRecovery,
        playerProfile,
        learningEvents,
        masteryRecords
    ] = await Promise.all([
        getDashboardSummary(range, range * 6),
        getMistakes(40),
        getDueCardsWithPriority(6),
        getSRSStats(),
        getMasteryAggregateSnapshot(range),
        getObjectiveMasteryAggregateSnapshot(range),
        getWeeklyLearningTasks(now),
        getStudyActionExecutions(),
        getStudyActionExecutionSummary(14),
        getStudyActionExecutionGoalSnapshot(14),
        getEngagementSnapshot(range),
        getGuardianAcceptanceSnapshot(7),
        getRepeatedCauseSnapshot(range),
        getRepeatedCauseTrends([7, 14, 30]),
        getRepeatedCauseGoalAgainstBaseline([7, 14, 30], 0.2, 5, 8, 800),
        getDataConsistencyAuditSnapshot(),
        getAIRequestMonitorSnapshot(7),
        getSessionRecoverySnapshot(14),
        getPlayerProfile(),
        db.learningEvents
            .where('timestamp')
            .aboveOrEqual(now - Math.max(range, 30) * DAY_MS)
            .toArray(),
        db.skillMastery.toArray()
    ]);

    const repeatedGoal = repeatedCauseBaselineGoal ?? evaluateRepeatedCauseGoalAgainstBaseline(mistakes, [7, 14, 30], 0.2, 5, 8);
    const repeatedAction = buildRepeatedCauseActionSuggestion(repeatedGoal, repeatedCauseSnapshot || undefined, {
        targetedSessions: history.targetedReview.sessions,
        targetedAvgAccuracy: history.targetedReview.avgAccuracy,
        targetedSuccessRuns: history.targetedReview.successRuns,
        targetedConsecutiveLowRuns: history.targetedReview.consecutiveLowAccuracyRuns
    });
    const repeatedAlert = buildRepeatedCauseIntensityAlert(repeatedAction, {
        targetedConsecutiveLowRuns: history.targetedReview.consecutiveLowAccuracyRuns
    });

    const activityFeed = buildGuardianActivityFeed({
        learningEvents,
        historyRecords: history.records,
        mistakes,
        learningTasks,
        now,
        limit: 8
    });
    const dailyPracticePlan = buildDailyPracticePlan({
        masteryRecords,
        dueCards,
        recentMistakes: mistakes,
        learningTasks,
        profile: playerProfile,
        now
    });
    const dailyFlameStatus = buildDailyFlameStatus({ profile: playerProfile, now });
    const calibrationSummary = buildCalibrationSummary(learningEvents, { now, windowDays: range });
    const progressRewardSummary = buildLearningProgressRewardSummary(learningEvents, { now, windowDays: range });

    return {
        history,
        playerProfile,
        dailyFlameStatus,
        mistakes,
        dueCards,
        srsStats,
        mastery,
        objectiveMastery,
        learningTasks,
        studyActionExecutions,
        studyActionSummary: studyActionSummary ?? computeStudyActionExecutionSummaryFromRows(studyActionExecutions, 14),
        studyActionGoal,
        engagement,
        guardianAcceptance,
        repeatedCauseSnapshot,
        repeatedCauseTrends,
        repeatedCauseBaselineGoal,
        repeatedAction,
        repeatedAlert,
        consistencyAudit,
        aiMonitor,
        sessionRecovery,
        dailyPracticePlan,
        activityFeed,
        calibrationSummary,
        progressRewardSummary
    };
}
