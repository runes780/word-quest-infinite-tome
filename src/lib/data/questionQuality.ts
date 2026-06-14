import type { Monster } from '@/store/gameStore';
import {
    difficultyAtOrBelow,
    isTextAtOrBelowDifficulty,
    type MaterialDifficulty
} from '@/lib/ai/materialProfile';
import { contentWords } from './textNormalize';
import { READING_SKILLS, type PlanDomain, type PlanReadingSkill } from './questionPlan';

export type QuestionQualityFlag =
    | 'source_grounded'
    | 'transfer_check'
    | 'mode_mismatch'
    | 'weak_options'
    | 'single_objective'
    | 'difficulty_fit'
    | 'language_fit'
    | 'lexical_fit'
    | 'context_grounded'
    | 'reading_skill_fit';

export interface QuestionQualityReport {
    accepted: boolean;
    score: number;
    flags: QuestionQualityFlag[];
    rejectReasons: string[];
    repairSuggestion?: string;
}

export interface QuestionQualityOptions {
    maxDifficulty?: MaterialDifficulty;
    allowedSet?: Set<string>;
    material?: string;
    target?: string;
    domain?: PlanDomain;
    readingSkill?: PlanReadingSkill;
}

const BLANK_REGEX = /(?:_{2,}|\[\s*(?:\.\.\.|…)?\s*\]|\(\s*blank\s*\))/i;
const CJK_REGEX = /[㐀-鿿]/;
const PLACEHOLDER_OPTION_REGEX = /^(?:[A-D]|option\s*[A-D]?|choice\s*[A-D]?|option\s+\d+|choice\s+\d+|\d+)$/i;
const GENERIC_SOURCE_SPAN_REGEX = /^(?:mission|daily_plan|srs|battle|revenge|diagnostic|immediate_repair|sanitized_fallback|boss_gate_(?:recognition|application|transfer))$/i;
const INTERNAL_FIELD_REGEX = /\b(?:questionMode|skillTag|correct_index|correctIndex|correctAnswer|sourceContextSpan|learningObjectiveId|supportLevel|attemptKind|apiProvider|apiKey|contextHash|level_title)\b/i;
const META_CONTENT_REGEX = /\b(?:api\s+(?:key|provider)|api\s+provider|model\s+name|openrouter|deepseek|gemini|claude|guardian\s+dashboard|system\s+status|json\s+schema|field\s+name)\b/i;

