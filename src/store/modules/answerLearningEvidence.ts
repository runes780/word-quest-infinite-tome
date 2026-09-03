import type {
    LearningEventResult,
    LearningEventSelfConfidence,
    LearningEventSource,
    logLearningEvent,
    reviewCard,
    updateObjectiveMastery
} from '@/db/db';
import type { LogMistakeArgs } from '@/lib/data/mistakes';
import type { LearningProgressReward } from '@/lib/data/learningProgressRewards';
import type { Monster, UserAnswer } from '@/store/gameStore';
import type { AdaptiveScaffoldDecision } from '@/lib/data/adaptiveScaffolding';
import {
    buildLearningEvidenceMetadata,
    evidenceStrengthForAttempt,
    resolveAssessmentRole
} from '@/lib/data/learningEvidenceContract';
import { applyTaskContractToEvidenceStrength, canUpdateObjectiveMastery } from '@/lib/data/learningTaskContract';

type LearningEventInput = Parameters<typeof logLearningEvent>[0];
type ObjectiveMasteryInput = Parameters<typeof updateObjectiveMastery>[0];
type ReviewRating = Parameters<typeof reviewCard>[1];
type ReviewQuestionData = NonNullable<Parameters<typeof reviewCard>[2]>;

interface AnswerIdentityInput {
    question: Monster;
    selectedOption: string;
    result: LearningEventResult;
    selfConfidence?: LearningEventSelfConfidence;
    questionHash: string;
    progressReward?: LearningProgressReward | null;
    hintUsed?: boolean;
    scaffoldDecision?: AdaptiveScaffoldDecision;
    /** Answers already recorded in this session, used to detect answer exposure. */
    priorAnswers?: UserAnswer[];
}

interface AnswerLearningEvidenceInput extends AnswerIdentityInput {
    responseLatencyMs: number;
    source: LearningEventSource;
    isCritical: boolean;
}

export interface AnswerLearningEvidence {
    learningEvent: LearningEventInput;
    /**
     * Undefined when the question's task contract marks it practice-only (or
     * misaligned with its objective): such answers are still recorded as
     * events, review cards, and mistakes, but never reach the objective
     * mastery updater.
     */
    objectiveMastery?: ObjectiveMasteryInput;
    review: {
        questionHash: string;
        rating: ReviewRating;
        questionData: ReviewQuestionData;
    };
    masteryResult: LearningEventResult;
    mistake?: LogMistakeArgs;
}

/**
 * True when the learner already answered another item of the same target
 * family earlier in this session, which exposes the answer for later
 * same-source items. Only meaningful for contract-carrying questions.
 */
export function priorAnswerForSameTarget(
    question: Monster,
    priorAnswers: UserAnswer[] = []
): boolean {
    if (!question.learningTask) return false;
    const familyId = buildLearningEvidenceMetadata({
        ...question,
        assessmentRole: resolveAssessmentRole({
            assessmentRole: question.assessmentRole,
            attemptKind: question.attemptKind,
            isImmediateRepair: question.isImmediateRepair
        })
    }).itemFamilyId;
    return priorAnswers.some((answer) => answer.itemFamilyId === familyId);
}

export function buildUserAnswer({
    question,
    selectedOption,
    result,
    selfConfidence,
    questionHash,
    progressReward,
    hintUsed,
    scaffoldDecision,
    priorAnswers
}: AnswerIdentityInput): UserAnswer {
    const evidenceMetadata = buildLearningEvidenceMetadata({
        ...question,
        assessmentRole: resolveAssessmentRole({
            assessmentRole: question.assessmentRole,
            attemptKind: question.attemptKind,
            isImmediateRepair: question.isImmediateRepair
        })
    });
    const evidenceStrength = applyTaskContractToEvidenceStrength(
        evidenceStrengthForAttempt({
            learningObjectiveId: question.learningObjectiveId,
            ...evidenceMetadata,
            supportLevel: question.supportLevel,
            hintUsed
        }),
        question,
        { priorAnswerForSameTarget: priorAnswerForSameTarget(question, priorAnswers) }
    );
    return {
        questionId: question.id,
        questionText: question.question,
        userChoice: selectedOption,
        correctChoice: question.options[question.correct_index],
        isCorrect: result === 'correct',
        learningObjectiveId: question.learningObjectiveId,
        itemFamilyId: evidenceMetadata.itemFamilyId,
        assessmentRole: evidenceMetadata.assessmentRole,
        evidenceStrength,
        attemptKind: question.attemptKind,
        supportLevel: question.supportLevel,
        causeTag: question.causeTag,
        selfConfidence,
        questionHash,
        ...(hintUsed ? { hintUsed: true } : {}),
        ...(scaffoldDecision
            ? {
                scaffoldTransition: scaffoldDecision.transition,
                scaffoldReason: scaffoldDecision.reason,
                nextSupportLevel: scaffoldDecision.nextSupportLevel,
                nextAttemptKind: scaffoldDecision.nextAttemptKind
            }
            : {}),
        ...(question.isImmediateRepair ? { isImmediateRepair: true } : {}),
        ...(progressReward ? { progressReward } : {})
    };
}

