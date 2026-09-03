import { canonicalizeLearningObjective, getLearningObjective } from './learningObjectives';
import { isIndependentEvidence } from './learningEvidenceContract';
import type { AssessmentRole, EvidenceStrength } from './learningEvidenceContract';
import type { CanonicalLearningObjective, LearningObjectiveId } from './learningObjectives';

/**
 * Learning task contract (v1).
 *
 * A task contract states what the learner was actually asked to DO, kept
 * deliberately separate from how the question is rendered and from what the
 * answer may count as. Restoring a surface form inside its original sentence
 * is form practice; it must never be recorded as meaning or reference
 * evidence just because the renderer or objective label says so.
 */

export const LEARNING_TASK_CONTRACT_SCHEMA_VERSION = 1;

export type TargetFacet =
    | 'vocab-form'
    | 'vocab-meaning'
    | 'vocab-use'
    | 'grammar-form'
    | 'grammar-meaning-use'
    | 'pronoun-form'
    | 'pronoun-reference'
    | 'reading-detail'
    | 'reading-inference';

export type CognitiveAction =
    | 'recognize-form'
    | 'recognize-meaning'
    | 'retrieve-form'
    | 'transform-form'
    | 'evaluate-fit'
    | 'locate-evidence'
    | 'resolve-reference'
    | 'infer'
    | 'reconstruct'
    | 'produce';

export type ContextRelation = 'same-source' | 'varied-source' | 'novel-source';
export type MeasurementEligibility = 'objective-evidence' | 'practice-only';
export type EncounterRole = 'scout' | 'skirmish' | 'repair' | 'boss';

export interface LearningTaskContract {
    schemaVersion: 1;
    targetFacet: TargetFacet;
    cognitiveAction: CognitiveAction;
    contextRelation: ContextRelation;
    measurementEligibility: MeasurementEligibility;
    encounterRole: EncounterRole;
}

/** Facets whose cognitive action restores or recognizes a surface form. */
const FORM_FACETS: ReadonlySet<TargetFacet> = new Set(['vocab-form', 'grammar-form', 'pronoun-form']);

/** Which overt actions are coherent for each facet (ICAP: action ≠ renderer). */
const ACTIONS_BY_FACET: Record<TargetFacet, ReadonlySet<CognitiveAction>> = {
    'vocab-form': new Set(['recognize-form', 'retrieve-form', 'transform-form']),
    'vocab-meaning': new Set(['recognize-meaning', 'evaluate-fit', 'produce']),
    'vocab-use': new Set(['evaluate-fit', 'produce', 'reconstruct']),
    'grammar-form': new Set(['recognize-form', 'retrieve-form', 'transform-form', 'evaluate-fit']),
    'grammar-meaning-use': new Set(['recognize-meaning', 'evaluate-fit', 'transform-form']),
    'pronoun-form': new Set(['recognize-form', 'retrieve-form']),
    'pronoun-reference': new Set(['resolve-reference', 'locate-evidence']),
    'reading-detail': new Set(['locate-evidence', 'evaluate-fit']),
    'reading-inference': new Set(['infer', 'locate-evidence'])
};

/** Which facets can support objective-level evidence, per objective type. */
const FACETS_BY_OBJECTIVE_TYPE: Record<LearningObjectiveTypeKey, ReadonlySet<TargetFacet>> = {
    form: new Set(['grammar-form']),
    meaning: new Set(['vocab-meaning', 'vocab-use']),
    reference: new Set(['pronoun-reference']),
    detail: new Set(['reading-detail']),
    inference: new Set(['reading-inference'])
};

type LearningObjectiveTypeKey = 'form' | 'meaning' | 'reference' | 'detail' | 'inference';

/** Minimal question shape the contract validators reason about. */
export interface TaskContractQuestion {
    question: string;
    options: string[];
    correct_index: number;
    correctAnswer?: string;
    sourceContextSpan?: string;
    learningObjectiveId?: string;
    supportLevel?: number;
    assessmentRole?: AssessmentRole;
    attemptKind?: 'diagnostic' | 'practice' | 'review' | 'transfer';
    isImmediateRepair?: boolean;
    isBoss?: boolean;
    bossStage?: number;
    learningTask?: LearningTaskContract;
}

