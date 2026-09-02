import type { MasteryState } from '@/db/db';

export type LearningObjectiveId =
    | 'present_simple'
    | 'past_tense_basic'
    | 'vocab_context_meaning'
    | 'pronoun_reference'
    | 'preposition_place_time'
    | 'reading_detail'
    | 'reading_inference';

export type LearningObjectiveDomain = 'grammar' | 'vocab' | 'reading';
export type LearningObjectiveType = 'form' | 'meaning' | 'reference' | 'detail' | 'inference';
export type KnowledgeComponentType = 'fact' | 'concept' | 'rule' | 'strategy';
export type ObjectiveQuestionMode = 'choice' | 'typing' | 'fill-blank';
export type SupportLevel = 0 | 1 | 2 | 3;
export type AttemptKind = 'diagnostic' | 'practice' | 'review' | 'transfer';
export type UiLanguage = 'en' | 'zh';
export type ObjectiveClassificationStatus = 'canonical' | 'alias' | 'inferred' | 'unclassified';

export const OBJECTIVE_CATALOG_VERSION = 2;

export interface LearningObjective {
    objectiveId: LearningObjectiveId;
    title: string;
    titleZh: string;
    catalogVersion: number;
    domain: LearningObjectiveDomain;
    type: LearningObjectiveType;
    knowledgeComponentType: KnowledgeComponentType;
    aliases: string[];
    prerequisites: LearningObjectiveId[];
    recommendedModes: ObjectiveQuestionMode[];
    masteryThreshold: {
        score: number;
        attempts: number;
        accuracy: number;
    };
    transferThreshold: {
        score: number;
        transferAttempts: number;
        accuracy: number;
    };
    reviewPolicy: {
        maxDaysWithoutReview: number;
        riskWeight: number;
    };
    evidenceRequirements: {
        minimumIndependentAttempts: number;
        minimumDelayedProbes: number;
        minimumTransferAttempts: number;
    };
}

export interface CanonicalLearningObjective {
    objectiveId?: LearningObjectiveId;
    confidence: number;
    source: 'ai' | 'catalog' | 'inference' | 'unclassified';
    status: ObjectiveClassificationStatus;
    catalogVersion: number;
    rawObjectiveId?: string;
    sourceContextSpan?: string;
}

export interface MasteryLike {
    score: number;
    state: MasteryState;
    attempts: number;
    correct: number;
}

