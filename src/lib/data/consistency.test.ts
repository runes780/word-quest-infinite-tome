import { GlobalPlayerProfile, HistoryRecord, LearningEvent } from '@/db/db';
import { computeDataConsistencyAudit } from './consistency';

function profile(overrides: Partial<GlobalPlayerProfile>): GlobalPlayerProfile {
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
        createdAt: 0,
        updatedAt: 0,
        ...overrides
    };
}

function event(overrides: Partial<LearningEvent>): LearningEvent {
    return {
        eventType: 'answer',
        source: 'battle',
        timestamp: Date.now(),
        result: 'correct',
        ...overrides
    };
}

function history(overrides: Partial<HistoryRecord>): HistoryRecord {
    return {
        timestamp: Date.now(),
        score: 50,
        totalQuestions: 5,
        levelTitle: 'Mission',
        totalCorrect: 4,
        ...overrides
    };
}

describe('computeDataConsistencyAudit', () => {
    test('returns ok when profile/history are aligned with events', () => {
        const now = Date.UTC(2026, 1, 8, 12, 0, 0);
        const day = 24 * 60 * 60 * 1000;
        const events: LearningEvent[] = [
            event({ timestamp: now - day, result: 'correct', source: 'battle' }),
            event({ timestamp: now - day + 1000, result: 'correct', source: 'battle' }),
            event({ timestamp: now - day + 2000, result: 'correct', source: 'battle' }),
            event({ timestamp: now - day + 3000, result: 'correct', source: 'battle' }),
            event({ timestamp: now - day + 4000, result: 'correct', source: 'battle' }),
            event({ timestamp: now - day + 5000, result: 'wrong', source: 'battle' }),
            event({ timestamp: now - day + 6000, result: 'correct', source: 'daily' }),
            event({ timestamp: now - day + 7000, eventType: 'session_complete', source: 'battle', result: undefined }),
            event({ timestamp: now - day + 7100, eventType: 'session_complete', source: 'battle', result: undefined }),
            event({ timestamp: now - day + 7200, eventType: 'session_complete', source: 'battle', result: undefined }),
            event({ timestamp: now - day + 7300, eventType: 'session_complete', source: 'daily', result: undefined })
        ];
        const rows: HistoryRecord[] = [
            history({
                timestamp: now - day + 100,
                totalQuestions: 2,
                totalCorrect: 2,
                levelTitle: 'Battle Mission'
            }),
            history({
                timestamp: now - day + 200,
                totalQuestions: 2,
                totalCorrect: 2,
                levelTitle: 'Battle Mission 2'
            }),
            history({
                timestamp: now - day + 300,
                totalQuestions: 2,
                totalCorrect: 1,
                levelTitle: 'Battle Mission 3'
            })
        ];
        const snapshot = computeDataConsistencyAudit({
            profile: profile({
                wordsLearned: 6,
                lessonsCompleted: 4
            }),
            events,
            history: rows,
            generatedAt: now
        });
        expect(snapshot.overallStatus).toBe('ok');
        expect(snapshot.checks.every((check) => check.status !== 'warning')).toBe(true);
    });

    test('returns warning when profile falls behind events', () => {
        const now = Date.UTC(2026, 1, 8, 12, 0, 0);
        const events: LearningEvent[] = [
            event({ timestamp: now - 1000, result: 'correct' }),
            event({ timestamp: now - 900, result: 'correct' }),
            event({ timestamp: now - 800, result: 'correct' }),
            event({ timestamp: now - 700, result: 'correct' }),
            event({ timestamp: now - 600, result: 'correct' }),
            event({ timestamp: now - 500, eventType: 'session_complete', result: undefined }),
            event({ timestamp: now - 400, eventType: 'session_complete', result: undefined }),
            event({ timestamp: now - 300, eventType: 'session_complete', result: undefined })
        ];
        const snapshot = computeDataConsistencyAudit({
            profile: profile({
                wordsLearned: 2,
                lessonsCompleted: 1
            }),
            events,
            history: [],
            generatedAt: now
        });
        expect(snapshot.overallStatus).toBe('warning');
        expect(snapshot.checks.find((check) => check.id === 'profile_words_vs_correct_answers')?.status).toBe('warning');
        expect(snapshot.checks.find((check) => check.id === 'profile_lessons_vs_sessions')?.status).toBe('warning');
    });
});
