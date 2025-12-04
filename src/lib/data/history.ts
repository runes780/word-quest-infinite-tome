import { db, HistoryRecord } from '@/db/db';

const isBrowser = typeof window !== 'undefined';

export interface MissionSummaryInput {
    score: number;
    totalQuestions: number;
    levelTitle: string;
}

export async function logMissionHistory(summary: MissionSummaryInput) {
    if (!isBrowser) return;
    try {
        await db.history.add({
            ...summary,
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