export const LEARNING_OBJECTIVES: LearningObjective[] = [
    {
        objectiveId: 'present_simple',
        title: 'Present Simple',
        titleZh: '一般现在时',
        catalogVersion: OBJECTIVE_CATALOG_VERSION,
        domain: 'grammar',
        type: 'form',
        knowledgeComponentType: 'rule',
        aliases: ['grammar_present_simple', 'simple_present', 'present_tense'],
        prerequisites: [],
        recommendedModes: ['choice', 'fill-blank', 'typing'],
        masteryThreshold: { score: 82, attempts: 8, accuracy: 0.8 },
        transferThreshold: { score: 78, transferAttempts: 2, accuracy: 0.75 },
        reviewPolicy: { maxDaysWithoutReview: 5, riskWeight: 1.15 },
        evidenceRequirements: { minimumIndependentAttempts: 3, minimumDelayedProbes: 2, minimumTransferAttempts: 2 }
    },
    {
        objectiveId: 'past_tense_basic',
        title: 'Basic Past Tense',
        titleZh: '基础过去时',
        catalogVersion: OBJECTIVE_CATALOG_VERSION,
        domain: 'grammar',
        type: 'form',
        knowledgeComponentType: 'rule',
        aliases: ['past_simple', 'past_tense', 'grammar_past_simple'],
        prerequisites: [],
        recommendedModes: ['choice', 'fill-blank', 'typing'],
        masteryThreshold: { score: 82, attempts: 8, accuracy: 0.8 },
        transferThreshold: { score: 78, transferAttempts: 2, accuracy: 0.75 },
        reviewPolicy: { maxDaysWithoutReview: 5, riskWeight: 1.2 },
        evidenceRequirements: { minimumIndependentAttempts: 3, minimumDelayedProbes: 2, minimumTransferAttempts: 2 }
    },
    {
        objectiveId: 'vocab_context_meaning',
        title: 'Vocabulary in Context',
        titleZh: '语境词义',
        catalogVersion: OBJECTIVE_CATALOG_VERSION,
        domain: 'vocab',
        type: 'meaning',
        knowledgeComponentType: 'concept',
        aliases: ['vocab_context', 'vocabulary_in_context', 'reading_contextual_meaning'],
        prerequisites: [],
        recommendedModes: ['choice', 'fill-blank', 'typing'],
        masteryThreshold: { score: 80, attempts: 8, accuracy: 0.78 },
        transferThreshold: { score: 76, transferAttempts: 2, accuracy: 0.74 },
        reviewPolicy: { maxDaysWithoutReview: 4, riskWeight: 1.15 },
        evidenceRequirements: { minimumIndependentAttempts: 3, minimumDelayedProbes: 2, minimumTransferAttempts: 2 }
    },
    {
        objectiveId: 'pronoun_reference',
        title: 'Pronoun Reference',
        titleZh: '代词指代',
        catalogVersion: OBJECTIVE_CATALOG_VERSION,
        domain: 'reading',
        type: 'reference',
        knowledgeComponentType: 'strategy',
        aliases: ['pronoun_referent', 'reading_pronoun_reference'],
        prerequisites: ['reading_detail'],
        recommendedModes: ['choice', 'fill-blank'],
        masteryThreshold: { score: 78, attempts: 6, accuracy: 0.76 },
        transferThreshold: { score: 74, transferAttempts: 2, accuracy: 0.72 },
        reviewPolicy: { maxDaysWithoutReview: 5, riskWeight: 1.1 },
        evidenceRequirements: { minimumIndependentAttempts: 2, minimumDelayedProbes: 2, minimumTransferAttempts: 2 }
    },
    {
        objectiveId: 'preposition_place_time',
        title: 'Place and Time Prepositions',
        titleZh: '时间/地点介词',
        catalogVersion: OBJECTIVE_CATALOG_VERSION,
        domain: 'grammar',
        type: 'form',
        knowledgeComponentType: 'rule',
        aliases: ['prepositions_place_time', 'in_on_at'],
        prerequisites: [],
        recommendedModes: ['choice', 'fill-blank', 'typing'],
        masteryThreshold: { score: 80, attempts: 8, accuracy: 0.78 },
        transferThreshold: { score: 76, transferAttempts: 2, accuracy: 0.74 },
        reviewPolicy: { maxDaysWithoutReview: 5, riskWeight: 1.15 },
        evidenceRequirements: { minimumIndependentAttempts: 3, minimumDelayedProbes: 2, minimumTransferAttempts: 2 }
    },
    {
        objectiveId: 'reading_detail',
        title: 'Reading for Details',
        titleZh: '阅读细节',
        catalogVersion: OBJECTIVE_CATALOG_VERSION,
        domain: 'reading',
        type: 'detail',
        knowledgeComponentType: 'strategy',
        aliases: ['reading_details', 'reading_main_idea', 'detail'],
        prerequisites: [],
        recommendedModes: ['choice', 'fill-blank'],
        masteryThreshold: { score: 80, attempts: 8, accuracy: 0.78 },
        transferThreshold: { score: 76, transferAttempts: 2, accuracy: 0.74 },
        reviewPolicy: { maxDaysWithoutReview: 6, riskWeight: 1 },
        evidenceRequirements: { minimumIndependentAttempts: 3, minimumDelayedProbes: 2, minimumTransferAttempts: 2 }
    },
    {
        objectiveId: 'reading_inference',
        title: 'Reading Inference',
        titleZh: '阅读推断',
        catalogVersion: OBJECTIVE_CATALOG_VERSION,
        domain: 'reading',
        type: 'inference',
        knowledgeComponentType: 'strategy',
        aliases: ['inference', 'reading_infer', 'cause_effect'],
        prerequisites: ['reading_detail', 'vocab_context_meaning'],
        recommendedModes: ['choice', 'fill-blank', 'typing'],
        masteryThreshold: { score: 84, attempts: 10, accuracy: 0.82 },
        transferThreshold: { score: 80, transferAttempts: 3, accuracy: 0.78 },
        reviewPolicy: { maxDaysWithoutReview: 4, riskWeight: 1.3 },
        evidenceRequirements: { minimumIndependentAttempts: 3, minimumDelayedProbes: 2, minimumTransferAttempts: 3 }
    }
];

