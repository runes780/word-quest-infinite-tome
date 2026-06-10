import type { Monster, QuestionMode } from '@/store/gameStore';
import {
    mapSkillTagToObjectiveId,
    type AttemptKind,
    type LearningObjectiveId,
    type SupportLevel
} from '@/lib/data/learningObjectives';

interface BossStageTemplate {
    question: string;
    options?: string[];
    correctAnswer?: string;
    hint?: string;
    explanation?: string;
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

const pastTenseTemplates: BossTemplateFactory = (question, correctAnswer, distractors) => [
    {
        question: `Recognition: Which option is the past-tense form?`,
        options: ensureFourOptions(correctAnswer, distractors),
        hint: question.hint || 'Past tense tells what already happened.',
        explanation: baseExplanation(question, correctAnswer)
    },
    {
        question: `Application: Last weekend, I ___ to the park with my friend.`,
        options: ensureFourOptions(correctAnswer, distractors),
        correctAnswer,
        hint: 'Use the past-tense verb after "Last weekend".',
        explanation: `After "Last weekend", use the past tense: ${correctAnswer}.`
    },
    {
        question: `Transfer: Type the past-tense verb that completes this sentence: Last weekend, I ___ to the library.`,
        correctAnswer,
        hint: `It starts with "${correctAnswer[0] || ''}".`,
        explanation: `${correctAnswer} works in a new past-time sentence.`
    }
];

const vocabTemplates: BossTemplateFactory = (question, correctAnswer, distractors) => [
    {
        question: `Recognition: Which option best matches the target meaning?`,
        options: ensureFourOptions(correctAnswer, distractors),
        hint: question.hint || 'Look for the meaning that fits the sentence.',
        explanation: baseExplanation(question, correctAnswer)
    },
    {
        question: `Application: Choose the word or phrase that fits this sentence: The clue in the story points to "__".`,
        options: ensureFourOptions(correctAnswer, distractors),
        correctAnswer,
        hint: 'Use the meaning from context, not just a familiar word.',
        explanation: `${correctAnswer} is the best contextual meaning.`
    },
    {
        question: `Transfer: Type the word or phrase that best fits a new context with the same meaning.`,
        correctAnswer,
        hint: `Think of the answer from the first question: ${correctAnswer[0] || ''}...`,
        explanation: `${correctAnswer} transfers to a new context.`
    }
];

const pronounTemplates: BossTemplateFactory = (question, correctAnswer, distractors) => {
    const context = contextFor(question, correctAnswer);
    return [
        {
            question: `Recognition: ${readPrefix(context)} Which person or thing does the pronoun refer to?`,
            options: ensureFourOptions(correctAnswer, distractors),
            hint: question.hint || 'Look backward to the nearest sensible noun.',
            explanation: baseExplanation(question, correctAnswer)
        },
        {
            question: `Application: In "Lily found her notebook and put it away", what does "it" refer to?`,
            options: ensureFourOptions('notebook', [correctAnswer, ...distractors]),
            correctAnswer: 'notebook',
            hint: 'Find the noun that can be put away.',
            explanation: '"It" refers to the notebook.'
        },
        {
            question: `Transfer: Type the noun that the pronoun refers to in this sentence: Tom dropped his pencil, so he picked it up.`,
            correctAnswer: 'pencil',
            hint: 'What can Tom pick up?',
            explanation: '"It" refers to pencil.'
        }
    ];
};

const prepositionTemplates: BossTemplateFactory = (question, correctAnswer, distractors) => [
    {
        question: `Recognition: Which option is the correct place or time preposition?`,
        options: ensureFourOptions(correctAnswer, distractors),
        hint: question.hint || 'Check whether the sentence needs place or time.',
        explanation: baseExplanation(question, correctAnswer)
    },
    {
        question: `Application: The book is ___ the table.`,
        options: ensureFourOptions(correctAnswer, ['on', 'in', 'at', ...distractors]),
        correctAnswer,
        hint: 'Use the preposition that matches the position.',
        explanation: `${correctAnswer} fits this place relationship.`
    },
    {
        question: `Transfer: Type the preposition that completes this sentence: We have English class ___ Monday.`,
        correctAnswer: 'on',
        hint: 'Days use this preposition.',
        explanation: 'We use "on" with days of the week.'
    }
];

const readingDetailTemplates: BossTemplateFactory = (question, correctAnswer, distractors) => {
    const context = contextFor(question, correctAnswer);
    return [
        {
            question: `Recognition: ${readPrefix(context)} Which option is stated directly in the text?`,
            options: ensureFourOptions(correctAnswer, distractors),
            hint: question.hint || 'Find the exact detail before choosing.',
            explanation: baseExplanation(question, correctAnswer)
        },
        {
            question: `Application: ${readPrefix(context)} Choose the answer that is directly stated.`,
            options: ensureFourOptions(correctAnswer, distractors),
            correctAnswer,
            hint: 'Do not infer yet. Match the detail.',
            explanation: `${correctAnswer} is the directly stated detail.`
        },
        {
            question: `Transfer: Type the directly stated answer from a similar short text clue.`,
            correctAnswer,
            hint: 'Use only what the text says.',
            explanation: `${correctAnswer} can be found from the stated detail.`
        }
    ];
};

const readingInferenceTemplates: BossTemplateFactory = (question, correctAnswer, distractors) => {
    const context = contextFor(question, correctAnswer);
    return [
        {
            question: `Recognition: ${readPrefix(context)} Which clue helps you make the inference?`,
            options: ensureFourOptions(correctAnswer, distractors),
            hint: question.hint || 'An inference combines clues with what you know.',
            explanation: baseExplanation(question, correctAnswer)
        },
        {
            question: `Application: A student sees dark clouds and takes an umbrella. What is the best inference?`,
            options: ensureFourOptions(correctAnswer, ['It might rain', 'It is lunchtime', 'The bag is heavy', ...distractors]),
            correctAnswer,
            hint: 'Connect the umbrella with the weather clue.',
            explanation: `${correctAnswer} is the best inference from the clues.`
        },
        {
            question: `Transfer: Type the inference you can make when someone takes an umbrella after seeing dark clouds.`,
            correctAnswer,
            hint: 'Use the clues, not only one word.',
            explanation: `${correctAnswer} is an inference supported by the new context.`
        }
    ];
};

const TEMPLATE_BY_OBJECTIVE: Record<LearningObjectiveId, BossTemplateFactory> = {
    past_tense_basic: pastTenseTemplates,
    vocab_context_meaning: vocabTemplates,
    pronoun_reference: pronounTemplates,
    preposition_place_time: prepositionTemplates,
    reading_detail: readingDetailTemplates,
    reading_inference: readingInferenceTemplates
};

function isKnownObjectiveId(value: string): value is LearningObjectiveId {
    return value in TEMPLATE_BY_OBJECTIVE;
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

    return {
        ...question,
        id: question.id * 10 + stage,
        question: template.question,
        options,
        correct_index: correctIndex,
        explanation: template.explanation || baseExplanation(question, correctAnswer),
        hint: template.hint || question.hint,
        correctAnswer,
        bossStage: stage,
        bossTotalStages: 3,
        supportLevel,
        attemptKind,
        questionMode,
        difficulty: stage === 3 ? 'hard' : question.difficulty,
        hp: 1,
        maxHp: 1,
        sourceContextSpan: stage === 1
            ? 'boss_gate_recognition'
            : stage === 2
                ? 'boss_gate_application'
                : 'boss_gate_transfer'
    };
}

export function buildBossGateVariants(question: Monster): Monster[] {
    const objectiveId = question.learningObjectiveId && isKnownObjectiveId(question.learningObjectiveId)
        ? question.learningObjectiveId
        : mapSkillTagToObjectiveId({
        skillTag: question.skillTag,
        type: question.type,
        question: question.question
    });
    const correctAnswer = answerFor(question);
    const distractors = distractorsFor(question, correctAnswer);
    const factory = TEMPLATE_BY_OBJECTIVE[objectiveId] || vocabTemplates;
    const templates = factory(question, correctAnswer, distractors);

    return [
        buildStage(question, 1, templates[0], 3, 'practice', 'choice'),
        buildStage(question, 2, templates[1], 2, 'practice', 'fill-blank'),
        buildStage(question, 3, templates[2], 0, 'transfer', 'typing')
    ];
}
