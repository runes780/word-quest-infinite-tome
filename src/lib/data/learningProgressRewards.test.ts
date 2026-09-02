import {
    buildLearningProgressRewardSummary,
    classifyLearningProgressReward,
    LEARNING_PROGRESS_SESSION_CAP,
    planLearningProgressReward,
    type ProgressRewardEvidence
} from './learningProgressRewards';

describe('learning progress rewards', () => {
    test('prioritizes repair, delayed recall, transfer, and independent evidence', () => {
        expect(classifyLearningProgressReward({ source: 'battle', isImmediateRepair: true, attemptKind: 'transfer' }))
            .toBe('repair-success');
        expect(classifyLearningProgressReward({ source: 'srs', attemptKind: 'review', supportLevel: 0, assessmentRole: 'delayed-probe', evidenceStrength: 'delayed-independent' }))
            .toBe('delayed-recall');
        expect(classifyLearningProgressReward({ source: 'battle', attemptKind: 'transfer', supportLevel: 0, assessmentRole: 'transfer', evidenceStrength: 'transfer-independent' }))
            .toBe('transfer-success');
        expect(classifyLearningProgressReward({ source: 'battle', attemptKind: 'practice', supportLevel: 0, assessmentRole: 'practice', evidenceStrength: 'independent' }))
            .toBe('independent-success');
        expect(classifyLearningProgressReward({ source: 'battle', attemptKind: 'practice', supportLevel: 2 }))
            .toBe('supported-practice');
    });

    test('does not reward a wrong answer', () => {
        expect(planLearningProgressReward({
            source: 'battle',
            questionHash: 'q1',
            isCorrect: false,
            priorEvidence: []
        })).toBeNull();
    });

    test('gives stronger evidence more value than supported practice', () => {
        const practice = planLearningProgressReward({
            source: 'battle', questionHash: 'practice', isCorrect: true, supportLevel: 2, priorEvidence: []
        });
        const transfer = planLearningProgressReward({
            source: 'battle', questionHash: 'transfer', isCorrect: true, attemptKind: 'transfer', supportLevel: 0,
            assessmentRole: 'transfer', evidenceStrength: 'transfer-independent', priorEvidence: []
        });
        expect(transfer?.xp).toBeGreaterThan(practice?.xp || 0);
        expect(transfer?.gold).toBeGreaterThan(practice?.gold || 0);
    });

    test('protects against repeated questions and per-kind farming', () => {
        const counted = (questionHash: string): ProgressRewardEvidence => ({
            questionHash,
            progressReward: { kind: 'supported-practice', xp: 8, gold: 4, counted: true }
        });
        expect(planLearningProgressReward({
            source: 'battle', questionHash: 'q1', isCorrect: true, priorEvidence: [counted('q1')]
        })).toEqual(expect.objectContaining({ counted: false, protectionReason: 'duplicate-evidence' }));
        expect(planLearningProgressReward({
            source: 'battle', questionHash: 'q3', isCorrect: true, priorEvidence: [counted('q1'), counted('q2')]
        })).toEqual(expect.objectContaining({ counted: false, protectionReason: 'kind-cap' }));
    });

    test('enforces the total session cap across reward kinds', () => {
        const priorEvidence: ProgressRewardEvidence[] = Array.from({ length: LEARNING_PROGRESS_SESSION_CAP }, (_, index) => ({
            questionHash: `prior-${index}`,
            progressReward: {
                kind: index % 2 === 0 ? 'repair-success' : 'delayed-recall',
                xp: 14,
                gold: 8,
                counted: true
            }
        }));
        expect(planLearningProgressReward({
            source: 'battle', questionHash: 'new', isCorrect: true, attemptKind: 'transfer', priorEvidence
        })).toEqual(expect.objectContaining({ counted: false, protectionReason: 'session-cap' }));
    });

    test('builds aggregate-only summaries from session and persisted event shapes', () => {
        const summary = buildLearningProgressRewardSummary([
            { progressReward: { kind: 'repair-success', xp: 14, gold: 8, counted: true } },
            { progressRewardKind: 'delayed-recall', rewardXp: 18, rewardGold: 10, rewardCounted: true },
            { progressRewardKind: 'supported-practice', rewardCounted: false, rewardProtectionReason: 'kind-cap' }
        ]);
        expect(summary).toEqual(expect.objectContaining({
            countedRewards: 2,
            protectedAttempts: 1,
            totalXp: 32,
            totalGold: 18,
            strongEvidenceCount: 1
        }));
        expect(JSON.stringify(summary)).not.toMatch(/questionHash|questionText|answer/i);
    });

    test('does not pay strong-evidence rewards for unreviewed measurement labels', () => {
        expect(planLearningProgressReward({
            source: 'battle',
            questionHash: 'unreviewed-transfer',
            isCorrect: true,
            attemptKind: 'transfer',
            supportLevel: 0,
            assessmentRole: 'transfer',
            evidenceStrength: 'no-credit',
            priorEvidence: []
        })).toBeNull();
    });
});