const OBJECTIVE_MAP = LEARNING_OBJECTIVES.reduce((acc, objective) => {
    acc[objective.objectiveId] = objective;
    return acc;
}, {} as Record<LearningObjectiveId, LearningObjective>);

const OBJECTIVE_ALIAS_MAP = LEARNING_OBJECTIVES.reduce((acc, objective) => {
    objective.aliases.forEach((alias) => {
        acc[normalize(alias)] = objective.objectiveId;
    });
    return acc;
}, {} as Record<string, LearningObjectiveId>);

export function getLearningObjective(objectiveId?: string | null): LearningObjective | undefined {
    if (!objectiveId) return undefined;
    return OBJECTIVE_MAP[objectiveId as LearningObjectiveId];
}

export function isKnownObjectiveId(objectiveId?: string | null): objectiveId is LearningObjectiveId {
    return Boolean(getLearningObjective(objectiveId));
}

export function canonicalizeLearningObjective(input: {
    suggestedObjectiveId?: string | null;
    skillTag?: string | null;
    type?: LearningObjectiveDomain | string | null;
    question?: string | null;
    sourceContextSpan?: string | null;
}): CanonicalLearningObjective {
    const suggested = getLearningObjective(input.suggestedObjectiveId);
    const normalizedSuggestion = normalize(input.suggestedObjectiveId);
    const aliasedObjectiveId = OBJECTIVE_ALIAS_MAP[normalizedSuggestion];
    const sourceContextSpan = input.sourceContextSpan?.trim() || undefined;
    const questionObjective = inferObjectiveFromQuestion(input);
    if (suggested && (!questionObjective || questionObjective === suggested.objectiveId)) {
        return {
            objectiveId: suggested.objectiveId,
            confidence: 0.86,
            source: 'ai',
            status: 'canonical',
            catalogVersion: OBJECTIVE_CATALOG_VERSION,
            rawObjectiveId: input.suggestedObjectiveId?.trim() || undefined,
            sourceContextSpan
        };
    }

    if (aliasedObjectiveId && (!questionObjective || questionObjective === aliasedObjectiveId)) {
        return {
            objectiveId: aliasedObjectiveId,
            confidence: 0.8,
            source: 'catalog',
            status: 'alias',
            catalogVersion: OBJECTIVE_CATALOG_VERSION,
            rawObjectiveId: input.suggestedObjectiveId?.trim() || undefined,
            sourceContextSpan
        };
    }

    const objectiveId = mapSkillTagToObjectiveId({
        skillTag: input.skillTag,
        type: input.type,
        question: input.question
    });
    if (!objectiveId) {
        return {
            confidence: 0,
            source: 'unclassified',
            status: 'unclassified',
            catalogVersion: OBJECTIVE_CATALOG_VERSION,
            rawObjectiveId: input.suggestedObjectiveId?.trim() || undefined,
            sourceContextSpan
        };
    }
    return {
        objectiveId,
        confidence: questionObjective ? 0.72 : 0.64,
        source: 'inference',
        status: 'inferred',
        catalogVersion: OBJECTIVE_CATALOG_VERSION,
        rawObjectiveId: input.suggestedObjectiveId?.trim() || undefined,
        sourceContextSpan
    };
}

function normalize(value?: string | null): string {
    return (value || '').trim().toLowerCase().replace(/[\s:-]+/g, '_');
}

