
import Dexie, { Table } from 'dexie';
import { createEmptyCard, fsrs, generatorParameters, Rating, State, Card as FSRSCardType, RecordLogItem } from 'ts-fsrs';
import {
    DEFAULT_QUESTION_CACHE_POLICY,
    mergeQuestionCache
} from '@/lib/data/questionCachePolicy';
import {
    canonicalizeLearningObjective,
    getLearningObjective,
    type LearningObjectiveDomain,
    type LearningObjectiveId
} from '@/lib/data/learningObjectives';
import type {
    AssessmentRole,
    ContentReviewerStatus,
    EvidenceStrength,
    RetentionProbeStage,
    TransferDistance
} from '@/lib/data/learningEvidenceContract';
import {
    evidenceStrengthForAttempt,
    isIndependentEvidence,
    resolveAssessmentRole
} from '@/lib/data/learningEvidenceContract';
import type { ObjectiveClassificationStatus } from '@/lib/data/learningObjectives';

export interface SkillStatSlice {
    correct: number;
    total: number;
}

export interface HistoryRecord {
    id?: number;
    timestamp: number;
    score: number;
    totalQuestions: number;
    levelTitle: string;
    totalCorrect?: number;
    accuracy?: number;
    skillStats?: Record<string, SkillStatSlice>;
}

export type StoredQuestionType = 'vocab' | 'grammar' | 'reading' | undefined;

export interface StoredRevengeQuestion {
    question: string;
    options: string[];
    correct_index: number;
    type?: StoredQuestionType;
    explanation?: string;
}

export interface MistakeRecord {
    id?: number;
    questionId: number;
    questionText: string;
    wrongAnswer: string;
    correctAnswer: string;
    explanation: string;
    options?: string[];
    correctIndex?: number;
    type?: StoredQuestionType;
    skillTag?: string;
    timestamp: number;
    mentorAnalysis?: string;
    mentorCauseTag?: string;
    mentorNextAction?: string;
    revengeQuestion?: StoredRevengeQuestion;
}

// Cached question from AI generation
export interface CachedQuestion {
    id?: number;
    question: string;
    options: string[];
    correct_index: number;
    type: StoredQuestionType;
    explanation: string;
    hint?: string;
    skillTag?: string;
    learningObjectiveId?: string;
    objectiveCatalogVersion?: number;
    objectiveClassificationStatus?: ObjectiveClassificationStatus;
    evidenceContractVersion?: number;
    itemFamilyId?: string;
    contextId?: string;
    equivalenceGroup?: string;
    assessmentRole?: AssessmentRole;
    transferDistance?: TransferDistance;
    reviewerStatus?: ContentReviewerStatus;
    probeStage?: RetentionProbeStage;
    probeScheduledFor?: number;
    sourceContextSpan?: string;
    questionMode?: 'choice' | 'typing' | 'fill-blank';
    correctAnswer?: string;
    contextHash: string; // Hash of the source context
    timestamp: number;
    used: boolean;  // Whether this question has been used in a game
}

// FSRS Spaced Repetition Card
export interface FSRSCard {
    id?: number;
    // Question identifier (hash of question text)
    questionHash: string;
    // Question data for review
    question: string;
    options: string[];
    correct_index: number;
    type: StoredQuestionType;
    explanation?: string;
    hint?: string;
    skillTag?: string;
    learningObjectiveId?: string;
    objectiveCatalogVersion?: number;
    objectiveClassificationStatus?: ObjectiveClassificationStatus;
    evidenceContractVersion?: number;
    itemFamilyId?: string;
    contextId?: string;
    equivalenceGroup?: string;
    assessmentRole?: AssessmentRole;
    transferDistance?: TransferDistance;
    reviewerStatus?: ContentReviewerStatus;
    probeStage?: RetentionProbeStage;
    probeScheduledFor?: number;
    sourceContextSpan?: string;
    questionMode?: 'choice' | 'typing' | 'fill-blank';
    correctAnswer?: string;
    // FSRS scheduling fields
    due: number;           // Next review timestamp
    stability: number;     // Memory stability
    difficulty: number;    // Card difficulty (0-1)
    elapsed_days: number;  // Days since last review
    scheduled_days: number;// Scheduled interval
    reps: number;          // Number of reviews
    lapses: number;        // Number of lapses
    state: number;         // 0=New, 1=Learning, 2=Review, 3=Relearning
    last_review?: number;  // Last review timestamp
}

// Global Player Profile - Persistent across all sessions
export interface GlobalPlayerProfile {
    id?: number;

    // Core progression (never resets)
    totalXp: number;
    globalLevel: number;
    totalGold: number;

    // Daily streak system
    dailyStreak: number;
    lastActiveDate: string;  // YYYY-MM-DD
    dailyXpGoal: number;
    dailyXpEarned: number;

    // Lifetime stats
    wordsLearned: number;
    lessonsCompleted: number;
    totalStudyMinutes: number;
    perfectLessons: number;

    // Skill mastery (0-100)
    vocabMastery: number;
    grammarMastery: number;
    readingMastery: number;

    // Inventory persisted
    ownedRelics: string[];  // Relic IDs owned permanently

    createdAt: number;
    updatedAt: number;
}

export type LearningEventSource = 'battle' | 'srs' | 'daily';
export type LearningEventMode = 'choice' | 'typing' | 'fill-blank';
export type LearningEventResult = 'correct' | 'wrong';
export type LearningEventAttemptKind = 'diagnostic' | 'practice' | 'review' | 'transfer';
export type LearningEventSupportLevel = 0 | 1 | 2 | 3;
export type LearningEventSelfConfidence = 'low' | 'medium' | 'high';
export type LearningEventProgressRewardKind =
    | 'supported-practice'
    | 'independent-success'
    | 'repair-success'
    | 'delayed-recall'
    | 'transfer-success';
export type LearningEventRewardProtectionReason = 'duplicate-evidence' | 'kind-cap' | 'session-cap';
export type LearningEventScaffoldTransition = 'hold' | 'increase' | 'fade' | 'transfer' | 'repair';
export type LearningEventScaffoldReason =
    | 'collect-more-evidence'
    | 'hint-dependence'
    | 'answer-repair'
    | 'transfer-repair'
    | 'repair-confirmation'
    | 'stable-success'
    | 'transfer-ready'
    | 'transfer-confirmed';

export interface LearningEvent {
    id?: number;
    eventType: 'answer' | 'hint' | 'session_complete';
    questionId?: number;
    questionHash?: string;
    skillTag?: string;
    learningObjectiveId?: string;
    objectiveConfidence?: number;
    objectiveCatalogVersion?: number;
    objectiveClassificationStatus?: ObjectiveClassificationStatus;
    evidenceContractVersion?: number;
    itemFamilyId?: string;
    contextId?: string;
    equivalenceGroup?: string;
    assessmentRole?: AssessmentRole;
    transferDistance?: TransferDistance;
    reviewerStatus?: ContentReviewerStatus;
    evidenceStrength?: EvidenceStrength;
    probeStage?: RetentionProbeStage;
    probeScheduledFor?: number;
    sourceContextSpan?: string;
    attemptKind?: LearningEventAttemptKind;
    supportLevel?: LearningEventSupportLevel;
    causeTag?: string;
    mode?: LearningEventMode;
    result?: LearningEventResult;
    hintUsed?: boolean;
    latencyMs?: number;
    selfConfidence?: LearningEventSelfConfidence;
    progressRewardKind?: LearningEventProgressRewardKind;
    rewardXp?: number;
    rewardGold?: number;
    rewardCounted?: boolean;
    rewardProtectionReason?: LearningEventRewardProtectionReason;
    scaffoldTransition?: LearningEventScaffoldTransition;
    scaffoldReason?: LearningEventScaffoldReason;
    nextSupportLevel?: LearningEventSupportLevel;
    nextAttemptKind?: LearningEventAttemptKind;
    source: LearningEventSource;
    timestamp: number;
}

export interface LearningEvidence {
    eventType: LearningEvent['eventType'];
    objectiveId?: string;
    skillTag?: string;
    sourceSpan?: string;
    confidence?: number;
    objectiveCatalogVersion?: number;
    objectiveClassificationStatus?: ObjectiveClassificationStatus;
    evidenceContractVersion?: number;
    itemFamilyId?: string;
    contextId?: string;
    equivalenceGroup?: string;
    assessmentRole?: AssessmentRole;
    transferDistance?: TransferDistance;
    reviewerStatus?: ContentReviewerStatus;
    evidenceStrength?: EvidenceStrength;
    probeStage?: RetentionProbeStage;
    probeScheduledFor?: number;
    mode?: LearningEventMode;
    supportLevel?: LearningEventSupportLevel;
    attemptKind?: LearningEventAttemptKind;
    result?: LearningEventResult;
    hintUsed?: boolean;
    latencyMs?: number;
    selfConfidence?: LearningEventSelfConfidence;
    progressRewardKind?: LearningEventProgressRewardKind;
    rewardXp?: number;
    rewardGold?: number;
    rewardCounted?: boolean;
    rewardProtectionReason?: LearningEventRewardProtectionReason;
    scaffoldTransition?: LearningEventScaffoldTransition;
    scaffoldReason?: LearningEventScaffoldReason;
    nextSupportLevel?: LearningEventSupportLevel;
    nextAttemptKind?: LearningEventAttemptKind;
}

export type LearningTaskMetric = 'daily_sessions' | 'srs_answers' | 'battle_correct';
export type LearningTaskStatus = 'active' | 'completed' | 'expired';

export interface LearningTaskEvidence {
    timestamp: number;
    source: LearningEventSource;
    eventType: LearningEvent['eventType'];
    questionHash?: string;
    skillTag?: string;
    learningObjectiveId?: string;
    attemptKind?: LearningEventAttemptKind;
    supportLevel?: LearningEventSupportLevel;
    causeTag?: string;
    result?: LearningEventResult;
}

export interface LearningTask {
    id?: number;
    taskId: string;
    metric: LearningTaskMetric;
    title: string;
    description: string;
    goal: number;
    progress: number;
    status: LearningTaskStatus;
    periodStart: number;
    periodEnd: number;
    rewardXp: number;
    rewardGold: number;
    evidence: LearningTaskEvidence[];
    completedAt?: number;
    rewardGrantedAt?: number;
    updatedAt: number;
}

export type EngagementMetricStatus = 'met' | 'not_met' | 'insufficient';

export interface EngagementMetricRow {
    currentRate: number;
    previousRate: number;
    absoluteDelta: number;
    relativeDelta: number;
    numerator: number;
    denominator: number;
    previousNumerator: number;
    previousDenominator: number;
    target: number;
    targetType: 'absolute_rate' | 'absolute_lift' | 'relative_lift';
    status: EngagementMetricStatus;
}

export interface EngagementSnapshot {
    windowDays: number;
    generatedAt: number;
    dailyChallengeParticipation: EngagementMetricRow;
    weeklyTaskCompletion: EngagementMetricRow;
    nextDayRetention: EngagementMetricRow;
}

