import { analyzeMaterialProfile, type MaterialDifficulty } from '@/lib/ai/materialProfile';
import { COMMON_WORD_SET } from './commonWords';
import { normalizeWord } from './textNormalize';
import { hasSameSlotDistractors } from './localQuestionTemplates';

/**
 * Deterministic, offline analysis of learner-provided material.
 *
 * The analyzer picks candidate learning targets directly from the material so a
 * quest can be built with no AI provider call. Everything here is pure and
 * deterministic: the same material always produces the same targets, plan item
 * IDs, and questions.
 */

export type LocalTargetKind = 'word' | 'grammar_form' | 'reference';
export type LocalDomain = 'vocab' | 'grammar' | 'reading';
export type LocalTemplateKind = 'context-recognition' | 'context-cloze' | 'typed-recall';

/** v1 cognitive actions map 1:1 to templates. Orthogonal action/render split is future work. */
export type LocalCognitiveAction = 'recognize-in-context' | 'retrieve-form-cloze' | 'retrieve-form-typed';

export const MIN_LOCAL_TARGETS = 3;
export const MAX_LOCAL_TARGETS = 8;
export const MIN_LOCAL_QUEST_QUESTIONS = 6;
export const MAX_LOCAL_QUEST_QUESTIONS = 8;

export type LocalLearningObjectiveId =
    | 'vocab_context_meaning'
    | 'past_tense_basic'
    | 'preposition_place_time'
    | 'pronoun_reference';

export interface LocalMaterialTarget {
    /** Stable across runs: derived from the normalized target form plus its span. */
    targetId: string;
    /** Exact surface form as it appears in the source span. */
    target: string;
    targetKind: LocalTargetKind;
    domain: LocalDomain;
    learningObjectiveId: LocalLearningObjectiveId;
    sourceSpan: string;
    difficulty: MaterialDifficulty;
}

export type LocalMaterialAnalysisReason =
    | 'material-empty'
    | 'material-not-english'
    | 'material-too-short'
    | 'too-few-targets';

export interface LocalMaterialAnalysis {
    status: 'ready' | 'insufficient';
    reason?: LocalMaterialAnalysisReason;
    language: string;
    difficulty: MaterialDifficulty;
    bandLabel: string;
    /** Whitespace-normalized material; every sourceSpan is a substring of it. */
    material: string;
    targets: LocalMaterialTarget[];
}

export interface LocalPlanItem {
    /** Stable plan identity; never a monster numeric id or array position. */
    planItemId: string;
    targetId: string;
    learningObjectiveId: LocalLearningObjectiveId;
    cognitiveAction: LocalCognitiveAction;
    template: LocalTemplateKind;
    sourceSpan: string;
    target: string;
    targetKind: LocalTargetKind;
    supportLevel: 0 | 1 | 2 | 3;
    difficulty: MaterialDifficulty;
}

export interface LocalQuestPlanResult {
    status: 'ready' | 'insufficient';
    reason?: 'too-few-targets' | 'insufficient-local-items';
    items: LocalPlanItem[];
}

/** Span word limits leave headroom for the instruction words added by templates. */
const MAX_SPAN_WORDS_BY_DIFFICULTY: Record<MaterialDifficulty, number> = {
    easy: 12,
    medium: 18,
    hard: 28
};

const MAX_SPAN_WORD_LENGTH_BY_DIFFICULTY: Record<MaterialDifficulty, number> = {
    easy: 11,
    medium: 14,
    hard: 18
};

const PRONOUN_TARGETS = new Set(['she', 'he', 'it', 'they', 'them', 'we', 'her', 'him', 'his', 'its', 'their']);

const PREPOSITION_TARGETS = new Set([
    'in', 'on', 'at', 'under', 'over', 'between', 'behind', 'near',
    'above', 'below', 'through', 'around', 'beside', 'into', 'across', 'along'
]);

const IRREGULAR_PAST_TARGETS = new Set([
    'went', 'saw', 'took', 'had', 'made', 'said', 'came', 'got', 'found',
    'left', 'kept', 'felt', 'told', 'held', 'brought', 'thought', 'bought',
    'wrote', 'sat', 'stood', 'ate', 'drank', 'knew', 'grew', 'met', 'paid', 'ran'
]);

/** Common -ed adjectives that are not past-tense verbs. */
const ED_ADJECTIVE_BLOCKLIST = new Set([
    'tired', 'excited', 'scared', 'surprised', 'interested', 'bored',
    'worried', 'pleased', 'sacred', 'bare', 'learned'
]);