export function isLearningTaskContract(value: unknown): value is LearningTaskContract {
    if (!value || typeof value !== 'object') return false;
    const contract = value as Partial<LearningTaskContract>;
    return contract.schemaVersion === LEARNING_TASK_CONTRACT_SCHEMA_VERSION &&
        typeof contract.targetFacet === 'string' && contract.targetFacet in ACTIONS_BY_FACET &&
        typeof contract.cognitiveAction === 'string' &&
        Object.values(ACTIONS_BY_FACET).some((actions) => actions.has(contract.cognitiveAction as CognitiveAction)) &&
        (contract.contextRelation === 'same-source' ||
            contract.contextRelation === 'varied-source' ||
            contract.contextRelation === 'novel-source') &&
        (contract.measurementEligibility === 'objective-evidence' ||
            contract.measurementEligibility === 'practice-only') &&
        (contract.encounterRole === 'scout' ||
            contract.encounterRole === 'skirmish' ||
            contract.encounterRole === 'repair' ||
            contract.encounterRole === 'boss');
}

export function facetsAllowedForObjective(objectiveId?: string | null): ReadonlySet<TargetFacet> | null {
    const objective = getLearningObjective(objectiveId);
    if (!objective) return null;
    return FACETS_BY_OBJECTIVE_TYPE[objective.type];
}

export function isObjectiveAlignedTask(question: TaskContractQuestion): boolean {
    const contract = question.learningTask;
    if (!contract) return false;
    const allowedFacets = facetsAllowedForObjective(question.learningObjectiveId);
    if (!allowedFacets) return false;
    return allowedFacets.has(contract.targetFacet) &&
        ACTIONS_BY_FACET[contract.targetFacet].has(contract.cognitiveAction);
}

/**
 * Canonicalizes a question's objective, keeping the explicitly declared
 * objective of contract-carrying questions. Such questions come from
 * deliberate generators (local material planner, guarded boss factories)
 * whose classification is grounded in the actual target token; regex
 * inference over the question text must not override it. Questions without a
 * contract keep the existing canonicalization behavior.
 */
export function canonicalizeObjectiveForQuestion(input: {
    suggestedObjectiveId?: string | null;
    skillTag?: string | null;
    type?: string | null;
    question?: string | null;
    sourceContextSpan?: string | null;
    learningTask?: LearningTaskContract;
}): CanonicalLearningObjective {
    const locked = Boolean(input.learningTask) && getLearningObjective(input.suggestedObjectiveId);
    if (locked) {
        return {
            objectiveId: input.suggestedObjectiveId as LearningObjectiveId,
            confidence: 0.9,
            source: 'catalog',
            status: 'canonical',
            catalogVersion: canonicalizeLearningObjective(input).catalogVersion,
            rawObjectiveId: input.suggestedObjectiveId?.trim() || undefined,
            sourceContextSpan: input.sourceContextSpan?.trim() || undefined
        };
    }
    return canonicalizeLearningObjective(input);
}

/**
 * Whether an answer to this question may update qualified objective mastery.
 * Questions without a task contract keep their current (legacy) behavior.
 */
export function canUpdateObjectiveMastery(question: TaskContractQuestion): boolean {
    if (!question.learningTask) return true;
    return question.learningTask.measurementEligibility === 'objective-evidence' &&
        isObjectiveAlignedTask(question);
}

const BLANK_REGEX = /_{3}/;

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ');

/**
 * True when the question shows the source span with the expected answer
 * blanked out — i.e. same-sentence surface-form restoration, which is form
 * evidence only. A blank elsewhere in the question (for example in a new
 * application sentence) does not count.
 */
