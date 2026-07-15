import type {
    LearningEventAttemptKind,
    LearningEventResult,
    LearningEventScaffoldReason,
    LearningEventScaffoldTransition,
    LearningEventSupportLevel
} from '@/db/db';

export type ScaffoldTransition = LearningEventScaffoldTransition;
export type ScaffoldDecisionReason = LearningEventScaffoldReason;

export interface ScaffoldEvidenceRecord {
    eventType?: 'answer' | 'hint' | 'session_complete';
    learningObjectiveId?: string;
    skillTag?: string;
    isCorrect?: boolean;
    result?: LearningEventResult;
    supportLevel?: LearningEventSupportLevel;
    attemptKind?: LearningEventAttemptKind;
    hintUsed?: boolean;
    isImmediateRepair?: boolean;
    scaffoldTransition?: ScaffoldTransition;
    scaffoldReason?: ScaffoldDecisionReason;
    nextSupportLevel?: LearningEventSupportLevel;
    nextAttemptKind?: LearningEventAttemptKind;
}

export interface ScaffoldDecisionEvidence {
    recentAttempts: number;
    recentCorrect: number;
    recentHintUses: number;
    consecutiveWrong: number;
    consecutiveNoHintSuccessesAtLevel: number;
    transferAttempts: number;
    transferCorrect: number;
}

export interface AdaptiveScaffoldDecision {
    transition: ScaffoldTransition;
    reason: ScaffoldDecisionReason;
    nextSupportLevel: LearningEventSupportLevel;
    nextAttemptKind: LearningEventAttemptKind;
    evidence: ScaffoldDecisionEvidence;
}

export interface ScaffoldFadingSummary {
    answerCount: number;
    supportedAttempts: number;
    independentAttempts: number;
    hintUsedAnswers: number;
    hintDependencyRate: number | null;
    fadedSteps: number;
    increasedSupportSteps: number;
    repairSteps: number;
    transferReadySignals: number;
    transferAttempts: number;
    transferCorrect: number;
    transferAccuracy: number | null;
}

const WINDOW_SIZE = 6;

const isCorrect = (row: ScaffoldEvidenceRecord) =>
    row.result ? row.result === 'correct' : row.isCorrect === true;

const isWrong = (row: ScaffoldEvidenceRecord) =>
    row.result ? row.result === 'wrong' : row.isCorrect === false;

const isAnswerEvidence = (row: ScaffoldEvidenceRecord) =>
    row.eventType === undefined || row.eventType === 'answer';

const objectiveKey = (row: ScaffoldEvidenceRecord) =>
    row.learningObjectiveId || row.skillTag || 'core';

function summarizeEvidence(rows: ScaffoldEvidenceRecord[], currentSupport: LearningEventSupportLevel): ScaffoldDecisionEvidence {
    const recent = rows.slice(-WINDOW_SIZE);
    let consecutiveWrong = 0;
    for (let index = recent.length - 1; index >= 0; index -= 1) {
        if (!isWrong(recent[index])) break;
        consecutiveWrong += 1;
    }

    let consecutiveNoHintSuccessesAtLevel = 0;
    for (let index = recent.length - 1; index >= 0; index -= 1) {
        const row = recent[index];
        if (!isCorrect(row) || row.hintUsed || row.isImmediateRepair || row.attemptKind === 'transfer') break;
        const support = row.supportLevel ?? 3;
        if (support > currentSupport) break;
        consecutiveNoHintSuccessesAtLevel += 1;
    }

    const transferRows = recent.filter((row) => row.attemptKind === 'transfer' || row.supportLevel === 0);
    return {
        recentAttempts: recent.length,
        recentCorrect: recent.filter(isCorrect).length,
        recentHintUses: recent.filter((row) => row.hintUsed).length,
        consecutiveWrong,
        consecutiveNoHintSuccessesAtLevel,
        transferAttempts: transferRows.length,
        transferCorrect: transferRows.filter(isCorrect).length
    };
}