const CJK_REGEX = /[\u3400-\u9FFF]/;

export function normalizeMaterialForAnalysis(text: string): string {
    return text.replace(/\s+/g, ' ').trim();
}

function stableHash(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function splitSentences(material: string): string[] {
    return material
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => sentence.trim())
        .filter(Boolean);
}

function wordsOf(value: string): string[] {
    return value.match(/[A-Za-z][A-Za-z'-]*/g) || [];
}

interface CandidateTarget {
    surface: string;
    kind: LocalTargetKind;
    domain: LocalDomain;
    objectiveId: LocalLearningObjectiveId;
}

function classifyTargetCandidate(token: string): CandidateTarget | null {
    const lower = token.toLowerCase();
    if (PRONOUN_TARGETS.has(lower)) {
        return { surface: token, kind: 'reference', domain: 'reading', objectiveId: 'pronoun_reference' };
    }
    if (PREPOSITION_TARGETS.has(lower)) {
        return { surface: token, kind: 'grammar_form', domain: 'grammar', objectiveId: 'preposition_place_time' };
    }
    if (IRREGULAR_PAST_TARGETS.has(lower)) {
        return { surface: token, kind: 'grammar_form', domain: 'grammar', objectiveId: 'past_tense_basic' };
    }
    if (token.length >= 5 && lower.endsWith('ed') && !ED_ADJECTIVE_BLOCKLIST.has(lower)) {
        return { surface: token, kind: 'grammar_form', domain: 'grammar', objectiveId: 'past_tense_basic' };
    }
    const normalized = normalizeWord(token);
    const isCommon = COMMON_WORD_SET.has(normalized);
    if (!isCommon && token.length >= 5 && token.length <= 13 && /^[A-Za-z]+$/.test(token)) {
        return { surface: token, kind: 'word', domain: 'vocab', objectiveId: 'vocab_context_meaning' };
    }
    return null;
}

export function analyzeLocalMaterial(text: string): LocalMaterialAnalysis {
    const material = normalizeMaterialForAnalysis(text);
    const profile = analyzeMaterialProfile(material);
    const base = {
        language: profile.language,
        difficulty: profile.difficulty,
        bandLabel: profile.bandLabel,
        material
    };

    if (!material) {
        return { ...base, status: 'insufficient', reason: 'material-empty', targets: [] };
    }
    if (profile.language !== 'english' || CJK_REGEX.test(material)) {
        return { ...base, status: 'insufficient', reason: 'material-not-english', targets: [] };
    }

    const totalWords = wordsOf(material).length;
    if (totalWords < 18) {
        return { ...base, status: 'insufficient', reason: 'material-too-short', targets: [] };
    }

    const maxSpanWords = MAX_SPAN_WORDS_BY_DIFFICULTY[profile.difficulty];
    const maxSpanWordLength = MAX_SPAN_WORD_LENGTH_BY_DIFFICULTY[profile.difficulty];

    const seenTargets = new Set<string>();
    const targets: LocalMaterialTarget[] = [];

    for (const sentence of splitSentences(material)) {
        if (targets.length >= MAX_LOCAL_TARGETS) break;
        if (CJK_REGEX.test(sentence)) continue;
        const words = wordsOf(sentence);
        if (words.length < 4 || words.length > maxSpanWords) continue;
        if (words.some((word) => word.length > maxSpanWordLength)) continue;

        // Skip the sentence-initial token: it is usually capitalized (subject
        // pronoun, proper name), which breaks case-consistent distractors.
        for (const token of words.slice(1)) {
            if (targets.length >= MAX_LOCAL_TARGETS) break;
            const candidate = classifyTargetCandidate(token);
            if (!candidate) continue;
            const normalized = normalizeWord(candidate.surface);
            if (seenTargets.has(normalized)) continue;
            seenTargets.add(normalized);
            targets.push({
                targetId: `lt-${normalized}-${stableHash(`${normalized}|${sentence}`).slice(0, 6)}`,
                target: candidate.surface,
                targetKind: candidate.kind,
                domain: candidate.domain,
                learningObjectiveId: candidate.objectiveId,
                sourceSpan: sentence,
                difficulty: profile.difficulty
            });
        }
    }

    if (targets.length < MIN_LOCAL_TARGETS) {
        return { ...base, status: 'insufficient', reason: 'too-few-targets', targets };
    }
    return { ...base, status: 'ready', targets };
}

const TEMPLATE_BY_ACTION: Record<LocalCognitiveAction, LocalTemplateKind> = {
    'recognize-in-context': 'context-recognition',
    'retrieve-form-cloze': 'context-cloze',
    'retrieve-form-typed': 'typed-recall'
};

function templatesForTarget(target: LocalMaterialTarget, material: string): LocalCognitiveAction[] {
    // A recognition item needs three same-slot distractors. When the material
    // cannot supply them, the target degrades to retrieval templates instead of
    // producing a weak multiple-choice item.
    const recognitionOk = hasSameSlotDistractors(target.target, material, target.sourceSpan);
    if (!recognitionOk) {
        return ['retrieve-form-cloze', 'retrieve-form-typed'];
    }
    return ['recognize-in-context', 'retrieve-form-cloze', 'retrieve-form-typed'];
}

/**
 * Builds a deterministic 6-8 item plan from the selected targets. Base coverage
 * gives every target one recognition item; extras add cloze/typed retrieval,
 * spread across targets, until the pack reaches the target size.
 */
export function planLocalQuest(
    analysis: LocalMaterialAnalysis,
    selectedTargetIds: string[]
): LocalQuestPlanResult {
    const selected = analysis.targets.filter((target) => selectedTargetIds.includes(target.targetId));
    if (selected.length < MIN_LOCAL_TARGETS) {
        return { status: 'insufficient', reason: 'too-few-targets', items: [] };
    }

    const material = analysis.material;
    const usedPlanItemIds = new Set<string>();
    const planItemIdFor = (target: LocalMaterialTarget, action: LocalCognitiveAction): string => {
        const baseId = `${target.targetId}:${TEMPLATE_BY_ACTION[action]}`;
        let id = baseId;
        let suffix = 2;
        while (usedPlanItemIds.has(id)) {
            id = `${baseId}#${suffix}`;
            suffix += 1;
        }
        usedPlanItemIds.add(id);
        return id;
    };

    const makeItem = (target: LocalMaterialTarget, action: LocalCognitiveAction): LocalPlanItem => ({
        planItemId: planItemIdFor(target, action),
        targetId: target.targetId,
        learningObjectiveId: target.learningObjectiveId,
        cognitiveAction: action,
        template: TEMPLATE_BY_ACTION[action],
        sourceSpan: target.sourceSpan,
        target: target.target,
        targetKind: target.targetKind,
        supportLevel: action === 'retrieve-form-typed' ? 1 : 2,
        difficulty: target.difficulty
    });

    const byTarget = new Map(selected.map((target) => [target.targetId, {
        target,
        templates: templatesForTarget(target, material)
    } as const]));

    const items: LocalPlanItem[] = [];
    const perTargetCount = new Map<string, number>();
    const pushItem = (targetId: string, action: LocalCognitiveAction) => {
        const entry = byTarget.get(targetId);
        if (!entry || !entry.templates.includes(action)) return false;
        const count = perTargetCount.get(targetId) || 0;
        if (count >= 3) return false;
        perTargetCount.set(targetId, count + 1);
        items.push(makeItem(entry.target, action));
        return true;
    };

    // Base: one recognition (or first available) item per target, capped so at
    // least one cloze and one typed item still fit inside the pack cap.
    const baseCap = Math.min(selected.length, MAX_LOCAL_QUEST_QUESTIONS - 2);
    for (const target of selected.slice(0, baseCap)) {
        const firstAction = byTarget.get(target.targetId)!.templates[0];
        pushItem(target.targetId, firstAction);
    }

    // Extras: spread cloze and typed retrieval across targets up to the pack cap.
    const targetCount = selected.length;
    let extraIndex = 0;
    while (items.length < MAX_LOCAL_QUEST_QUESTIONS) {
        const target = selected[extraIndex % targetCount];
        const action: LocalCognitiveAction = extraIndex % 2 === 0 ? 'retrieve-form-cloze' : 'retrieve-form-typed';
        const before = items.length;
        pushItem(target.targetId, action);
        if (items.length === before) {
            // This target is exhausted; try its other retrieval template once.
            const fallbackAction: LocalCognitiveAction = extraIndex % 2 === 0 ? 'retrieve-form-typed' : 'retrieve-form-cloze';
            pushItem(target.targetId, fallbackAction);
        }
        if (items.length === before) {
            // All targets exhausted before reaching the cap.
            break;
        }
        extraIndex += 1;
    }

    if (items.length < MIN_LOCAL_QUEST_QUESTIONS) {
        return { status: 'insufficient', reason: 'insufficient-local-items', items };
    }
    return { status: 'ready', items };
}
