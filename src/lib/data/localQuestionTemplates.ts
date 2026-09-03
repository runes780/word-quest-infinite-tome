import type { Monster } from '@/store/gameStore';
import { normalizeWord } from './textNormalize';
import { normalizeMissionMonsters } from './missionSanitizer';
import type { LocalPlanItem, LocalTemplateKind } from './localMaterialPlanner';
import { MIN_LOCAL_QUEST_QUESTIONS } from './localMaterialPlanner';

/**
 * Deterministic local question templates for learner material.
 *
 * Every question is built from a plan item's sourceSpan, and the correct answer
 * is always the plan target as it appears in that span. Multiple-choice items
 * only exist when the material (plus the common-word list) supplies three
 * same-slot distractors; otherwise the item degrades to a retrieval template at
 * planning time, so a rendered choice never shows weak filler options.
 */

type PosBucket = 'pronoun' | 'preposition' | 'verb-past' | 'content';

const PRONOUN_BUCKET = new Set([
    'he', 'she', 'it', 'they', 'them', 'we', 'us', 'him', 'her',
    'his', 'its', 'their', 'i', 'you', 'me', 'my', 'your', 'our'
]);

const PREPOSITION_BUCKET = new Set([
    'in', 'on', 'at', 'to', 'of', 'for', 'with', 'from', 'by', 'about',
    'into', 'under', 'over', 'between', 'behind', 'near', 'above', 'below',
    'through', 'around', 'beside', 'against', 'along', 'across', 'toward', 'upon'
]);

const IRREGULAR_PAST_BUCKET = new Set([
    'went', 'saw', 'took', 'had', 'made', 'said', 'came', 'got', 'found',
    'left', 'kept', 'felt', 'told', 'held', 'brought', 'thought', 'bought',
    'wrote', 'sat', 'stood', 'ate', 'drank', 'knew', 'grew', 'met', 'paid', 'ran'
]);

/**
 * Display-form common words for distractors. COMMON_WORD_LIST itself stores
 * normalized stems (apostrophes and suffixes stripped), which must never be
 * rendered; these curated lists carry natural surface forms per bucket.
 */
const PRONOUN_DISPLAY_POOL = [
    'he', 'she', 'it', 'they', 'them', 'we', 'us', 'him', 'her', 'his', 'its', 'their'
];

const PREPOSITION_DISPLAY_POOL = [
    'in', 'on', 'at', 'to', 'of', 'for', 'with', 'from', 'by', 'about', 'into',
    'under', 'over', 'between', 'behind', 'near', 'above', 'below', 'through',
    'around', 'beside', 'against', 'along', 'across', 'toward', 'upon'
];

const VERB_PAST_DISPLAY_POOL = [
    'went', 'saw', 'took', 'had', 'made', 'said', 'came', 'got', 'found', 'left',
    'kept', 'felt', 'told', 'held', 'brought', 'thought', 'bought', 'wrote',
    'sat', 'stood', 'ate', 'drank', 'knew', 'grew', 'met', 'paid', 'ran',
    'played', 'walked', 'opened', 'closed', 'started', 'finished', 'watched',
    'washed', 'jumped', 'looked', 'wanted', 'needed', 'helped', 'turned',
    'called', 'asked', 'answered', 'cleaned', 'cooked', 'listened', 'visited',
    'studied', 'carried', 'tried', 'picked', 'showed', 'pulled', 'moved'
];

const CONTENT_DISPLAY_POOL = [
    'morning', 'picture', 'window', 'teacher', 'student', 'kitchen', 'market',
    'village', 'flower', 'garden', 'forest', 'island', 'mountain', 'weather',
    'winter', 'summer', 'spring', 'holiday', 'present', 'candle', 'basket',
    'bottle', 'mirror', 'pocket', 'finger', 'shoulder', 'blanket', 'jacket',
    'hungry', 'thirsty', 'quiet', 'gentle', 'brave', 'clever', 'famous',
    'narrow', 'smooth', 'golden', 'silver', 'crowded', 'peaceful', 'careful'
];