export type GuardianDashboardEventType = 'panel_open' | 'action_marked' | 'report_export' | 'session_launch';

export interface GuardianDashboardEvent {
    id?: number;
    eventType: GuardianDashboardEventType;
    dateKey: string; // YYYY-MM-DD
    timestamp: number;
}

export type AIRequestOutcome = 'success' | 'error' | 'timeout';

export interface AIRequestMetric {
    id?: number;
    provider: 'openrouter' | 'deepseek' | 'openai';
    model: string;
    isFreeModel: boolean;
    outcome: AIRequestOutcome;
    attempts: number;
    retryCount: number;
    rateLimitHits: number;
    latencyMs: number;
    statusCode?: number;
    errorMessage?: string;
    timestamp: number;
}

export type SessionRecoveryEventType = 'attempt' | 'success' | 'failure';

export interface SessionRecoveryEvent {
    id?: number;
    eventType: SessionRecoveryEventType;
    hasSave: boolean;
    savedAgeMs?: number;
    reason?: string;
    timestamp: number;
}

export type StudyActionPriority = 'urgent' | 'important' | 'optional';
export type StudyActionStatus = 'pending' | 'completed' | 'skipped';

export interface StudyActionExecution {
    id?: number;
    actionId: string;
    dateKey: string; // YYYY-MM-DD
    status: StudyActionStatus;
    priority: StudyActionPriority;
    estimatedMinutes: number;
    source: 'guardian_dashboard';
    completedAt?: number;
    updatedAt: number;
}

export interface StudyActionExecutionSummary {
    windowDays: number;
    completed: number;
    skipped: number;
    pending: number;
    totalTracked: number;
    executionRate: number;
}

export interface StudyActionExecutionGoalSnapshot {
    windowDays: number;
    generatedAt: number;
    executionRate: EngagementMetricRow;
}

export interface GuardianAcceptanceSnapshot {
    windowDays: number;
    generatedAt: number;
    weeklyActiveRate: EngagementMetricRow;
}

export interface AIRequestMonitorSnapshot {
    windowDays: number;
    generatedAt: number;
    totalRequests: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    successRate: EngagementMetricRow;
    nonRateLimitedRate: EngagementMetricRow;
    retryPressureRate: number;
    status: 'healthy' | 'warning' | 'critical' | 'insufficient';
}

export interface SessionRecoverySnapshot {
    windowDays: number;
    generatedAt: number;
    attempts: number;
    successRate: EngagementMetricRow;
    status: 'healthy' | 'warning' | 'critical' | 'insufficient';
}

export type MasteryState = 'new' | 'learning' | 'consolidated' | 'mastered';

export interface SkillMasteryRecord {
    id?: number;
    skillTag: string;
    score: number; // 0-100
    state: MasteryState;
    attempts: number;
    correct: number;
    lastReviewedAt: number;
    updatedAt: number;
}

export type ObjectiveAttemptsByMode = Record<LearningEventMode, number>;

export interface ObjectiveMasteryRecord {
    id?: number;
    objectiveId: LearningObjectiveId;
    score: number;
    state: MasteryState;
    attempts: number;
    correct: number;
    qualifiedAttempts?: number;
    qualifiedCorrect?: number;
    independentAttempts?: number;
    attemptsByMode: ObjectiveAttemptsByMode;
    transferAttempts: number;
    transferCorrect: number;
    delayedProbeAttempts?: number;
    delayedProbeCorrect?: number;
    hintCount: number;
    hintRate: number;
    lastReviewedAt: number;
    nextReviewAt: number;
    confidence: number;
    updatedAt: number;
    evidenceModelVersion?: number;
}

export interface MasteryAggregateSkillRow {
    skillTag: string;
    attempts: number;
    correct: number;
    smoothedAccuracy: number;
    currentState: MasteryState;
    currentScore: number;
}

export interface MasteryAggregateSnapshot {
    windowDays: number;
    totalAttempts: number;
    totalCorrect: number;
    bySkill: MasteryAggregateSkillRow[];
    stateCounts: Record<MasteryState, number>;
}

export interface ObjectiveMasteryAggregateObjectiveRow {
    objectiveId: LearningObjectiveId;
    title: string;
    domain: LearningObjectiveDomain;
    score: number;
    state: MasteryState;
    attempts: number;
    correct: number;
    qualifiedAttempts: number;
    independentAttempts: number;
    confidence: number;
    transferAttempts: number;
    delayedProbeAttempts: number;
    evidenceStatus: 'insufficient' | 'developing' | 'retained';
    nextReviewAt: number;
}

export interface ObjectiveMasteryAggregateDomainRow {
    domain: LearningObjectiveDomain;
    averageScore: number;
    objectiveCount: number;
    masteredCount: number;
    learningCount: number;
}

export interface ObjectiveMasteryAggregateSnapshot {
    windowDays: number;
    generatedAt: number;
    averageScore: number;
    byObjective: ObjectiveMasteryAggregateObjectiveRow[];
    byDomain: ObjectiveMasteryAggregateDomainRow[];
    stateCounts: Record<MasteryState, number>;
}

export type PracticePlanRunStatus = 'active' | 'completed' | 'skipped';

export interface PracticePlanRunRecord {
    id?: number;
    planId: string;
    dateKey: string;
    title: string;
    status: PracticePlanRunStatus;
    steps: unknown[];
    completedStepIds: string[];
    evidenceBefore: unknown[];
    evidenceAfter: unknown[];
    startedAt: number;
    completedAt?: number;
    updatedAt: number;
}

export interface ContentReviewRecord {
    id?: number;
    contentKey: string;
    cachedQuestionId?: number;
    questionText: string;
    sourceType: 'ai' | 'controlled' | 'fallback';
    status: ContentReviewerStatus;
    objectiveId?: string;
    itemFamilyId?: string;
    equivalenceGroup?: string;
    notes?: string;
    createdAt: number;
    updatedAt: number;
}

export const CURRENT_DB_SCHEMA_VERSION = 15;

export class WordQuestDB extends Dexie {
    history!: Table<HistoryRecord>;
    mistakes!: Table<MistakeRecord>;
    questionCache!: Table<CachedQuestion>;
    fsrsCards!: Table<FSRSCard>;
    playerProfile!: Table<GlobalPlayerProfile>;
    learningEvents!: Table<LearningEvent>;
    learningTasks!: Table<LearningTask>;
    studyActionExecutions!: Table<StudyActionExecution>;
    guardianDashboardEvents!: Table<GuardianDashboardEvent>;
    aiRequestMetrics!: Table<AIRequestMetric>;
    sessionRecoveryEvents!: Table<SessionRecoveryEvent>;
    skillMastery!: Table<SkillMasteryRecord>;
    objectiveMastery!: Table<ObjectiveMasteryRecord>;
    practicePlanRuns!: Table<PracticePlanRunRecord>;
    contentReviews!: Table<ContentReviewRecord>;

    constructor(name = 'WordQuestDB') {
        super(name);
        this.version(1).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId'
        });
        this.version(2).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag'
        });
        this.version(3).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used'
        });
        this.version(4).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used',
            fsrsCards: '++id, questionHash, due, state'
        });
        this.version(5).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used',
            fsrsCards: '++id, questionHash, due, state',
            playerProfile: '++id'
        });
        this.version(6).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used',
            fsrsCards: '++id, questionHash, due, state',
            playerProfile: '++id',
            learningEvents: '++id, timestamp, source, eventType, questionHash, skillTag'
        });
        this.version(7).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used',
            fsrsCards: '++id, questionHash, due, state',
            playerProfile: '++id',
            learningEvents: '++id, timestamp, source, eventType, questionHash, skillTag',
            skillMastery: '++id, skillTag, state, score, updatedAt'
        });
        this.version(8).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used',
            fsrsCards: '++id, questionHash, due, state',
            playerProfile: '++id',
            learningEvents: '++id, timestamp, source, eventType, questionHash, skillTag',
            learningTasks: '++id, taskId, metric, status, periodStart, periodEnd, updatedAt, [taskId+periodStart]',
            skillMastery: '++id, skillTag, state, score, updatedAt'
        });
        this.version(9).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used',
            fsrsCards: '++id, questionHash, due, state',
            playerProfile: '++id',
            learningEvents: '++id, timestamp, source, eventType, questionHash, skillTag',
            learningTasks: '++id, taskId, metric, status, periodStart, periodEnd, updatedAt, [taskId+periodStart]',
            studyActionExecutions: '++id, actionId, dateKey, status, updatedAt, [actionId+dateKey]',
            skillMastery: '++id, skillTag, state, score, updatedAt'
        });
        this.version(10).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used',
            fsrsCards: '++id, questionHash, due, state',
            playerProfile: '++id',
            learningEvents: '++id, timestamp, source, eventType, questionHash, skillTag',
            learningTasks: '++id, taskId, metric, status, periodStart, periodEnd, updatedAt, [taskId+periodStart]',
            studyActionExecutions: '++id, actionId, dateKey, status, updatedAt, [actionId+dateKey]',
            guardianDashboardEvents: '++id, timestamp, eventType, dateKey',
            skillMastery: '++id, skillTag, state, score, updatedAt'
        });
        this.version(11).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used',
            fsrsCards: '++id, questionHash, due, state',
            playerProfile: '++id',
            learningEvents: '++id, timestamp, source, eventType, questionHash, skillTag',
            learningTasks: '++id, taskId, metric, status, periodStart, periodEnd, updatedAt, [taskId+periodStart]',
            studyActionExecutions: '++id, actionId, dateKey, status, updatedAt, [actionId+dateKey]',
            guardianDashboardEvents: '++id, timestamp, eventType, dateKey',
            aiRequestMetrics: '++id, timestamp, provider, model, outcome, isFreeModel',
            skillMastery: '++id, skillTag, state, score, updatedAt'
        });
        this.version(12).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used',
            fsrsCards: '++id, questionHash, due, state',
            playerProfile: '++id',
            learningEvents: '++id, timestamp, source, eventType, questionHash, skillTag',
            learningTasks: '++id, taskId, metric, status, periodStart, periodEnd, updatedAt, [taskId+periodStart]',
            studyActionExecutions: '++id, actionId, dateKey, status, updatedAt, [actionId+dateKey]',
            guardianDashboardEvents: '++id, timestamp, eventType, dateKey',
            aiRequestMetrics: '++id, timestamp, provider, model, outcome, isFreeModel',
            sessionRecoveryEvents: '++id, timestamp, eventType, hasSave',
            skillMastery: '++id, skillTag, state, score, updatedAt'
        });
        this.version(13).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used',
            fsrsCards: '++id, questionHash, due, state',
            playerProfile: '++id',
            learningEvents: '++id, timestamp, source, eventType, questionHash, skillTag, learningObjectiveId, causeTag',
            learningTasks: '++id, taskId, metric, status, periodStart, periodEnd, updatedAt, [taskId+periodStart]',
            studyActionExecutions: '++id, actionId, dateKey, status, updatedAt, [actionId+dateKey]',
            guardianDashboardEvents: '++id, timestamp, eventType, dateKey',
            aiRequestMetrics: '++id, timestamp, provider, model, outcome, isFreeModel',
            sessionRecoveryEvents: '++id, timestamp, eventType, hasSave',
            skillMastery: '++id, skillTag, state, score, updatedAt'
        });
        this.version(14).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used',
            fsrsCards: '++id, questionHash, due, state',
            playerProfile: '++id',
            learningEvents: '++id, timestamp, source, eventType, questionHash, skillTag, learningObjectiveId, causeTag',
            learningTasks: '++id, taskId, metric, status, periodStart, periodEnd, updatedAt, [taskId+periodStart]',
            studyActionExecutions: '++id, actionId, dateKey, status, updatedAt, [actionId+dateKey]',
            guardianDashboardEvents: '++id, timestamp, eventType, dateKey',
            aiRequestMetrics: '++id, timestamp, provider, model, outcome, isFreeModel',
            sessionRecoveryEvents: '++id, timestamp, eventType, hasSave',
            skillMastery: '++id, skillTag, state, score, updatedAt',
            objectiveMastery: '++id, objectiveId, state, score, updatedAt, nextReviewAt',
            practicePlanRuns: '++id, planId, dateKey, status, updatedAt, [planId+dateKey]'
        });
        this.version(CURRENT_DB_SCHEMA_VERSION).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used',
            fsrsCards: '++id, questionHash, due, state',
            playerProfile: '++id',
            learningEvents: '++id, timestamp, source, eventType, questionHash, skillTag, learningObjectiveId, causeTag',
            learningTasks: '++id, taskId, metric, status, periodStart, periodEnd, updatedAt, [taskId+periodStart]',
            studyActionExecutions: '++id, actionId, dateKey, status, updatedAt, [actionId+dateKey]',
            guardianDashboardEvents: '++id, timestamp, eventType, dateKey',
            aiRequestMetrics: '++id, timestamp, provider, model, outcome, isFreeModel',
            sessionRecoveryEvents: '++id, timestamp, eventType, hasSave',
            skillMastery: '++id, skillTag, state, score, updatedAt',
            objectiveMastery: '++id, objectiveId, state, score, updatedAt, nextReviewAt',
            practicePlanRuns: '++id, planId, dateKey, status, updatedAt, [planId+dateKey]',
            contentReviews: '++id, &contentKey, status, sourceType, updatedAt'
        }).upgrade(async (transaction) => {
            await transaction.table('objectiveMastery').toCollection().modify((record: ObjectiveMasteryRecord) => {
                record.qualifiedAttempts ??= 0;
                record.qualifiedCorrect ??= 0;
                record.independentAttempts ??= 0;
                record.delayedProbeAttempts ??= 0;
                record.delayedProbeCorrect ??= 0;
                record.evidenceModelVersion = 1;
                if (record.state === 'mastered') record.state = 'consolidated';
            });
        });
    }
}

