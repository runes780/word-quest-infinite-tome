import type { Monster, QuestionMode } from '@/store/gameStore';
import {
    mapSkillTagToObjectiveId,
    type AttemptKind,
    type LearningObjectiveId,
    type SupportLevel
} from '@/lib/data/learningObjectives';
import { assessQuestionQuality, hasVisibleQuestionBlank } from '@/lib/data/questionQuality';
import {
    validateLearningTaskContract,
    type CognitiveAction,
    type ContextRelation,
    type LearningTaskContract
} from '@/lib/data/learningTaskContract';
import { LEARNING_TASK_CONTRACT_SCHEMA_VERSION } from '@/lib/data/learningTaskContract';

interface BossStageTemplate {
    question: string;
    sourceContextSpan: string;
    options?: string[];
    correctAnswer?: string;
    itemFamilyId?: string;
    hint?: string;
    explanation?: string;
    learningTask: LearningTaskContract;
}

type BossTemplateFactory = (question: Monster, correctAnswer: string, distractors: string[]) => BossStageTemplate[];

const ensureFourOptions = (correctAnswer: string, distractors: string[]) => {
    const normalized = [correctAnswer, ...distractors]
        .map((option) => option.trim())
        .filter(Boolean);
    const unique = Array.from(new Set(normalized));
    let filler = 1;
    while (unique.length < 4) {
        unique.push(`Option ${filler++}`);
    }
    return unique.slice(0, 4);
};

const answerFor = (question: Monster) =>
    (question.correctAnswer || question.options[question.correct_index] || '').trim() || 'the correct answer';

const distractorsFor = (question: Monster, correctAnswer: string) =>
    question.options.filter((option) => option && option !== correctAnswer);

const baseExplanation = (question: Monster, correctAnswer: string) =>
    question.explanation || `${correctAnswer} is the target answer for this objective.`;

const GENERIC_SOURCE_SPAN_REGEX = /^(?:mission|daily_plan|srs|battle|revenge|diagnostic|immediate_repair|sanitized_fallback|boss_gate_(?:recognition|application|transfer))$/i;

const cleanContextSpan = (value?: string) => {
    const cleaned = value?.trim().replace(/\s+/g, ' ');
    if (!cleaned || GENERIC_SOURCE_SPAN_REGEX.test(cleaned)) return '';
    return cleaned;
};

