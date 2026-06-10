import { objectiveTitle, type AttemptKind, type SupportLevel, type UiLanguage } from './learningObjectives';

export interface SessionAnswerEvidence {
    questionId: number;
    questionText: string;
    userChoice: string;
    correctChoice: string;
    isCorrect: boolean;
    learningObjectiveId?: string;
    attemptKind?: AttemptKind;
    supportLevel?: SupportLevel;
    causeTag?: string;
}

export type SessionObjectiveEvidenceState = 'secured' | 'transfer-ready' | 'needs-repair' | 'practice';

export interface SessionObjectiveEvidence {
    objectiveId: string;
    title: string;
    total: number;
    correct: number;
    wrong: number;
    accuracy: number;
    transferAttempts: number;
    transferCorrect: number;
    lowestSupportLevel: number | null;
    state: SessionObjectiveEvidenceState;
    detail: string;
    nextAction: string;
}

export interface SessionLearningClosure {
    objectiveEvidence: SessionObjectiveEvidence[];
    headline: string;
    followUp: string;
}

interface ObjectiveAccumulator {
    total: number;
    correct: number;
    transferAttempts: number;
    transferCorrect: number;
    supportLevels: number[];
}

export function buildSessionLearningClosure(
    answers: SessionAnswerEvidence[],
    language: UiLanguage = 'en'
): SessionLearningClosure {
    const byObjective = new Map<string, ObjectiveAccumulator>();

    answers.forEach((answer) => {
        const objectiveId = answer.learningObjectiveId || 'core';
        const row = byObjective.get(objectiveId) || {
            total: 0,
            correct: 0,
            transferAttempts: 0,
            transferCorrect: 0,
            supportLevels: []
        };
        row.total += 1;
        row.correct += answer.isCorrect ? 1 : 0;
        if (answer.attemptKind === 'transfer' || answer.supportLevel === 0) {
            row.transferAttempts += 1;
            row.transferCorrect += answer.isCorrect ? 1 : 0;
        }
        if (typeof answer.supportLevel === 'number') {
            row.supportLevels.push(answer.supportLevel);
        }
        byObjective.set(objectiveId, row);
    });

    const objectiveEvidence = Array.from(byObjective.entries()).map(([objectiveId, row]) => {
        const wrong = row.total - row.correct;
        const accuracy = row.total > 0 ? row.correct / row.total : 0;
        const lowestSupportLevel = row.supportLevels.length > 0 ? Math.min(...row.supportLevels) : null;
        const state = classifyObjectiveEvidence(row, accuracy);
        return {
            objectiveId,
            title: objectiveTitle(objectiveId, language),
            total: row.total,
            correct: row.correct,
            wrong,
            accuracy,
            transferAttempts: row.transferAttempts,
            transferCorrect: row.transferCorrect,
            lowestSupportLevel,
            state,
            detail: evidenceDetail(row, accuracy, language),
            nextAction: nextActionForState(state, language)
        };
    }).sort((a, b) => {
        if (a.state === 'needs-repair' && b.state !== 'needs-repair') return 1;
        if (a.state !== 'needs-repair' && b.state === 'needs-repair') return -1;
        return b.accuracy - a.accuracy;
    });

    return {
        objectiveEvidence,
        headline: buildHeadline(objectiveEvidence, language),
        followUp: buildFollowUp(objectiveEvidence, language)
    };
}

function classifyObjectiveEvidence(row: ObjectiveAccumulator, accuracy: number): SessionObjectiveEvidenceState {
    if (row.transferCorrect > 0 && accuracy >= 0.8) return 'transfer-ready';
    if (row.total >= 2 && accuracy >= 0.85) return 'secured';
    if (row.total - row.correct > 0 || accuracy < 0.6) return 'needs-repair';
    return 'practice';
}

function evidenceDetail(row: ObjectiveAccumulator, accuracy: number, language: UiLanguage) {
    const accuracyText = `${Math.round(accuracy * 100)}%`;
    if (language === 'zh') {
        return `${row.correct}/${row.total} 正确 · 迁移证据 ${row.transferCorrect}/${row.transferAttempts}`;
    }
    return `${row.correct}/${row.total} correct · transfer evidence ${row.transferCorrect}/${row.transferAttempts} · ${accuracyText}`;
}

function nextActionForState(state: SessionObjectiveEvidenceState, language: UiLanguage) {
    if (language === 'zh') {
        return {
            secured: '保持间隔复习。',
            'transfer-ready': '换一个新语境独立完成。',
            'needs-repair': '先修复错因模式，再继续前进。',
            practice: '再做一题支架练习。'
        }[state];
    }
    return {
        secured: 'Keep it on spaced review.',
        'transfer-ready': 'Try a fresh context without hints.',
        'needs-repair': 'Repair the mistake pattern before moving on.',
        practice: 'Do one more scaffolded rep.'
    }[state];
}

function buildHeadline(rows: SessionObjectiveEvidence[], language: UiLanguage) {
    const transferSecured = rows.filter((row) => row.state === 'transfer-ready').length;
    if (transferSecured > 0) {
        return language === 'zh'
            ? `${transferSecured} 个目标已有迁移证据`
            : `${transferSecured} objective${transferSecured === 1 ? '' : 's'} secured with transfer evidence`;
    }
    const repaired = rows.filter((row) => row.state === 'secured').length;
    if (repaired > 0) {
        return language === 'zh'
            ? `${repaired} 个目标已稳定正确`
            : `${repaired} objective${repaired === 1 ? '' : 's'} stable in practice`;
    }
    return language === 'zh' ? '本轮已收集学习证据' : 'Learning evidence collected this run';
}

function buildFollowUp(rows: SessionObjectiveEvidence[], language: UiLanguage) {
    const repair = rows.find((row) => row.state === 'needs-repair');
    if (repair) {
        return language === 'zh'
            ? `先修复 ${repair.title}，再继续今日路径。`
            : `Repair ${repair.title}, then continue today's path.`;
    }
    const transfer = rows.find((row) => row.state === 'transfer-ready');
    if (transfer) {
        return language === 'zh'
            ? `${transfer.title} 可以进入新语境迁移。`
            : `${transfer.title} is ready for a fresh-context transfer.`;
    }
    return language === 'zh'
        ? '继续完成今日路径，系统会自动更新下一步。'
        : 'Continue today\'s path; the system will update the next step automatically.';
}
