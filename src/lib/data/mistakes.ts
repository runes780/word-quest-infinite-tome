import { db, MistakeRecord, StoredRevengeQuestion, StoredQuestionType } from '@/db/db';
export type { MistakeRecord } from '@/db/db';

const isBrowser = typeof window !== 'undefined';

export interface LogMistakeArgs {
    questionId: number;
    questionText: string;
    wrongAnswer: string;
    correctAnswer: string;
    explanation: string;
    options?: string[];
    correctIndex?: number;
    type?: StoredQuestionType;
    skillTag?: string;
}

async function findMistake(questionId: number, wrongAnswer: string): Promise<MistakeRecord | null> {
    if (!isBrowser) return null;
    try {
        const collection = db.mistakes
            .where('questionId')
            .equals(questionId)
            .filter((record) => record.wrongAnswer === wrongAnswer);
        const record = await collection.last();
        return record ?? null;
    } catch (error) {
        console.error('findMistake error', error);
        return null;
    }
}

export async function logMistake(args: LogMistakeArgs) {
    if (!isBrowser) return;
    try {
        await db.mistakes.add({
            ...args,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('logMistake error', error);
    }
}

export interface CacheMentorArgs extends LogMistakeArgs {
    analysis: string;
    causeTag?: string;
    nextAction?: string;
    mentorExplanation?: string;
    revengeQuestion?: StoredRevengeQuestion;
}

export interface RepeatedCauseRow {
    causeTag: string;
    count: number;
}

export interface RepeatedCauseSnapshot {
    windowDays: number;
    taggedMistakes: number;
    repeatedMistakes: number;
    repeatRate: number;
    topCauses: RepeatedCauseRow[];
}

export interface RepeatedCauseTrend {
    windowDays: number;
    current: RepeatedCauseSnapshot;
    previous: RepeatedCauseSnapshot;
    deltaRate: number;
    relativeDelta: number;
}

export type RepeatedCauseGoalStatus = 'passed' | 'not_met' | 'insufficient';

export interface RepeatedCauseGoalRow {
    windowDays: number;
    targetReduction: number;
    status: RepeatedCauseGoalStatus;
    currentRate: number;
    previousRate: number;
    relativeReduction: number;
    currentTagged: number;
    previousTagged: number;
}

export interface RepeatedCauseGoalSummary {
    targetReduction: number;
    rows: RepeatedCauseGoalRow[];
    overallStatus: RepeatedCauseGoalStatus;
}

export async function cacheMentorAnalysis(args: CacheMentorArgs) {
    if (!isBrowser) return;
    try {
        const existing = await findMistake(args.questionId, args.wrongAnswer);
        if (existing?.id) {
            await db.mistakes.update(existing.id, {
                mentorAnalysis: args.analysis,
                mentorCauseTag: args.causeTag,
                mentorNextAction: args.nextAction,
                revengeQuestion: args.revengeQuestion,
                explanation: args.mentorExplanation || existing.explanation,
                options: existing.options || args.options,
                correctIndex: existing.correctIndex ?? args.correctIndex,
                type: existing.type || args.type,
                skillTag: existing.skillTag || args.skillTag,
                timestamp: Date.now()
            });
        } else {
            await db.mistakes.add({
                questionId: args.questionId,
                questionText: args.questionText,
                wrongAnswer: args.wrongAnswer,
                correctAnswer: args.correctAnswer,
                explanation: args.mentorExplanation || args.explanation,
                options: args.options,
                correctIndex: args.correctIndex,
                type: args.type,
                skillTag: args.skillTag,
                mentorAnalysis: args.analysis,
                mentorCauseTag: args.causeTag,
                mentorNextAction: args.nextAction,
                revengeQuestion: args.revengeQuestion,
                timestamp: Date.now()
            });
        }
    } catch (error) {
        console.error('cacheMentorAnalysis error', error);
    }
}

export async function loadMentorCache(questionId: number, wrongAnswer: string): Promise<MistakeRecord | null> {
    if (!isBrowser) return null;
    try {
        const record = await findMistake(questionId, wrongAnswer);
        if (record?.mentorAnalysis) {
            return record;
        }
        return null;
    } catch (error) {
        console.error('loadMentorCache error', error);
        return null;
    }
}

export async function findMistakeBySkill(skillTag: string): Promise<MistakeRecord | null> {
    if (!isBrowser) return null;
    try {
        const collection = db.mistakes.where('skillTag').equals(skillTag).reverse();
        const record = await collection.first();
        return record || null;
    } catch (error) {
        console.error('findMistakeBySkill error', error);
        return null;
    }
}

export async function getMistakes(limit = 50): Promise<MistakeRecord[]> {
    if (!isBrowser) return [];
    try {
        return await db.mistakes.orderBy('timestamp').reverse().limit(limit).toArray();
    } catch (error) {
        console.error('getMistakes error', error);
        return [];
    }
}

export function computeRepeatedCauseSnapshot(
    records: MistakeRecord[],
    windowDays = 14,
    now = Date.now()
): RepeatedCauseSnapshot {
    const cutoff = now - (windowDays * 24 * 60 * 60 * 1000);
    const inWindow = records.filter((row) => row.timestamp >= cutoff && row.timestamp <= now);
    return computeRepeatedCauseSnapshotFromRows(inWindow, windowDays);
}

function computeRepeatedCauseSnapshotFromRows(
    inWindow: MistakeRecord[],
    windowDays: number
): RepeatedCauseSnapshot {
    const tags = inWindow
        .map((row) => row.mentorCauseTag?.trim())
        .filter((value): value is string => Boolean(value));

    const counts = new Map<string, number>();
    tags.forEach((tag) => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
    });

    let repeatedMistakes = 0;
    tags.forEach((tag) => {
        if ((counts.get(tag) || 0) >= 2) repeatedMistakes += 1;
    });

    const topCauses = Array.from(counts.entries())
        .map(([causeTag, count]) => ({ causeTag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

    return {
        windowDays,
        taggedMistakes: tags.length,
        repeatedMistakes,
        repeatRate: tags.length > 0 ? repeatedMistakes / tags.length : 0,
        topCauses
    };
}

export function computeRepeatedCauseTrends(
    records: MistakeRecord[],
    windows: number[] = [7, 14, 30],
    now = Date.now()
): RepeatedCauseTrend[] {
    return windows.map((windowDays) => {
        const ms = windowDays * 24 * 60 * 60 * 1000;
        const currentRows = records.filter((row) => row.timestamp > now - ms && row.timestamp <= now);
        const previousRows = records.filter((row) => row.timestamp > now - (2 * ms) && row.timestamp <= now - ms);

        const current = computeRepeatedCauseSnapshotFromRows(currentRows, windowDays);
        const previous = computeRepeatedCauseSnapshotFromRows(previousRows, windowDays);
        const deltaRate = current.repeatRate - previous.repeatRate;
        const relativeDelta = previous.repeatRate > 0 ? deltaRate / previous.repeatRate : 0;

        return {
            windowDays,
            current,
            previous,
            deltaRate,
            relativeDelta
        };
    });
}

export async function getRepeatedCauseSnapshot(windowDays = 14, limit = 200): Promise<RepeatedCauseSnapshot> {
    const mistakes = await getMistakes(limit);
    return computeRepeatedCauseSnapshot(mistakes, windowDays);
}

export async function getRepeatedCauseTrends(windows: number[] = [7, 14, 30], limit = 400): Promise<RepeatedCauseTrend[]> {
    const mistakes = await getMistakes(limit);
    return computeRepeatedCauseTrends(mistakes, windows);
}

export function evaluateRepeatedCauseGoal(
    trends: RepeatedCauseTrend[],
    targetReduction = 0.2,
    minTagged = 5
): RepeatedCauseGoalSummary {
    const rows: RepeatedCauseGoalRow[] = trends.map((trend) => {
        const currentTagged = trend.current.taggedMistakes;
        const previousTagged = trend.previous.taggedMistakes;
        const enoughData = currentTagged >= minTagged && previousTagged >= minTagged;
        const relativeReduction = -trend.relativeDelta;
        let status: RepeatedCauseGoalStatus = 'insufficient';
        if (enoughData) {
            status = relativeReduction >= targetReduction ? 'passed' : 'not_met';
        }
        return {
            windowDays: trend.windowDays,
            targetReduction,
            status,
            currentRate: trend.current.repeatRate,
            previousRate: trend.previous.repeatRate,
            relativeReduction,
            currentTagged,
            previousTagged
        };
    });

    const actionable = rows.filter((row) => row.status !== 'insufficient');
    const overallStatus: RepeatedCauseGoalStatus = actionable.length === 0
        ? 'insufficient'
        : actionable.some((row) => row.status === 'passed')
            ? 'passed'
            : 'not_met';

    return {
        targetReduction,
        rows,
        overallStatus
    };
}

export async function deleteMistake(id: number) {
    if (!isBrowser) return;
    try {
        await db.mistakes.delete(id);
    } catch (error) {
        console.error('deleteMistake error', error);
    }
}
