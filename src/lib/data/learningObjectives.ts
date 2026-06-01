import type { MasteryState } from '@/db/db';

export type LearningObjectiveId =
    | 'past_tense_basic'
    | 'vocab_context_meaning'
    | 'pronoun_reference'
    | 'preposition_place_time'
    | 'reading_detail'
    | 'reading_inference';

export type LearningObjectiveDomain = 'grammar' | 'vocab' | 'reading';
export type LearningObjectiveType = 'form' | 'meaning' | 'reference' | 'detail' | 'inference';
export type ObjectiveQuestionMode = 'choice' | 'typing' | 'fill-blank';
export type SupportLevel = 0 | 1 | 2 | 3;
export type AttemptKind = 'diagnostic' | 'practice' | 'review' | 'transfer';

export interface LearningObjective {
    objectiveId: LearningObjectiveId;
    title: string;
    domain: LearningObjectiveDomain;
    type: LearningObjectiveType;
    prerequisites: LearningObjectiveId[];
    recommendedModes: ObjectiveQuestionMode[];
    masteryThreshold: {
        score: number;
        attempts: number;
        accuracy: number;
    };
}

export interface MasteryLike {
    score: number;
    state: MasteryState;
    attempts: number;
    correct: number;
}

export const LEARNING_OBJECTIVES: LearningObjective[] = [
    {
        objectiveId: 'past_tense_basic',
        title: 'Basic Past Tense',
        domain: 'grammar',
        type: 'form',
        prerequisites: [],
        recommendedModes: ['choice', 'fill-blank', 'typing'],
        masteryThreshold: { score: 82, attempts: 8, accuracy: 0.8 }
    },
    {
        objectiveId: 'vocab_context_meaning',
        title: 'Vocabulary in Context',
        domain: 'vocab',
        type: 'meaning',
        prerequisites: [],
        recommendedModes: ['choice', 'fill-blank', 'typing'],
        masteryThreshold: { score: 80, attempts: 8, accuracy: 0.78 }
    },
    {
        objectiveId: 'pronoun_reference',
        title: 'Pronoun Reference',
        domain: 'reading',
        type: 'reference',
        prerequisites: ['reading_detail'],
        recommendedModes: ['choice', 'fill-blank'],
        masteryThreshold: { score: 78, attempts: 6, accuracy: 0.76 }
    },
    {
        objectiveId: 'preposition_place_time',
        title: 'Place and Time Prepositions',
        domain: 'grammar',
        type: 'form',
        prerequisites: [],
        recommendedModes: ['choice', 'fill-blank', 'typing'],
        masteryThreshold: { score: 80, attempts: 8, accuracy: 0.78 }
    },
    {
        objectiveId: 'reading_detail',
        title: 'Reading for Details',
        domain: 'reading',
        type: 'detail',
        prerequisites: [],
        recommendedModes: ['choice', 'fill-blank'],
        masteryThreshold: { score: 80, attempts: 8, accuracy: 0.78 }
    },
    {
        objectiveId: 'reading_inference',
        title: 'Reading Inference',
        domain: 'reading',
        type: 'inference',
        prerequisites: ['reading_detail', 'vocab_context_meaning'],
        recommendedModes: ['choice', 'fill-blank', 'typing'],
        masteryThreshold: { score: 84, attempts: 10, accuracy: 0.82 }
    }
];

const OBJECTIVE_MAP = LEARNING_OBJECTIVES.reduce((acc, objective) => {
    acc[objective.objectiveId] = objective;
    return acc;
}, {} as Record<LearningObjectiveId, LearningObjective>);

export function getLearningObjective(objectiveId?: string | null): LearningObjective | undefined {
    if (!objectiveId) return undefined;
    return OBJECTIVE_MAP[objectiveId as LearningObjectiveId];
}

function normalize(value?: string | null): string {
    return (value || '').trim().toLowerCase().replace(/[\s:-]+/g, '_');
}

export function mapSkillTagToObjectiveId(input: {
    skillTag?: string | null;
    type?: LearningObjectiveDomain | string | null;
    question?: string | null;
}): LearningObjectiveId {
    const rawSkill = normalize(input.skillTag);
    const rawQuestion = normalize(input.question);
    const combined = `${rawSkill}_${rawQuestion}`;

    if (/(past|past_simple|past_tense|ed_form|yesterday|went|was|were)/.test(combined)) {
        return 'past_tense_basic';
    }
    if (/(pronoun|reference|refer|he_|she_|they_|it_)/.test(combined)) {
        return 'pronoun_reference';
    }
    if (/(preposition|place|time|in_on_at|under|behind|between|before|after)/.test(combined)) {
        return 'preposition_place_time';
    }
    if (/(infer|inference|why|cause_effect|predict|imply)/.test(combined)) {
        return 'reading_inference';
    }
    if (/(vocab|vocabulary|meaning|context_meaning|word|synonym|happy|big|temperature|friends|life)/.test(combined)) {
        return 'vocab_context_meaning';
    }
    if (/(detail|main_idea|reading)/.test(combined)) {
        return 'reading_detail';
    }

    if (input.type === 'vocab') return 'vocab_context_meaning';
    if (input.type === 'grammar') return 'past_tense_basic';
    if (input.type === 'reading') return 'reading_detail';
    return 'vocab_context_meaning';
}

export function selectSupportLevelForMastery(mastery?: Partial<MasteryLike> | null): SupportLevel {
    if (!mastery || !mastery.state || typeof mastery.score !== 'number') return 3;
    if (mastery.state === 'mastered' && mastery.score >= 86 && (mastery.attempts || 0) >= 10) return 0;
    if (mastery.state === 'consolidated' || mastery.score >= 68) return 1;
    if (mastery.state === 'learning' || mastery.score >= 35) return 2;
    return 3;
}

export function modeForSupportLevel(level: SupportLevel): ObjectiveQuestionMode {
    if (level === 3) return 'choice';
    if (level === 2) return 'fill-blank';
    return 'typing';
}

export function supportLevelLabel(level: SupportLevel): string {
    if (level === 3) return 'guided';
    if (level === 2) return 'scaffolded';
    if (level === 1) return 'independent';
    return 'transfer';
}

export function normalizeCauseTag(value?: string | null): string | undefined {
    const normalized = normalize(value);
    if (!normalized) return undefined;
    if (/(tense|past|verb_form)/.test(normalized)) return 'tense_confusion';
    if (/(vocab|meaning|word|context)/.test(normalized)) return 'vocab_meaning';
    if (/(distractor|trap|option)/.test(normalized)) return 'distractor_trap';
    if (/(pronoun|reference)/.test(normalized)) return 'pronoun_reference';
    if (/(infer|why|cause|effect|reason)/.test(normalized)) return 'inference_gap';
    if (/(spell|form|plural|capital)/.test(normalized)) return 'spelling_or_form';
    return normalized;
}

export function objectiveTitle(objectiveId?: string | null): string {
    return getLearningObjective(objectiveId)?.title || 'Core English Skill';
}
