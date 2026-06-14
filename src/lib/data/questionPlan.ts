import { normalizeWord } from './textNormalize';

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

export function validateQuestionPlan(
    planInput: QuestionPlan,
    material: string,
    allowedSet: Set<string>
): PlanValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const materialLower = material.toLowerCase();
    const items = planInput.items || [];

    if (items.length < 6 || items.length > 8) {
        errors.push(`Plan must have 6 to 8 items (got ${items.length}).`);
    }

    items.forEach((item, index) => {
        const label = `item[${index}]`;
        // Guard every field access: a non-compliant plan item must produce a
        // clean validation error, never crash the pipeline.
        const span = (item.sourceSpan ?? '').trim().toLowerCase();
        if (!span || !materialLower.includes(span)) {
            errors.push(`${label} sourceSpan is not a material substring: "${item.sourceSpan ?? ''}".`);
        }
        if (TARGET_KIND_NEEDS_IN_SPAN.includes(item.targetKind)) {
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
        const offending = (item.allowedWords ?? [])
            .map(normalizeWord)
            .filter((w) => !allowedSet.has(w));
        if (offending.length > 0) {
            errors.push(`${label} allowedWords outside allowedSet: ${offending.join(', ')}.`);
        }
    });

    const roles = items.map((i) => i.role);
    if (roles.length >= 6 && !roles.includes('transfer')) {
        // A transfer item is pedagogically desirable (recognition->cloze->recall->transfer
        // ladder) but NOT a correctness requirement. The legacy fallback path has no transfer
        // guarantee either, so rejecting an otherwise-good plan for this would be strictly
        // worse. Surface it as a warning; the generator prompt still requests it.
        warnings.push('Plan has no transfer item; the ladder will end at recall.');
    }

    return { valid: errors.length === 0, errors, warnings };
}
