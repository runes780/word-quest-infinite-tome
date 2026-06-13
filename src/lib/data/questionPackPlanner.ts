import type { Monster } from '@/store/gameStore';
import { assessQuestionQuality, hasVisibleQuestionBlank, type QuestionQualityReport } from './questionQuality';

export type QuestionLadderRole = 'recognition' | 'cloze' | 'recall' | 'transfer' | 'repair';

export interface QuestionPackPlanItem<T extends Monster = Monster> {
    question: T;
    role: QuestionLadderRole;
    quality: QuestionQualityReport;
}

export interface QuestionPackPlan<T extends Monster = Monster> {
    items: QuestionPackPlanItem<T>[];
    questions: T[];
    hasTransfer: boolean;
    rejected: QuestionPackPlanItem<T>[];
}

const ROLE_ORDER: Record<QuestionLadderRole, number> = {
    recognition: 0,
    cloze: 1,
    recall: 2,
    transfer: 3,
    repair: 4
};

const GENERIC_SOURCE_SPAN_REGEX = /^(?:mission|daily_plan|srs|battle|revenge|diagnostic|immediate_repair|sanitized_fallback|boss_gate_(?:recognition|application|transfer))$/i;

function hasRealSourceSpan(question: Monster): boolean {
    const span = question.sourceContextSpan?.trim();
    return Boolean(span && !GENERIC_SOURCE_SPAN_REGEX.test(span));
}

function inferRole(question: Monster): QuestionLadderRole {
    if (question.isImmediateRepair) return 'repair';
    if (question.attemptKind === 'transfer' || question.supportLevel === 0) return 'transfer';
    if (question.questionMode === 'fill-blank') return 'cloze';
    if (question.questionMode === 'typing') return 'recall';
    return 'recognition';
}

function normalizeModeForStructure<T extends Monster>(question: T): T {
    if (question.questionMode !== 'fill-blank' || hasVisibleQuestionBlank(question.question)) return question;
    return {
        ...question,
        questionMode: 'choice',
        supportLevel: Math.max(2, question.supportLevel ?? 3) as Monster['supportLevel'],
        attemptKind: question.attemptKind || 'practice'
    };
}

function transferPromptFor(question: Monster): string {
    if (question.attemptKind === 'transfer' || question.supportLevel === 0) return question.question;
    const objectiveText = `${question.learningObjectiveId || ''} ${question.skillTag || ''}`;
    if (/(past_tense|past_simple)/i.test(objectiveText)) {
        return 'Transfer check: Last weekend, I ___ to the library. Type the past-tense verb.';
    }
    if (/(vocab_context_meaning|vocab|vocabulary|meaning)/i.test(objectiveText)) {
        const target = extractQuotedWord(question.question) || firstContentWord(question.sourceContextSpan);
        if (target) {
            return `Transfer check: Read: "The ${target} lamp helps me read." What does "${target}" mean?`;
        }
    }
    if (/(reading_inference|inference|cause_effect)/i.test(objectiveText)) {
        return 'Transfer check: A student sees dark clouds and opens an umbrella. What can you infer?';
    }
    const source = hasRealSourceSpan(question)
        ? ` Original clue: "${question.sourceContextSpan}"`
        : '';
    return `Transfer check: type the answer for the same skill.${source}`;
}

function extractQuotedWord(value?: string): string | undefined {
    return value?.match(/["']([A-Za-z][A-Za-z'-]*)["']/)?.[1]?.toLowerCase();
}

function firstContentWord(value?: string): string | undefined {
    return value
        ?.toLowerCase()
        .match(/[a-z]+(?:'[a-z]+)?/g)
        ?.find((word) => word.length > 3 && !['read', 'what', 'does', 'mean', 'with', 'from', 'that', 'this', 'they', 'their'].includes(word));
}

function ensureTransfer<T extends Monster>(items: QuestionPackPlanItem<T>[]): QuestionPackPlanItem<T>[] {
    const hasTransfer = items.some((item) => item.role === 'transfer');
    if (hasTransfer || items.length < 6 || items.length > 8) return items;

    const targetIndex = Math.max(0, items.findLastIndex((item) => item.role !== 'repair' && hasRealSourceSpan(item.question)));
    const target = items[targetIndex];
    if (!target || !hasRealSourceSpan(target.question)) return items;
    if (!target.question.learningObjectiveId) return items;

    const transferQuestion = {
        ...target.question,
        question: transferPromptFor(target.question),
        questionMode: 'typing',
        supportLevel: 0,
        attemptKind: 'transfer'
    } as T;
    const quality = assessQuestionQuality(transferQuestion);
    if (!quality.accepted) return items;

    const next = [...items];
    next[targetIndex] = {
        question: transferQuestion,
        role: 'transfer',
        quality
    };
    return next;
}

function packKey(question: Monster): string {
    return `${question.learningObjectiveId || question.skillTag}:${question.sourceContextSpan || ''}`;
}

function avoidThreeConsecutiveSameTarget<T extends Monster>(
    items: QuestionPackPlanItem<T>[]
): QuestionPackPlanItem<T>[] {
    const arranged = [...items];
    for (let index = 2; index < arranged.length; index += 1) {
        const key = packKey(arranged[index].question);
        if (key !== packKey(arranged[index - 1].question) || key !== packKey(arranged[index - 2].question)) continue;

        const swapIndex = arranged.findIndex((item, candidateIndex) =>
            candidateIndex > index && packKey(item.question) !== key
        );
        if (swapIndex === -1) continue;
        const replacement = arranged[swapIndex];
        arranged[swapIndex] = arranged[index];
        arranged[index] = replacement;
    }
    return arranged;
}

export function planQuestionPack<T extends Monster>(questions: T[]): QuestionPackPlan<T> {
    const items = questions.map((raw) => {
        const question = normalizeModeForStructure(raw);
        return {
            question,
            role: inferRole(question),
            quality: assessQuestionQuality(question)
        };
    });

    const accepted = items.filter((item) => item.quality.accepted);
    const rejected = items.filter((item) => !item.quality.accepted);
    const sorted = [...accepted].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
    const withTransfer = ensureTransfer(sorted);
    const arranged = avoidThreeConsecutiveSameTarget(withTransfer);

    return {
        items: arranged,
        questions: arranged.map((item) => item.question),
        hasTransfer: arranged.some((item) => item.role === 'transfer'),
        rejected
    };
}