export function buildAnswerLearningEvidence({
    question,
    selectedOption,
    result,
    questionHash,
    responseLatencyMs,
    source,
    isCritical,
    selfConfidence,
    progressReward,
    hintUsed,
    scaffoldDecision,
    priorAnswers
}: AnswerLearningEvidenceInput): AnswerLearningEvidence {
    const evidenceMetadata = buildLearningEvidenceMetadata({
        ...question,
        assessmentRole: resolveAssessmentRole({
            assessmentRole: question.assessmentRole,
            attemptKind: question.attemptKind,
            isImmediateRepair: question.isImmediateRepair
        })
    });
    const evidenceStrength = applyTaskContractToEvidenceStrength(
        evidenceStrengthForAttempt({
            learningObjectiveId: question.learningObjectiveId,
            ...evidenceMetadata,
            supportLevel: question.supportLevel,
            hintUsed
        }),
        question,
        { priorAnswerForSameTarget: priorAnswerForSameTarget(question, priorAnswers) }
    );
    const sharedLearningMetadata = {
        skillTag: question.skillTag,
        learningObjectiveId: question.learningObjectiveId,
        objectiveConfidence: question.objectiveConfidence,
        ...evidenceMetadata,
        evidenceStrength,
        sourceContextSpan: question.sourceContextSpan,
        attemptKind: question.attemptKind,
        supportLevel: question.supportLevel,
        causeTag: question.causeTag,
        mode: question.questionMode,
        selfConfidence,
        progressRewardKind: progressReward?.kind,
        rewardXp: progressReward?.xp,
        rewardGold: progressReward?.gold,
        rewardCounted: progressReward?.counted,
        rewardProtectionReason: progressReward?.protectionReason,
        scaffoldTransition: scaffoldDecision?.transition,
        scaffoldReason: scaffoldDecision?.reason,
        nextSupportLevel: scaffoldDecision?.nextSupportLevel,
        nextAttemptKind: scaffoldDecision?.nextAttemptKind
    };
    const questionData: ReviewQuestionData = {
        question: question.question,
        options: question.options,
        correct_index: question.correct_index,
        type: question.type,
        explanation: question.explanation,
        hint: question.hint,
        skillTag: question.skillTag,
        learningObjectiveId: question.learningObjectiveId,
        ...evidenceMetadata,
        sourceContextSpan: question.sourceContextSpan,
        questionMode: question.questionMode,
        correctAnswer: question.correctAnswer,
        // Kept on the FSRS card so an SRS re-serve of a practice-only form
        // item cannot later leak into objective mastery.
        ...(question.learningTask ? { learningTask: question.learningTask } : {})
    };

    return {
        learningEvent: {
            eventType: 'answer',
            questionId: question.id,
            questionHash,
            ...sharedLearningMetadata,
            result,
            hintUsed: Boolean(hintUsed),
            latencyMs: responseLatencyMs,
            source
        },
        ...(canUpdateObjectiveMastery(question)
            ? {
                objectiveMastery: {
                    objectiveId: question.learningObjectiveId,
                    skillTag: question.skillTag,
                    type: question.type,
                    question: question.question,
                    result,
                    mode: question.questionMode,
                    attemptKind: question.attemptKind,
                    supportLevel: question.supportLevel,
                    hintUsed: Boolean(hintUsed),
                    latencyMs: responseLatencyMs,
                    evidenceStrength,
                    assessmentRole: evidenceMetadata.assessmentRole,
                    reviewerStatus: evidenceMetadata.reviewerStatus,
                    objectiveClassificationStatus: evidenceMetadata.objectiveClassificationStatus
                }
            }
            : {}),
        review: {
            questionHash,
            rating: result === 'wrong' ? 'again' : isCritical ? 'easy' : 'good',
            questionData
        },
        masteryResult: result,
        ...(result === 'wrong'
            ? {
                mistake: {
                    questionId: question.id,
                    questionText: question.question,
                    wrongAnswer: selectedOption,
                    correctAnswer: question.options[question.correct_index],
                    explanation: question.explanation,
                    options: question.options,
                    correctIndex: question.correct_index,
                    type: question.type,
                    skillTag: question.skillTag
                }
            }
            : {})
    };
}
