import type { Monster } from '@/store/gameStore';
import type { MistakeRecord } from '@/db/db';
import { getBalancedFallbackQuestions, type FallbackQuestion } from './fallbackQuestions';
import { rebalanceQuestionModes } from './questionModes';

interface BuildTargetedReviewInput {
    mistakes: MistakeRecord[];
    focusCauseTag?: string;
    weakestSkillTag?: string;
    desiredCount?: number;
    fallbackQuestions?: FallbackQuestion[];
}

export interface TargetedReviewPack {
    monsters: Monster[];
    fromMistakes: number;
    fromFallback: number;
}

function buildFallbackOptions(record: MistakeRecord) {
    const base = new Set<string>();
    if (record.correctAnswer) base.add(record.correctAnswer);
    if (record.wrongAnswer) base.add(record.wrongAnswer);
    let filler = 1;
    while (base.size < 4) {
        base.add(`Option ${filler++}`);
    }
    return Array.from(base).slice(0, 4);
}

function normalizeOptions(record: MistakeRecord): { options: string[]; correctIndex: number; } {
    const raw = Array.isArray(record.options) && record.options.length >= 2
        ? [...record.options]
        : buildFallbackOptions(record);
    let options = raw.slice(0, 4);
    if (!options.includes(record.correctAnswer)) {
        if (options.length >= 4) {
            options[0] = record.correctAnswer;
        } else {
            options.push(record.correctAnswer);
        }
    }
    options = Array.from(new Set(options));
    while (options.length < 4) {
        options.push(`Option ${options.length + 1}`);
    }
    const correctIndex = options.indexOf(record.correctAnswer);
    return {
        options: options.slice(0, 4),
        correctIndex: correctIndex >= 0 ? correctIndex : 0
    };
}

function recordToMonster(record: MistakeRecord, index: number): Monster {
    const { options, correctIndex } = normalizeOptions(record);
    const type = (record.type || (record.skillTag?.startsWith('grammar') ? 'grammar' : 'vocab')) as Monster['type'];
    return {
        id: (record.id || Date.now()) + index,
        type,
        question: record.questionText,
        options,
        correct_index: correctIndex,
        explanation: record.mentorAnalysis || record.explanation || 'Review this concept.',
        hint: record.mentorNextAction,
        skillTag: record.skillTag || `${type}_review`,
        difficulty: 'medium',
        questionMode: 'choice',
        correctAnswer: options[correctIndex]
    };
}

function fallbackToMonster(question: FallbackQuestion, index: number): Monster {
    return {
        id: question.id + index,
        type: question.type,
        question: question.question,
        options: question.options,
        correct_index: question.correct_index,
        explanation: question.explanation,
        hint: question.hint,
        skillTag: question.skillTag,
        difficulty: question.difficulty,
        questionMode: 'choice',
        correctAnswer: question.options[question.correct_index] || ''
    };
}

function scoreRecord(record: MistakeRecord, input: BuildTargetedReviewInput): number {
    let score = 0;
    if (input.focusCauseTag && record.mentorCauseTag === input.focusCauseTag) score += 100;
    if (input.weakestSkillTag && record.skillTag === input.weakestSkillTag) score += 70;
    if (record.mentorAnalysis) score += 10;
    score += Math.max(0, (record.timestamp || 0) / 1e10);
    return score;
}

export function buildTargetedReviewPack(input: BuildTargetedReviewInput): TargetedReviewPack {
    const desiredCount = Math.max(3, Math.min(8, input.desiredCount || 5));
    const dedup = new Set<string>();
    const ranked = [...input.mistakes]
        .sort((a, b) => scoreRecord(b, input) - scoreRecord(a, input))
        .filter((record) => {
            const key = `${record.questionText}::${record.correctAnswer}`;
            if (dedup.has(key)) return false;
            dedup.add(key);
            return true;
        });

    const chosenMistakes = ranked.slice(0, desiredCount);
    const fromMistakes = chosenMistakes.length;
    const neededFallback = Math.max(0, desiredCount - fromMistakes);
    const fallbackPool = input.fallbackQuestions || getBalancedFallbackQuestions(Math.max(neededFallback, desiredCount));
    const chosenFallback = fallbackPool.slice(0, neededFallback);

    const monsters = [
        ...chosenMistakes.map((row, idx) => recordToMonster(row, idx)),
        ...chosenFallback.map((row, idx) => fallbackToMonster(row, 1000 + idx))
    ];

    return {
        monsters: rebalanceQuestionModes(monsters) as Monster[],
        fromMistakes,
        fromFallback: chosenFallback.length
    };
}
