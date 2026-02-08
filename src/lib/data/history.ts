import { db, HistoryRecord, SkillStatSlice } from '@/db/db';

const isBrowser = typeof window !== 'undefined';
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_POINTS_PER_CORRECT = 10;
const MAX_POINTS_PER_CORRECT = 25;

export type SkillStatSnapshot = Record<string, SkillStatSlice>;

export interface MissionSummaryInput {
    score: number;
    totalQuestions: number;
    levelTitle: string;
    skillStats?: SkillStatSnapshot;
    totalCorrect?: number;
    accuracy?: number;
}

export interface DailyAccuracyRow {
    date: number;
    label: string;
    accuracy: number;
    correct: number;
    total: number;
    missions: number;
}

export interface SkillAccuracyRow {
    skill: string;
    accuracy: number;
    correct: number;
    total: number;
}

export interface DashboardSummary {
    records: HistoryRecord[];
    daily: DailyAccuracyRow[];
    skills: SkillAccuracyRow[];
    targetedReview: {
        sessions: number;
        avgAccuracy: number;
        avgScore: number;
        successRuns: number;
        lastFocusTag?: string;
        lastRunAt?: number;
    };
    totals: {
        missions: number;
        correct: number;
        total: number;
        accuracy: number;
        lastActive?: number;
    };
}

const dateFormatter = typeof Intl !== 'undefined'
    ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
    : null;

function sumSkillStats(skillStats?: SkillStatSnapshot) {
    if (!skillStats) return null;
    return Object.values(skillStats).reduce(
        (acc, stat) => {
            acc.correct += stat.correct || 0;
            acc.total += stat.total || 0;
            return acc;
        },
        { correct: 0, total: 0 }
    );
}

function deriveCounts(record: HistoryRecord) {
    const fromSkills = sumSkillStats(record.skillStats);
    if (fromSkills && fromSkills.total > 0) {
        return fromSkills;
    }
    if (typeof record.totalCorrect === 'number') {
        return { correct: record.totalCorrect, total: record.totalQuestions };
    }
    if (typeof record.accuracy === 'number') {
        const correct = Math.round(record.totalQuestions * record.accuracy);
        return { correct, total: record.totalQuestions };
    }
    const estimated = Math.round(record.score / ((MIN_POINTS_PER_CORRECT + MAX_POINTS_PER_CORRECT) / 2));
    return {
        correct: Math.max(0, Math.min(record.totalQuestions, estimated)),
        total: record.totalQuestions
    };
}

function computeDailySeries(records: HistoryRecord[], days: number): DailyAccuracyRow[] {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = today.getTime() - (days - 1) * DAY_MS;
    const buckets = new Map<number, { correct: number; total: number; missions: number }>();

    records.forEach((record) => {
        if (record.timestamp < cutoff) return;
        const day = new Date(record.timestamp);
        day.setHours(0, 0, 0, 0);
        const key = day.getTime();
        const existing = buckets.get(key) || { correct: 0, total: 0, missions: 0 };
        const counts = deriveCounts(record);
        existing.correct += counts.correct;
        existing.total += counts.total;
        existing.missions += 1;
        buckets.set(key, existing);
    });

    const rows: DailyAccuracyRow[] = [];
    for (let offset = days - 1; offset >= 0; offset--) {
        const dayStart = today.getTime() - offset * DAY_MS;
        const bucket = buckets.get(dayStart) || { correct: 0, total: 0, missions: 0 };
        rows.push({
            date: dayStart,
            label: dateFormatter ? dateFormatter.format(new Date(dayStart)) : new Date(dayStart).toLocaleDateString(),
            accuracy: bucket.total > 0 ? bucket.correct / bucket.total : 0,
            correct: bucket.correct,
            total: bucket.total,
            missions: bucket.missions
        });
    }
    return rows;
}

