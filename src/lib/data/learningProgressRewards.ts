import type {
    LearningEventAttemptKind,
    LearningEventSource,
    LearningEventSupportLevel
} from '@/db/db';
import type { AssessmentRole, EvidenceStrength } from './learningEvidenceContract';

export type LearningProgressRewardKind =
    | 'supported-practice'
    | 'independent-success'
    | 'repair-success'
    | 'delayed-recall'
    | 'transfer-success';

export type LearningProgressProtectionReason =
    | 'duplicate-evidence'
    | 'kind-cap'
    | 'session-cap';

export interface LearningProgressReward {
    kind: LearningProgressRewardKind;
    xp: number;
    gold: number;
    counted: boolean;
    protectionReason?: LearningProgressProtectionReason;
}

export interface ProgressRewardEvidence {
    questionHash?: string;
    isCorrect?: boolean;
    result?: 'correct' | 'wrong';
    attemptKind?: LearningEventAttemptKind;
    supportLevel?: LearningEventSupportLevel;
    isImmediateRepair?: boolean;
    progressReward?: LearningProgressReward;
    progressRewardKind?: LearningProgressRewardKind;
    rewardXp?: number;
    rewardGold?: number;
    rewardCounted?: boolean;
    rewardProtectionReason?: LearningProgressProtectionReason;
    timestamp?: number;
}

export interface LearningProgressRewardSummary {
    countedRewards: number;
    protectedAttempts: number;
    totalXp: number;
    totalGold: number;
    strongEvidenceCount: number;
    byKind: Record<LearningProgressRewardKind, number>;
}

export const LEARNING_PROGRESS_REWARD_RULES: Record<
    LearningProgressRewardKind,
    { xp: number; gold: number; perSessionCap: number }
> = {
    'supported-practice': { xp: 8, gold: 4, perSessionCap: 2 },
    'independent-success': { xp: 12, gold: 6, perSessionCap: 2 },
    'repair-success': { xp: 14, gold: 8, perSessionCap: 2 },
    'delayed-recall': { xp: 14, gold: 8, perSessionCap: 3 },
    'transfer-success': { xp: 18, gold: 10, perSessionCap: 2 }
};

export const LEARNING_PROGRESS_SESSION_CAP = 6;

function emptyKindCounts(): Record<LearningProgressRewardKind, number> {
    return {
        'supported-practice': 0,
        'independent-success': 0,
        'repair-success': 0,
        'delayed-recall': 0,
        'transfer-success': 0
    };
}

export function classifyLearningProgressReward(input: {
    source: LearningEventSource;
    attemptKind?: LearningEventAttemptKind;
    supportLevel?: LearningEventSupportLevel;
    isImmediateRepair?: boolean;
    assessmentRole?: AssessmentRole;
    evidenceStrength?: EvidenceStrength;
}): LearningProgressRewardKind {
    if (input.isImmediateRepair) return 'repair-success';
    if (input.assessmentRole === 'delayed-probe' && input.evidenceStrength === 'delayed-independent') return 'delayed-recall';
    if (input.evidenceStrength === 'transfer-independent') return 'transfer-success';
    if (input.evidenceStrength === 'independent') return 'independent-success';
    return 'supported-practice';
}

export function planLearningProgressReward(input: {
    source: LearningEventSource;
    questionHash: string;
    isCorrect: boolean;
    attemptKind?: LearningEventAttemptKind;
    supportLevel?: LearningEventSupportLevel;
    isImmediateRepair?: boolean;
    assessmentRole?: AssessmentRole;
    evidenceStrength?: EvidenceStrength;
    priorEvidence: ProgressRewardEvidence[];
}): LearningProgressReward | null {
    if (!input.isCorrect || input.evidenceStrength === 'no-credit') return null;

    const kind = classifyLearningProgressReward(input);
    const rule = LEARNING_PROGRESS_REWARD_RULES[kind];
    const countedPrior = input.priorEvidence.filter((entry) => entry.progressReward?.counted);
    const duplicate = countedPrior.some((entry) => entry.questionHash === input.questionHash);
    const kindCount = countedPrior.filter((entry) => entry.progressReward?.kind === kind).length;

    let protectionReason: LearningProgressProtectionReason | undefined;
    if (duplicate) protectionReason = 'duplicate-evidence';
    else if (countedPrior.length >= LEARNING_PROGRESS_SESSION_CAP) protectionReason = 'session-cap';
    else if (kindCount >= rule.perSessionCap) protectionReason = 'kind-cap';

    if (protectionReason) {
        return { kind, xp: 0, gold: 0, counted: false, protectionReason };
    }

    return { kind, xp: rule.xp, gold: rule.gold, counted: true };
}

function rewardFromEvidence(entry: ProgressRewardEvidence): LearningProgressReward | null {
    if (entry.progressReward) return entry.progressReward;
    if (!entry.progressRewardKind) return null;
    return {
        kind: entry.progressRewardKind,
        xp: entry.rewardXp || 0,
        gold: entry.rewardGold || 0,
        counted: entry.rewardCounted !== false,
        protectionReason: entry.rewardProtectionReason
    };
}

export function buildLearningProgressRewardSummary(
    evidence: ProgressRewardEvidence[],
    options: { now?: number; windowDays?: number } = {}
): LearningProgressRewardSummary {
    const now = options.now ?? Date.now();
    const start = typeof options.windowDays === 'number'
        ? now - options.windowDays * 24 * 60 * 60 * 1000
        : null;
    const byKind = emptyKindCounts();
    let countedRewards = 0;
    let protectedAttempts = 0;
    let totalXp = 0;
    let totalGold = 0;

    evidence.forEach((entry) => {
        if (
            start !== null &&
            typeof entry.timestamp === 'number' &&
            (entry.timestamp < start || entry.timestamp > now)
        ) return;
        const reward = rewardFromEvidence(entry);
        if (!reward) return;
        if (!reward.counted) {
            protectedAttempts += 1;
            return;
        }
        countedRewards += 1;
        totalXp += reward.xp;
        totalGold += reward.gold;
        byKind[reward.kind] += 1;
    });

    return {
        countedRewards,
        protectedAttempts,
        totalXp,
        totalGold,
        strongEvidenceCount:
            byKind['independent-success'] +
            byKind['delayed-recall'] +
            byKind['transfer-success'],
        byKind
    };
}
