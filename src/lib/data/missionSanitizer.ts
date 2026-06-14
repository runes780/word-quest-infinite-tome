import type { Monster, QuestionMode } from '@/store/gameStore';
import { FALLBACK_QUESTIONS } from '@/lib/data/fallbackQuestions';
import { canonicalizeLearningObjective } from '@/lib/data/learningObjectives';
import {
    analyzeMaterialProfile,
    difficultyAtOrBelow,
    isTextAtOrBelowDifficulty
} from '@/lib/ai/materialProfile';
import type { MaterialDifficulty } from '@/lib/ai/materialProfile';
import { planQuestionPack } from '@/lib/data/questionPackPlanner';
import type { QuestionPlan } from '@/lib/data/questionPlan';

const DEFAULT_MODE_SEQUENCE: QuestionMode[] = [
    'choice', 'choice', 'choice', 'choice', 'choice',
    'typing', 'typing', 'typing',
    'fill-blank', 'fill-blank'
];

const CJK_REGEX = /[\u3400-\u9FFF]/;
const OPTION_PREFIX_REGEX = /^\s*[(\[]?[A-Da-d][\)\].:-]\s*/;
const PLACEHOLDER_OPTION_REGEX = /^(?:[A-D]|option\s*[A-D]?|choice\s*[A-D]?|\d+)$/i;
const SPEAKER_LABEL_OPTION_REGEX = /^[A-Z][A-Za-z]{1,18}:$/;
const META_CONTENT_REGEX = /\b(?:api|api key|api provider|provider|model|model name|openrouter|deepseek|gemini|claude|dashboard|guardian dashboard|settings|system status|json|schema|field name|question mode|skill tag|correct index|source context|support level|attempt kind|learning objective|context hash)\b/i;
const INTERNAL_FIELD_REGEX = /\b(?:questionMode|skillTag|correct_index|correctIndex|correctAnswer|sourceContextSpan|learningObjectiveId|supportLevel|attemptKind|apiProvider|apiKey|contextHash|level_title)\b/i;
const CONTEXT_LABEL_REGEX = /\b(?:read|context|sentence|passage|text)\s*[:：]/i;
const QUOTED_SENTENCE_REGEX = /["“][^"”]*\b[A-Za-z]+\b[^"”]*\s+\b[A-Za-z]+\b[^"”]*["”]/;
const BLANK_REGEX = /(?:_{2,}|\[\s*(?:\.\.\.|…)?\s*\]|\(\s*blank\s*\))/i;
const PRONOUN_REFERENCE_REGEX = /\b(?:pronoun|refer(?:s|red|ring)?\s+to|reference)\b|["']?(?:it|they|them|he|she|him|her|this|that|these|those)["']?\s+refer/i;
const READING_CONTEXT_OBJECTIVE_REGEX = /\b(?:pronoun_reference|reading_detail|reading_inference)\b/i;
const GENERIC_SOURCE_SPAN_REGEX = /^(?:mission|daily_plan|srs|battle|revenge|diagnostic|immediate_repair|sanitized_fallback|boss_gate_(?:recognition|application|transfer))$/i;
const SUPPORT_EXEMPT_OBJECTIVES = new Set(['vocab_context_meaning', 'reading_inference']);
const CONTENT_STOPWORDS = new Set([
    'the', 'and', 'that', 'this', 'these', 'those', 'with', 'from', 'what', 'where', 'when',
    'who', 'why', 'how', 'like', 'today', 'answer', 'word', 'phrase', 'sentence'
]);

const TEXT_LIMITS_BY_DIFFICULTY: Record<MaterialDifficulty, { maxWords: number; maxWordLength: number }> = {
    easy: { maxWords: 18, maxWordLength: 11 },
    medium: { maxWords: 24, maxWordLength: 14 },
    hard: { maxWords: 34, maxWordLength: 18 }
};

const EASY_FALLBACK_POOL = FALLBACK_QUESTIONS.filter((item) => item.difficulty === 'easy');

interface MissionSanitizerOptions {
    sourceText?: string;
    maxDifficulty?: MaterialDifficulty;
    allowedSet?: Set<string>;
    material?: string;
    plan?: QuestionPlan;
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

function isContextQuestionTextAcceptable(value: string): boolean {
    const words = value.toLowerCase().match(/[a-z]+/g) || [];
    if (words.length === 0 || words.length > 72) return false;
    return words.every((word) => word.length <= 24);
}

function sanitizeOptions(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const item of value) {
        const option = cleanOption(item);
        if (!option) continue;
        if (PLACEHOLDER_OPTION_REGEX.test(option)) continue;
        if (SPEAKER_LABEL_OPTION_REGEX.test(option)) continue;
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
    maxDifficulty?: MaterialDifficulty,
    allowContextQuestion = false
): boolean {
    if (difficulty && maxDifficulty && !difficultyAtOrBelow(difficulty, maxDifficulty)) return false;
    const effectiveDifficulty = difficulty || maxDifficulty || 'medium';
    if (!isEnglishOnly(question)) return false;
    if (allowContextQuestion) {
        if (!isContextQuestionTextAcceptable(question)) return false;
    } else if (!isLearningTextWithinDifficulty(question, effectiveDifficulty)) {
        return false;
    }
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

function hasEmbeddedContext(question: string): boolean {
    return CONTEXT_LABEL_REGEX.test(question) || QUOTED_SENTENCE_REGEX.test(question);
}

function isUsableSourceContextSpan(value: string): boolean {
    if (!value || GENERIC_SOURCE_SPAN_REGEX.test(value)) return false;
    if (!isEnglishOnly(value)) return false;
    if (isMetaContentPayload(value, [])) return false;
    return isContextQuestionTextAcceptable(value);
}

function extractQuotedTarget(question: string): string | undefined {
    const match = question.match(/["']([A-Za-z][A-Za-z'-]*)["']/);
    return match?.[1]?.toLowerCase();
}

function splitSourceSentences(sourceText?: string): string[] {
    if (!sourceText) return [];
    return sourceText
        .replace(/\s+/g, ' ')
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => cleanText(sentence))
        .filter(isUsableSourceContextSpan);
}

function inferSourceContextSpan(
    question: string,
    sourceText: string | undefined,
    correctAnswer: string
): string | undefined {
    const sentences = splitSourceSentences(sourceText);
    if (sentences.length === 0) return undefined;

    const target = extractQuotedTarget(question);
    const answer = correctAnswer.toLowerCase();
    const byTargetAndAnswer = sentences.find((sentence) => {
        const lower = sentence.toLowerCase();
        return Boolean(target && lower.includes(target) && answer && lower.includes(answer));
    });
    if (byTargetAndAnswer) return byTargetAndAnswer;

    const byTarget = sentences.find((sentence) => {
        const lower = sentence.toLowerCase();
        return Boolean(target && lower.includes(target));
    });
    if (byTarget) return byTarget;

    const byAnswer = sentences.find((sentence) => {
        const lower = sentence.toLowerCase();
        return Boolean(answer && lower.includes(answer));
    });
    if (byAnswer) return byAnswer;

    return undefined;
}

function requiresSourceContext(source: Partial<Monster>, question: string, type: Monster['type']): boolean {
    const objectiveText = `${source.learningObjectiveId || ''} ${source.skillTag || ''}`;
    if (READING_CONTEXT_OBJECTIVE_REGEX.test(objectiveText)) return true;
    if (type === 'reading') return true;
    return PRONOUN_REFERENCE_REGEX.test(question);
}

function quoteRegex(value: string): RegExp {
    return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function ensureQuestionHasSourceContext(question: string, sourceContextSpan: string): string {
    if (hasEmbeddedContext(question)) return question;
    if (quoteRegex(sourceContextSpan).test(question)) return question;
    return `Read: "${sourceContextSpan}" ${question}`;
}

function hasVisibleBlank(question: string): boolean {
    return BLANK_REGEX.test(question);
}

function buildClozeQuestion(question: string, sourceContextSpan: string | undefined, correctAnswer: string): string | undefined {
    if (hasVisibleBlank(question)) return question;
    if (!sourceContextSpan || !correctAnswer) return undefined;

    const source = cleanText(sourceContextSpan);
    const answerPattern = quoteRegex(correctAnswer);
    if (!answerPattern.test(source)) return undefined;

    const clozed = source.replace(answerPattern, '___');
    return `Read: "${clozed}" Complete the missing words.`;
}

function contentWords(value: string): string[] {
    return Array.from(new Set((value.toLowerCase().match(/[a-z]+/g) || [])
        .filter((word) => word.length > 2 && !CONTENT_STOPWORDS.has(word))));
}

function sourceSupportsDirectAnswer(objectiveId: string, sourceContextSpan: string | undefined, correctAnswer: string): boolean {
    if (SUPPORT_EXEMPT_OBJECTIVES.has(objectiveId)) return true;
    if (!sourceContextSpan || !correctAnswer) return true;
    if (objectiveId !== 'reading_detail' && objectiveId !== 'pronoun_reference') return true;

    const words = contentWords(correctAnswer);
    if (words.length === 0) return true;
    const source = sourceContextSpan.toLowerCase();
    return words.some((word) => source.includes(word));
}

export function normalizeMissionMonsters(input: unknown[], options: MissionSanitizerOptions = {}): Monster[] {
    if (!Array.isArray(input)) return [];
    const maxDifficulty = maxDifficultyFromOptions(options);
    const normalized = input.map((raw, index) => {
        const source = (raw || {}) as Partial<Monster>;
        const fallback = pickFallback(index, asType(source.type));

        const rawQuestion = cleanText(source.question);
        const sanitizedOptions = sanitizeOptions(source.options);
        const declaredDifficulty = asDifficulty(source.difficulty);
        const type = asType(source.type) || fallback.type;
        const providedCorrect = cleanOption(source.correctAnswer);
        const providedIndex = typeof source.correct_index === 'number' ? source.correct_index : -1;
        const matchedIndex = providedCorrect
            ? sanitizedOptions.findIndex((opt) => opt.toLowerCase() === providedCorrect.toLowerCase())
            : -1;
        const safeCorrectIndex = providedIndex >= 0 && providedIndex < sanitizedOptions.length
            ? providedIndex
            : matchedIndex >= 0
                ? matchedIndex
                : 0;
        const correctAnswer = sanitizedOptions[safeCorrectIndex] || providedCorrect || '';
        const providedSourceContext = cleanText(source.sourceContextSpan);
        const sourceContextSpan = isUsableSourceContextSpan(providedSourceContext)
            ? providedSourceContext
            : inferSourceContextSpan(rawQuestion, options.sourceText, correctAnswer);
        const needsContext = requiresSourceContext(source, rawQuestion, type);
        const contextQuestion = needsContext && sourceContextSpan
            ? ensureQuestionHasSourceContext(rawQuestion, sourceContextSpan)
            : rawQuestion;
        const requestedMode = asMode(source.questionMode) || fallback.questionMode;
        const question = requestedMode === 'fill-blank'
            ? buildClozeQuestion(contextQuestion, sourceContextSpan, correctAnswer) || contextQuestion
            : contextQuestion;

        if (needsContext && !sourceContextSpan && !hasEmbeddedContext(rawQuestion)) {
            if (source.id !== undefined) {
                fallback.id = source.id;
            }
            return fallback;
        }

        if (requestedMode === 'fill-blank' && !hasVisibleBlank(question)) {
            if (source.id !== undefined) {
                fallback.id = source.id;
            }
            return fallback;
        }

        const validationDifficulty = declaredDifficulty && maxDifficulty && !difficultyAtOrBelow(declaredDifficulty, maxDifficulty)
            ? maxDifficulty
            : declaredDifficulty;

        if (!isValidQuestionPayload(question, sanitizedOptions, validationDifficulty, maxDifficulty, needsContext)) {
            if (source.id !== undefined) {
                fallback.id = source.id;
            }
            return fallback;
        }

        const hintText = cleanText(source.hint);
        const explanationText = cleanText(source.explanation);
        const supportDifficulty = validationDifficulty || maxDifficulty;
        const fallbackHint = 'Use the words in the text.';
        const fallbackExplanation = `The answer is "${sanitizedOptions[safeCorrectIndex]}". The text gives this clue.`;
        const canonicalObjective = canonicalizeLearningObjective({
            suggestedObjectiveId: source.learningObjectiveId,
            skillTag: source.skillTag,
            type,
            question,
            sourceContextSpan
        });
        if (!sourceSupportsDirectAnswer(canonicalObjective.objectiveId, sourceContextSpan, sanitizedOptions[safeCorrectIndex] || '')) {
            if (source.id !== undefined) {
                fallback.id = source.id;
            }
            return fallback;
        }

        return {
            id: source.id ?? fallback.id,
            type,
            question,
            options: sanitizedOptions,
            correct_index: safeCorrectIndex,
            explanation: normalizeSupportText(explanationText, supportDifficulty, fallbackExplanation),
            hint: normalizeSupportText(hintText, supportDifficulty, fallbackHint),
            skillTag: source.skillTag || `${type}_core`,
            difficulty: validationDifficulty || fallback.difficulty,
            questionMode: requestedMode,
            correctAnswer: sanitizedOptions[safeCorrectIndex] || '',
            learningObjectiveId: canonicalObjective.objectiveId,
            objectiveConfidence: source.objectiveConfidence ?? canonicalObjective.confidence,
            supportLevel: asSupportLevel(source.supportLevel),
            attemptKind: asAttemptKind(source.attemptKind),
            causeTag: cleanText(source.causeTag) || undefined,
            sourceContextSpan: sourceContextSpan || undefined
        };
    });

    return normalized.length >= 5 ? planQuestionPack(normalized as Monster[]).questions : normalized as Monster[];
}