export function restoresSourceToken(question: TaskContractQuestion): boolean {
    const answer = (question.correctAnswer || question.options[question.correct_index] || '').trim();
    const span = question.sourceContextSpan?.trim();
    if (!answer || !span || !BLANK_REGEX.test(question.question)) return false;
    const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = span.match(new RegExp(`(^|[^A-Za-z'])${escaped}(?![A-Za-z'])`, 'i'));
    if (!match || match.index === undefined) return false;
    const start = match.index + match[1].length;
    const blankedSpan = `${span.slice(0, start)}___${span.slice(start + answer.length)}`;
    return normalizeWhitespace(question.question).includes(normalizeWhitespace(blankedSpan));
}

export interface TaskContractValidation {
    accepted: boolean;
    reasons: string[];
}

/**
 * Validates that a question's task contract is internally consistent and that
 * any measurement claim (objective evidence, transfer) is justified by what
 * the learner is actually asked to do. Questions without a contract are
 * accepted unchanged: only newly generated local/Boss questions carry one.
 */
export function validateLearningTaskContract(question: TaskContractQuestion): TaskContractValidation {
    const contract = question.learningTask;
    if (!contract) return { accepted: true, reasons: [] };
    const reasons: string[] = [];

    if (!isLearningTaskContract(contract)) {
        return { accepted: false, reasons: ['task-contract-shape-invalid'] };
    }
    if (!ACTIONS_BY_FACET[contract.targetFacet].has(contract.cognitiveAction)) {
        reasons.push(`cognitive-action-not-coherent-for-facet:${contract.targetFacet}`);
    }

    // Same-sentence token restoration measures form, never meaning/reference.
    if (restoresSourceToken(question)) {
        if (!FORM_FACETS.has(contract.targetFacet)) {
            reasons.push('source-token-restoration-must-be-form-task');
        }
    }

    if (contract.measurementEligibility === 'objective-evidence') {
        if (!isObjectiveAlignedTask(question)) {
            reasons.push(`facet-not-aligned-with-objective:${question.learningObjectiveId || 'unclassified'}`);
        } else if (restoresSourceToken(question)) {
            const objective = getLearningObjective(question.learningObjectiveId);
            // Token restoration can only carry objective weight for form
            // objectives; meaning/reference objectives need their own task.
            if (objective && objective.type !== 'form') {
                reasons.push(`form-restoration-cannot-update-${objective.type}-objective`);
            }
        }
    }

    const claimsTransfer = question.attemptKind === 'transfer' || question.assessmentRole === 'transfer';
    if (claimsTransfer) {
        if (contract.contextRelation === 'same-source') {
            reasons.push('transfer-requires-changed-context');
        }
        if ((question.supportLevel ?? 3) > 1) {
            reasons.push('transfer-requires-low-support');
        }
    }

    const expectedRole: EncounterRole | undefined = question.isImmediateRepair
        ? 'repair'
        : question.isBoss || question.bossStage !== undefined
            ? 'boss'
            : undefined;
    if (expectedRole && contract.encounterRole !== expectedRole) {
        reasons.push(`encounter-role-mismatch:${contract.encounterRole}`);
    }

    return { accepted: reasons.length === 0, reasons };
}

/**
 * Evidence-strength policy for task contracts. Practice-only tasks stay at
 * 'supported' at best, and a contract-carrying target whose answer was
 * already exposed earlier in the same session is supported practice, never
 * independent evidence — regardless of the renderer.
 */
export function applyTaskContractToEvidenceStrength(
    baseStrength: EvidenceStrength,
    question: Pick<TaskContractQuestion, 'learningTask'>,
    options: { priorAnswerForSameTarget?: boolean } = {}
): EvidenceStrength {
    if (baseStrength === 'no-credit') return baseStrength;
    const contract = question.learningTask;
    if (!contract) return baseStrength;

    if (contract.measurementEligibility === 'practice-only') return 'supported';
    if (options.priorAnswerForSameTarget && isIndependentEvidence(baseStrength)) return 'supported';
    return baseStrength;
}
