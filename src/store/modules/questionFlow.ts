import type { Monster, QuestionMode, UserAnswer, RunObjectiveBonus } from '@/store/gameStore';
import type { LearningEventSource, SkillMasteryRecord } from '@/db/db';
import {
    mapSkillTagToObjectiveId,
    modeForSupportLevel,
    objectiveTitle,
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
    const objectiveId = question.learningObjectiveId || mapSkillTagToObjectiveId({
        skillTag: question.skillTag,
        type: question.type,
        question: question.question
    });
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
    if (question.attemptKind) return question.attemptKind;
    if (source === 'srs') return 'review';
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
    const learningObjectiveId = question.learningObjectiveId || mapSkillTagToObjectiveId({
        skillTag: question.skillTag,
        type: question.type,
        question: question.question
    });
    const attemptKind = attemptKindForQuestion(source, question, supportLevel);
    return {
        ...question,
        learningObjectiveId,
        supportLevel,
        attemptKind,
        questionMode: modeForSupportLevel(supportLevel),
        correctAnswer: question.correctAnswer || question.options[question.correct_index] || ''
    };
};

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

export const buildRunObjectiveBonuses = (
    source: LearningEventSource,
    stats: SkillStatsMap,
    answers: UserAnswer[]
): RunObjectiveBonus[] => {
    const bonuses: RunObjectiveBonus[] = [];
    const totalAnswers = answers.length;
    const totalCorrect = answers.filter((answer) => answer.isCorrect).length;
    const accuracy = totalAnswers > 0 ? totalCorrect / totalAnswers : 0;

    if (source === 'srs' && totalAnswers >= 6 && accuracy >= 0.7) {
        bonuses.push({
            id: `bonus_review_${Date.now()}`,
            title: 'Review Completion',
            description: 'Completed a qualified SRS review run.',
            xp: 30,
            gold: 20
        });
    }

    const breakthrough = findBreakthroughSkill(stats);
    if (breakthrough) {
        bonuses.push({
            id: `bonus_breakthrough_${breakthrough.skillTag}_${Date.now()}`,
            title: 'Weakness Breakthrough',
            description: `${formatSkillLabel(breakthrough.skillTag)} reached ${Math.round(breakthrough.accuracy * 100)}% in ${breakthrough.attempts} attempts.`,
            xp: 24,
            gold: 18,
            skillTag: breakthrough.skillTag
        });
    }

    const transferAnswers = answers.filter((answer) =>
        answer.isCorrect && (answer.attemptKind === 'transfer' || answer.supportLevel === 0)
    );
    const transferObjective = transferAnswers.find((answer) => answer.learningObjectiveId)?.learningObjectiveId;
    if (transferAnswers.length > 0) {
        bonuses.push({
            id: `bonus_transfer_${transferObjective || 'objective'}_${Date.now()}`,
            title: 'Transfer Checkpoint',
            description: `${objectiveTitle(transferObjective)} held up in independent recall.`,
            xp: 22,
            gold: 14,
            skillTag: transferObjective
        });
    }

    return bonuses;
};