export function decideAdaptiveScaffold(input: {
    current: ScaffoldEvidenceRecord;
    priorEvidence?: ScaffoldEvidenceRecord[];
}): AdaptiveScaffoldDecision {
    const current = input.current;
    const key = objectiveKey(current);
    const relevant = [...(input.priorEvidence || []), current]
        .filter(isAnswerEvidence)
        .filter((row) => objectiveKey(row) === key);
    const currentSupport = current.supportLevel ?? 3;
    const currentAttempt = current.attemptKind || (currentSupport === 0 ? 'transfer' : 'practice');
    const evidence = summarizeEvidence(relevant, currentSupport);

    if (isWrong(current)) {
        const transferFailure = currentAttempt === 'transfer' || currentSupport === 0;
        return {
            transition: 'repair',
            reason: transferFailure ? 'transfer-repair' : 'answer-repair',
            nextSupportLevel: transferFailure
                ? 2
                : Math.min(3, Math.max(2, currentSupport + 1)) as LearningEventSupportLevel,
            nextAttemptKind: 'practice',
            evidence
        };
    }

    if (current.hintUsed) {
        const nextSupportLevel = Math.max(2, currentSupport) as LearningEventSupportLevel;
        return {
            transition: nextSupportLevel > currentSupport ? 'increase' : 'hold',
            reason: 'hint-dependence',
            nextSupportLevel,
            nextAttemptKind: 'practice',
            evidence
        };
    }

    if (current.isImmediateRepair && isCorrect(current)) {
        return {
            transition: 'hold',
            reason: 'repair-confirmation',
            nextSupportLevel: 2,
            nextAttemptKind: 'practice',
            evidence
        };
    }

    if ((currentAttempt === 'transfer' || currentSupport === 0) && isCorrect(current)) {
        return {
            transition: 'hold',
            reason: 'transfer-confirmed',
            nextSupportLevel: 0,
            nextAttemptKind: 'transfer',
            evidence
        };
    }

    if (evidence.consecutiveNoHintSuccessesAtLevel >= 2) {
        if (currentSupport <= 1) {
            return {
                transition: 'transfer',
                reason: 'transfer-ready',
                nextSupportLevel: 0,
                nextAttemptKind: 'transfer',
                evidence
            };
        }
        return {
            transition: 'fade',
            reason: 'stable-success',
            nextSupportLevel: (currentSupport - 1) as LearningEventSupportLevel,
            nextAttemptKind: 'practice',
            evidence
        };
    }

    return {
        transition: 'hold',
        reason: 'collect-more-evidence',
        nextSupportLevel: currentSupport,
        nextAttemptKind: currentAttempt,
        evidence
    };
}

export function scaffoldDecisionMessage(
    decision: AdaptiveScaffoldDecision,
    language: 'en' | 'zh' = 'en'
): string {
    const messages = language === 'zh'
        ? {
            'collect-more-evidence': '先保持当前帮助强度；需要更多同目标证据后再调整。',
            'hint-dependence': '这次使用了提示，下一题保留支架，避免过早撤掉帮助。',
            'answer-repair': '下一步先做一次带支架补救，再回到原学习路径。',
            'transfer-repair': '新语境暂未成功；先回到带支架练习，这不是能力定论。',
            'repair-confirmation': '补救已完成；下一题保留部分支架，再确认一次。',
            'stable-success': '已连续两次无提示答对；下一题减少一级帮助。',
            'transfer-ready': '已在较少帮助下连续成功；下一步尝试新语境迁移。',
            'transfer-confirmed': '已获得一次新语境成功证据；后续用间隔复习继续确认。'
        }
        : {
            'collect-more-evidence': 'Keep the current support while we collect more evidence for this objective.',
            'hint-dependence': 'A hint helped this time, so the next item keeps support instead of fading too early.',
            'answer-repair': 'Next comes one scaffolded repair before returning to the learning path.',
            'transfer-repair': 'The fresh context needs repair; this is support evidence, not an ability verdict.',
            'repair-confirmation': 'Repair completed; the next item keeps partial support for one more check.',
            'stable-success': 'Two no-hint successes at this level: the next item removes one level of support.',
            'transfer-ready': 'Two low-support successes: the next step is a fresh-context transfer.',
            'transfer-confirmed': 'One fresh-context success is recorded; spaced review will confirm it later.'
        };
    return messages[decision.reason];
}

export function buildScaffoldFadingSummary(rows: ScaffoldEvidenceRecord[]): ScaffoldFadingSummary {
    const answers = rows.filter(isAnswerEvidence);
    const supportedAttempts = answers.filter((row) => typeof row.supportLevel === 'number' && row.supportLevel >= 2).length;
    const independentAttempts = answers.filter((row) =>
        typeof row.supportLevel === 'number' &&
        row.supportLevel <= 1 &&
        row.attemptKind !== 'transfer'
    ).length;
    const hintUsedAnswers = answers.filter((row) => row.hintUsed).length;
    const transferRows = answers.filter((row) => row.attemptKind === 'transfer' || row.supportLevel === 0);
    const transferCorrect = transferRows.filter(isCorrect).length;

    return {
        answerCount: answers.length,
        supportedAttempts,
        independentAttempts,
        hintUsedAnswers,
        hintDependencyRate: answers.length > 0 ? hintUsedAnswers / answers.length : null,
        fadedSteps: answers.filter((row) => row.scaffoldTransition === 'fade').length,
        increasedSupportSteps: answers.filter((row) => row.scaffoldTransition === 'increase').length,
        repairSteps: answers.filter((row) => row.scaffoldTransition === 'repair').length,
        transferReadySignals: answers.filter((row) => row.scaffoldReason === 'transfer-ready').length,
        transferAttempts: transferRows.length,
        transferCorrect,
        transferAccuracy: transferRows.length > 0 ? transferCorrect / transferRows.length : null
    };
}
