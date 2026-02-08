import { db, getPlayerProfile, GlobalPlayerProfile, HistoryRecord, LearningEvent } from '@/db/db';

const MIN_POINTS_PER_CORRECT = 10;
const MAX_POINTS_PER_CORRECT = 25;

export type ConsistencyCheckStatus = 'ok' | 'warning' | 'insufficient';

export interface ConsistencyAuditCheck {
    id: 'profile_words_vs_correct_answers' | 'profile_lessons_vs_sessions' | 'history_questions_vs_non_daily_answers' | 'history_missions_vs_non_daily_sessions';
    label: string;
    expected: number;
    actual: number;
    delta: number;
    status: ConsistencyCheckStatus;
    note: string;
}

export interface DataConsistencyAuditSnapshot {
    generatedAt: number;
    overallStatus: ConsistencyCheckStatus;
    comparedSince?: number;
    checks: ConsistencyAuditCheck[];
}

function deriveHistoryCounts(record: HistoryRecord): { correct: number; total: number; } {
    if (record.skillStats) {
        const fromSkills = Object.values(record.skillStats).reduce(
            (acc, stat) => {
                acc.correct += stat.correct || 0;
                acc.total += stat.total || 0;
                return acc;
            },
            { correct: 0, total: 0 }
        );
        if (fromSkills.total > 0) return fromSkills;
    }
    if (typeof record.totalCorrect === 'number') {
        return { correct: record.totalCorrect, total: record.totalQuestions };
    }
    if (typeof record.accuracy === 'number') {
        return {
            correct: Math.round(record.totalQuestions * record.accuracy),
            total: record.totalQuestions
        };
    }
    const estimated = Math.round(record.score / ((MIN_POINTS_PER_CORRECT + MAX_POINTS_PER_CORRECT) / 2));
    return {
        correct: Math.max(0, Math.min(record.totalQuestions, estimated)),
        total: record.totalQuestions
    };
}

function buildProfileLowerBoundCheck(input: {
    id: ConsistencyAuditCheck['id'];
    label: string;
    expected: number;
    actual: number;
    minSample: number;
    deficitNote: string;
    surplusNote: string;
}): ConsistencyAuditCheck {
    const { id, label, expected, actual, minSample, deficitNote, surplusNote } = input;
    const delta = actual - expected;
    if (expected < minSample && actual < minSample) {
        return {
            id,
            label,
            expected,
            actual,
            delta,
            status: 'insufficient',
            note: 'Sample too small for stable consistency judgement.'
        };
    }
    if (actual < expected) {
        return {
            id,
            label,
            expected,
            actual,
            delta,
            status: 'warning',
            note: deficitNote
        };
    }
    return {
        id,
        label,
        expected,
        actual,
        delta,
        status: 'ok',
        note: surplusNote
    };
}

function buildExactCheck(input: {
    id: ConsistencyAuditCheck['id'];
    label: string;
    expected: number;
    actual: number;
    tolerance: number;
    minSample: number;
}): ConsistencyAuditCheck {
    const { id, label, expected, actual, tolerance, minSample } = input;
    const delta = actual - expected;
    const sample = Math.max(expected, actual);
    if (sample < minSample) {
        return {
            id,
            label,
            expected,
            actual,
            delta,
            status: 'insufficient',
            note: 'Sample too small for stable consistency judgement.'
        };
    }
    if (Math.abs(delta) <= tolerance) {
        return {
            id,
            label,
            expected,
            actual,
            delta,
            status: 'ok',
            note: 'Within tolerance.'
        };
    }
    return {
        id,
        label,
        expected,
        actual,
        delta,
        status: 'warning',
        note: 'Drift exceeds tolerance; check event logging or profile updates.'
    };
}

function overallFromChecks(checks: ConsistencyAuditCheck[]): ConsistencyCheckStatus {
    if (checks.some((check) => check.status === 'warning')) return 'warning';
    if (checks.every((check) => check.status === 'insufficient')) return 'insufficient';
    return 'ok';
}

export function computeDataConsistencyAudit(input: {
    profile: GlobalPlayerProfile;
    events: LearningEvent[];
    history: HistoryRecord[];
    generatedAt?: number;
}): DataConsistencyAuditSnapshot {
    const { profile, events, history, generatedAt = Date.now() } = input;
    const minEventTs = events.length > 0 ? Math.min(...events.map((event) => event.timestamp)) : undefined;
    const minHistoryTs = history.length > 0 ? Math.min(...history.map((row) => row.timestamp)) : undefined;
    const comparedSince = minEventTs !== undefined && minHistoryTs !== undefined
        ? Math.max(minEventTs, minHistoryTs)
        : undefined;

    const overlapEvents = comparedSince !== undefined
        ? events.filter((event) => event.timestamp >= comparedSince)
        : [];
    const overlapHistory = comparedSince !== undefined
        ? history.filter((row) => row.timestamp >= comparedSince)
        : [];

    const correctAnswers = events.filter((event) => event.eventType === 'answer' && event.result === 'correct').length;
    const sessionCompleted = events.filter((event) => event.eventType === 'session_complete').length;
    const nonDailyAnswers = overlapEvents.filter((event) => event.eventType === 'answer' && event.source !== 'daily').length;
    const nonDailySessions = overlapEvents.filter((event) => event.eventType === 'session_complete' && event.source !== 'daily').length;
    const historyTotals = overlapHistory.reduce(
        (acc, row) => {
            const counts = deriveHistoryCounts(row);
            acc.totalQuestions += counts.total;
            return acc;
        },
        { totalQuestions: 0 }
    );

    const checks: ConsistencyAuditCheck[] = [
        buildProfileLowerBoundCheck({
            id: 'profile_words_vs_correct_answers',
            label: 'Profile wordsLearned >= correct answers',
            expected: correctAnswers,
            actual: profile.wordsLearned,
            minSample: 5,
            deficitNote: 'Profile wordsLearned is lower than logged correct answers.',
            surplusNote: 'Profile wordsLearned covers logged correct answers.'
        }),
        buildProfileLowerBoundCheck({
            id: 'profile_lessons_vs_sessions',
            label: 'Profile lessonsCompleted >= session_complete',
            expected: sessionCompleted,
            actual: profile.lessonsCompleted,
            minSample: 3,
            deficitNote: 'Profile lessonsCompleted is lower than logged session completions.',
            surplusNote: 'Profile lessonsCompleted covers logged session completions.'
        }),
        buildExactCheck({
            id: 'history_questions_vs_non_daily_answers',
            label: 'History totalQuestions ~= non-daily answer events',
            expected: nonDailyAnswers,
            actual: historyTotals.totalQuestions,
            tolerance: 2,
            minSample: 6
        }),
        buildExactCheck({
            id: 'history_missions_vs_non_daily_sessions',
            label: 'History missions ~= non-daily session_complete events',
            expected: nonDailySessions,
            actual: overlapHistory.length,
            tolerance: 1,
            minSample: 3
        })
    ];

    return {
        generatedAt,
        comparedSince,
        checks,
        overallStatus: overallFromChecks(checks)
    };
}

export async function getDataConsistencyAuditSnapshot(now = Date.now()): Promise<DataConsistencyAuditSnapshot> {
    const [profile, events, history] = await Promise.all([
        getPlayerProfile(),
        db.learningEvents.orderBy('timestamp').toArray(),
        db.history.orderBy('timestamp').toArray()
    ]);

    return computeDataConsistencyAudit({
        profile,
        events,
        history,
        generatedAt: now
    });
}
