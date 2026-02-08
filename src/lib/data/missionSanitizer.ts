import type { Monster, QuestionMode } from '@/store/gameStore';
import { FALLBACK_QUESTIONS } from '@/lib/data/fallbackQuestions';
import { rebalanceQuestionModes } from '@/lib/data/questionModes';

const DEFAULT_MODE_SEQUENCE: QuestionMode[] = [
    'choice', 'choice', 'choice', 'choice', 'choice',
    'typing', 'typing', 'typing',
    'fill-blank', 'fill-blank'
];

const CJK_REGEX = /[\u3400-\u9FFF]/;
const OPTION_PREFIX_REGEX = /^\s*[(\[]?[A-Da-d][\)\].:-]\s*/;
const PLACEHOLDER_OPTION_REGEX = /^(?:[A-D]|option\s*[A-D]?|choice\s*[A-D]?|\d+)$/i;

const ADVANCED_WORDS = new Set([
    'meticulous',
    'revolutionized',
    'hypothetical',
    'fundamental',
    'consequently',
    'approximately',
    'architecture',
    'photosynthesis',
    'sophisticated',
    'comprehensive'
]);

const EASY_FALLBACK_POOL = FALLBACK_QUESTIONS.filter((item) => item.difficulty === 'easy');

function asMode(value: unknown): QuestionMode | null {
    if (value === 'choice' || value === 'typing' || value === 'fill-blank') {
        return value;
    }
    return null;
}

function asType(value: unknown): Monster['type'] | null {
    if (value === 'vocab' || value === 'grammar' || value === 'reading') {
        return value;
    }
    return null;
}

function asDifficulty(value: unknown): Monster['difficulty'] | null {
    if (value === 'easy' || value === 'medium' || value === 'hard') {
        return value;
    }
    return null;
}

function cleanText(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\s+/g, ' ');
}

function cleanOption(value: unknown): string {
    return cleanText(value).replace(OPTION_PREFIX_REGEX, '').trim();
}

function isEnglishOnly(value: string): boolean {
    if (!value) return false;
    if (CJK_REGEX.test(value)) return false;
    return /[A-Za-z]/.test(value);
}

function isA1A2Friendly(value: string): boolean {
    const words = value.toLowerCase().match(/[a-z]+/g) || [];
    if (words.length === 0 || words.length > 18) return false;
    if (words.some((word) => word.length >= 12)) return false;
    if (words.some((word) => ADVANCED_WORDS.has(word))) return false;
    return true;
}

function sanitizeOptions(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const item of value) {
        const option = cleanOption(item);
        if (!option) continue;
        if (PLACEHOLDER_OPTION_REGEX.test(option)) continue;
        const key = option.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push(option);
        if (cleaned.length >= 4) break;
    }
    return cleaned;
}

function pickFallback(index: number, preferredType: Monster['type'] | null): Monster {
    const sameTypePool = preferredType
        ? EASY_FALLBACK_POOL.filter((item) => item.type === preferredType)
        : [];
    const pool = sameTypePool.length > 0 ? sameTypePool : EASY_FALLBACK_POOL;
    const source = pool[index % pool.length];

    return {
        id: Date.now() + index,
        type: source.type,
        question: source.question,
        options: source.options.slice(0, 4),
        correct_index: source.correct_index,
        explanation: source.explanation,
        hint: source.hint,
        skillTag: source.skillTag,
        difficulty: 'easy',
        questionMode: DEFAULT_MODE_SEQUENCE[index % DEFAULT_MODE_SEQUENCE.length],
        correctAnswer: source.options[source.correct_index] || '',
        learningObjectiveId: undefined,
        sourceContextSpan: 'sanitized_fallback'
    };
}

function isValidQuestionPayload(question: string, options: string[]): boolean {
    if (!isEnglishOnly(question) || !isA1A2Friendly(question)) return false;
    if (options.length !== 4) return false;
    return options.every((option) => isEnglishOnly(option) && isA1A2Friendly(option));
}

export function normalizeMissionMonsters(input: unknown[]): Monster[] {
    if (!Array.isArray(input)) return [];
    const normalized = input.map((raw, index) => {
        const source = (raw || {}) as Partial<Monster>;
        const fallback = pickFallback(index, asType(source.type));

        const question = cleanText(source.question);
        const options = sanitizeOptions(source.options);
        if (!isValidQuestionPayload(question, options)) {
            if (source.id !== undefined) {
                fallback.id = source.id;
            }
            return fallback;
        }

        const providedCorrect = cleanOption(source.correctAnswer);
        const providedIndex = typeof source.correct_index === 'number' ? source.correct_index : -1;
        const matchedIndex = providedCorrect
            ? options.findIndex((opt) => opt.toLowerCase() === providedCorrect.toLowerCase())
            : -1;
        const safeCorrectIndex = providedIndex >= 0 && providedIndex < options.length
            ? providedIndex
            : matchedIndex >= 0
                ? matchedIndex
                : 0;

        const hintText = cleanText(source.hint);
        const explanationText = cleanText(source.explanation);
        const type = asType(source.type) || fallback.type;

        return {
            id: source.id ?? fallback.id,
            type,
            question,
            options,
            correct_index: safeCorrectIndex,
            explanation: isEnglishOnly(explanationText) ? explanationText : `The correct answer is "${options[safeCorrectIndex]}".`,
            hint: isEnglishOnly(hintText) ? hintText : 'Look for the key word in the sentence.',
            skillTag: source.skillTag || `${type}_core`,
            difficulty: asDifficulty(source.difficulty) || fallback.difficulty,
            questionMode: asMode(source.questionMode) || fallback.questionMode,
            correctAnswer: options[safeCorrectIndex] || '',
            learningObjectiveId: cleanText(source.learningObjectiveId) || undefined,
            sourceContextSpan: cleanText(source.sourceContextSpan) || undefined
        };
    });

    return rebalanceQuestionModes(normalized) as Monster[];
}
