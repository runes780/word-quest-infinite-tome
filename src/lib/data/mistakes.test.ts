import type { MistakeRecord } from '@/db/db';
import {
    buildRepeatedCauseActionSuggestion,
    buildRepeatedCauseIntensityAlert,
    computeRepeatedCauseSnapshot,
    computeRepeatedCauseTrends,
    evaluateRepeatedCauseGoal,
    evaluateRepeatedCauseGoalAgainstBaseline
} from './mistakes';

function row(overrides: Partial<MistakeRecord>): MistakeRecord {
    return {
        questionId: 1,
        questionText: 'q',
        wrongAnswer: 'a',
        correctAnswer: 'b',
        explanation: 'exp',
        timestamp: Date.now(),
        ...overrides
    };
}

describe('computeRepeatedCauseSnapshot', () => {
    test('computes repeat rate from repeated cause tags', () => {
        const now = Date.now();
        const records: MistakeRecord[] = [
            row({ mentorCauseTag: 'tense_confusion', timestamp: now - 1000 }),
            row({ mentorCauseTag: 'tense_confusion', timestamp: now - 2000 }),
            row({ mentorCauseTag: 'inference_gap', timestamp: now - 3000 }),
            row({ mentorCauseTag: 'collocation_mixup', timestamp: now - 4000 }),
            row({ mentorCauseTag: 'collocation_mixup', timestamp: now - 5000 })
        ];

        const snapshot = computeRepeatedCauseSnapshot(records, 14, now);
        expect(snapshot.taggedMistakes).toBe(5);
        expect(snapshot.repeatedMistakes).toBe(4);
        expect(snapshot.repeatRate).toBeCloseTo(0.8, 5);
        expect(snapshot.topCauses[0].causeTag).toBe('tense_confusion');
        expect(snapshot.topCauses[0].count).toBe(2);
    });

    test('ignores old records outside window and blank tags', () => {
        const now = Date.now();
        const old = now - (30 * 24 * 60 * 60 * 1000);
        const records: MistakeRecord[] = [
            row({ mentorCauseTag: 'tense_confusion', timestamp: old }),
            row({ mentorCauseTag: '', timestamp: now - 500 }),
            row({ timestamp: now - 200 })
        ];

        const snapshot = computeRepeatedCauseSnapshot(records, 7, now);
        expect(snapshot.taggedMistakes).toBe(0);
        expect(snapshot.repeatedMistakes).toBe(0);
        expect(snapshot.repeatRate).toBe(0);
        expect(snapshot.topCauses).toHaveLength(0);
    });
});

describe('computeRepeatedCauseTrends', () => {
    test('calculates current vs previous window deltas for 7/14/30 days', () => {
        const day = 24 * 60 * 60 * 1000;
        const now = Date.now();
        const records: MistakeRecord[] = [
            row({ mentorCauseTag: 'tense_confusion', timestamp: now - day }),
            row({ mentorCauseTag: 'tense_confusion', timestamp: now - (2 * day) }),
            row({ mentorCauseTag: 'inference_gap', timestamp: now - (3 * day) }),
            row({ mentorCauseTag: 'collocation_mixup', timestamp: now - (8 * day) }),
            row({ mentorCauseTag: 'collocation_mixup', timestamp: now - (9 * day) }),
            row({ mentorCauseTag: 'inference_gap', timestamp: now - (10 * day) }),
            row({ mentorCauseTag: 'inference_gap', timestamp: now - (11 * day) }),
            row({ mentorCauseTag: 'inference_gap', timestamp: now - (20 * day) }),
            row({ mentorCauseTag: 'inference_gap', timestamp: now - (21 * day) })
        ];

        const trends = computeRepeatedCauseTrends(records, [7, 14, 30], now);
        expect(trends).toHaveLength(3);
        expect(trends[0].windowDays).toBe(7);
        expect(trends[0].current.taggedMistakes).toBeGreaterThan(0);
        expect(typeof trends[0].deltaRate).toBe('number');
        expect(typeof trends[1].relativeDelta).toBe('number');
    });
});

