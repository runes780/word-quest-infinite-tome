import {
    assessmentRoleFromAttempt,
    buildLearningEvidenceMetadata,
    evidenceStrengthForAttempt,
    isIndependentEvidence,
    resolveAssessmentRole
} from './learningEvidenceContract';

describe('learning evidence contract', () => {
    test('builds stable family, context, and equivalence identities without learner data', () => {
        const input = {
            learningObjectiveId: 'present_simple',
            skillTag: 'daily_routine',
            question: 'She walks to school every day.',
            sourceContextSpan: 'She walks to school every day.'
        };
        const first = buildLearningEvidenceMetadata(input);
        const second = buildLearningEvidenceMetadata(input);

        expect(first).toEqual(second);
        expect(first.itemFamilyId).toMatch(/^family_/);
        expect(first.contextId).toMatch(/^context_/);
        expect(first.equivalenceGroup).toMatch(/^equiv_/);
        expect(JSON.stringify(first)).not.toMatch(/student|school name|email/i);
    });

    test('quarantines unknown objectives from credit', () => {
        const metadata = buildLearningEvidenceMetadata({
            learningObjectiveId: 'invented_by_model',
            assessmentRole: 'transfer',
            reviewerStatus: 'educator-approved'
        });
        expect(metadata.objectiveClassificationStatus).toBe('unclassified');
        expect(evidenceStrengthForAttempt({
            learningObjectiveId: 'invented_by_model',
            ...metadata,
            supportLevel: 0
        })).toBe('no-credit');
    });

    test.each([
        [{ attemptKind: 'diagnostic' as const }, 'instruction'],
        [{ attemptKind: 'practice' as const }, 'practice'],
        [{ attemptKind: 'review' as const }, 'practice'],
        [{ attemptKind: 'transfer' as const }, 'transfer'],
        [{ attemptKind: 'transfer' as const, isImmediateRepair: true }, 'immediate-repair']
    ])('maps attempt semantics %o to assessment role %s', (input, expected) => {
        expect(assessmentRoleFromAttempt(input)).toBe(expected);
    });

    test('does not treat hints, high support, or immediate repair as independent mastery', () => {
        const base = {
            learningObjectiveId: 'present_simple',
            objectiveClassificationStatus: 'canonical' as const,
            reviewerStatus: 'system-reviewed' as const,
            supportLevel: 0
        };
        expect(evidenceStrengthForAttempt({ ...base, assessmentRole: 'practice' })).toBe('independent');
        expect(evidenceStrengthForAttempt({ ...base, assessmentRole: 'practice', hintUsed: true })).toBe('supported');
        expect(evidenceStrengthForAttempt({ ...base, assessmentRole: 'practice', supportLevel: 2 })).toBe('supported');
        expect(evidenceStrengthForAttempt({ ...base, assessmentRole: 'immediate-repair' })).toBe('supported');
        expect(isIndependentEvidence('supported')).toBe(false);
    });

    test('repairs stale copied roles when attempt semantics change', () => {
        expect(resolveAssessmentRole({ assessmentRole: 'practice', attemptKind: 'transfer' })).toBe('transfer');
        expect(resolveAssessmentRole({ assessmentRole: 'transfer', isImmediateRepair: true })).toBe('immediate-repair');
        expect(resolveAssessmentRole({ assessmentRole: 'delayed-probe', attemptKind: 'review' })).toBe('delayed-probe');
    });

    test('distinguishes delayed and new-context transfer evidence', () => {
        const base = {
            learningObjectiveId: 'reading_detail',
            objectiveClassificationStatus: 'canonical' as const,
            reviewerStatus: 'educator-approved' as const,
            supportLevel: 0
        };
        expect(evidenceStrengthForAttempt({ ...base, assessmentRole: 'delayed-probe' })).toBe('delayed-independent');
        expect(evidenceStrengthForAttempt({ ...base, assessmentRole: 'transfer', transferDistance: 'near' })).toBe('transfer-independent');
        expect(evidenceStrengthForAttempt({ ...base, assessmentRole: 'transfer', transferDistance: 'same-context' })).toBe('independent');
    });
});
