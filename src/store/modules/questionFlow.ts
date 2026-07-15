import type { Monster, QuestionMode } from '@/store/gameStore';
import type { LearningEventSource, SkillMasteryRecord } from '@/db/db';
import {
    canonicalizeLearningObjective,
    modeForSupportLevel,
    selectSupportLevelForMastery,
    type AttemptKind,
    type SupportLevel
} from '@/lib/data/learningObjectives';
import { buildBossGateVariants } from './bossGateVariants';

export type QuestionInput = Partial<Monster> & {
    id: number;
    type: Monster['type'];
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
};

export type SkillStatsMap = Record<string, { correct: number; total: number }>;

const MASTERY_STATE_RANK: Record<SkillMasteryRecord['state'], number> = {
    new: 0,
    learning: 1,
    consolidated: 2,
    mastered: 3
};

export const defaultModeForIndex = (index: number): QuestionMode => {
    const bucket = index % 10;
    if (bucket < 5) return 'choice';
    if (bucket < 8) return 'typing';
    return 'fill-blank';
};

export const applyQuestionDefaults = (
    question: QuestionInput,
    index = 0
): Monster => {
    const safeCorrectIndex = question.correct_index >= 0 && question.correct_index < question.options.length
        ? question.correct_index
        : 0;
    const canonical = canonicalizeLearningObjective({
        suggestedObjectiveId: question.learningObjectiveId,
        skillTag: question.skillTag,
        type: question.type,
        question: question.question,
        sourceContextSpan: question.sourceContextSpan
    });
    const objectiveId = canonical.objectiveId;
    const supportLevel = question.supportLevel ?? 3;
    const mode = question.questionMode || modeForSupportLevel(supportLevel) || defaultModeForIndex(index);
    const fallbackCorrect = question.options[safeCorrectIndex] || '';
    const providedAnswer = question.correctAnswer?.trim();
    const correctAnswer = providedAnswer || fallbackCorrect;

    return {
        ...question,
        correct_index: safeCorrectIndex,
        skillTag: question.skillTag || `${question.type}_core`,
        difficulty: question.difficulty || 'medium',
        questionMode: mode,
        correctAnswer,
        learningObjectiveId: objectiveId,
        objectiveConfidence: question.objectiveConfidence ?? canonical.confidence,
        supportLevel,
        attemptKind: question.attemptKind,
        causeTag: question.causeTag,
        hp: question.isBoss ? 3 : 1,
        maxHp: question.isBoss ? 3 : 1,
        element: question.type === 'grammar' ? 'water' : question.type === 'vocab' ? 'fire' : 'grass',
        sourceContextSpan: question.sourceContextSpan || 'mission'
    } as Monster;
};

export const attemptKindForQuestion = (
    source: LearningEventSource,
    question: Monster,
    supportLevel: SupportLevel
): AttemptKind => {
    if (source === 'srs') return 'review';
    if (question.attemptKind) return question.attemptKind;
    if (question.sourceContextSpan === 'diagnostic') return 'diagnostic';
    if (supportLevel === 0 || question.isBoss) return 'transfer';
    return 'practice';
};

export const applyLearningMetadataForSource = (
    question: Monster,
    source: LearningEventSource,
    mastery?: SkillMasteryRecord
): Monster => {
    const baseSupport = question.supportLevel ?? selectSupportLevelForMastery(mastery);
    const supportLevel = question.sourceContextSpan === 'revenge'
        ? Math.min(3, baseSupport + 1) as SupportLevel
        : baseSupport;
    const canonical = canonicalizeLearningObjective({
        suggestedObjectiveId: question.learningObjectiveId,
        skillTag: question.skillTag,
        type: question.type,
        question: question.question,
        sourceContextSpan: question.sourceContextSpan
    });
    const learningObjectiveId = canonical.objectiveId;
    const attemptKind = attemptKindForQuestion(source, question, supportLevel);
    return {
        ...question,
        learningObjectiveId,
        objectiveConfidence: question.objectiveConfidence ?? canonical.confidence,
        supportLevel,
        attemptKind,
        questionMode: question.questionMode || modeForSupportLevel(supportLevel),
        correctAnswer: question.correctAnswer || question.options[question.correct_index] || ''
    };
};