describe('evaluateRepeatedCauseGoal', () => {
    test('marks row as passed when relative reduction reaches target', () => {
        const summary = evaluateRepeatedCauseGoal([
            {
                windowDays: 14,
                current: {
                    windowDays: 14,
                    taggedMistakes: 10,
                    repeatedMistakes: 4,
                    repeatRate: 0.4,
                    topCauses: []
                },
                previous: {
                    windowDays: 14,
                    taggedMistakes: 10,
                    repeatedMistakes: 6,
                    repeatRate: 0.6,
                    topCauses: []
                },
                deltaRate: -0.2,
                relativeDelta: -1 / 3
            }
        ], 0.2, 5);

        expect(summary.rows[0].status).toBe('passed');
        expect(summary.overallStatus).toBe('passed');
    });

    test('marks insufficient when sample size is too small', () => {
        const summary = evaluateRepeatedCauseGoal([
            {
                windowDays: 7,
                current: {
                    windowDays: 7,
                    taggedMistakes: 3,
                    repeatedMistakes: 2,
                    repeatRate: 2 / 3,
                    topCauses: []
                },
                previous: {
                    windowDays: 7,
                    taggedMistakes: 4,
                    repeatedMistakes: 3,
                    repeatRate: 0.75,
                    topCauses: []
                },
                deltaRate: -0.0833,
                relativeDelta: -0.111
            }
        ], 0.2, 5);

        expect(summary.rows[0].status).toBe('insufficient');
        expect(summary.overallStatus).toBe('insufficient');
    });
});

describe('evaluateRepeatedCauseGoalAgainstBaseline', () => {
    test('uses historical baseline window and marks passed when >=20% lower', () => {
        const day = 24 * 60 * 60 * 1000;
        const now = Date.now();
        const records: MistakeRecord[] = [];

        // Current 7d window: 10 tagged, 2 repeated => 20%
        for (let i = 0; i < 8; i++) {
            records.push(row({ mentorCauseTag: `tag_${i}`, timestamp: now - (i * 0.5 * day) }));
        }
        records.push(row({ mentorCauseTag: 'repeat_a', timestamp: now - (5 * 60 * 1000) }));
        records.push(row({ mentorCauseTag: 'repeat_a', timestamp: now - (10 * 60 * 1000) }));

        // Baseline window 4 periods back: 10 tagged, 6 repeated => 60%
        const baselineBase = now - (4 * 7 * day) + day;
        records.push(row({ mentorCauseTag: 'repeat_b', timestamp: baselineBase }));
        records.push(row({ mentorCauseTag: 'repeat_b', timestamp: baselineBase + 1000 }));
        records.push(row({ mentorCauseTag: 'repeat_c', timestamp: baselineBase + 2000 }));
        records.push(row({ mentorCauseTag: 'repeat_c', timestamp: baselineBase + 3000 }));
        records.push(row({ mentorCauseTag: 'repeat_d', timestamp: baselineBase + 4000 }));
        records.push(row({ mentorCauseTag: 'repeat_d', timestamp: baselineBase + 5000 }));
        records.push(row({ mentorCauseTag: 'uniq_1', timestamp: baselineBase + 6000 }));
        records.push(row({ mentorCauseTag: 'uniq_2', timestamp: baselineBase + 7000 }));
        records.push(row({ mentorCauseTag: 'uniq_3', timestamp: baselineBase + 8000 }));
        records.push(row({ mentorCauseTag: 'uniq_4', timestamp: baselineBase + 9000 }));

        const summary = evaluateRepeatedCauseGoalAgainstBaseline(records, [7], 0.2, 5, 8, now);
        expect(summary.rows[0].status).toBe('passed');
        expect(summary.rows[0].baselineWindowOffset).toBeGreaterThan(0);
        expect(summary.rows[0].reductionFromBaseline).toBeGreaterThanOrEqual(0.2);
        expect(summary.overallStatus).toBe('passed');
    });

    test('marks insufficient when no baseline with enough tagged data', () => {
        const now = Date.now();
        const records: MistakeRecord[] = [
            row({ mentorCauseTag: 'repeat_a', timestamp: now - 1000 }),
            row({ mentorCauseTag: 'repeat_a', timestamp: now - 2000 }),
            row({ mentorCauseTag: 'unique', timestamp: now - 3000 })
        ];

        const summary = evaluateRepeatedCauseGoalAgainstBaseline(records, [7], 0.2, 5, 8, now);
        expect(summary.rows[0].status).toBe('insufficient');
        expect(summary.overallStatus).toBe('insufficient');
    });
});

