import {
    OBJECTIVE_CATALOG_VERSION,
    isKnownObjectiveId,
    type LearningObjectiveId,
    type ObjectiveClassificationStatus
} from './learningObjectives';

export const LEARNING_EVIDENCE_CONTRACT_VERSION = 1;

export type AssessmentRole =
    | 'instruction'
    | 'practice'
    | 'immediate-repair'
    | 'delayed-probe'
    | 'transfer';

export type TransferDistance = 'same-context' | 'near' | 'far';
export type ContentReviewerStatus =
    | 'unreviewed'
    | 'system-reviewed'
    | 'educator-approved'
    | 'educator-edited'
    | 'rejected';

export type EvidenceStrength =
    | 'no-credit'
    | 'supported'
    | 'independent'
    | 'delayed-independent'
    | 'transfer-independent';

export interface LearningEvidenceMetadata {
    evidenceContractVersion: number;
    objectiveCatalogVersion: number;
    objectiveClassificationStatus: ObjectiveClassificationStatus;
    itemFamilyId: string;
    contextId: string;
    equivalenceGroup: string;
    assessmentRole: AssessmentRole;
    transferDistance: TransferDistance;
    reviewerStatus: ContentReviewerStatus;
}

interface EvidenceIdentityInput {
    learningObjectiveId?: string | null;
    objectiveClassificationStatus?: ObjectiveClassificationStatus;
    skillTag?: string | null;
    question?: string | null;
    sourceContextSpan?: string | null;
    target?: string | null;
    itemFamilyId?: string | null;
    contextId?: string | null;
    equivalenceGroup?: string | null;
    assessmentRole?: AssessmentRole;
    transferDistance?: TransferDistance;
    reviewerStatus?: ContentReviewerStatus;
    objectiveCatalogVersion?: number;
}

interface EvidenceStrengthInput {
    learningObjectiveId?: string | null;
    objectiveClassificationStatus?: ObjectiveClassificationStatus;
    assessmentRole?: AssessmentRole;
    transferDistance?: TransferDistance;
    reviewerStatus?: ContentReviewerStatus;
    supportLevel?: number;
    hintUsed?: boolean;
}

function normalizeIdentityPart(value?: string | null): string {
    return (value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 96);
}

function stableIdentityHash(value: string): string {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function stableId(prefix: string, parts: Array<string | null | undefined>): string {
    const normalized = parts.map(normalizeIdentityPart).filter(Boolean).join('|') || 'unclassified';
    return `${prefix}_${stableIdentityHash(normalized)}`;
}

export function assessmentRoleFromAttempt(input: {
    attemptKind?: 'diagnostic' | 'practice' | 'review' | 'transfer';
    isImmediateRepair?: boolean;
}): AssessmentRole {
    if (input.isImmediateRepair) return 'immediate-repair';
    if (input.attemptKind === 'diagnostic') return 'instruction';
    if (input.attemptKind === 'transfer') return 'transfer';
    return 'practice';
}

export function resolveAssessmentRole(input: {
    assessmentRole?: AssessmentRole;
    attemptKind?: 'diagnostic' | 'practice' | 'review' | 'transfer';
    isImmediateRepair?: boolean;
}): AssessmentRole {
    if (input.isImmediateRepair) return 'immediate-repair';
    if (input.assessmentRole === 'delayed-probe') return 'delayed-probe';
    if (input.attemptKind === 'transfer') return 'transfer';
    if (input.assessmentRole === 'instruction' || input.attemptKind === 'diagnostic') return 'instruction';
    return input.assessmentRole || assessmentRoleFromAttempt(input);
}

export function buildLearningEvidenceMetadata(input: EvidenceIdentityInput): LearningEvidenceMetadata {
    const knownObjective = isKnownObjectiveId(input.learningObjectiveId)
        ? input.learningObjectiveId as LearningObjectiveId
        : undefined;
    const classificationStatus = knownObjective
        ? input.objectiveClassificationStatus || 'canonical'
        : 'unclassified';
    const objectiveKey = knownObjective || 'unclassified';
    const targetKey = input.target || input.skillTag || input.question;
    const sourceKey = input.sourceContextSpan || input.question;
    const itemFamilyId = normalizeIdentityPart(input.itemFamilyId) || stableId('family', [objectiveKey, targetKey]);
    const contextId = normalizeIdentityPart(input.contextId) || stableId('context', [sourceKey]);
    const equivalenceGroup = normalizeIdentityPart(input.equivalenceGroup) || stableId('equiv', [objectiveKey, targetKey]);
    const assessmentRole = input.assessmentRole || 'practice';

    return {
        evidenceContractVersion: LEARNING_EVIDENCE_CONTRACT_VERSION,
        objectiveCatalogVersion: input.objectiveCatalogVersion || OBJECTIVE_CATALOG_VERSION,
        objectiveClassificationStatus: classificationStatus,
        itemFamilyId,
        contextId,
        equivalenceGroup,
        assessmentRole,
        transferDistance: input.transferDistance || (assessmentRole === 'transfer' ? 'near' : 'same-context'),
        reviewerStatus: input.reviewerStatus || 'unreviewed'
    };
}

export function evidenceStrengthForAttempt(input: EvidenceStrengthInput): EvidenceStrength {
    if (!isKnownObjectiveId(input.learningObjectiveId) ||
        input.objectiveClassificationStatus === 'unclassified' ||
        input.reviewerStatus === 'rejected') {
        return 'no-credit';
    }

    if (input.assessmentRole === 'instruction' ||
        input.assessmentRole === 'immediate-repair' ||
        input.hintUsed ||
        (input.supportLevel ?? 3) >= 2) {
        return 'supported';
    }

    if (input.assessmentRole === 'delayed-probe') return 'delayed-independent';
    if (input.assessmentRole === 'transfer' && input.transferDistance !== 'same-context') {
        return 'transfer-independent';
    }
    return 'independent';
}

export function isIndependentEvidence(strength?: EvidenceStrength): boolean {
    return strength === 'independent' ||
        strength === 'delayed-independent' ||
        strength === 'transfer-independent';
}