const contextFromQuestionText = (question: string) => {
    const match = question.match(/\bRead\s*:\s*["“]([^"”]+)["”]/i);
    return cleanContextSpan(match?.[1]);
};

const articleFor = (answer: string) => {
    const cleaned = answer.trim();
    if (!cleaned) return 'the thing';
    if (/^(?:a|an|the)\s+/i.test(cleaned)) return cleaned;
    return `the ${cleaned}`;
};

const contextFor = (question: Monster, correctAnswer: string) =>
    cleanContextSpan(question.sourceContextSpan) ||
    contextFromQuestionText(question.question) ||
    `Mia picked up ${articleFor(correctAnswer)} and put it away.`;

const readPrefix = (context: string) => `Read: "${context}"`;

const blankAnswerInContext = (context: string, answer: string): string | null => {
    const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = context.match(new RegExp(`(^|[^A-Za-z'])(${escaped})(?![A-Za-z'])`, 'i'));
    if (!match || match.index === undefined) return null;
    const start = match.index + match[1].length;
    return `${context.slice(0, start)}___${context.slice(start + match[2].length)}`;
};

const bossFamily = (question: Monster, suffix: string) =>
    `${question.itemFamilyId || `boss_${question.id}`}_${suffix}`;

const PRONOUN_ANSWER_SET = new Set([
    'he', 'she', 'it', 'they', 'them', 'we', 'us', 'him', 'her', 'his', 'its',
    'their', 'i', 'you', 'me', 'my', 'your', 'our', 'mine', 'yours', 'hers', 'ours'
]);

/**
 * Verbs that genuinely complete the hardcoded "I ___ to the park/library"
 * application and transfer frames. Any other past-tense answer would make the
 * generic frame ungrammatical, so those bosses fall back to the original.
 */
const MOTION_VERB_SET = new Set([
    'went', 'walked', 'ran', 'hurried', 'rushed', 'drove', 'rode', 'cycled',
    'flew', 'marched', 'strolled', 'dashed', 'traveled', 'headed', 'skated',
    'hopped', 'jogged', 'wandered'
]);

const pastTenseOfBucket = (word: string): boolean => {
    const lower = word.toLowerCase();
    return MOTION_VERB_SET.has(lower) ||
        (lower.length >= 5 && lower.endsWith('ed')) ||
        ['went', 'saw', 'took', 'had', 'made', 'said', 'came', 'got', 'found',
            'left', 'kept', 'felt', 'told', 'held', 'brought', 'thought', 'bought',
            'wrote', 'sat', 'stood', 'ate', 'drank', 'knew', 'grew', 'met', 'paid', 'ran']
            .includes(lower);
};

const isPronoun = (answer: string) => PRONOUN_ANSWER_SET.has(answer.trim().toLowerCase());

const stageContract = (
    cognitiveAction: CognitiveAction,
    contextRelation: ContextRelation
): Pick<LearningTaskContract, 'schemaVersion' | 'cognitiveAction' | 'contextRelation' | 'encounterRole'> => ({
    schemaVersion: LEARNING_TASK_CONTRACT_SCHEMA_VERSION,
    cognitiveAction,
    contextRelation,
    encounterRole: 'boss'
});

/**
 * Controlled grammar transformation for past-tense bosses. Each stage has an
 * explicit answer, but the ladder is only built when the original options
 * contain exactly one past-tense form (stage 1 is a real discrimination) and
 * the answer actually completes the motion frames of stages 2-3.
 */
const pastTenseTemplates: BossTemplateFactory = (question, correctAnswer, distractors) => {
    const recognitionContext = contextFor(question, correctAnswer);
    const applicationContext = `Last weekend, I ${correctAnswer} to the park with my friend.`;
    const transferContext = `Last weekend, I ${correctAnswer} to the library.`;
    const familyId = bossFamily(question, `past_${correctAnswer.toLowerCase()}`);
    return [{
        question: `Recognition: Which option is the past-tense form?`,
        sourceContextSpan: recognitionContext,
        options: ensureFourOptions(correctAnswer, distractors),
        itemFamilyId: familyId,
        hint: question.hint || 'Past tense tells what already happened.',
        explanation: baseExplanation(question, correctAnswer),
        learningTask: {
            ...stageContract('recognize-form', 'same-source'),
            targetFacet: 'grammar-form',
            measurementEligibility: 'objective-evidence'
        }
    },
    {
        question: `Application: Last weekend, I ___ to the park with my friend.`,
        sourceContextSpan: applicationContext,
        options: ensureFourOptions(correctAnswer, distractors),
        correctAnswer,
        itemFamilyId: familyId,
        hint: 'Use the past-tense verb after "Last weekend".',
        explanation: `After "Last weekend", use the past tense: ${correctAnswer}.`,
        learningTask: {
            ...stageContract('retrieve-form', 'varied-source'),
            targetFacet: 'grammar-form',
            measurementEligibility: 'objective-evidence'
        }
    },
    {
        question: `Transfer: Type the past-tense verb that completes this sentence: Last weekend, I ___ to the library.`,
        sourceContextSpan: transferContext,
        correctAnswer,
        itemFamilyId: familyId,
        hint: `It starts with "${correctAnswer[0] || ''}".`,
        explanation: `${correctAnswer} works in a new past-time sentence.`,
        learningTask: {
            ...stageContract('retrieve-form', 'varied-source'),
            targetFacet: 'grammar-form',
            measurementEligibility: 'objective-evidence'
        }
    }];
};

/**
 * Pronoun-reference bosses can only ladder when the original answer is an
 * antecedent (a noun), not a pronoun: stage 1 asks for the referent. Stages
 * 2-3 use their own canned sentences with explicit stage-specific answers.
 */
const pronounTemplates: BossTemplateFactory = (question, correctAnswer, distractors) => {
    const context = contextFor(question, correctAnswer);
    const applicationContext = 'Lily found her notebook and put it away.';
    const transferContext = 'Tom dropped his pencil, so he picked it up.';
    return [
        {
            question: `Recognition: ${readPrefix(context)} Which person or thing does the pronoun refer to?`,
            sourceContextSpan: context,
            options: ensureFourOptions(correctAnswer, distractors),
            itemFamilyId: bossFamily(question, `referent_${correctAnswer.toLowerCase()}`),
            hint: question.hint || 'Look backward to the nearest sensible noun.',
            explanation: baseExplanation(question, correctAnswer),
            learningTask: {
                ...stageContract('resolve-reference', 'same-source'),
                targetFacet: 'pronoun-reference',
                measurementEligibility: 'objective-evidence'
            }
        },
        {
            question: `Application: In "${applicationContext}", what does "it" refer to?`,
            sourceContextSpan: applicationContext,
            options: ensureFourOptions('notebook', [correctAnswer, ...distractors]),
            correctAnswer: 'notebook',
            itemFamilyId: bossFamily(question, 'referent_notebook'),
            hint: 'Find the noun that can be put away.',
            explanation: '"It" refers to the notebook.',
            learningTask: {
                ...stageContract('resolve-reference', 'varied-source'),
                targetFacet: 'pronoun-reference',
                measurementEligibility: 'objective-evidence'
            }
        },
        {
            question: `Transfer: Type the noun that the pronoun refers to in this sentence: Tom dropped his pencil, so he picked it up.`,
            sourceContextSpan: transferContext,
            correctAnswer: 'pencil',
            itemFamilyId: bossFamily(question, 'referent_pencil'),
            hint: 'What can Tom pick up?',
            explanation: '"It" refers to pencil.',
            learningTask: {
                ...stageContract('resolve-reference', 'varied-source'),
                targetFacet: 'pronoun-reference',
                measurementEligibility: 'objective-evidence'
            }
        }
    ];
};

const prepositionScenarioFor = (answer: string): { application: string; transfer: string; hint: string; explanation: string } | null => {
    switch (answer.trim().toLowerCase()) {
        case 'at':
            return {
                application: 'The train leaves at six o\'clock.',
                transfer: 'The class starts at nine.',
                hint: 'Clock times use this preposition.',
                explanation: 'Use "at" with clock times.'
            };
        case 'in':
            return {
                application: 'The pencil is in the box.',
                transfer: 'The bird is in the tree.',
                hint: 'Use this preposition when something is inside a place.',
                explanation: 'Use "in" when something is inside.'
            };
        case 'under':
            return {
                application: 'The ball is under the table.',
                transfer: 'The cat sleeps under the chair.',
                hint: 'Use this preposition for a lower position.',
                explanation: 'Use "under" when something is below another thing.'
            };
        case 'behind':
            return {
                application: 'The bag is behind the chair.',
                transfer: 'The tree is behind the house.',
                hint: 'Use this preposition for the back position.',
                explanation: 'Use "behind" when something is at the back.'
            };
        case 'between':
            return {
                application: 'The desk is between two chairs.',
                transfer: 'The shop is between the bank and the school.',
                hint: 'Use this preposition for the middle of two things.',
                explanation: 'Use "between" for the middle of two things.'
            };
        case 'before':
            return {
                application: 'We wash hands before lunch.',
                transfer: 'I brush my teeth before bed.',
                hint: 'Use this preposition for earlier time.',
                explanation: 'Use "before" for something earlier.'
            };
        case 'after':
            return {
                application: 'We play outside after class.',
                transfer: 'I do homework after dinner.',
                hint: 'Use this preposition for later time.',
                explanation: 'Use "after" for something later.'
            };
        case 'on':
            return {
                application: 'The book is on the table.',
                transfer: 'We have English class on Monday.',
                hint: 'Use this preposition for a surface or a day.',
                explanation: 'Use "on" for a surface or a day.'
            };
        default:
            return null;
    }
};

/**
 * Preposition bosses ladder only for answers with an explicit, verified
 * scenario frame; stage 1 is grounded in the source context as a read-back
 * recognition of the form the material actually used.
 */
const prepositionTemplates: BossTemplateFactory = (question, correctAnswer, distractors) => {
    const context = contextFor(question, correctAnswer);
    const scenario = prepositionScenarioFor(correctAnswer);
    if (!scenario) return [];
    const recognition = blankAnswerInContext(context, correctAnswer);
    const application = blankAnswerInContext(scenario.application, correctAnswer);
    const transfer = blankAnswerInContext(scenario.transfer, correctAnswer);
    if (!recognition || !application || !transfer) return [];
    if (scenario.application.toLowerCase() === context.toLowerCase() ||
        scenario.transfer.toLowerCase() === context.toLowerCase()) return [];
    const familyId = bossFamily(question, `preposition_${correctAnswer.toLowerCase()}`);
    return [
        {
            question: `Recognition: ${readPrefix(recognition)} Which preposition completes the sentence?`,
            sourceContextSpan: context,
            options: ensureFourOptions(correctAnswer, distractors),
            itemFamilyId: familyId,
            hint: question.hint || 'Check whether the sentence needs place or time.',
            explanation: baseExplanation(question, correctAnswer),
            learningTask: {
                ...stageContract('recognize-form', 'same-source'),
                targetFacet: 'grammar-form',
                measurementEligibility: 'objective-evidence'
            }
        },
        {
            question: `Application: ${application}`,
            sourceContextSpan: scenario.application,
            options: ensureFourOptions(correctAnswer, ['on', 'in', 'at', ...distractors]),
            correctAnswer,
            itemFamilyId: familyId,
            hint: scenario.hint,
            explanation: scenario.explanation,
            learningTask: {
                ...stageContract('evaluate-fit', 'varied-source'),
                targetFacet: 'grammar-form',
                measurementEligibility: 'objective-evidence'
            }
        },
        {
            question: `Transfer: Type the preposition that completes this sentence: ${transfer}`,
            sourceContextSpan: scenario.transfer,
            correctAnswer,
            itemFamilyId: familyId,
            hint: scenario.hint,
            explanation: scenario.explanation,
            learningTask: {
                ...stageContract('retrieve-form', 'varied-source'),
                targetFacet: 'grammar-form',
                measurementEligibility: 'objective-evidence'
            }
        }
    ];
};

/**
 * Reading-inference bosses ladder only when the original answer is provably
 * the inference supported by the canned dark-clouds scenario; any other
 * answer would be reused across an unrelated prompt.
 */
const readingInferenceTemplates: BossTemplateFactory = (question, correctAnswer, distractors) => {
    const context = contextFor(question, correctAnswer);
    const clue = context.match(/\b(?:dark|black|storm) clouds?\b/i)?.[0];
    if (!clue) return [];
    const applicationContext = 'A student sees dark clouds and takes an umbrella.';
    const transferContext = 'Someone takes an umbrella after seeing dark clouds.';
    return [
        {
            question: `Recognition: ${readPrefix(context)} Which clue helps you make the inference?`,
            sourceContextSpan: context,
            options: ensureFourOptions(clue, ['a school bell', 'a lunch box', 'a sunny window']),
            correctAnswer: clue,
            itemFamilyId: bossFamily(question, `clue_${clue.toLowerCase()}`),
            hint: question.hint || 'An inference combines clues with what you know.',
            explanation: baseExplanation(question, correctAnswer),
            learningTask: {
                ...stageContract('locate-evidence', 'same-source'),
                targetFacet: 'reading-inference',
                measurementEligibility: 'objective-evidence'
            }
        },
        {
            question: `Application: ${applicationContext} What is the best inference?`,
            sourceContextSpan: applicationContext,
            options: ensureFourOptions(correctAnswer, ['It might rain', 'It is lunchtime', 'The bag is heavy', ...distractors]),
            correctAnswer,
            itemFamilyId: bossFamily(question, `inference_${correctAnswer.toLowerCase()}`),
            hint: 'Connect the umbrella with the weather clue.',
            explanation: `${correctAnswer} is the best inference from the clues.`,
            learningTask: {
                ...stageContract('infer', 'varied-source'),
                targetFacet: 'reading-inference',
                measurementEligibility: 'objective-evidence'
            }
        },
        {
            question: `Transfer: Type the inference you can make when someone takes an umbrella after seeing dark clouds.`,
            sourceContextSpan: transferContext,
            correctAnswer,
            itemFamilyId: bossFamily(question, `inference_${correctAnswer.toLowerCase()}`),
            hint: 'Use the clues, not only one word.',
            explanation: `${correctAnswer} is an inference supported by the new context.`,
            learningTask: {
                ...stageContract('infer', 'varied-source'),
                targetFacet: 'reading-inference',
                measurementEligibility: 'objective-evidence'
            }
        }
    ];
};

/**
 * Objectives whose generic factories cannot prove stage-specific answers:
 *
 * - present_simple: the application frame is a content-free placeholder
 *   ("this action") and the transfer stage contains no new sentence at all.
 * - vocab_context_meaning: "which option matches the meaning" cannot be
 *   verified when the options are the words themselves rather than meanings,
 *   and the transfer stage offers no new context to fit.
 * - reading_detail: stages repeat the same context and answer, and the
 *   transfer stage references a "similar short text clue" that does not exist.
 *
 * These bosses stay playable as their original single question until reviewed
 * stage content exists (Batch 4 boss work).
 */
const UNLADDRED_OBJECTIVES: ReadonlySet<LearningObjectiveId> = new Set([
    'present_simple',
    'vocab_context_meaning',
    'reading_detail'
]);

type BossObjectiveKind =
    | { kind: 'guarded'; factory: BossTemplateFactory; proof: (question: Monster, correctAnswer: string) => boolean }
    | { kind: 'quarantined' };

const BOSS_OBJECTIVE_RULES: Record<LearningObjectiveId, BossObjectiveKind> = {
    present_simple: { kind: 'quarantined' },
    past_tense_basic: {
        kind: 'guarded',
        factory: pastTenseTemplates,
        proof: (question, correctAnswer) => {
            const options = [correctAnswer, ...distractorsFor(question, correctAnswer)]
                .map((option) => option.trim())
                .filter(Boolean);
            const pastForms = options.filter((option) => pastTenseOfBucket(option));
            // Stage 1 must be a real form discrimination: exactly one option is
            // a past-tense form.
            if (pastForms.length !== 1) return false;
            // Stages 2-3 embed the answer in motion frames; only motion verbs
            // complete them grammatically.
            return MOTION_VERB_SET.has(correctAnswer.trim().toLowerCase());
        }
    },
    vocab_context_meaning: { kind: 'quarantined' },
    pronoun_reference: {
        kind: 'guarded',
        factory: pronounTemplates,
        // Stage 1 asks for the referent; a pronoun answer would ask the
        // learner to "resolve" a pronoun to a pronoun.
        proof: (question, correctAnswer) => {
            const context = cleanContextSpan(question.sourceContextSpan) || contextFromQuestionText(question.question);
            const referencedPronoun = question.question.match(/what does\s+["“']?([A-Za-z]+)["”']?\s+refer to/i)?.[1];
            return !isPronoun(correctAnswer) &&
                Boolean(referencedPronoun && isPronoun(referencedPronoun)) &&
                new RegExp(`\\b${correctAnswer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(context) &&
                new RegExp(`\\b${referencedPronoun}\\b`, 'i').test(context);
        }
    },
    preposition_place_time: {
        kind: 'guarded',
        factory: prepositionTemplates,
        // Only answers with explicit, verified scenario frames may ladder.
        proof: (_question, correctAnswer) => prepositionScenarioFor(correctAnswer) !== null
    },
    reading_detail: { kind: 'quarantined' },
    reading_inference: {
        kind: 'guarded',
        factory: readingInferenceTemplates,
        // The canned application/transfer scenario is about rain; any other
        // answer would be reused across an unrelated inference prompt.
        proof: (question, correctAnswer) => {
            const context = cleanContextSpan(question.sourceContextSpan) || contextFromQuestionText(question.question);
            return /\brain\b/i.test(correctAnswer) && /\b(?:dark|black|storm) clouds?\b/i.test(context);
        }
    }
};

function isKnownObjectiveId(value: string): value is LearningObjectiveId {
    return value in BOSS_OBJECTIVE_RULES;
}

function buildStage(
    question: Monster,
    stage: number,
    template: BossStageTemplate,
    supportLevel: SupportLevel,
    attemptKind: AttemptKind,
    questionMode: QuestionMode
): Monster {
    const correctAnswer = template.correctAnswer || answerFor(question);
    const options = template.options || ensureFourOptions(correctAnswer, distractorsFor(question, correctAnswer));
    const correctIndex = Math.max(0, options.indexOf(correctAnswer));

    const assembled: Monster = {
        ...question,
        id: question.id * 10 + stage,
        question: template.question,
        options,
        correct_index: correctIndex,
        explanation: template.explanation || baseExplanation(question, correctAnswer),
        hint: template.hint || question.hint,
        correctAnswer,
        itemFamilyId: template.itemFamilyId || question.itemFamilyId,
        bossStage: stage,
        bossTotalStages: 3,
        supportLevel,
        attemptKind,
        questionMode,
        difficulty: stage === 3 ? 'hard' : question.difficulty,
        assessmentRole: attemptKind === 'transfer' ? 'transfer' : 'practice',
        transferDistance: attemptKind === 'transfer' ? 'near' : 'same-context',
        // The parent Boss metadata describes a different stimulus. Let the
        // evidence builder derive a context id from this stage's real text.
        contextId: undefined,
        hp: 1,
        maxHp: 1,
        sourceContextSpan: template.sourceContextSpan
    };
    return { ...assembled, learningTask: template.learningTask };
}

export function buildBossGateVariants(question: Monster): Monster[] {
    const objectiveId = question.learningObjectiveId && isKnownObjectiveId(question.learningObjectiveId)
        ? question.learningObjectiveId
        : mapSkillTagToObjectiveId({
        skillTag: question.skillTag,
        type: question.type,
        question: question.question
    });
    if (!objectiveId) return [question];
    if (UNLADDRED_OBJECTIVES.has(objectiveId)) return [question];

    const rule = BOSS_OBJECTIVE_RULES[objectiveId];
    if (!rule || rule.kind !== 'guarded') return [question];

    const correctAnswer = answerFor(question);
    if (!rule.proof(question, correctAnswer)) return [question];

    const distractors = distractorsFor(question, correctAnswer);
    const templates = rule.factory(question, correctAnswer, distractors);
    const originalSourceContext = cleanContextSpan(question.sourceContextSpan) || contextFromQuestionText(question.question);
    if (!originalSourceContext) return [question];
    if (templates.length !== 3) return [question];

    const applicationMode: QuestionMode = hasVisibleQuestionBlank(templates[1].question) ? 'fill-blank' : 'choice';
    const stages = [
        buildStage(question, 1, templates[0], 3, 'practice', 'choice'),
        buildStage(question, 2, templates[1], 2, 'practice', applicationMode),
        buildStage(question, 3, templates[2], 0, 'transfer', 'typing')
    ];
    // A ladder ships only when every stage is playable AND its task construct
    // is provably aligned; otherwise the original boss question is preserved.
    const validLadder = stages.length === 3 && stages.every((stage) =>
        assessQuestionQuality(stage).accepted &&
        validateLearningTaskContract(stage).accepted
    );
    return validLadder ? stages : [question];
}