function computeSkillSeries(records: HistoryRecord[]): SkillAccuracyRow[] {
    const skillMap = new Map<string, { correct: number; total: number }>();
    records.forEach((record) => {
        if (!record.skillStats) return;
        Object.entries(record.skillStats).forEach(([skill, stat]) => {
            const bucket = skillMap.get(skill) || { correct: 0, total: 0 };
            bucket.correct += stat.correct || 0;
            bucket.total += stat.total || 0;
            skillMap.set(skill, bucket);
        });
    });

    return Array.from(skillMap.entries())
        .map(([skill, counts]) => ({
            skill,
            correct: counts.correct,
            total: counts.total,
            accuracy: counts.total > 0 ? counts.correct / counts.total : 0
        }))
        .sort((a, b) => a.accuracy - b.accuracy);
}

function parseTargetedFocusTag(levelTitle: string): string | undefined {
    if (!levelTitle.startsWith('Targeted Review:')) return undefined;
    const raw = levelTitle.split(':')[1]?.trim();
    return raw || undefined;
}

export function getTargetedReviewSummary(records: HistoryRecord[]) {
    const targeted = records
        .filter((record) => parseTargetedFocusTag(record.levelTitle || '') !== undefined)
        .sort((a, b) => b.timestamp - a.timestamp);

    if (targeted.length === 0) {
        return {
            sessions: 0,
            avgAccuracy: 0,
            avgScore: 0,
            successRuns: 0,
            lastFocusTag: undefined,
            lastRunAt: undefined
        };
    }

    const aggregate = targeted.reduce((acc, record) => {
        const counts = deriveCounts(record);
        const accuracy = counts.total > 0 ? counts.correct / counts.total : 0;
        acc.totalCorrect += counts.correct;
        acc.totalQuestions += counts.total;
        acc.totalScore += record.score || 0;
        if (accuracy >= 0.8) acc.successRuns += 1;
        return acc;
    }, {
        totalCorrect: 0,
        totalQuestions: 0,
        totalScore: 0,
        successRuns: 0
    });

    return {
        sessions: targeted.length,
        avgAccuracy: aggregate.totalQuestions > 0 ? aggregate.totalCorrect / aggregate.totalQuestions : 0,
        avgScore: aggregate.totalScore / targeted.length,
        successRuns: aggregate.successRuns,
        lastFocusTag: parseTargetedFocusTag(targeted[0].levelTitle || ''),
        lastRunAt: targeted[0].timestamp
    };
}

export async function logMissionHistory(summary: MissionSummaryInput) {
    if (!isBrowser) return;
    try {
        const skillTotals = sumSkillStats(summary.skillStats || undefined);
        const totalCorrect = typeof summary.totalCorrect === 'number'
            ? summary.totalCorrect
            : skillTotals?.correct;
        const accuracy = typeof summary.accuracy === 'number'
            ? summary.accuracy
            : (totalCorrect !== undefined && summary.totalQuestions > 0
                ? totalCorrect / summary.totalQuestions
                : skillTotals && skillTotals.total > 0
                    ? skillTotals.correct / skillTotals.total
                    : undefined);

        await db.history.add({
            ...summary,
            totalCorrect,
            accuracy,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('logMissionHistory error', error);
    }
}

export async function getMissionHistory(limit = 20): Promise<HistoryRecord[]> {
    if (!isBrowser) return [];
    try {
        return await db.history.orderBy('timestamp').reverse().limit(limit).toArray();
    } catch (error) {
        console.error('getMissionHistory error', error);
        return [];
    }
}

export async function getDashboardSummary(days = 7, limit = 60): Promise<DashboardSummary> {
    const records = await getMissionHistory(limit);
    const daily = computeDailySeries(records, days);
    const skills = computeSkillSeries(records);
    const targetedReview = getTargetedReviewSummary(records);
    const totals = records.reduce(
        (acc, record) => {
            const counts = deriveCounts(record);
            acc.correct += counts.correct;
            acc.total += counts.total;
            return acc;
        },
        { missions: 0, correct: 0, total: 0, accuracy: 0, lastActive: undefined as number | undefined }
    );
    totals.missions = records.length;
    totals.accuracy = totals.total > 0 ? totals.correct / totals.total : 0;
    totals.lastActive = records[0]?.timestamp;

    return { records, daily, skills, targetedReview, totals };
}
