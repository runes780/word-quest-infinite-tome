import type { GlobalPlayerProfile } from '@/db/db';

const DAY_MS = 24 * 60 * 60 * 1000;

export type DailyFlameState = 'protected' | 'needs-practice' | 'at-risk' | 'starter';

export interface DailyFlameStatus {
    state: DailyFlameState;
    streakDays: number;
    dailyXpGoal: number;
    dailyXpEarned: number;
    remainingXp: number;
    progressPercent: number;
    canUseFreeze: boolean;
    lastActiveDate: string;
}

interface BuildDailyFlameStatusInput {
    profile: GlobalPlayerProfile | null;
    now?: number;
}

function dayKey(timestamp: number) {
    return new Date(timestamp).toISOString().slice(0, 10);
}

function daysBetween(fromDay: string, toDay: string) {
    if (!fromDay) return Number.POSITIVE_INFINITY;
    const from = new Date(`${fromDay}T00:00:00.000Z`).getTime();
    const to = new Date(`${toDay}T00:00:00.000Z`).getTime();
    return Math.round((to - from) / DAY_MS);
}

export function buildDailyFlameStatus(input: BuildDailyFlameStatusInput): DailyFlameStatus {
    const today = dayKey(input.now ?? Date.now());
    const profile = input.profile;
    const dailyXpGoal = Math.max(1, profile?.dailyXpGoal || 50);
    const dailyXpEarned = Math.max(0, profile?.lastActiveDate === today ? profile.dailyXpEarned : 0);
    const remainingXp = Math.max(0, dailyXpGoal - dailyXpEarned);
    const progressPercent = Math.min(100, Math.round((dailyXpEarned / dailyXpGoal) * 100));
    const lastActiveDate = profile?.lastActiveDate || '';
    const inactiveDays = daysBetween(lastActiveDate, today);
    const streakDays = profile?.dailyStreak || 0;

    if (!profile || streakDays === 0) {
        return {
            state: 'starter',
            streakDays: 0,
            dailyXpGoal,
            dailyXpEarned,
            remainingXp,
            progressPercent,
            canUseFreeze: false,
            lastActiveDate
        };
    }

    if (remainingXp === 0 && lastActiveDate === today) {
        return {
            state: 'protected',
            streakDays,
            dailyXpGoal,
            dailyXpEarned,
            remainingXp,
            progressPercent,
            canUseFreeze: false,
            lastActiveDate
        };
    }

    const missedAtLeastOneDay = Number.isFinite(inactiveDays) && inactiveDays > 1;
    return {
        state: missedAtLeastOneDay ? 'at-risk' : 'needs-practice',
        streakDays,
        dailyXpGoal,
        dailyXpEarned,
        remainingXp,
        progressPercent,
        canUseFreeze: missedAtLeastOneDay,
        lastActiveDate
    };
}