export const db = new WordQuestDB();

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const TASK_EVIDENCE_LIMIT = 5;
export const QUESTION_CACHE_TTL_MS = DEFAULT_QUESTION_CACHE_POLICY.ttlMs;
export const QUESTION_CACHE_MAX_TOTAL = DEFAULT_QUESTION_CACHE_POLICY.maxTotal;
export const QUESTION_CACHE_MAX_PER_CONTEXT = DEFAULT_QUESTION_CACHE_POLICY.maxPerContext;

interface LearningTaskBlueprint {
    taskId: string;
    metric: LearningTaskMetric;
    title: string;
    description: string;
    goal: number;
    rewardXp: number;
    rewardGold: number;
}

const WEEKLY_TASK_BLUEPRINTS: LearningTaskBlueprint[] = [
    {
        taskId: 'daily_champion_weekly',
        metric: 'daily_sessions',
        title: 'Daily Champion',
        description: 'Complete 3 daily challenges this week.',
        goal: 3,
        rewardXp: 45,
        rewardGold: 30
    },
    {
        taskId: 'srs_guardian_weekly',
        metric: 'srs_answers',
        title: 'SRS Guardian',
        description: 'Finish 12 SRS review answers this week.',
        goal: 12,
        rewardXp: 60,
        rewardGold: 35
    },
    {
        taskId: 'battle_precision_weekly',
        metric: 'battle_correct',
        title: 'Battle Precision',
        description: 'Get 15 correct battle answers this week.',
        goal: 15,
        rewardXp: 80,
        rewardGold: 45
    }
];

function toDayKey(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
}

interface WindowRange {
    start: number;
    end: number;
}

function getWindowRange(now: number, windowDays: number, offsetWindows = 0): WindowRange {
    const span = windowDays * DAY_MS;
    const end = now - (offsetWindows * span);
    const start = end - span;
    return { start, end };
}

function filterEventsInRange<T extends { timestamp: number }>(events: T[], range: WindowRange): T[] {
    return events.filter((event) => event.timestamp > range.start && event.timestamp <= range.end);
}

function createMetricRow(input: {
    numerator: number;
    denominator: number;
    previousNumerator: number;
    previousDenominator: number;
    target: number;
    targetType: EngagementMetricRow['targetType'];
    minDenominator?: number;
}): EngagementMetricRow {
    const {
        numerator,
        denominator,
        previousNumerator,
        previousDenominator,
        target,
        targetType,
        minDenominator = 3
    } = input;

    const currentRate = denominator > 0 ? numerator / denominator : 0;
    const previousRate = previousDenominator > 0 ? previousNumerator / previousDenominator : 0;
    const absoluteDelta = currentRate - previousRate;
    const relativeDelta = previousRate > 0 ? absoluteDelta / previousRate : 0;

    let status: EngagementMetricStatus = 'not_met';
    if (denominator < minDenominator) {
        status = 'insufficient';
    } else if (targetType === 'absolute_rate') {
        status = currentRate >= target ? 'met' : 'not_met';
    } else if (previousDenominator < minDenominator || (targetType === 'relative_lift' && previousRate <= 0)) {
        status = 'insufficient';
    } else if (targetType === 'absolute_lift') {
        status = absoluteDelta >= target ? 'met' : 'not_met';
    } else {
        status = relativeDelta >= target ? 'met' : 'not_met';
    }

    return {
        currentRate,
        previousRate,
        absoluteDelta,
        relativeDelta,
        numerator,
        denominator,
        previousNumerator,
        previousDenominator,
        target,
        targetType,
        status
    };
}

function computeDailyParticipationMetric(events: LearningEvent[], now: number, windowDays: number): EngagementMetricRow {
    const current = filterEventsInRange(events, getWindowRange(now, windowDays, 0));
    const previous = filterEventsInRange(events, getWindowRange(now, windowDays, 1));

    const currentActive = new Set(current.map((event) => toDayKey(event.timestamp)));
    const currentDaily = new Set(
        current
            .filter((event) => event.source === 'daily' && event.eventType === 'session_complete')
            .map((event) => toDayKey(event.timestamp))
    );
    const previousActive = new Set(previous.map((event) => toDayKey(event.timestamp)));
    const previousDaily = new Set(
        previous
            .filter((event) => event.source === 'daily' && event.eventType === 'session_complete')
            .map((event) => toDayKey(event.timestamp))
    );

    return createMetricRow({
        numerator: currentDaily.size,
        denominator: currentActive.size,
        previousNumerator: previousDaily.size,
        previousDenominator: previousActive.size,
        target: 0.15,
        targetType: 'relative_lift'
    });
}

function computeWeeklyTaskCompletionMetric(events: LearningEvent[], now: number): EngagementMetricRow {
    const currentTasks = buildWeeklyLearningTasksFromEvents(events, now);
    const previousTasks = buildWeeklyLearningTasksFromEvents(events, now - WEEK_MS);

    const currentCompleted = currentTasks.filter((task) => task.status === 'completed').length;
    const previousCompleted = previousTasks.filter((task) => task.status === 'completed').length;

    return createMetricRow({
        numerator: currentCompleted,
        denominator: currentTasks.length,
        previousNumerator: previousCompleted,
        previousDenominator: previousTasks.length,
        target: 0.6,
        targetType: 'absolute_rate',
        minDenominator: 1
    });
}

function computeRetentionRate(events: LearningEvent[], range: WindowRange): { retained: number; eligible: number; } {
    const inRange = filterEventsInRange(events, range);
    const activeDays = Array.from(new Set(inRange.map((event) => toDayKey(event.timestamp)))).sort();
    const activeSet = new Set(activeDays);
    let eligible = 0;
    let retained = 0;

    activeDays.forEach((dayKey) => {
        const dayStart = new Date(`${dayKey}T00:00:00.000Z`).getTime();
        const nextDayKey = toDayKey(dayStart + DAY_MS);
        const nextDayStart = dayStart + DAY_MS;
        if (nextDayStart > range.end) return;
        eligible += 1;
        if (activeSet.has(nextDayKey)) retained += 1;
    });

    return { retained, eligible };
}

function computeNextDayRetentionMetric(events: LearningEvent[], now: number, windowDays: number): EngagementMetricRow {
    const currentRange = getWindowRange(now, windowDays, 0);
    const previousRange = getWindowRange(now, windowDays, 1);
    const current = computeRetentionRate(events, currentRange);
    const previous = computeRetentionRate(events, previousRange);

    return createMetricRow({
        numerator: current.retained,
        denominator: current.eligible,
        previousNumerator: previous.retained,
        previousDenominator: previous.eligible,
        target: 0.05,
        targetType: 'absolute_lift'
    });
}

// ========== Player Profile Functions ==========

function getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
}

