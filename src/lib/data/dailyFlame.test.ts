import type { GlobalPlayerProfile } from '@/db/db';
import { buildDailyFlameStatus } from './dailyFlame';

const baseProfile: GlobalPlayerProfile = {
    totalXp: 120,
    globalLevel: 2,
    totalGold: 80,
    dailyStreak: 6,
    lastActiveDate: '2026-06-03',
    dailyXpGoal: 50,
    dailyXpEarned: 20,
    wordsLearned: 12,
    lessonsCompleted: 4,
    totalStudyMinutes: 18,
    perfectLessons: 1,
    vocabMastery: 30,
    grammarMastery: 20,
    readingMastery: 10,
    ownedRelics: [],
    createdAt: 1,
    updatedAt: 1
};

describe('daily flame status', () => {
    test('marks today protected once the daily XP goal is met', () => {
        const status = buildDailyFlameStatus({
            profile: {
                ...baseProfile,
                lastActiveDate: '2026-06-04',
                dailyXpEarned: 55
            },
            now: new Date('2026-06-04T10:00:00.000Z').getTime()
        });

        expect(status.state).toBe('protected');
        expect(status.streakDays).toBe(6);
        expect(status.remainingXp).toBe(0);
        expect(status.progressPercent).toBe(100);
    });

    test('carries yesterday streak into today and asks for a fresh daily goal', () => {
        const status = buildDailyFlameStatus({
            profile: baseProfile,
            now: new Date('2026-06-04T10:00:00.000Z').getTime()
        });

        expect(status.state).toBe('needs-practice');
        expect(status.streakDays).toBe(6);
        expect(status.remainingXp).toBe(50);
        expect(status.canUseFreeze).toBe(false);
    });

    test('tracks partial progress made today toward the flame', () => {
        const status = buildDailyFlameStatus({
            profile: {
                ...baseProfile,
                lastActiveDate: '2026-06-04',
                dailyXpEarned: 20
            },
            now: new Date('2026-06-04T10:00:00.000Z').getTime()
        });

        expect(status.state).toBe('needs-practice');
        expect(status.remainingXp).toBe(30);
        expect(status.progressPercent).toBe(40);
        expect(status.canUseFreeze).toBe(false);
    });

    test('offers freeze guidance after a missed day instead of showing a dead streak', () => {
        const status = buildDailyFlameStatus({
            profile: {
                ...baseProfile,
                lastActiveDate: '2026-06-01',
                dailyStreak: 14,
                dailyXpEarned: 0
            },
            now: new Date('2026-06-04T10:00:00.000Z').getTime()
        });

        expect(status.state).toBe('at-risk');
        expect(status.streakDays).toBe(14);
        expect(status.canUseFreeze).toBe(true);
        expect(status.remainingXp).toBe(50);
    });
});