export const buildImmediateRepairQuestion = (
    question: Monster,
    selectedOption: string,
    index = 0
): Monster => {
    const correctAnswer = question.correctAnswer || question.options[question.correct_index] || '';
    const supportLevel = Math.min(3, Math.max(2, (question.supportLevel ?? 2) + 1)) as SupportLevel;
    const distractors = question.options
        .filter((option) => option && option !== correctAnswer && option !== selectedOption)
        .slice(0, 3);
    const options = Array.from(new Set([correctAnswer, selectedOption, ...distractors].filter(Boolean)));
    const safeOptions = options.length >= 2 ? options : [correctAnswer, selectedOption || 'Not this answer'].filter(Boolean);

    return applyQuestionDefaults({
        id: question.id + 1000000 + index,
        type: question.type,
        question: buildRepairQuestionText(question),
        options: safeOptions,
        correct_index: 0,
        explanation: question.explanation,
        hint: question.hint || (correctAnswer ? `Start with "${correctAnswer.slice(0, 1)}".` : undefined),
        skillTag: question.skillTag,
        difficulty: question.difficulty,
        correctAnswer,
        learningObjectiveId: question.learningObjectiveId,
        objectiveConfidence: question.objectiveConfidence,
        supportLevel,
        attemptKind: 'practice',
        causeTag: question.causeTag,
        isImmediateRepair: true,
        sourceContextSpan: repairSourceContextSpan(question)
    }, index);
};

const GENERIC_SOURCE_CONTEXT_SPAN_REGEX = /^(?:mission|daily_plan|srs|battle|revenge|diagnostic|immediate_repair|sanitized_fallback|boss_gate_(?:recognition|application|transfer))$/i;

const repairSourceContextSpan = (question: Monster) => {
    const span = question.sourceContextSpan?.trim().replace(/\s+/g, ' ');
    if (!span || GENERIC_SOURCE_CONTEXT_SPAN_REGEX.test(span)) return 'immediate_repair';
    return span;
};

const buildRepairQuestionText = (question: Monster) => {
    const originalQuestion = shortQuestionText(question.question);
    const sourceContextSpan = repairSourceContextSpan(question);
    const correctAnswer = question.correctAnswer || question.options[question.correct_index] || '';

    if (sourceContextSpan !== 'immediate_repair' && (question.type === 'reading' || question.learningObjectiveId?.startsWith('reading'))) {
        if (/^read\s*:/i.test(originalQuestion)) {
            return `Try again: ${originalQuestion}`;
        }
        return `Read: "${sourceContextSpan}" ${originalQuestion}`;
    }

    if (sourceContextSpan !== 'immediate_repair' && correctAnswer) {
        const target = repairBlankTarget(question, correctAnswer, sourceContextSpan);
        if (target) {
            const cloze = sourceContextSpan.replace(quoteRegex(target), '___');
            return `Try this clue: Read: "${cloze}" Choose the missing answer.`;
        }
    }

    if (/^read\s*:/i.test(originalQuestion)) {
        return `Try again: ${originalQuestion}`;
    }

    return `Try again: ${originalQuestion}`;
};

