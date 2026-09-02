import { normalizeWord } from './textNormalize';
import { isKnownObjectiveId } from './learningObjectives';

export type PlanDomain = 'grammar' | 'vocab' | 'reading';
export type PlanRole = 'recognition' | 'cloze' | 'recall' | 'transfer';
export type PlanReadingSkill =
    | 'pronoun_reference'
    | 'inference'
    | 'contextual_meaning'
    | 'discourse'
    | 'pragmatic';

export type PlanTargetKind = 'word' | 'phrase' | 'grammar_form' | 'reference' | 'inference';

export interface QuestionPlanItem {
    role: PlanRole;
    domain: PlanDomain;
    learningObjectiveId: string;
    readingSkill?: PlanReadingSkill;
    sourceSpan: string;
    target: string;
    targetKind: PlanTargetKind;
    allowedWords: string[];
    supportLevel: 0 | 1 | 2 | 3;
    difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuestionPlan {
    levelTitle: string;
    materialSummary: string;
    vocabularyAllowed: string[];
    items: QuestionPlanItem[];
}

export const READING_SKILLS: PlanReadingSkill[] = [
    'pronoun_reference',
    'inference',
    'contextual_meaning',
    'discourse',
    'pragmatic'
];

export interface PlanValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

const TARGET_KIND_NEEDS_IN_SPAN: PlanTargetKind[] = ['word', 'phrase', 'grammar_form', 'reference'];
const PLAN_ROLES: PlanRole[] = ['recognition', 'cloze', 'recall', 'transfer'];
const PLAN_DOMAINS: PlanDomain[] = ['grammar', 'vocab', 'reading'];
const PLAN_TARGET_KINDS: PlanTargetKind[] = ['word', 'phrase', 'grammar_form', 'reference', 'inference'];
const PLAN_DIFFICULTIES: QuestionPlanItem['difficulty'][] = ['easy', 'medium', 'hard'];

export function validateQuestionPlan(
    planInput: QuestionPlan,
    material: string,
    allowedSet: Set<string>
): PlanValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const materialLower = material.toLowerCase();
    const rawPlan = planInput as unknown;
    if (!rawPlan || typeof rawPlan !== 'object' || Array.isArray(rawPlan)) {
        return { valid: false, errors: ['Plan must be a JSON object.'], warnings };
    }
    const planRecord = rawPlan as Record<string, unknown>;
    if (typeof planRecord.levelTitle !== 'string' || !planRecord.levelTitle.trim()) {
        errors.push('Plan levelTitle must be a non-empty string.');
    }
    if (typeof planRecord.materialSummary !== 'string') {
        errors.push('Plan materialSummary must be a string.');
    }
    if (!Array.isArray(planRecord.vocabularyAllowed) ||
        !planRecord.vocabularyAllowed.every((word) => typeof word === 'string')) {
        errors.push('Plan vocabularyAllowed must be a string array.');
    }
    if (!Array.isArray(planRecord.items)) {
        errors.push('Plan items must be an array.');
        return { valid: false, errors, warnings };
    }
    const items = planRecord.items;

    if (items.length < 6 || items.length > 8) {
        errors.push(`Plan must have 6 to 8 items (got ${items.length}).`);
    }

    items.forEach((rawItem, index) => {
        const label = `item[${index}]`;
        if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
            errors.push(`${label} must be an object.`);
            return;
        }
        const item = rawItem as Partial<QuestionPlanItem>;
        if (!item.role || !PLAN_ROLES.includes(item.role)) {
            errors.push(`${label} role is invalid.`);
        }
        if (!item.domain || !PLAN_DOMAINS.includes(item.domain)) {
            errors.push(`${label} domain is invalid.`);
        }
        if (!item.targetKind || !PLAN_TARGET_KINDS.includes(item.targetKind)) {
            errors.push(`${label} targetKind is invalid.`);
        }
        if (!item.difficulty || !PLAN_DIFFICULTIES.includes(item.difficulty)) {
            errors.push(`${label} difficulty is invalid.`);
        }
        if (![0, 1, 2, 3].includes(item.supportLevel as number)) {
            errors.push(`${label} supportLevel must be 0, 1, 2, or 3.`);
        }
        if (typeof item.learningObjectiveId !== 'string' || !item.learningObjectiveId.trim()) {
            errors.push(`${label} learningObjectiveId must be a non-empty string.`);
        } else if (!isKnownObjectiveId(item.learningObjectiveId)) {
            errors.push(`${label} learningObjectiveId "${item.learningObjectiveId}" is not in the reviewed objective catalog.`);
        }
        const span = (item.sourceSpan ?? '').trim().toLowerCase();
        if (!span || !materialLower.includes(span)) {
            errors.push(`${label} sourceSpan is not a material substring: "${item.sourceSpan ?? ''}".`);
        }
        if (item.targetKind && TARGET_KIND_NEEDS_IN_SPAN.includes(item.targetKind)) {
            const target = (item.target ?? '').toLowerCase();
            if (!target || !span.includes(target)) {
                errors.push(`${label} target "${item.target ?? ''}" does not appear in its sourceSpan.`);
            }
        }
        if (item.domain === 'reading' && !item.readingSkill) {
            errors.push(`${label} reading item is missing readingSkill.`);
        }
        if (item.readingSkill && !READING_SKILLS.includes(item.readingSkill)) {
            errors.push(`${label} readingSkill "${item.readingSkill}" is not in the allowed list.`);
        }
        // allowedWords is the one field models omit; missing it is not a
        // structural failure (the critic enforces lexical fit downstream).
        if (item.allowedWords !== undefined && !Array.isArray(item.allowedWords)) {
            errors.push(`${label} allowedWords must be a string array when provided.`);
        }
        const allowedWords = Array.isArray(item.allowedWords)
            ? item.allowedWords.filter((word): word is string => typeof word === 'string')
            : [];
        if (Array.isArray(item.allowedWords) && allowedWords.length !== item.allowedWords.length) {
            errors.push(`${label} allowedWords must contain only strings.`);
        }
        const offending = allowedWords
            .map(normalizeWord)
            .filter((w) => !allowedSet.has(w));
        if (offending.length > 0) {
            errors.push(`${label} allowedWords outside allowedSet: ${offending.join(', ')}.`);
        }
    });

    const roles = items.flatMap((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const role = (item as Partial<QuestionPlanItem>).role;
        return role && PLAN_ROLES.includes(role) ? [role] : [];
    });
    if (roles.length >= 6 && !roles.includes('transfer')) {
        // A transfer item is pedagogically desirable (recognition->cloze->recall->transfer
        // ladder) but NOT a correctness requirement. The legacy fallback path has no transfer
        // guarantee either, so rejecting an otherwise-good plan for this would be strictly
        // worse. Surface it as a warning; the generator prompt still requests it.
        warnings.push('Plan has no transfer item; the ladder will end at recall.');
    }

    return { valid: errors.length === 0, errors, warnings };
}