/** Function words that never make useful content-slot distractors. */
const FUNCTION_WORD_DISTRACTOR_BLOCKLIST = new Set([
    'although', 'because', 'while', 'when', 'where', 'why', 'how', 'what',
    'which', 'who', 'whose', 'that', 'this', 'these', 'those', 'and', 'or',
    'but', 'so', 'if', 'than', 'then', 'not', 'very', 'too', 'also', 'only',
    'again', 'always', 'never', 'often', 'maybe', 'perhaps', 'almost',
    'enough', 'together', 'alone', 'after', 'before', 'during', 'until',
    'another', 'other', 'same', 'different', 'there', 'here'
]);

function displayPoolFor(bucket: PosBucket): string[] {
    if (bucket === 'pronoun') return PRONOUN_DISPLAY_POOL;
    if (bucket === 'preposition') return PREPOSITION_DISPLAY_POOL;
    if (bucket === 'verb-past') return VERB_PAST_DISPLAY_POOL;
    return CONTENT_DISPLAY_POOL;
}

const CANNED_TRANSFER_PREFIX_REGEX = /^Transfer check:/i;

export function posBucketOf(word: string): PosBucket {
    const lower = word.toLowerCase();
    if (PRONOUN_BUCKET.has(lower)) return 'pronoun';
    if (PREPOSITION_BUCKET.has(lower)) return 'preposition';
    if (IRREGULAR_PAST_BUCKET.has(lower)) return 'verb-past';
    if (word.length >= 5 && lower.endsWith('ed')) return 'verb-past';
    return 'content';
}