function inferObjectiveFromQuestion(input: {
    type?: LearningObjectiveDomain | string | null;
    question?: string | null;
}): LearningObjectiveId | undefined {
    const question = (input.question || '').trim().toLowerCase();
    if (!question) return undefined;

    if (/\b(?:present simple|simple present|every day|usually|always|often|daily routine)\b/.test(question)) {
        return 'present_simple';
    }
    if (/\b(?:past[- ]tense|yesterday|last weekend|last week|ago|went|was|were|did)\b/.test(question)) {
        return 'past_tense_basic';
    }
    if (/\b(?:pronoun|reference|refer(?:s|red|ring)?\s+to)\b/.test(question)) {
        return 'pronoun_reference';
    }
    if (/\b(?:preposition|in|on|at|under|behind|between|before|after)\b/.test(question) && /\b(?:place|time|where|when|table|room|monday|week)\b/.test(question)) {
        return 'preposition_place_time';
    }
    if (/\b(?:why|infer|inference|predict|imply|suggest|cause|effect|reason)\b/.test(question)) {
        return 'reading_inference';
    }
    if (/\b(?:what does|mean|meaning|synonym|antonym|word|vocabulary|best word)\b/.test(question)) {
        return 'vocab_context_meaning';
    }
    if (input.type === 'reading' || /\b(?:weather|stated|directly|detail|main idea|what|where|when|who|which|how)\b/.test(question)) {
        return 'reading_detail';
    }

    return undefined;
}

function inferObjectiveFromSkillTag(skillTag?: string | null): LearningObjectiveId | undefined {
    const rawSkill = normalize(skillTag);
    if (!rawSkill) return undefined;
    const canonical = getLearningObjective(rawSkill)?.objectiveId || OBJECTIVE_ALIAS_MAP[rawSkill];
    if (canonical) return canonical;
    if (/(present_simple|simple_present|present_tense|every_day|daily_routine)/.test(rawSkill)) return 'present_simple';
    if (/(past|past_simple|past_tense|ed_form|yesterday|went|was|were)/.test(rawSkill)) return 'past_tense_basic';
    if (/(pronoun|reference|refer|he_|she_|they_|it_)/.test(rawSkill)) return 'pronoun_reference';
    if (/(preposition|place|time|in_on_at|under|behind|between|before|after)/.test(rawSkill)) return 'preposition_place_time';
    if (/(infer|inference|why|cause_effect|predict|imply)/.test(rawSkill)) return 'reading_inference';
    if (/(vocab|vocabulary|meaning|context_meaning|word|synonym|happy|big|temperature|friends|life)/.test(rawSkill)) return 'vocab_context_meaning';
    if (/(detail|main_idea|reading)/.test(rawSkill)) return 'reading_detail';
    return undefined;
}