function getDefaultProfile(): GlobalPlayerProfile {
    return {
        totalXp: 0,
        globalLevel: 1,
        totalGold: 0,
        dailyStreak: 0,
        lastActiveDate: '',
        dailyXpGoal: 50,
        dailyXpEarned: 0,
        wordsLearned: 0,
        lessonsCompleted: 0,
        totalStudyMinutes: 0,
        perfectLessons: 0,
        vocabMastery: 0,
        grammarMastery: 0,
        readingMastery: 0,
        ownedRelics: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
}

export async function getPlayerProfile(): Promise<GlobalPlayerProfile> {
    const existing = await db.playerProfile.toCollection().first();
    if (existing) return existing;

    // Create new profile
    const profile = getDefaultProfile();
    const id = await db.playerProfile.add(profile);
    return { ...profile, id };
}

interface MasteryDeltas {
    vocab?: number;
    grammar?: number;
    reading?: number;
}

export type PlayerProfileUpdates = Partial<GlobalPlayerProfile> & {
    masteryDeltas?: MasteryDeltas;
};

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export async function updatePlayerProfile(updates: PlayerProfileUpdates): Promise<GlobalPlayerProfile> {
    const profile = await getPlayerProfile();
    const today = getTodayKey();
    const nextUpdates: PlayerProfileUpdates = { ...updates };

    // Handle daily streak logic
    if (nextUpdates.dailyXpEarned !== undefined) {
        const lastDate = profile.lastActiveDate;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = yesterday.toISOString().split('T')[0];

        if (lastDate === today) {
            // Same day, just add XP
            nextUpdates.dailyXpEarned = profile.dailyXpEarned + (nextUpdates.dailyXpEarned || 0);
        } else if (lastDate === yesterdayKey) {
            // Consecutive day, increment streak
            nextUpdates.dailyStreak = profile.dailyStreak + 1;
            nextUpdates.lastActiveDate = today;
        } else if (lastDate !== today) {
            // Streak broken or first day
            nextUpdates.dailyStreak = 1;
            nextUpdates.lastActiveDate = today;
        }
    }

    // Calculate level from XP
    if (nextUpdates.totalXp !== undefined) {
        const newXp = profile.totalXp + nextUpdates.totalXp;
        nextUpdates.totalXp = newXp;
        nextUpdates.globalLevel = calculateLevel(newXp);
    }

    // Add gold (don't replace)
    if (nextUpdates.totalGold !== undefined) {
        nextUpdates.totalGold = profile.totalGold + nextUpdates.totalGold;
    }

    // Atomic additive updates for core counters
    if (nextUpdates.wordsLearned !== undefined) {
        nextUpdates.wordsLearned = profile.wordsLearned + nextUpdates.wordsLearned;
    }
    if (nextUpdates.lessonsCompleted !== undefined) {
        nextUpdates.lessonsCompleted = profile.lessonsCompleted + nextUpdates.lessonsCompleted;
    }
    if (nextUpdates.totalStudyMinutes !== undefined) {
        nextUpdates.totalStudyMinutes = profile.totalStudyMinutes + nextUpdates.totalStudyMinutes;
    }
    if (nextUpdates.perfectLessons !== undefined) {
        nextUpdates.perfectLessons = profile.perfectLessons + nextUpdates.perfectLessons;
    }

    if (nextUpdates.masteryDeltas) {
        const deltas = nextUpdates.masteryDeltas;
        nextUpdates.vocabMastery = clamp(profile.vocabMastery + (deltas.vocab || 0), 0, 100);
        nextUpdates.grammarMastery = clamp(profile.grammarMastery + (deltas.grammar || 0), 0, 100);
        nextUpdates.readingMastery = clamp(profile.readingMastery + (deltas.reading || 0), 0, 100);
    }

    const { masteryDeltas, ...persistableUpdates } = nextUpdates;
    void masteryDeltas;

    const merged = {
        ...profile,
        ...persistableUpdates,
        updatedAt: Date.now()
    };

    await db.playerProfile.update(profile.id!, merged);
    return merged;
}

export function getWeeklyWindow(now = Date.now()): { periodStart: number; periodEnd: number; } {
    const localDay = new Date(now);
    localDay.setHours(0, 0, 0, 0);
    const weekday = (localDay.getDay() + 6) % 7; // Monday=0 ... Sunday=6
    localDay.setDate(localDay.getDate() - weekday);
    const periodStart = localDay.getTime();
    return {
        periodStart,
        periodEnd: periodStart + WEEK_MS
    };
}

export function eventMatchesTaskMetric(metric: LearningTaskMetric, event: LearningEvent): boolean {
    if (metric === 'daily_sessions') {
        return event.eventType === 'session_complete' && event.source === 'daily';
    }
    if (metric === 'srs_answers') {
        return event.eventType === 'answer' && event.source === 'srs';
    }
    return event.eventType === 'answer' && event.source === 'battle' && event.result === 'correct';
}

function toTaskEvidence(event: LearningEvent): LearningTaskEvidence {
    return {
        timestamp: event.timestamp,
        source: event.source,
        eventType: event.eventType,
        questionHash: event.questionHash,
        skillTag: event.skillTag,
        learningObjectiveId: event.learningObjectiveId,
        attemptKind: event.attemptKind,
        supportLevel: event.supportLevel,
        causeTag: event.causeTag,
        result: event.result
    };
}

type ExistingTaskMap = Record<string, LearningTask | undefined>;

export function buildWeeklyLearningTasksFromEvents(
    events: LearningEvent[],
    now = Date.now(),
    existingTaskMap: ExistingTaskMap = {}
): LearningTask[] {
    const { periodStart, periodEnd } = getWeeklyWindow(now);
    const inWindow = events.filter((event) => event.timestamp >= periodStart && event.timestamp < periodEnd);

    return WEEKLY_TASK_BLUEPRINTS.map((task) => {
        const existing = existingTaskMap[task.taskId];
        const matched = inWindow.filter((event) => eventMatchesTaskMetric(task.metric, event));
        const progress = Math.min(task.goal, matched.length);
        const status: LearningTaskStatus = progress >= task.goal
            ? 'completed'
            : now >= periodEnd
                ? 'expired'
                : 'active';
        const completedAt = status === 'completed'
            ? (existing?.completedAt || now)
            : undefined;
        return {
            id: existing?.id,
            taskId: task.taskId,
            metric: task.metric,
            title: task.title,
            description: task.description,
            goal: task.goal,
            progress,
            status,
            periodStart,
            periodEnd,
            rewardXp: task.rewardXp,
            rewardGold: task.rewardGold,
            evidence: matched
                .slice(-TASK_EVIDENCE_LIMIT)
                .reverse()
                .map(toTaskEvidence),
            completedAt,
            rewardGrantedAt: existing?.rewardGrantedAt,
            updatedAt: now
        };
    });
}

function sortLearningTasks(tasks: LearningTask[]): LearningTask[] {
    const statusRank: Record<LearningTaskStatus, number> = {
        active: 0,
        completed: 1,
        expired: 2
    };
    return [...tasks].sort((a, b) => {
        if (statusRank[a.status] !== statusRank[b.status]) {
            return statusRank[a.status] - statusRank[b.status];
        }
        const aRatio = a.goal > 0 ? a.progress / a.goal : 0;
        const bRatio = b.goal > 0 ? b.progress / b.goal : 0;
        if (bRatio !== aRatio) return bRatio - aRatio;
        return a.taskId.localeCompare(b.taskId);
    });
}

export async function syncWeeklyLearningTasks(now = Date.now()): Promise<LearningTask[]> {
    const { periodStart, periodEnd } = getWeeklyWindow(now);

    const [events, existingCurrent, staleActive] = await Promise.all([
        db.learningEvents
            .where('timestamp')
            .between(periodStart, Math.min(now, periodEnd - 1), true, true)
            .toArray(),
        db.learningTasks
            .where('periodStart')
            .equals(periodStart)
            .toArray(),
        db.learningTasks
            .where('status')
            .equals('active')
            .and((row) => row.periodEnd <= now)
            .toArray()
    ]);

    if (staleActive.length > 0) {
        await Promise.all(staleActive.map((row) => db.learningTasks.update(row.id!, {
            status: row.progress >= row.goal ? 'completed' : 'expired',
            updatedAt: now
        })));
    }

    const existingMap = existingCurrent.reduce((acc, row) => {
        acc[row.taskId] = row;
        return acc;
    }, {} as ExistingTaskMap);

    const computed = buildWeeklyLearningTasksFromEvents(events, now, existingMap);
    await db.learningTasks.bulkPut(computed);

    const refreshed = await db.learningTasks
        .where('periodStart')
        .equals(periodStart)
        .toArray();

    const newlyCompleted = refreshed.filter((task) => task.status === 'completed' && !task.rewardGrantedAt);
    for (const task of newlyCompleted) {
        await updatePlayerProfile({
            totalXp: task.rewardXp,
            totalGold: task.rewardGold
        });
        await db.learningTasks.update(task.id!, {
            rewardGrantedAt: now,
            updatedAt: now
        });
    }

    const finalRows = await db.learningTasks
        .where('periodStart')
        .equals(periodStart)
        .toArray();
    return sortLearningTasks(finalRows);
}

export async function getWeeklyLearningTasks(now = Date.now()): Promise<LearningTask[]> {
    return syncWeeklyLearningTasks(now);
}

export function computeEngagementSnapshotFromEvents(
    events: LearningEvent[],
    now = Date.now(),
    windowDays = 14
): EngagementSnapshot {
    return {
        windowDays,
        generatedAt: now,
        dailyChallengeParticipation: computeDailyParticipationMetric(events, now, windowDays),
        weeklyTaskCompletion: computeWeeklyTaskCompletionMetric(events, now),
        nextDayRetention: computeNextDayRetentionMetric(events, now, windowDays)
    };
}

export async function getEngagementSnapshot(windowDays = 14, lookbackDays = 120, now = Date.now()): Promise<EngagementSnapshot> {
    const start = now - (lookbackDays * DAY_MS);
    const events = await db.learningEvents
        .where('timestamp')
        .aboveOrEqual(start)
        .toArray();
    return computeEngagementSnapshotFromEvents(events, now, windowDays);
}

export function dateKeyFromTimestamp(timestamp: number): string {
    return new Date(timestamp).toISOString().slice(0, 10);
}

export async function upsertStudyActionExecution(input: {
    actionId: string;
    status: StudyActionStatus;
    priority: StudyActionPriority;
    estimatedMinutes: number;
    now?: number;
}): Promise<StudyActionExecution> {
    const now = input.now ?? Date.now();
    const dateKey = dateKeyFromTimestamp(now);
    const existing = await db.studyActionExecutions
        .where('[actionId+dateKey]')
        .equals([input.actionId, dateKey])
        .first();

    const payload: StudyActionExecution = {
        id: existing?.id,
        actionId: input.actionId,
        dateKey,
        status: input.status,
        priority: input.priority,
        estimatedMinutes: input.estimatedMinutes,
        source: 'guardian_dashboard',
        completedAt: input.status === 'completed'
            ? (existing?.completedAt || now)
            : undefined,
        updatedAt: now
    };

    if (existing?.id) {
        await db.studyActionExecutions.update(existing.id, payload);
        return payload;
    }

    const id = await db.studyActionExecutions.add(payload);
    return { ...payload, id };
}

export async function getStudyActionExecutions(dateKey = dateKeyFromTimestamp(Date.now())): Promise<StudyActionExecution[]> {
    const rows = await db.studyActionExecutions
        .where('dateKey')
        .equals(dateKey)
        .toArray();
    return rows.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function computeStudyActionExecutionSummaryFromRows(
    rows: StudyActionExecution[],
    windowDays = 14,
    now = Date.now()
): StudyActionExecutionSummary {
    const start = now - (windowDays * DAY_MS);
    const inWindow = rows.filter((row) => row.updatedAt >= start && row.updatedAt <= now);
    const latestByActionDay = new Map<string, StudyActionExecution>();
    inWindow.forEach((row) => {
        const key = `${row.actionId}::${row.dateKey}`;
        const existing = latestByActionDay.get(key);
        if (!existing || row.updatedAt > existing.updatedAt) {
            latestByActionDay.set(key, row);
        }
    });

    const latestRows = Array.from(latestByActionDay.values());
    const completed = latestRows.filter((row) => row.status === 'completed').length;
    const skipped = latestRows.filter((row) => row.status === 'skipped').length;
    const pending = latestRows.filter((row) => row.status === 'pending').length;
    const totalTracked = latestRows.length;
    const executionRate = totalTracked > 0 ? completed / totalTracked : 0;

    return {
        windowDays,
        completed,
        skipped,
        pending,
        totalTracked,
        executionRate
    };
}

export function computeStudyActionExecutionGoalFromRows(
    rows: StudyActionExecution[],
    windowDays = 14,
    now = Date.now(),
    targetRate = 0.4
): StudyActionExecutionGoalSnapshot {
    const current = computeStudyActionExecutionSummaryFromRows(rows, windowDays, now);
    const previous = computeStudyActionExecutionSummaryFromRows(rows, windowDays, now - (windowDays * DAY_MS));

    return {
        windowDays,
        generatedAt: now,
        executionRate: createMetricRow({
            numerator: current.completed,
            denominator: current.totalTracked,
            previousNumerator: previous.completed,
            previousDenominator: previous.totalTracked,
            target: targetRate,
            targetType: 'absolute_rate'
        })
    };
}

export async function getStudyActionExecutionSummary(windowDays = 14, now = Date.now()): Promise<StudyActionExecutionSummary> {
    const start = now - (windowDays * DAY_MS);
    const rows = await db.studyActionExecutions
        .where('updatedAt')
        .aboveOrEqual(start)
        .toArray();
    return computeStudyActionExecutionSummaryFromRows(rows, windowDays, now);
}

export async function getStudyActionExecutionGoalSnapshot(
    windowDays = 14,
    lookbackDays = 84,
    now = Date.now(),
    targetRate = 0.4
): Promise<StudyActionExecutionGoalSnapshot> {
    const start = now - (lookbackDays * DAY_MS);
    const rows = await db.studyActionExecutions
        .where('updatedAt')
        .aboveOrEqual(start)
        .toArray();
    return computeStudyActionExecutionGoalFromRows(rows, windowDays, now, targetRate);
}

export function computeGuardianAcceptanceSnapshotFromEvents(
    events: GuardianDashboardEvent[],
    now = Date.now(),
    windowDays = 7,
    targetLift = 0.2
): GuardianAcceptanceSnapshot {
    const current = filterEventsInRange(events, getWindowRange(now, windowDays, 0));
    const previous = filterEventsInRange(events, getWindowRange(now, windowDays, 1));
    const currentActiveDays = new Set(current.map((event) => event.dateKey)).size;
    const previousActiveDays = new Set(previous.map((event) => event.dateKey)).size;

    return {
        windowDays,
        generatedAt: now,
        weeklyActiveRate: createMetricRow({
            numerator: currentActiveDays,
            denominator: windowDays,
            previousNumerator: previousActiveDays,
            previousDenominator: windowDays,
            target: targetLift,
            targetType: 'relative_lift',
            minDenominator: 1
        })
    };
}

export async function getGuardianAcceptanceSnapshot(
    windowDays = 7,
    lookbackDays = 60,
    now = Date.now(),
    targetLift = 0.2
): Promise<GuardianAcceptanceSnapshot> {
    const start = now - (lookbackDays * DAY_MS);
    const rows = await db.guardianDashboardEvents
        .where('timestamp')
        .aboveOrEqual(start)
        .toArray();
    return computeGuardianAcceptanceSnapshotFromEvents(rows, now, windowDays, targetLift);
}

export async function logGuardianDashboardEvent(
    eventType: GuardianDashboardEventType,
    timestamp = Date.now()
): Promise<void> {
    await db.guardianDashboardEvents.add({
        eventType,
        dateKey: dateKeyFromTimestamp(timestamp),
        timestamp
    });
}

export async function logAIRequestMetric(input: Omit<AIRequestMetric, 'id' | 'timestamp'> & { timestamp?: number; }): Promise<void> {
    await db.aiRequestMetrics.add({
        ...input,
        timestamp: input.timestamp ?? Date.now()
    });
}

function percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
    return sorted[index];
}

export function computeAIRequestMonitorSnapshotFromRows(
    rows: AIRequestMetric[],
    now = Date.now(),
    windowDays = 7
): AIRequestMonitorSnapshot {
    const currentRange = getWindowRange(now, windowDays, 0);
    const previousRange = getWindowRange(now, windowDays, 1);
    const current = filterEventsInRange(rows, currentRange);
    const previous = filterEventsInRange(rows, previousRange);

    const currentSuccess = current.filter((row) => row.outcome === 'success').length;
    const previousSuccess = previous.filter((row) => row.outcome === 'success').length;
    const currentNonRateLimited = current.filter((row) => row.rateLimitHits === 0).length;
    const previousNonRateLimited = previous.filter((row) => row.rateLimitHits === 0).length;
    const currentLatency = current.map((row) => row.latencyMs).filter((value) => value > 0);
    const retryRequests = current.filter((row) => row.retryCount > 0).length;

    const successRate = createMetricRow({
        numerator: currentSuccess,
        denominator: current.length,
        previousNumerator: previousSuccess,
        previousDenominator: previous.length,
        target: 0.9,
        targetType: 'absolute_rate',
        minDenominator: 5
    });
    const nonRateLimitedRate = createMetricRow({
        numerator: currentNonRateLimited,
        denominator: current.length,
        previousNumerator: previousNonRateLimited,
        previousDenominator: previous.length,
        target: 0.85,
        targetType: 'absolute_rate',
        minDenominator: 5
    });

    const totalRequests = current.length;
    const retryPressureRate = totalRequests > 0 ? retryRequests / totalRequests : 0;

    let status: AIRequestMonitorSnapshot['status'] = 'healthy';
    if (totalRequests < 5) {
        status = 'insufficient';
    } else {
        const failedTargets = [successRate.status, nonRateLimitedRate.status].filter((value) => value === 'not_met').length;
        const insufficientTargets = [successRate.status, nonRateLimitedRate.status].filter((value) => value === 'insufficient').length;
        if (failedTargets >= 2 || retryPressureRate >= 0.6) {
            status = 'critical';
        } else if (failedTargets >= 1 || insufficientTargets >= 1 || retryPressureRate >= 0.35) {
            status = 'warning';
        } else {
            status = 'healthy';
        }
    }

    return {
        windowDays,
        generatedAt: now,
        totalRequests,
        avgLatencyMs: currentLatency.length > 0
            ? Math.round(currentLatency.reduce((sum, value) => sum + value, 0) / currentLatency.length)
            : 0,
        p95LatencyMs: Math.round(percentile(currentLatency, 95)),
        successRate,
        nonRateLimitedRate,
        retryPressureRate,
        status
    };
}

export async function getAIRequestMonitorSnapshot(
    windowDays = 7,
    lookbackDays = 60,
    now = Date.now()
): Promise<AIRequestMonitorSnapshot> {
    const start = now - (lookbackDays * DAY_MS);
    const rows = await db.aiRequestMetrics
        .where('timestamp')
        .aboveOrEqual(start)
        .toArray();
    return computeAIRequestMonitorSnapshotFromRows(rows, now, windowDays);
}

export async function logSessionRecoveryEvent(
    eventType: SessionRecoveryEventType,
    input: {
        hasSave: boolean;
        savedAgeMs?: number;
        reason?: string;
        timestamp?: number;
    }
): Promise<void> {
    await db.sessionRecoveryEvents.add({
        eventType,
        hasSave: input.hasSave,
        savedAgeMs: input.savedAgeMs,
        reason: input.reason,
        timestamp: input.timestamp ?? Date.now()
    });
}

export function computeSessionRecoverySnapshotFromEvents(
    events: SessionRecoveryEvent[],
    now = Date.now(),
    windowDays = 14
): SessionRecoverySnapshot {
    const current = filterEventsInRange(events, getWindowRange(now, windowDays, 0));
    const previous = filterEventsInRange(events, getWindowRange(now, windowDays, 1));
    const currentAttempts = current.filter((event) => event.eventType === 'attempt').length;
    const currentSuccesses = current.filter((event) => event.eventType === 'success').length;
    const previousAttempts = previous.filter((event) => event.eventType === 'attempt').length;
    const previousSuccesses = previous.filter((event) => event.eventType === 'success').length;

    const successRate = createMetricRow({
        numerator: currentSuccesses,
        denominator: currentAttempts,
        previousNumerator: previousSuccesses,
        previousDenominator: previousAttempts,
        target: 0.85,
        targetType: 'absolute_rate',
        minDenominator: 3
    });

    let status: SessionRecoverySnapshot['status'] = 'healthy';
    if (currentAttempts < 3) {
        status = 'insufficient';
    } else if (successRate.status === 'not_met' && successRate.currentRate < 0.6) {
        status = 'critical';
    } else if (successRate.status === 'not_met' || successRate.status === 'insufficient') {
        status = 'warning';
    } else {
        status = 'healthy';
    }

    return {
        windowDays,
        generatedAt: now,
        attempts: currentAttempts,
        successRate,
        status
    };
}

export async function getSessionRecoverySnapshot(
    windowDays = 14,
    lookbackDays = 120,
    now = Date.now()
): Promise<SessionRecoverySnapshot> {
    const start = now - (lookbackDays * DAY_MS);
    const rows = await db.sessionRecoveryEvents
        .where('timestamp')
        .aboveOrEqual(start)
        .toArray();
    return computeSessionRecoverySnapshotFromEvents(rows, now, windowDays);
}

export async function logLearningEvent(event: Omit<LearningEvent, 'id' | 'timestamp'> & { timestamp?: number }): Promise<void> {
    const payload: LearningEvent = {
        ...event,
        timestamp: event.timestamp ?? Date.now()
    };
    await db.learningEvents.add(payload);
    if (payload.eventType === 'answer' || payload.eventType === 'session_complete') {
        try {
            await syncWeeklyLearningTasks(payload.timestamp);
        } catch (error) {
            console.error('syncWeeklyLearningTasks error', error);
        }
    }
}

function masteryStateFromScore(score: number, attempts: number, accuracy: number): MasteryState {
    if (attempts < 3) return 'new';
    if (score >= 86 && attempts >= 10 && accuracy >= 0.86) return 'mastered';
    if (score >= 68 && attempts >= 6 && accuracy >= 0.72) return 'consolidated';
    if (score >= 35) return 'learning';
    return 'new';
}

function smoothAccuracy(correct: number, attempts: number): number {
    // Beta prior (alpha=2,beta=2) to reduce volatility for low-sample skills.
    return (correct + 2) / (attempts + 4);
}

function transitionMasteryState(
    previousState: MasteryState,
    score: number,
    attempts: number,
    smoothedAccuracy: number
): MasteryState {
    if (attempts < 3) return 'new';

    if (previousState === 'mastered') {
        if (score < 74 || smoothedAccuracy < 0.72) return 'consolidated';
        return 'mastered';
    }

    if (previousState === 'consolidated') {
        if (score >= 86 && attempts >= 10 && smoothedAccuracy >= 0.86) return 'mastered';
        if (score < 52 || smoothedAccuracy < 0.58) return 'learning';
        return 'consolidated';
    }

    if (previousState === 'learning') {
        if (score >= 68 && attempts >= 6 && smoothedAccuracy >= 0.72) return 'consolidated';
        if (score < 22 && attempts >= 4) return 'new';
        return 'learning';
    }

    if (score >= 35 && attempts >= 3) return 'learning';
    return 'new';
}

export function computeMasteryUpdate(input: {
    previousScore: number;
    previousState: MasteryState;
    attempts: number;
    correct: number;
    result: LearningEventResult;
}): { score: number; state: MasteryState; smoothedAccuracy: number; } {
    const { previousScore, previousState, attempts, correct, result } = input;
    const smoothed = smoothAccuracy(correct, attempts);
    const targetScore = Math.round(smoothed * 100);
    const weight = attempts < 8 ? 0.35 : 0.55;
    const resultBias = result === 'correct' ? 4 : -5;
    const score = clamp(Math.round(previousScore * (1 - weight) + targetScore * weight + resultBias), 0, 100);
    const state = transitionMasteryState(previousState, score, attempts, smoothed);
    return {
        score,
        state,
        smoothedAccuracy: smoothed
    };
}

function emptyAttemptsByMode(): ObjectiveAttemptsByMode {
    return { choice: 0, 'fill-blank': 0, typing: 0 };
}

function objectiveModeWeight(mode?: LearningEventMode): number {
    if (mode === 'typing') return 1.08;
    if (mode === 'fill-blank') return 0.92;
    return 0.68;
}

function objectiveStateFromEvidence(input: {
    previousState: MasteryState;
    score: number;
    qualifiedAttempts: number;
    qualifiedAccuracy: number;
    independentAttempts: number;
    delayedProbeAttempts: number;
    delayedProbeAccuracy: number;
    transferAttempts: number;
    transferAccuracy: number;
    confidence: number;
}): MasteryState {
    const {
        previousState,
        score,
        qualifiedAttempts,
        qualifiedAccuracy,
        independentAttempts,
        delayedProbeAttempts,
        delayedProbeAccuracy,
        transferAttempts,
        transferAccuracy,
        confidence
    } = input;
    if (qualifiedAttempts < 3 || confidence < 0.18) return 'new';

    if (previousState === 'mastered') {
        if (score < 74 || qualifiedAccuracy < 0.7 || confidence < 0.5) return 'consolidated';
        return 'mastered';
    }

    if (score >= 86 && qualifiedAttempts >= 10 && independentAttempts >= 3 && qualifiedAccuracy >= 0.84 &&
        delayedProbeAttempts >= 2 && delayedProbeAccuracy >= 0.75 && transferAttempts >= 2 &&
        transferAccuracy >= 0.75 && confidence >= 0.68) {
        return 'mastered';
    }
    if (score >= 68 && qualifiedAttempts >= 6 && independentAttempts >= 3 && qualifiedAccuracy >= 0.68 && confidence >= 0.42) {
        return 'consolidated';
    }
    if (score >= 32 || previousState === 'learning') return 'learning';
    return 'new';
}

export function computeObjectiveMasteryUpdate(input: {
    previousScore: number;
    previousState: MasteryState;
    attempts: number;
    correct: number;
    qualifiedAttempts?: number;
    qualifiedCorrect?: number;
    independentAttempts?: number;
    attemptsByMode: ObjectiveAttemptsByMode;
    transferAttempts: number;
    transferCorrect: number;
    delayedProbeAttempts?: number;
    delayedProbeCorrect?: number;
    hintCount: number;
    result: LearningEventResult;
    mode?: LearningEventMode;
    attemptKind?: LearningEventAttemptKind;
    supportLevel?: LearningEventSupportLevel;
    latencyMs?: number;
    evidenceStrength?: EvidenceStrength;
}): { score: number; state: MasteryState; confidence: number; hintRate: number; nextReviewDelayMs: number; } {
    const smoothed = smoothAccuracy(input.correct, input.attempts);
    const qualifiedAttempts = input.qualifiedAttempts ?? input.attempts;
    const qualifiedCorrect = input.qualifiedCorrect ?? input.correct;
    const qualifiedAccuracy = smoothAccuracy(qualifiedCorrect, qualifiedAttempts);
    const independentAttempts = input.independentAttempts ?? qualifiedAttempts;
    const delayedProbeAttempts = input.delayedProbeAttempts ?? 0;
    const delayedProbeCorrect = input.delayedProbeCorrect ?? 0;
    const delayedProbeAccuracy = delayedProbeAttempts > 0 ? delayedProbeCorrect / delayedProbeAttempts : 0;
    const evidenceStrength = input.evidenceStrength || (
        input.hintCount > 0 || (input.supportLevel ?? 3) >= 2
            ? 'supported'
            : input.attemptKind === 'transfer'
                ? 'transfer-independent'
                : 'independent'
    );
    const independentEvidence = isIndependentEvidence(evidenceStrength);
    const modeWeight = objectiveModeWeight(input.mode);
    const isTransfer = input.attemptKind === 'transfer';
    const transferAccuracy = input.transferAttempts > 0 ? input.transferCorrect / input.transferAttempts : 0;
    const transferBoost = isTransfer && input.result === 'correct' ? 7 : transferAccuracy * 8;
    const supportPenalty = typeof input.supportLevel === 'number' ? (input.supportLevel / 3) * 7 : 3;
    const hintRate = input.attempts > 0 ? input.hintCount / input.attempts : 0;
    const hintPenalty = Math.min(12, hintRate * 24);
    const latencyPenalty = input.latencyMs && input.latencyMs > 20_000 ? 5 : input.latencyMs && input.latencyMs > 12_000 ? 2 : 0;
    const resultBias = input.result === 'correct' ? 4 * modeWeight : -7;
    const evidenceAccuracy = independentEvidence ? qualifiedAccuracy : smoothed;
    const targetScore = clamp(Math.round((evidenceAccuracy * 100 * modeWeight) + transferBoost - supportPenalty - hintPenalty - latencyPenalty), 0, 100);
    const baseWeight = qualifiedAttempts < 8 ? 0.34 : 0.5;
    const weight = independentEvidence ? baseWeight : Math.min(0.16, baseWeight);
    const rawScore = clamp(Math.round(input.previousScore * (1 - weight) + targetScore * weight + resultBias * (independentEvidence ? 1 : 0.35)), 0, 100);
    const score = independentEvidence ? rawScore : Math.min(67, rawScore);

    const productiveAttempts = (input.attemptsByMode.typing || 0) + (input.attemptsByMode['fill-blank'] || 0);
    const productiveRatio = input.attempts > 0 ? productiveAttempts / input.attempts : 0;
    const transferRatio = input.attempts > 0 ? input.transferAttempts / input.attempts : 0;
    const confidence = clamp(
        Number((Math.min(1, qualifiedAttempts / 10) * 0.35 +
            productiveRatio * 0.25 +
            transferRatio * 0.25 +
            Math.min(1, qualifiedAccuracy) * 0.2 -
            hintRate * 0.18 -
            ((input.supportLevel || 0) / 3) * 0.08).toFixed(3)),
        0.05,
        0.98
    );

    const state = objectiveStateFromEvidence({
        previousState: input.previousState,
        score,
        qualifiedAttempts,
        qualifiedAccuracy,
        independentAttempts,
        delayedProbeAttempts,
        delayedProbeAccuracy,
        transferAttempts: input.transferAttempts,
        transferAccuracy,
        confidence
    });

    const nextReviewDelayMs = confidence >= 0.72 && score >= 80
        ? 6 * DAY_MS
        : confidence >= 0.42 && score >= 60
            ? 3 * DAY_MS
            : DAY_MS;

    return { score, state, confidence, hintRate, nextReviewDelayMs };
}

export async function updateObjectiveMastery(input: {
    objectiveId?: string | null;
    skillTag?: string | null;
    type?: StoredQuestionType;
    question?: string | null;
    result: LearningEventResult;
    mode?: LearningEventMode;
    attemptKind?: LearningEventAttemptKind;
    supportLevel?: LearningEventSupportLevel;
    hintUsed?: boolean;
    latencyMs?: number;
    evidenceStrength?: EvidenceStrength;
    assessmentRole?: AssessmentRole;
    reviewerStatus?: ContentReviewerStatus;
    objectiveClassificationStatus?: ObjectiveClassificationStatus;
    now?: number;
}): Promise<ObjectiveMasteryRecord | null> {
    const now = input.now ?? Date.now();
    const objectiveId = getLearningObjective(input.objectiveId)?.objectiveId || canonicalizeLearningObjective({
        suggestedObjectiveId: input.objectiveId,
        skillTag: input.skillTag,
        type: input.type,
        question: input.question
    }).objectiveId;
    if (!objectiveId) return null;
    const assessmentRole = resolveAssessmentRole({
        assessmentRole: input.assessmentRole,
        attemptKind: input.attemptKind
    });
    const evidenceStrength = input.evidenceStrength || evidenceStrengthForAttempt({
        learningObjectiveId: objectiveId,
        objectiveClassificationStatus: input.objectiveClassificationStatus || 'canonical',
        assessmentRole,
        reviewerStatus: input.reviewerStatus || 'unreviewed',
        supportLevel: input.supportLevel,
        hintUsed: input.hintUsed,
        transferDistance: assessmentRole === 'transfer' ? 'near' : 'same-context'
    });
    if (evidenceStrength === 'no-credit') return null;
    const existing = await db.objectiveMastery.where('objectiveId').equals(objectiveId).first();
    const attemptsByMode = { ...(existing?.attemptsByMode || emptyAttemptsByMode()) };
    const mode = input.mode || 'choice';
    attemptsByMode[mode] = (attemptsByMode[mode] || 0) + 1;

    const attempts = (existing?.attempts || 0) + 1;
    const correct = (existing?.correct || 0) + (input.result === 'correct' ? 1 : 0);
    const independentEvidence = isIndependentEvidence(evidenceStrength);
    const qualifiedAttempts = (existing?.qualifiedAttempts || 0) + (independentEvidence ? 1 : 0);
    const qualifiedCorrect = (existing?.qualifiedCorrect || 0) + (independentEvidence && input.result === 'correct' ? 1 : 0);
    const independentAttempts = (existing?.independentAttempts || 0) + (evidenceStrength === 'independent' ? 1 : 0);
    const isTransfer = evidenceStrength === 'transfer-independent';
    const transferAttempts = (existing?.transferAttempts || 0) + (isTransfer ? 1 : 0);
    const transferCorrect = (existing?.transferCorrect || 0) + (isTransfer && input.result === 'correct' ? 1 : 0);
    const isDelayedProbe = evidenceStrength === 'delayed-independent';
    const delayedProbeAttempts = (existing?.delayedProbeAttempts || 0) + (isDelayedProbe ? 1 : 0);
    const delayedProbeCorrect = (existing?.delayedProbeCorrect || 0) + (isDelayedProbe && input.result === 'correct' ? 1 : 0);
    const hintCount = (existing?.hintCount || 0) + (input.hintUsed ? 1 : 0);

    const update = computeObjectiveMasteryUpdate({
        previousScore: existing?.score ?? 20,
        previousState: existing?.state || 'new',
        attempts,
        correct,
        qualifiedAttempts,
        qualifiedCorrect,
        independentAttempts,
        attemptsByMode,
        transferAttempts,
        transferCorrect,
        delayedProbeAttempts,
        delayedProbeCorrect,
        hintCount,
        result: input.result,
        mode,
        attemptKind: input.attemptKind,
        supportLevel: input.supportLevel,
        latencyMs: input.latencyMs,
        evidenceStrength
    });

    const nextRecord: ObjectiveMasteryRecord = {
        id: existing?.id,
        objectiveId,
        score: update.score,
        state: update.state,
        attempts,
        correct,
        qualifiedAttempts,
        qualifiedCorrect,
        independentAttempts,
        attemptsByMode,
        transferAttempts,
        transferCorrect,
        delayedProbeAttempts,
        delayedProbeCorrect,
        hintCount,
        hintRate: update.hintRate,
        lastReviewedAt: now,
        nextReviewAt: now + update.nextReviewDelayMs,
        confidence: update.confidence,
        updatedAt: now,
        evidenceModelVersion: 1
    };

    if (existing?.id) {
        await db.objectiveMastery.update(existing.id, nextRecord);
        return nextRecord;
    }

    const id = await db.objectiveMastery.add(nextRecord);
    return { ...nextRecord, id };
}

export async function updateSkillMastery(skillTag: string, result: LearningEventResult): Promise<SkillMasteryRecord> {
    const now = Date.now();
    const existing = await db.skillMastery.where('skillTag').equals(skillTag).first();

    const attempts = (existing?.attempts || 0) + 1;
    const correct = (existing?.correct || 0) + (result === 'correct' ? 1 : 0);
    const previousScore = existing?.score ?? 20;
    const previousState = existing?.state || 'new';
    const { score, state } = computeMasteryUpdate({
        previousScore,
        previousState,
        attempts,
        correct,
        result
    });

    const nextRecord: SkillMasteryRecord = {
        id: existing?.id,
        skillTag,
        score,
        state,
        attempts,
        correct,
        lastReviewedAt: now,
        updatedAt: now
    };

    if (existing?.id) {
        await db.skillMastery.update(existing.id, nextRecord);
        return nextRecord;
    }

    const id = await db.skillMastery.add(nextRecord);
    return { ...nextRecord, id };
}

export async function getSkillMasteryMap(skillTags?: string[]): Promise<Record<string, SkillMasteryRecord>> {
    const rows = skillTags && skillTags.length > 0
        ? await db.skillMastery.where('skillTag').anyOf(skillTags).toArray()
        : await db.skillMastery.toArray();

    return rows.reduce((acc, row) => {
        acc[row.skillTag] = row;
        return acc;
    }, {} as Record<string, SkillMasteryRecord>);
}

export async function seedSkillMasteryFromLearningEvents(): Promise<number> {
    const existingCount = await db.skillMastery.count();
    if (existingCount > 0) return 0;

    const events = await db.learningEvents
        .where('eventType')
        .equals('answer')
        .toArray();

    const grouped = new Map<string, { attempts: number; correct: number; lastTs: number }>();
    events.forEach((event) => {
        if (!event.skillTag || !event.result) return;
        const bucket = grouped.get(event.skillTag) || { attempts: 0, correct: 0, lastTs: 0 };
        bucket.attempts += 1;
        bucket.correct += event.result === 'correct' ? 1 : 0;
        bucket.lastTs = Math.max(bucket.lastTs, event.timestamp);
        grouped.set(event.skillTag, bucket);
    });

    const now = Date.now();
    const records: SkillMasteryRecord[] = Array.from(grouped.entries()).map(([skillTag, value]) => {
        const accuracy = smoothAccuracy(value.correct, value.attempts);
        const score = clamp(Math.round(accuracy * 100), 0, 100);
        return {
            skillTag,
            attempts: value.attempts,
            correct: value.correct,
            score,
            state: masteryStateFromScore(score, value.attempts, accuracy),
            lastReviewedAt: value.lastTs || now,
            updatedAt: now
        };
    });

    if (records.length > 0) {
        await db.skillMastery.bulkPut(records);
    }
    return records.length;
}

export async function getSkillReviewRiskMap(skillTags: string[]): Promise<Record<string, number>> {
    if (!skillTags.length) return {};
    const now = Date.now();
    const dueCards = await db.fsrsCards
        .where('due')
        .belowOrEqual(now)
        .toArray();

    const riskMap: Record<string, number> = {};
    dueCards.forEach((card) => {
        if (!card.skillTag || !skillTags.includes(card.skillTag)) return;
        const overdueDays = Math.max(0, (now - card.due) / (24 * 60 * 60 * 1000));
        const weight = 1 + Math.min(2, overdueDays / 3);
        riskMap[card.skillTag] = (riskMap[card.skillTag] || 0) + weight;
    });

    return riskMap;
}

export async function getRecentMistakeIntensity(skillTags: string[], windowDays = 14): Promise<Record<string, number>> {
    if (!skillTags.length) return {};
    const cutoff = Date.now() - (windowDays * 24 * 60 * 60 * 1000);
    const rows = await db.mistakes
        .where('timestamp')
        .aboveOrEqual(cutoff)
        .toArray();

    const result: Record<string, number> = {};
    rows.forEach((row) => {
        const key = row.skillTag;
        if (!key || !skillTags.includes(key)) return;
        result[key] = (result[key] || 0) + 1;
    });
    return result;
}

export async function getMasteryAggregateSnapshot(windowDays = 7): Promise<MasteryAggregateSnapshot> {
    const cutoff = Date.now() - (windowDays * 24 * 60 * 60 * 1000);
    const [events, masteryRows] = await Promise.all([
        db.learningEvents
            .where('timestamp')
            .aboveOrEqual(cutoff)
            .and((row) => row.eventType === 'answer')
            .toArray(),
        db.skillMastery.toArray()
    ]);

    const bucket = new Map<string, { attempts: number; correct: number }>();
    events.forEach((event) => {
        if (!event.skillTag || !event.result) return;
        const row = bucket.get(event.skillTag) || { attempts: 0, correct: 0 };
        row.attempts += 1;
        row.correct += event.result === 'correct' ? 1 : 0;
        bucket.set(event.skillTag, row);
    });

    const masteryMap = masteryRows.reduce((acc, row) => {
        acc[row.skillTag] = row;
        return acc;
    }, {} as Record<string, SkillMasteryRecord>);

    const bySkill: MasteryAggregateSkillRow[] = Array.from(bucket.entries())
        .map(([skillTag, row]) => {
            const mastery = masteryMap[skillTag];
            return {
                skillTag,
                attempts: row.attempts,
                correct: row.correct,
                smoothedAccuracy: smoothAccuracy(row.correct, row.attempts),
                currentState: mastery?.state || 'new',
                currentScore: mastery?.score ?? 20
            };
        })
        .sort((a, b) => {
            if (b.attempts !== a.attempts) return b.attempts - a.attempts;
            return b.currentScore - a.currentScore;
        });

    const totalAttempts = bySkill.reduce((sum, row) => sum + row.attempts, 0);
    const totalCorrect = bySkill.reduce((sum, row) => sum + row.correct, 0);
    const stateCounts: Record<MasteryState, number> = {
        new: 0,
        learning: 0,
        consolidated: 0,
        mastered: 0
    };
    masteryRows.forEach((row) => {
        stateCounts[row.state] += 1;
    });

    return {
        windowDays,
        totalAttempts,
        totalCorrect,
        bySkill,
        stateCounts
    };
}

export function computeObjectiveMasteryAggregateFromRows(
    rows: ObjectiveMasteryRecord[],
    windowDays = 14,
    now = Date.now()
): ObjectiveMasteryAggregateSnapshot {
    const byObjective: ObjectiveMasteryAggregateObjectiveRow[] = rows
        .map((row) => {
            const objective = getLearningObjective(row.objectiveId);
            return {
                objectiveId: row.objectiveId,
                title: objective?.title || row.objectiveId,
                domain: objective?.domain || 'vocab',
                score: row.score,
                state: row.state,
                attempts: row.attempts,
                correct: row.correct,
                qualifiedAttempts: row.qualifiedAttempts || 0,
                independentAttempts: row.independentAttempts || 0,
                confidence: row.confidence,
                transferAttempts: row.transferAttempts,
                delayedProbeAttempts: row.delayedProbeAttempts || 0,
                evidenceStatus: row.state === 'mastered'
                    ? 'retained' as const
                    : (row.independentAttempts || 0) >= (objective?.evidenceRequirements.minimumIndependentAttempts || 3)
                        ? 'developing' as const
                        : 'insufficient' as const,
                nextReviewAt: row.nextReviewAt
            };
        })
        .sort((a, b) => {
            if (a.state !== b.state) return a.score - b.score;
            return a.nextReviewAt - b.nextReviewAt;
        });

    const domainMap = new Map<LearningObjectiveDomain, ObjectiveMasteryAggregateDomainRow & { totalScore: number }>();
    byObjective.forEach((row) => {
        const existing = domainMap.get(row.domain) || {
            domain: row.domain,
            averageScore: 0,
            objectiveCount: 0,
            masteredCount: 0,
            learningCount: 0,
            totalScore: 0
        };
        existing.objectiveCount += 1;
        existing.totalScore += row.score;
        if (row.state === 'mastered') existing.masteredCount += 1;
        if (row.state === 'new' || row.state === 'learning') existing.learningCount += 1;
        existing.averageScore = Math.round(existing.totalScore / existing.objectiveCount);
        domainMap.set(row.domain, existing);
    });

    const stateCounts: Record<MasteryState, number> = {
        new: 0,
        learning: 0,
        consolidated: 0,
        mastered: 0
    };
    rows.forEach((row) => {
        stateCounts[row.state] += 1;
    });

    const averageScore = byObjective.length > 0
        ? Math.round(byObjective.reduce((sum, row) => sum + row.score, 0) / byObjective.length)
        : 0;

    return {
        windowDays,
        generatedAt: now,
        averageScore,
        byObjective,
        byDomain: Array.from(domainMap.values()).map(({ totalScore, ...row }) => {
            void totalScore;
            return row;
        }),
        stateCounts
    };
}

export async function getObjectiveMasteryAggregateSnapshot(windowDays = 14, now = Date.now()): Promise<ObjectiveMasteryAggregateSnapshot> {
    const cutoff = now - (windowDays * DAY_MS);
    const rows = await db.objectiveMastery
        .where('updatedAt')
        .aboveOrEqual(cutoff)
        .toArray();
    return computeObjectiveMasteryAggregateFromRows(rows, windowDays, now);
}

// XP to Level calculation (similar to Duolingo)
function calculateLevel(xp: number): number {
    // Level 1: 0 XP, Level 2: 100 XP, Level 3: 250 XP, etc.
    // Formula: XP needed = 50 * level^1.5
    let level = 1;
    let totalNeeded = 0;
    while (totalNeeded <= xp) {
        level++;
        totalNeeded += Math.floor(50 * Math.pow(level, 1.5));
    }
    return level - 1;
}

export function xpForNextLevel(currentLevel: number): number {
    return Math.floor(50 * Math.pow(currentLevel + 1, 1.5));
}

export function xpProgressInLevel(totalXp: number, currentLevel: number): { current: number; needed: number } {
    let accumulated = 0;
    for (let l = 1; l <= currentLevel; l++) {
        accumulated += Math.floor(50 * Math.pow(l, 1.5));
    }
    const currentLevelXp = totalXp - accumulated + Math.floor(50 * Math.pow(currentLevel, 1.5));
    const neededForNext = xpForNextLevel(currentLevel);
    return { current: Math.max(0, currentLevelXp), needed: neededForNext };
}

// ========== FSRS Functions ==========


// Initialize FSRS with default parameters
const params = generatorParameters();
const f = fsrs(params);

// Simple hash for question text
export function hashQuestion(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'q_' + hash.toString(16);
}

// Convert FSRSCard to ts-fsrs Card format
function toFSRSCard(card: FSRSCard): FSRSCardType {
    return {
        due: new Date(card.due),
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        reps: card.reps,
        lapses: card.lapses,
        state: card.state as State,
        last_review: card.last_review ? new Date(card.last_review) : undefined,
        learning_steps: 0 // Default learning steps
    };
}

// Convert ts-fsrs Card back to FSRSCard format
function fromFSRSCard(card: FSRSCardType, original: Partial<FSRSCard>): Partial<FSRSCard> {
    return {
        ...original,
        due: card.due.getTime(),
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        reps: card.reps,
        lapses: card.lapses,
        state: card.state,
        last_review: card.last_review?.getTime()
    };
}

// Add or update a card after answering
export async function reviewCard(
    questionHash: string,
    rating: 'again' | 'hard' | 'good' | 'easy',
    questionData?: {
        question: string;
        options: string[];
        correct_index: number;
        type: StoredQuestionType;
        explanation?: string;
        hint?: string;
        skillTag?: string;
        learningObjectiveId?: string;
        sourceContextSpan?: string;
        questionMode?: 'choice' | 'typing' | 'fill-blank';
        correctAnswer?: string;
    }
): Promise<FSRSCard> {
    const ratingMap: Record<string, Rating> = {
        again: Rating.Again,
        hard: Rating.Hard,
        good: Rating.Good,
        easy: Rating.Easy
    };

    const now = new Date();
    const fsrsRating = ratingMap[rating];
    const existing = await db.fsrsCards.where('questionHash').equals(questionHash).first();
    const questionFields: Partial<FSRSCard> = questionData
        ? {
            question: questionData.question,
            options: questionData.options,
            correct_index: questionData.correct_index,
            type: questionData.type,
            explanation: questionData.explanation,
            hint: questionData.hint,
            skillTag: questionData.skillTag,
            learningObjectiveId: questionData.learningObjectiveId,
            sourceContextSpan: questionData.sourceContextSpan,
            questionMode: questionData.questionMode,
            correctAnswer: questionData.correctAnswer
        }
        : {};

    if (!existing) {
        // Create new card
        const emptyCard = createEmptyCard(now);
        const scheduled = f.repeat(emptyCard, now);
        // Access the result by rating key and cast to RecordLogItem
        const result = scheduled[fsrsRating as keyof typeof scheduled] as RecordLogItem;

        const newCard: FSRSCard = {
            questionHash,
            question: '',
            options: [],
            correct_index: 0,
            ...questionFields,
            ...fromFSRSCard(result.card, {})
        } as FSRSCard;

        const id = await db.fsrsCards.add(newCard);
        return { ...newCard, id };
    } else {
        // Review existing card
        const fsrsCard = toFSRSCard(existing);
        const scheduled = f.repeat(fsrsCard, now);
        const result = scheduled[fsrsRating as keyof typeof scheduled] as RecordLogItem;

        const updated = {
            ...fromFSRSCard(result.card, existing),
            ...questionFields
        };
        await db.fsrsCards.update(existing.id!, updated);
        return { ...existing, ...updated } as FSRSCard;
    }
}

// Get cards due for review
export async function getDueCards(limit = 10): Promise<FSRSCard[]> {
    const now = Date.now();
    return await db.fsrsCards
        .where('due')
        .belowOrEqual(now)
        .limit(limit)
        .toArray();
}

// Get cards due for review with priority (overdue first)
export async function getDueCardsWithPriority(limit = 10): Promise<FSRSCard[]> {
    const now = Date.now();
    const cards = await db.fsrsCards
        .where('due')
        .belowOrEqual(now)
        .toArray();

    // Sort by how overdue they are (most overdue first)
    cards.sort((a, b) => a.due - b.due);
    return cards.slice(0, limit);
}

// Get total cards and due count for stats
export async function getSRSStats(): Promise<{ total: number; due: number; new: number; learning: number; review: number }> {
    const now = Date.now();
    const all = await db.fsrsCards.toArray();

    return {
        total: all.length,
        due: all.filter(c => c.due <= now).length,
        new: all.filter(c => c.state === State.New).length,
        learning: all.filter(c => c.state === State.Learning || c.state === State.Relearning).length,
        review: all.filter(c => c.state === State.Review).length
    };
}

// Delete a card
export async function deleteCard(questionHash: string): Promise<void> {
    await db.fsrsCards.where('questionHash').equals(questionHash).delete();
}

// Get card by question text (for display in mistake notebook)
export async function getCardByQuestionText(questionText: string): Promise<FSRSCard | null> {
    const hash = hashQuestion(questionText);
    const card = await db.fsrsCards.where('questionHash').equals(hash).first();
    return card || null;
}

// Calculate memory retrievability (probability of recall)
// Based on FSRS formula: R = e^(-t/S) where t = elapsed time, S = stability
export function calculateRetrievability(card: FSRSCard): number {
    if (card.state === 0) return 1; // New card, not yet learned

    const now = Date.now();
    const lastReview = card.last_review || card.due - (card.scheduled_days * 24 * 60 * 60 * 1000);
    const elapsedDays = (now - lastReview) / (24 * 60 * 60 * 1000);

    if (card.stability <= 0) return 0;

    // R = e^(-t/S) where t is in days and S is stability in days
    const retrievability = Math.exp(-elapsedDays / card.stability);
    return Math.max(0, Math.min(1, retrievability));
}

// Get human-readable memory status
export function getMemoryStatus(card: FSRSCard): {
    retrievability: number;
    stability: number;
    status: 'new' | 'learning' | 'strong' | 'weak' | 'forgotten';
    daysUntilDue: number;
    statusEmoji: string;
    statusText: { en: string; zh: string };
} {
    const retrievability = calculateRetrievability(card);
    const now = Date.now();
    const daysUntilDue = (card.due - now) / (24 * 60 * 60 * 1000);

    let status: 'new' | 'learning' | 'strong' | 'weak' | 'forgotten';
    let statusEmoji: string;
    let statusText: { en: string; zh: string };

    if (card.state === 0) {
        status = 'new';
        statusEmoji = '🆕';
        statusText = { en: 'New', zh: '新卡片' };
    } else if (card.state === 1 || card.state === 3) {
        status = 'learning';
        statusEmoji = '📖';
        statusText = { en: 'Learning', zh: '学习中' };
    } else if (retrievability >= 0.9) {
        status = 'strong';
        statusEmoji = '💪';
        statusText = { en: 'Strong', zh: '记忆牢固' };
    } else if (retrievability >= 0.7) {
        status = 'weak';
        statusEmoji = '⚠️';
        statusText = { en: 'Needs Review', zh: '需要复习' };
    } else {
        status = 'forgotten';
        statusEmoji = '🔴';
        statusText = { en: 'Forgotten', zh: '几乎遗忘' };
    }

    return {
        retrievability,
        stability: card.stability,
        status,
        daysUntilDue,
        statusEmoji,
        statusText
    };
}

// ========== Cache Functions ==========

async function persistQuestionCacheRows(rows: CachedQuestion[]): Promise<void> {
    await db.questionCache.clear();
    if (rows.length === 0) return;
    const payload = rows.map(({ id, ...rest }) => {
        void id;
        return rest;
    });
    await db.questionCache.bulkAdd(payload);
}

export async function cacheQuestions(questions: CachedQuestion[]): Promise<void> {
    if (!Array.isArray(questions) || questions.length === 0) return;
    await db.transaction('rw', db.questionCache, async () => {
        const existing = await db.questionCache.toArray();
        const retained = mergeQuestionCache(existing, questions);
        await persistQuestionCacheRows(retained);
    });
}

export async function getCachedQuestions(contextHash: string, limit = 10): Promise<CachedQuestion[]> {
    if (!contextHash || limit <= 0) return [];

    return db.transaction('rw', db.questionCache, async () => {
        // Applying retention policy on read keeps cache size bounded over time.
        const retained = mergeQuestionCache(await db.questionCache.toArray(), []);
        await persistQuestionCacheRows(retained);

        const contextRows = await db.questionCache
            .where('contextHash').equals(contextHash)
            .toArray();

        const sorted = contextRows.sort((a, b) => b.timestamp - a.timestamp);
        const unused = sorted.filter((q) => !q.used);
        const used = sorted.filter((q) => q.used);
        const selected = [
            ...unused.slice(0, limit),
            ...used.slice(0, Math.max(0, limit - unused.length))
        ];

        const ids = selected
            .map((row) => row.id)
            .filter((id): id is number => typeof id === 'number');
        if (ids.length > 0) {
            await db.questionCache.where('id').anyOf(ids).modify({ used: true });
        }

        return selected;
    });
}

export async function markQuestionsAsUsed(ids: number[]): Promise<void> {
    if (!Array.isArray(ids) || ids.length === 0) return;
    await db.questionCache.where('id').anyOf(ids).modify({ used: true });
}

export async function getCachedQuestionsCount(): Promise<number> {
    return await db.questionCache.count();
}

export function hashContext(context: string): string {
    let hash = 0;
    for (let i = 0; i < context.length; i++) {
        const char = context.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}