const READING_SKILL_SIGNALS: Record<PlanReadingSkill, RegExp> = {
    pronoun_reference: /\b(refer(?:s|red|ring)? to|what does ['"]?(?:he|she|it|they|this|that)['"]? (?:mean|refer))\b/i,
    inference: /\b(why|infer|because|suggest|imply|probably|how (?:do|can|did)|show)\b/i,
    contextual_meaning: /\b(in this (?:sentence|line)|here|most nearly mean|closest (?:in )?meaning)\b/i,
    discourse: /\b(however|then|next|first|finally|transition|connect|in contrast)\b/i,
    pragmatic: /\b(purpose|intend|trying to|tone|feel|attitude|the writer|the author)\b/i
};

export function hasVisibleQuestionBlank(question: string): boolean {
    return BLANK_REGEX.test(question);
}

function uniqueLower(values: string[]): Set<string> {
    return new Set(values.map((value) => value.trim().toLowerCase()).filter(Boolean));
}

function isGenericSourceSpan(value?: string): boolean {
    return !value || GENERIC_SOURCE_SPAN_REGEX.test(value.trim());
}

function addReject(rejectReasons: string[], reason: string) {
    if (!rejectReasons.includes(reason)) rejectReasons.push(reason);
}

function addFlag(flags: QuestionQualityFlag[], flag: QuestionQualityFlag) {
    if (!flags.includes(flag)) flags.push(flag);
}

function hasNonEnglishPayloadText(values: string[]): boolean {
    return values.some((value) => CJK_REGEX.test(value));
}

function scoreFrom(flags: QuestionQualityFlag[], rejectReasons: string[]) {
    let score = 100;
    score -= rejectReasons.length * 28;
    if (flags.includes('weak_options')) score -= 18;
    if (flags.includes('mode_mismatch')) score -= 22;
    if (flags.includes('transfer_check')) score += 4;
    if (flags.includes('source_grounded')) score += 4;
    if (flags.includes('difficulty_fit')) score += 2;
    return Math.max(0, Math.min(100, score));
}

function checkLexicalFit(
    texts: string[],
    allowedSet: Set<string>,
    target: string | undefined
): { ok: boolean; offending: string[] } {
    const targetNorm = target ? target.toLowerCase().replace(/[^a-z]/g, '') : '';
    const offending = new Set<string>();
    for (const text of texts) {
        for (const word of contentWords(text)) {
            if (word === targetNorm) continue;
            if (allowedSet.has(word)) continue;
            offending.add(word);
        }
    }
    return { ok: offending.size === 0, offending: [...offending] };
}

function extractQuotedSpans(text: string): string[] {
    const matches = text.match(/["“]([^"”]{8,})["”]/g) || [];
    return matches.map((m) => m.replace(/^["“]|["”]$/g, '').trim());
}

function isGroundedInMaterial(
    question: { question: string; sourceContextSpan?: string },
    material: string
): boolean {
    const spans = [question.sourceContextSpan, ...extractQuotedSpans(question.question)]
        .map((s) => s?.trim())
        .filter(Boolean) as string[];
    return spans.some((span) => material.includes(span));
}

function readingSkillMatches(stem: string, skill: PlanReadingSkill): boolean {
    return READING_SKILL_SIGNALS[skill].test(stem);
}

export function assessQuestionQuality(
    question: Pick<Monster,
        'question' |
        'options' |
        'correct_index' |
        'correctAnswer' |
        'questionMode' |
        'difficulty' |
        'learningObjectiveId' |
        'sourceContextSpan' |
        'supportLevel' |
        'attemptKind' |
        'hint' |
        'explanation'>,
    options: QuestionQualityOptions = {}
): QuestionQualityReport {
    const flags: QuestionQualityFlag[] = [];
    const rejectReasons: string[] = [];
    let repairSuggestion: string | undefined;
    const stem = question.question?.trim() || '';
    const answer = question.correctAnswer?.trim() || question.options?.[question.correct_index] || '';
    const sourceContextSpan = question.sourceContextSpan?.trim();
    const isTransfer = question.attemptKind === 'transfer' || question.supportLevel === 0;

    if (!stem) addReject(rejectReasons, 'missing_question');
    if (INTERNAL_FIELD_REGEX.test(stem) || META_CONTENT_REGEX.test(stem)) addReject(rejectReasons, 'meta_content');
    if (hasNonEnglishPayloadText([stem, ...(question.options || []), answer])) {
        addFlag(flags, 'language_fit');
        addReject(rejectReasons, 'non_english_question_payload');
    } else {
        addFlag(flags, 'language_fit');
    }

    const validMode = question.questionMode === 'choice' || question.questionMode === 'typing' || question.questionMode === 'fill-blank';
    if (!validMode) addReject(rejectReasons, 'invalid_question_mode');

    if (question.questionMode === 'fill-blank' && !hasVisibleQuestionBlank(stem)) {
        addFlag(flags, 'mode_mismatch');
        addReject(rejectReasons, 'fill_blank_missing_visible_blank');
    }

    if (!Array.isArray(question.options) || question.options.length !== 4) {
        addFlag(flags, 'weak_options');
        addReject(rejectReasons, 'option_count_not_four');
    } else {
        const optionSet = uniqueLower(question.options);
        if (optionSet.size !== question.options.length) {
            addFlag(flags, 'weak_options');
            addReject(rejectReasons, 'duplicate_options');
        }
        if (question.options.some((option) => PLACEHOLDER_OPTION_REGEX.test(option.trim()))) {
            addFlag(flags, 'weak_options');
            addReject(rejectReasons, 'placeholder_options');
        }
        if (question.correct_index < 0 || question.correct_index >= question.options.length) {
            addFlag(flags, 'weak_options');
            addReject(rejectReasons, 'correct_index_out_of_range');
        }
    }

    if (!answer) addReject(rejectReasons, 'missing_correct_answer');

    if (isTransfer) {
        addFlag(flags, 'transfer_check');
        if (!question.learningObjectiveId) {
            addReject(rejectReasons, 'transfer_missing_learning_objective');
        }
        if (isGenericSourceSpan(sourceContextSpan)) {
            addReject(rejectReasons, 'transfer_missing_source_span');
        }
    } else if (!isGenericSourceSpan(sourceContextSpan)) {
        addFlag(flags, 'source_grounded');
    }

    if (question.learningObjectiveId) addFlag(flags, 'single_objective');

    const maxDifficulty = options.maxDifficulty;
    if (maxDifficulty && question.difficulty && !difficultyAtOrBelow(question.difficulty, maxDifficulty)) {
        const textFits = isTextAtOrBelowDifficulty(stem, maxDifficulty) &&
            Array.isArray(question.options) &&
            question.options.every((option) => isTextAtOrBelowDifficulty(option, maxDifficulty));
        if (!textFits) {
            addReject(rejectReasons, 'above_material_difficulty');
        }
    } else {
        addFlag(flags, 'difficulty_fit');
    }

    // --- Lexical grounding (preferred over the legacy heuristic when allowedSet is provided) ---
    if (options.allowedSet) {
        const texts = [
            stem,
            ...(Array.isArray(question.options) ? question.options : []),
            question.hint ?? '',
            question.explanation ?? '',
            answer
        ];
        const fit = checkLexicalFit(texts, options.allowedSet, options.target);
        if (fit.ok) {
            addFlag(flags, 'lexical_fit');
        } else {
            addReject(rejectReasons, 'above_material_vocabulary');
            if (!repairSuggestion) repairSuggestion = 'clamp_to_allowed_vocabulary';
        }
    }

    // --- 1T grounding ---
    if (options.material) {
        if (isGroundedInMaterial({ question: stem, sourceContextSpan }, options.material)) {
            addFlag(flags, 'context_grounded');
        } else {
            addReject(rejectReasons, 'not_grounded_in_material');
            if (!repairSuggestion) repairSuggestion = 'embed_source_span';
        }
    }

    // --- Reading-skill fit ---
    if (options.domain === 'reading') {
        if (!options.readingSkill || !READING_SKILLS.includes(options.readingSkill)) {
            addReject(rejectReasons, 'reading_skill_missing');
        } else if (!readingSkillMatches(stem, options.readingSkill)) {
            addReject(rejectReasons, 'reading_skill_mismatch');
            if (!repairSuggestion) repairSuggestion = 'assign_reading_skill';
        } else {
            addFlag(flags, 'reading_skill_fit');
        }
    }

    const score = scoreFrom(flags, rejectReasons);
    const accepted = rejectReasons.length === 0 && score >= 60;

    if (!repairSuggestion) {
        if (rejectReasons.includes('fill_blank_missing_visible_blank')) repairSuggestion = 'build_cloze_from_source_span';
        else if (rejectReasons.includes('placeholder_options')) repairSuggestion = 'replace_placeholder_distractors';
        else if (rejectReasons.includes('non_english_question_payload')) repairSuggestion = 'replace_non_english_payload';
    }

    return {
        accepted,
        score,
        flags,
        rejectReasons,
        repairSuggestion
    };
}