export function mapSkillTagToObjectiveId(input: {
    skillTag?: string | null;
    type?: LearningObjectiveDomain | string | null;
    question?: string | null;
}): LearningObjectiveId | undefined {
    const questionObjective = inferObjectiveFromQuestion(input);
    if (questionObjective) return questionObjective;

    const skillObjective = inferObjectiveFromSkillTag(input.skillTag);
    if (skillObjective) return skillObjective;

    return undefined;
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

export function supportLevelLabel(level: SupportLevel, language: UiLanguage = 'en'): string {
    if (language === 'zh') {
        if (level === 3) return '有提示';
        if (level === 2) return '支架练习';
        if (level === 1) return '独立练习';
        return '迁移应用';
    }
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

export function objectiveTitle(objectiveId?: string | null, language: UiLanguage = 'en'): string {
    const objective = getLearningObjective(objectiveId);
    if (!objective) return language === 'zh' ? '核心英语技能' : 'Core English Skill';
    return language === 'zh' ? objective.titleZh : objective.title;
}

const ZH_LEARNING_LABELS: Record<string, string> = {
    core_skill: '核心技能',
    core_skills: '核心技能',
    review: '复习',
    skill: '技能',
    vocab: '词汇',
    vocabulary: '词汇',
    vocab_core: '基础词汇',
    vocab_basic: '基础词汇',
    vocab_daily: '词汇练习',
    vocab_review: '词汇复习',
    vocab_meaning: '词义理解',
    vocabulary_meaning: '词义理解',
    vocab_context: '语境词汇',
    vocab_context_meaning: '语境词义',
    vocabulary_in_context: '语境词义',
    reading_vocabulary_in_context: '语境词义',
    grammar: '语法',
    grammar_core: '语法基础',
    grammar_review: '语法复习',
    grammar_tense: '时态语法',
    grammar_past_simple: '一般过去时',
    past_simple: '一般过去时',
    past_tense: '过去时',
    past_tense_basic: '基础过去时',
    tense_confusion: '时态混淆',
    verb_form: '动词形式',
    preposition: '介词',
    preposition_under: '介词 under',
    preposition_place_time: '时间/地点介词',
    pronoun: '代词',
    pronoun_reference: '代词指代',
    reading: '阅读',
    reading_detail: '阅读细节',
    reading_details: '阅读细节',
    detail: '细节理解',
    reading_inference: '阅读推断',
    inference: '推断',
    inference_gap: '推断断点',
    reading_comprehension: '阅读理解',
    reading_main: '主旨理解',
    reading_main_idea: '主旨大意',
    main_idea: '主旨大意',
    cause_effect: '因果推断',
    distractor_trap: '选项干扰',
    spelling_or_form: '拼写/形式',
    collocation_mixup: '搭配混淆'
};

const EN_LEARNING_LABELS: Record<string, string> = {
    vocab: 'Vocabulary',
    vocab_core: 'Vocab Core',
    vocab_meaning: 'Vocabulary Meaning',
    vocab_context_meaning: 'Vocabulary in Context',
    reading_vocabulary_in_context: 'Vocabulary in Context',
    grammar_past_simple: 'Past Simple',
    tense_confusion: 'Tense Confusion',
    pronoun_reference: 'Pronoun Reference',
    preposition_place_time: 'Place and Time Prepositions',
    reading_detail: 'Reading Details',
    reading_inference: 'Reading Inference',
    inference_gap: 'Inference Gap',
    cause_effect: 'Cause and Effect',
    distractor_trap: 'Distractor Trap',
    spelling_or_form: 'Spelling or Form',
    core_skill: 'Core Skill',
    core_skills: 'Core Skills'
};

function titleCaseLearningLabel(normalized: string) {
    return normalized
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatLearningLabel(value?: string | null, language: UiLanguage = 'en'): string {
    const normalized = normalize(value);
    if (!normalized) return language === 'zh' ? '暂无数据' : 'N/A';

    const objective = getLearningObjective(normalized);
    if (objective) return objectiveTitle(objective.objectiveId, language);

    if (language === 'zh') {
        if (ZH_LEARNING_LABELS[normalized]) return ZH_LEARNING_LABELS[normalized];
        if (normalized.startsWith('vocab_')) return `词汇：${titleCaseLearningLabel(normalized.replace(/^vocab_/, ''))}`;
        if (normalized.startsWith('vocabulary_')) return `词汇：${titleCaseLearningLabel(normalized.replace(/^vocabulary_/, ''))}`;
        if (normalized.startsWith('grammar_')) return `语法：${titleCaseLearningLabel(normalized.replace(/^grammar_/, ''))}`;
        if (normalized.startsWith('reading_')) return `阅读：${titleCaseLearningLabel(normalized.replace(/^reading_/, ''))}`;
        if (normalized.startsWith('preposition_')) return `介词：${titleCaseLearningLabel(normalized.replace(/^preposition_/, ''))}`;
        return titleCaseLearningLabel(normalized);
    }

    return EN_LEARNING_LABELS[normalized] || titleCaseLearningLabel(normalized);
}

export function practicePlanStepTitle(
    type: 'review' | 'practice' | 'transfer',
    objectiveId?: string | null,
    language: UiLanguage = 'en'
): string {
    const objective = objectiveTitle(objectiveId, language);
    if (language === 'zh') {
        if (type === 'review') return `复习${objective}`;
        if (type === 'transfer') return `迁移${objective}`;
        return `巩固${objective}`;
    }
    if (type === 'review') return `Review ${objective}`;
    if (type === 'transfer') return `Transfer ${objective}`;
    return `Consolidate ${objective}`;
}

export function practicePlanStepRationale(
    type: 'review' | 'practice' | 'transfer',
    language: UiLanguage = 'en'
): string {
    if (language === 'zh') {
        if (type === 'review') return '到期复习优先，先稳住最容易遗忘的内容。';
        if (type === 'transfer') return '接近掌握的内容用新语境或主动回忆检查。';
        return '近期错题先带支架回炉，再逐步撤掉提示。';
    }
    if (type === 'review') return 'Due review comes first because it has the highest forgetting risk.';
    if (type === 'transfer') return 'Near-mastered skills are checked through recall or a new context.';
    return 'Recent mistakes return with scaffolding before support is removed.';
}
