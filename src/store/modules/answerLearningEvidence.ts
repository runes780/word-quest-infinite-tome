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
}

interface AnswerLearningEvidenceInput extends AnswerIdentityInput {
    responseLatencyMs: number;
    source: LearningEventSource;
    isCritical: boolean;
}

export interface AnswerLearningEvidence {
    learningEvent: LearningEventInput;
    objectiveMastery: ObjectiveMasteryInput;
    review: {
        questionHash: string;
        rating: ReviewRating;
        questionData: ReviewQuestionData;
    };
    masteryResult: LearningEventResult;
    mistake?: LogMistakeArgs;
}

export function buildUserAnswer({
    question,
    selectedOption,
    result,
    selfConfidence,
    questionHash,
    progressReward,
    hintUsed,
    scaffoldDecision
}: AnswerIdentityInput): UserAnswer {
    return {
        questionId: question.id,
        questionText: question.question,
        userChoice: selectedOption,
        correctChoice: question.options[question.correct_index],
        isCorrect: result === 'correct',
        learningObjectiveId: question.learningObjectiveId,
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
    scaffoldDecision
}: AnswerLearningEvidenceInput): AnswerLearningEvidence {
    const sharedLearningMetadata = {
        skillTag: question.skillTag,
        learningObjectiveId: question.learningObjectiveId,
        objectiveConfidence: question.objectiveConfidence,
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
        sourceContextSpan: question.sourceContextSpan,
        questionMode: question.questionMode,
        correctAnswer: question.correctAnswer
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
            latencyMs: responseLatencyMs
        },
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
