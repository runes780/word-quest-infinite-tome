import type { Monster, QuestionMode } from '@/store/gameStore';
import { FALLBACK_QUESTIONS } from '@/lib/data/fallbackQuestions';
import { rebalanceQuestionModes } from '@/lib/data/questionModes';
import {
    analyzeMaterialProfile,
    difficultyAtOrBelow,
    isTextAtOrBelowDifficulty
} from '@/lib/ai/materialProfile';
import type { MaterialDifficulty } from '@/lib/ai/materialProfile';

const DEFAULT_MODE_SEQUENCE: QuestionMode[] = [
    'choice', 'choice', 'choice', 'choice', 'choice',
    'typing', 'typing', 'typing',
    'fill-blank', 'fill-blank'
];

const CJK_REGEX = /[\u3400-\u9FFF]/;
const OPTION_PREFIX_REGEX = /^\s*[(\[]?[A-Da-d][\)\].:-]\s*/;
const PLACEHOLDER_OPTION_REGEX = /^(?:[A-D]|option\s*[A-D]?|choice\s*[A-D]?|\d+)$/i;
const META_CONTENT_REGEX = /\b(?:api|api key|api provider|provider|model|model name|openrouter|deepseek|gemini|claude|dashboard|guardian dashboard|settings|system status|json|schema|field name|question mode|skill tag|correct index|source context|support level|attempt kind|learning objective|context hash)\b/i;
const INTERNAL_FIELD_REGEX = /\b(?:questionMode|skillTag|correct_index|correctIndex|correctAnswer|sourceContextSpan|learningObjectiveId|supportLevel|attemptKind|apiProvider|apiKey|contextHash|level_title)\b/i;

const TEXT_LIMITS_BY_DIFFICULTY: Record<MaterialDifficulty, { maxWords: number; maxWordLength: number }> = {
    easy: { maxWords: 18, maxWordLength: 11 },
    medium: { maxWords: 24, maxWordLength: 14 },
    hard: { maxWords: 34, maxWordLength: 18 }
};

const EASY_FALLBACK_POOL = FALLBACK_QUESTIONS.filter((item) => item.difficulty === 'easy');

interface MissionSanitizerOptions {
    sourceText?: string;
    maxDifficulty?: MaterialDifficulty;
}

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

function asSupportLevel(value: unknown): Monster['supportLevel'] | undefined {
    if (value === 0 || value === 1 || value === 2 || value === 3) {
        return value;
    }
    return undefined;
}

function asAttemptKind(value: unknown): Monster['attemptKind'] | undefined {
    if (value === 'diagnostic' || value === 'practice' || value === 'review' || value === 'transfer') {
        return value;
    }
    return undefined;
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

function isLearningTextWithinDifficulty(value: string, maxDifficulty: MaterialDifficulty): boolean {
    const limits = TEXT_LIMITS_BY_DIFFICULTY[maxDifficulty];
    const words = value.toLowerCase().match(/[a-z]+/g) || [];
    if (words.length === 0 || words.length > limits.maxWords) return false;
    if (words.some((word) => word.length > limits.maxWordLength)) return false;
    return isTextAtOrBelowDifficulty(value, maxDifficulty);
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
        supportLevel: undefined,
        attemptKind: undefined,
        causeTag: undefined,
        sourceContextSpan: 'sanitized_fallback'
    };
}

function isValidQuestionPayload(
    question: string,
    options: string[],
    difficulty: Monster['difficulty'] | null,
    maxDifficulty?: MaterialDifficulty
): boolean {
    if (difficulty && maxDifficulty && !difficultyAtOrBelow(difficulty, maxDifficulty)) return false;
    const effectiveDifficulty = difficulty || maxDifficulty || 'medium';
    if (!isEnglishOnly(question) || !isLearningTextWithinDifficulty(question, effectiveDifficulty)) return false;
    if (isMetaContentPayload(question, options)) return false;
    if (options.length !== 4) return false;
    return options.every((option) =>
        isEnglishOnly(option) && isLearningTextWithinDifficulty(option, effectiveDifficulty)
    );
}

function isMetaContentPayload(question: string, options: string[]): boolean {
    const combined = [question, ...options].join(' ');
    if (INTERNAL_FIELD_REGEX.test(combined)) return true;
    if (!META_CONTENT_REGEX.test(combined)) return false;

    const lowerQuestion = question.toLowerCase();
    return (
        /\b(api|provider|model|dashboard|settings|json|schema|field|question mode|skill tag|source context|support level|attempt kind|learning objective)\b/.test(lowerQuestion) ||
        options.some((option) => /\b(openrouter|deepseek|gemini|claude)\b/i.test(option))
    );
}

function normalizeSupportText(
    value: string,
    supportDifficulty: MaterialDifficulty | undefined,
    fallback: string
): string {
    if (!isEnglishOnly(value)) return fallback;
    if (supportDifficulty && !isTextAtOrBelowDifficulty(value, supportDifficulty)) return fallback;
    if (supportDifficulty && !isLearningTextWithinDifficulty(value, supportDifficulty)) return fallback;
    return value;
}

function maxDifficultyFromOptions(options: MissionSanitizerOptions): MaterialDifficulty | undefined {
    if (options.maxDifficulty) return options.maxDifficulty;
    if (!options.sourceText) return undefined;
    return analyzeMaterialProfile(options.sourceText).maxQuestionDifficulty;
}

export function normalizeMissionMonsters(input: unknown[], options: MissionSanitizerOptions = {}): Monster[] {
    if (!Array.isArray(input)) return [];
    const maxDifficulty = maxDifficultyFromOptions(options);
    const normalized = input.map((raw, index) => {
        const source = (raw || {}) as Partial<Monster>;
        const fallback = pickFallback(index, asType(source.type));

        const question = cleanText(source.question);
        const options = sanitizeOptions(source.options);
        const sourceDifficulty = asDifficulty(source.difficulty);
        if (!isValidQuestionPayload(question, options, sourceDifficulty, maxDifficulty)) {
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
        const supportDifficulty = sourceDifficulty || maxDifficulty;
        const fallbackHint = 'Use the words in the text.';
        const fallbackExplanation = `The answer is "${options[safeCorrectIndex]}". The text gives this clue.`;

        return {
            id: source.id ?? fallback.id,
            type,
            question,
            options,
            correct_index: safeCorrectIndex,
            explanation: normalizeSupportText(explanationText, supportDifficulty, fallbackExplanation),
            hint: normalizeSupportText(hintText, supportDifficulty, fallbackHint),
            skillTag: source.skillTag || `${type}_core`,
            difficulty: sourceDifficulty || fallback.difficulty,
            questionMode: asMode(source.questionMode) || fallback.questionMode,
            correctAnswer: options[safeCorrectIndex] || '',
            learningObjectiveId: cleanText(source.learningObjectiveId) || undefined,
            supportLevel: asSupportLevel(source.supportLevel),
            attemptKind: asAttemptKind(source.attemptKind),
            causeTag: cleanText(source.causeTag) || undefined,
            sourceContextSpan: cleanText(source.sourceContextSpan) || undefined
        };
    });

    return rebalanceQuestionModes(normalized) as Monster[];
}