describe('buildRepeatedCauseActionSuggestion', () => {
    test('returns reduce action when goal not met', () => {
        const summary = {
            targetReduction: 0.2,
            overallStatus: 'not_met' as const,
            rows: [{
                windowDays: 14,
                targetReduction: 0.2,
                status: 'not_met' as const,
                currentRate: 0.6,
                baselineRate: 0.7,
                reductionFromBaseline: 0.14,
                currentTagged: 12,
                baselineTagged: 12,
                baselineWindowOffset: 2
            }]
        };
        const snapshot = {
            windowDays: 14,
            taggedMistakes: 12,
            repeatedMistakes: 7,
            repeatRate: 0.58,
            topCauses: [{ causeTag: 'tense_confusion', count: 4 }]
        };

        const action = buildRepeatedCauseActionSuggestion(summary, snapshot);
        expect(action.reason).toBe('reduce');
        expect(action.recommendedQuestions).toBe(5);
        expect(action.intensity).toBe('standard');
        expect(action.focusCauseTag).toBe('tense_confusion');
    });

    test('returns collect action when insufficient data', () => {
        const summary = {
            targetReduction: 0.2,
            overallStatus: 'insufficient' as const,
            rows: [{
                windowDays: 7,
                targetReduction: 0.2,
                status: 'insufficient' as const,
                currentRate: 0,
                baselineRate: 0,
                reductionFromBaseline: 0,
                currentTagged: 2,
                baselineTagged: 0,
                baselineWindowOffset: -1
            }]
        };

        const action = buildRepeatedCauseActionSuggestion(summary);
        expect(action.reason).toBe('collect');
        expect(action.recommendedQuestions).toBe(3);
        expect(action.intensity).toBe('standard');
    });

    test('escalates to intensive pack when not met and targeted accuracy is low', () => {
        const summary = {
            targetReduction: 0.2,
            overallStatus: 'not_met' as const,
            rows: [{
                windowDays: 14,
                targetReduction: 0.2,
                status: 'not_met' as const,
                currentRate: 0.6,
                baselineRate: 0.7,
                reductionFromBaseline: 0.14,
                currentTagged: 12,
                baselineTagged: 12,
                baselineWindowOffset: 2
            }]
        };

        const action = buildRepeatedCauseActionSuggestion(summary, undefined, {
            targetedSessions: 3,
            targetedAvgAccuracy: 0.5,
            targetedSuccessRuns: 0
        });
        expect(action.reason).toBe('reduce');
        expect(action.intensity).toBe('intensive');
        expect(action.recommendedQuestions).toBe(7);
    });

    test('escalates to intensive when not met and consecutive low runs keep happening', () => {
        const summary = {
            targetReduction: 0.2,
            overallStatus: 'not_met' as const,
            rows: [{
                windowDays: 14,
                targetReduction: 0.2,
                status: 'not_met' as const,
                currentRate: 0.6,
                baselineRate: 0.7,
                reductionFromBaseline: 0.14,
                currentTagged: 12,
                baselineTagged: 12,
                baselineWindowOffset: 2
            }]
        };

        const action = buildRepeatedCauseActionSuggestion(summary, undefined, {
            targetedSessions: 5,
            targetedAvgAccuracy: 0.72,
            targetedSuccessRuns: 1,
            targetedConsecutiveLowRuns: 2
        });
        expect(action.reason).toBe('reduce');
        expect(action.intensity).toBe('intensive');
        expect(action.recommendedQuestions).toBe(7);
    });
});

describe('buildRepeatedCauseIntensityAlert', () => {
    test('returns warning when intensive streak reaches threshold', () => {
        const alert = buildRepeatedCauseIntensityAlert(
            {
                status: 'not_met',
                recommendedQuestions: 7,
                reason: 'reduce',
                intensity: 'intensive',
                rationale: 'r'
            },
            { targetedConsecutiveLowRuns: 2 }
        );
        expect(alert?.level).toBe('warning');
        expect(alert?.active).toBe(true);
    });

    test('returns critical when intensive streak is long', () => {
        const alert = buildRepeatedCauseIntensityAlert(
            {
                status: 'not_met',
                recommendedQuestions: 7,
                reason: 'reduce',
                intensity: 'intensive',
                rationale: 'r'
            },
            { targetedConsecutiveLowRuns: 4 }
        );
        expect(alert?.level).toBe('critical');
    });

    test('returns null when action is not intensive', () => {
        const alert = buildRepeatedCauseIntensityAlert(
            {
                status: 'passed',
                recommendedQuestions: 3,
                reason: 'maintain',
                intensity: 'light',
                rationale: 'r'
            },
            { targetedConsecutiveLowRuns: 5 }
        );
        expect(alert).toBeNull();
    });
});