const repairBlankTarget = (question: Monster, correctAnswer: string, sourceContextSpan: string) => {
    if (quoteRegex(correctAnswer).test(sourceContextSpan)) return correctAnswer;
    const quotedTarget = question.question.match(/["']([A-Za-z][A-Za-z'-]*)["']/)?.[1];
    if (quotedTarget && quoteRegex(quotedTarget).test(sourceContextSpan)) return quotedTarget;
    return undefined;
};

const shortQuestionText = (question: string) => {
    const trimmed = question.trim().replace(/\s+/g, ' ');
    if (trimmed.length <= 120) return trimmed;
    return `${trimmed.slice(0, 117)}...`;
};

const quoteRegex = (value: string): RegExp =>
    new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

export function expandBossGateQuestions(questions: Monster[]): Monster[] {
    return questions.flatMap((question) => {
        if (!question.isBoss || question.bossTotalStages) return [question];
        return buildBossGateVariants(question);
    });
}

export const getSkillKey = (question: Monster) => question.skillTag || `${question.type}_${question.difficulty || 'medium'}`;

const accuracyFor = (stats: SkillStatsMap, question: Monster) => {
    const key = getSkillKey(question);
    const data = stats[key];
    if (!data || data.total === 0) return 0;
    return data.correct / data.total;
};

const masteryPressure = (mastery?: SkillMasteryRecord) => {
    if (!mastery) return 2.5;
    if (mastery.state === 'new') return 2.8;
    if (mastery.state === 'learning') return 2.2;
    if (mastery.state === 'consolidated') return 1.2;
    return 0.5;
};

export function computeSkillPriority(
    question: Monster,
    stats: SkillStatsMap,
    masteryBySkill: Record<string, SkillMasteryRecord>,
    reviewRiskBySkill: Record<string, number>,
    recentMistakeBySkill: Record<string, number>
): number {
    const key = getSkillKey(question);
    const accuracy = accuracyFor(stats, question);
    const accuracyPressure = 1 - accuracy;
    const mastery = masteryBySkill[key];
    const masteryScore = masteryPressure(mastery);
    const reviewRisk = Math.min(3, reviewRiskBySkill[key] || 0);
    const recentMistakes = Math.min(3, recentMistakeBySkill[key] || 0);
    const difficultyWeight = question.difficulty === 'hard' ? 0.8 : question.difficulty === 'medium' ? 0.4 : 0.1;
    return masteryScore + accuracyPressure + reviewRisk + recentMistakes + difficultyWeight;
}

export const reorderQuestionsBySkill = (
    questions: Monster[],
    currentIndex: number,
    stats: SkillStatsMap,
    masteryBySkill: Record<string, SkillMasteryRecord>,
    reviewRiskBySkill: Record<string, number>,
    recentMistakeBySkill: Record<string, number>
) => {
    if (currentIndex >= questions.length - 1) return questions;
    const head = questions.slice(0, currentIndex + 1);
    const tail = [...questions.slice(currentIndex + 1)];
    tail.sort((a, b) => computeSkillPriority(b, stats, masteryBySkill, reviewRiskBySkill, recentMistakeBySkill) -
        computeSkillPriority(a, stats, masteryBySkill, reviewRiskBySkill, recentMistakeBySkill));
    return [...head, ...tail];
};

export const formatSkillLabel = (skill: string) => skill.replace(/_/g, ' ');

export const isMasteryUpgrade = (fromState: SkillMasteryRecord['state'], toState: SkillMasteryRecord['state']) =>
    MASTERY_STATE_RANK[toState] > MASTERY_STATE_RANK[fromState];

export const findWeakSkill = (stats: SkillStatsMap) => {
    const sorted = Object.entries(stats)
        .filter(([, value]) => value.total >= 1)
        .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total));
    return sorted[0]?.[0];
};

export const getSkillSnapshot = (stats: SkillStatsMap, skillTag?: string) => {
    if (!skillTag) return null;
    const row = stats[skillTag];
    if (!row || row.total <= 0) return null;
    return {
        skillTag,
        attempts: row.total,
        accuracy: row.correct / row.total
    };
};

export const findBreakthroughSkill = (stats: SkillStatsMap) => {
    const weakest = findWeakSkill(stats);
    const snapshot = getSkillSnapshot(stats, weakest);
    if (!snapshot) return null;
    if (snapshot.attempts < 4 || snapshot.accuracy < 0.75) return null;
    return snapshot;
};