function wordsOf(value: string): string[] {
    return value.match(/[A-Za-z][A-Za-z'-]*/g) || [];
}

interface DistractorCandidate {
    word: string;
    /** 0 = from the learner's material (preferred), 1 = curated common pool. */
    sourceRank: number;
}

/**
 * Deterministic candidate pool for distractors: material words from other
 * sentences first (they match the learner's text), then curated common display
 * words. Words that already appear in the item's own span are excluded so a
 * distractor can never also fit the blank.
 */
function distractorCandidates(target: string, material: string, span: string): DistractorCandidate[] {
    const spanWords = new Set(wordsOf(span).map((word) => normalizeWord(word)));
    const targetNormalized = normalizeWord(target);
    const candidates: DistractorCandidate[] = [];
    const seen = new Set<string>([targetNormalized]);

    const push = (word: string, sourceRank: number) => {
        const normalized = normalizeWord(word);
        if (normalized.length < 2) return;
        if (seen.has(normalized) || spanWords.has(normalized)) return;
        seen.add(normalized);
        candidates.push({ word, sourceRank });
    };

    for (const sentence of material.split(/(?<=[.!?])\s+/)) {
        if (sentence.trim() === span) continue;
        for (const word of wordsOf(sentence)) {
            // Skip capitalized tokens: they are sentence-initial subjects or
            // proper names and read as wrong mid-sentence distractors.
            if (/^[A-Z]/.test(word)) continue;
            push(word, 0);
        }
    }

    const bucket = posBucketOf(target);
    for (const word of displayPoolFor(bucket)) {
        push(word, 1);
    }

    return candidates;
}

/**
 * Picks `count` same-part-of-speech, length-close distractors for the target,
 * preferring words from the learner's own material. Returns null when the
 * same-slot pool is smaller than `count`; callers must then use a non-choice
 * template instead of filling weak options.
 */
export function pickSameSlotDistractors(
    target: string,
    material: string,
    span: string,
    count = 3
): string[] | null {
    const bucket = posBucketOf(target);
    const targetLength = target.length;
    const targetNormalized = normalizeWord(target);

    const sameSlot = distractorCandidates(target, material, span)
        .filter((candidate) => posBucketOf(candidate.word) === bucket)
        .filter((candidate) => {
            if (bucket === 'content' && FUNCTION_WORD_DISTRACTOR_BLOCKLIST.has(candidate.word.toLowerCase())) {
                return false;
            }
            return normalizeWord(candidate.word) !== targetNormalized;
        })
        .sort((a, b) => {
            const bySource = a.sourceRank - b.sourceRank;
            if (bySource !== 0) return bySource;
            const byLength = Math.abs(a.word.length - targetLength) - Math.abs(b.word.length - targetLength);
            return byLength !== 0 ? byLength : a.word.localeCompare(b.word);
        })
        .map((candidate) => candidate.word);

    if (sameSlot.length < count) return null;
    return sameSlot.slice(0, count);
}

/** Probe used by the planner to decide whether a recognition item is possible. */
export function hasSameSlotDistractors(target: string, material: string, span: string): boolean {
    return pickSameSlotDistractors(target, material, span, 3) !== null;
}

/**
 * Options for non-choice templates. These four entries satisfy the mission
 * sanitizer payload contract but are never rendered as choices by the typing
 * and fill-blank renderers; they still prefer same-slot candidates and stay
 * unique so the sanitizer's duplicate check passes.
 */
function internalOptionsFor(item: LocalPlanItem, material: string, correctAnswer: string): string[] {
    const distractors = pickSameSlotDistractors(item.target, material, item.sourceSpan, 3);
    const pool = distractors ?? distractorCandidates(item.target, material, item.sourceSpan)
        .sort((a, b) =>
            a.sourceRank - b.sourceRank ||
            Math.abs(a.word.length - correctAnswer.length) - Math.abs(b.word.length - correctAnswer.length) ||
            a.word.localeCompare(b.word))
        .map((candidate) => candidate.word);
    return [correctAnswer, ...pool.slice(0, 3)];
}

/**
 * Replaces the first word-boundary, case-insensitive occurrence of the target
 * inside the span with a visible blank. Word boundaries prevent partial hits
 * (e.g. "her" inside "there"). Returns null when the target is not in the span;
 * the span keeps the target's original casing as the correct answer.
 */
export function blankTargetInSpan(
    span: string,
    target: string
): { question: string; correctAnswer: string } | null {
    const trimmed = target.trim();
    if (!trimmed) return null;
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(^|[^A-Za-z'])(${escaped})(?![A-Za-z'])`, 'i');
    const match = span.match(pattern);
    if (!match || match.index === undefined) return null;
    const start = match.index + match[1].length;
    const actual = span.slice(start, start + trimmed.length);
    const question = `${span.slice(0, start)}___${span.slice(start + trimmed.length)}`;
    return { question, correctAnswer: actual };
}

// Instruction phrasing is restricted to COMMON_WORD_LIST vocabulary plus the
// span itself, so every generated question passes the lexical quality gate.
const RECOGNITION_PROMPT = 'Choose the right word.';
const TYPED_PROMPT = 'What is the word?';
const HINT_TEXT = 'Look at the other words in the sentence.';

export function buildMonsterFromLocalPlanItem(
    item: LocalPlanItem,
    sequence: number,
    material: string
): Monster | null {
    const blanked = blankTargetInSpan(item.sourceSpan, item.target);
    if (!blanked) return null;

    const options = internalOptionsFor(item, material, blanked.correctAnswer);
    if (options.length !== 4 || new Set(options.map((option) => option.toLowerCase())).size !== 4) {
        return null;
    }

    const explanation = `The word is "${blanked.correctAnswer}". The full sentence: "${item.sourceSpan}"`;
    const monsterType: Monster['type'] = item.targetKind === 'word'
        ? 'vocab'
        : item.targetKind === 'grammar_form'
            ? 'grammar'
            : 'reading';
    const shared = {
        id: sequence,
        type: monsterType,
        skillTag: `${monsterType}:${item.learningObjectiveId}`,
        difficulty: item.difficulty,
        learningObjectiveId: item.learningObjectiveId,
        supportLevel: item.supportLevel,
        attemptKind: 'practice' as const,
        sourceContextSpan: item.sourceSpan,
        hint: HINT_TEXT,
        explanation,
        options,
        correctAnswer: blanked.correctAnswer,
        correct_index: 0
    };

    if (item.template === 'context-recognition') {
        const correctIndex = sequence % 4;
        const ordered: string[] = [];
        let distractorIndex = 1;
        for (let slot = 0; slot < 4; slot += 1) {
            if (slot === correctIndex) ordered.push(blanked.correctAnswer);
            else ordered.push(options[distractorIndex++]);
        }
        return {
            ...shared,
            question: `Read: "${blanked.question}" ${RECOGNITION_PROMPT}`,
            options: ordered,
            correct_index: correctIndex,
            questionMode: 'choice'
        };
    }

    if (item.template === 'context-cloze') {
        return {
            ...shared,
            question: `Read: "${blanked.question}"`,
            questionMode: 'fill-blank'
        };
    }

    return {
        ...shared,
        question: `Read: "${blanked.question}" ${TYPED_PROMPT}`,
        questionMode: 'typing'
    };
}

export interface LocalQuestQuestion {
    planItemId: string;
    monster: Monster;
}

export interface LocalQuestBuildResult {
    status: 'ready' | 'insufficient';
    reason?: 'insufficient-local-items';
    questions: LocalQuestQuestion[];
    droppedPlanItemIds: string[];
    /** Sanitizer output for the rendered battle; length equals questions.length. */
    sanitizedMonsters: Monster[];
}

function matchPlanItem(monster: Monster, items: LocalPlanItem[]): LocalPlanItem | undefined {
    const modeByTemplate: Record<LocalTemplateKind, Monster['questionMode']> = {
        'context-recognition': 'choice',
        'context-cloze': 'fill-blank',
        'typed-recall': 'typing'
    };
    const monsterAnswer = (monster.correctAnswer || '').toLowerCase();
    return items.find((item) => {
        if (monster.sourceContextSpan !== item.sourceSpan) return false;
        if (monster.questionMode !== modeByTemplate[item.template]) return false;
        const blanked = blankTargetInSpan(item.sourceSpan, item.target);
        return Boolean(blanked && blanked.correctAnswer.toLowerCase() === monsterAnswer);
    });
}

/**
 * Builds the final local quest: template monsters go through the shared mission
 * sanitizer (never a side channel), then any output that lost its material
 * grounding — including canned "Transfer check" conversions or fallback-bank
 * swaps — is dropped rather than delivered. The quest only ships with 6-8
 * material-grounded questions.
 */
export function buildLocalQuest(material: string, items: LocalPlanItem[]): LocalQuestBuildResult {
    const templateMonsters = items
        .map((item, index) => buildMonsterFromLocalPlanItem(item, index + 1, material))
        .filter((monster): monster is Monster => monster !== null);

    const sanitized = normalizeMissionMonsters(templateMonsters, {
        sourceText: material,
        material
    });

    const questions: LocalQuestQuestion[] = [];
    const usedPlanItemIds = new Set<string>();

    for (const monster of sanitized) {
        const spanGrounded = typeof monster.sourceContextSpan === 'string' &&
            material.includes(monster.sourceContextSpan);
        const notCanned = !CANNED_TRANSFER_PREFIX_REGEX.test(monster.question);
        const matched = spanGrounded && notCanned
            ? matchPlanItem(monster, items.filter((item) => !usedPlanItemIds.has(item.planItemId)))
            : undefined;

        if (!matched) continue;
        usedPlanItemIds.add(matched.planItemId);
        questions.push({ planItemId: matched.planItemId, monster });
    }

    const droppedPlanItemIds = items
        .filter((item) => !usedPlanItemIds.has(item.planItemId))
        .map((item) => item.planItemId);

    if (questions.length < MIN_LOCAL_QUEST_QUESTIONS) {
        return {
            status: 'insufficient',
            reason: 'insufficient-local-items',
            questions: [],
            droppedPlanItemIds,
            sanitizedMonsters: []
        };
    }

    return {
        status: 'ready',
        questions,
        droppedPlanItemIds,
        sanitizedMonsters: questions.map((question) => question.monster)
    };
}
