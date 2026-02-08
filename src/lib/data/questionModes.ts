import type { QuestionMode } from '@/store/gameStore';

export interface QuestionModeTargets {
    choice: number;
    typing: number;
    'fill-blank': number;
}

export interface QuestionModeDistribution {
    total: number;
    counts: Record<QuestionMode, number>;
    rates: Record<QuestionMode, number>;
}

export const DEFAULT_MODE_TARGETS: QuestionModeTargets = {
    choice: 0.5,
    typing: 0.3,
    'fill-blank': 0.2
};

const MODES: QuestionMode[] = ['choice', 'typing', 'fill-blank'];

export function getQuestionModeDistribution(
    values: Array<{ questionMode?: string | null; }>
): QuestionModeDistribution {
    const counts: Record<QuestionMode, number> = {
        choice: 0,
        typing: 0,
        'fill-blank': 0
    };
    values.forEach((item) => {
        const mode = item.questionMode;
        if (mode === 'choice' || mode === 'typing' || mode === 'fill-blank') {
            counts[mode] += 1;
        }
    });
    const total = values.length;
    const rates: Record<QuestionMode, number> = {
        choice: total > 0 ? counts.choice / total : 0,
        typing: total > 0 ? counts.typing / total : 0,
        'fill-blank': total > 0 ? counts['fill-blank'] / total : 0
    };
    return { total, counts, rates };
}

export function buildModeQuota(total: number, targets: QuestionModeTargets = DEFAULT_MODE_TARGETS): Record<QuestionMode, number> {
    if (total <= 0) {
        return { choice: 0, typing: 0, 'fill-blank': 0 };
    }

    const raw: Record<QuestionMode, number> = {
        choice: total * targets.choice,
        typing: total * targets.typing,
        'fill-blank': total * targets['fill-blank']
    };

    const quota: Record<QuestionMode, number> = {
        choice: Math.floor(raw.choice),
        typing: Math.floor(raw.typing),
        'fill-blank': Math.floor(raw['fill-blank'])
    };

    let remaining = total - (quota.choice + quota.typing + quota['fill-blank']);
    const byRemainder = [...MODES].sort((a, b) => (raw[b] - quota[b]) - (raw[a] - quota[a]));
    for (let i = 0; i < byRemainder.length && remaining > 0; i++) {
        quota[byRemainder[i]] += 1;
        remaining -= 1;
    }

    return quota;
}

export function rebalanceQuestionModes<T extends { questionMode?: string | null; }>(
    values: T[],
    targets: QuestionModeTargets = DEFAULT_MODE_TARGETS
): T[] {
    if (values.length === 0) return values;

    const quota = buildModeQuota(values.length, targets);
    const queue: QuestionMode[] = [];
    MODES.forEach((mode) => {
        for (let i = 0; i < quota[mode]; i++) queue.push(mode);
    });

    return values.map((item, index) => ({
        ...item,
        questionMode: queue[index] || 'choice'
    }));
}

export function isQuestionModeDistributionHealthy(
    values: Array<{ questionMode?: string | null; }>,
    targets: QuestionModeTargets = DEFAULT_MODE_TARGETS,
    tolerance = 0.08
): boolean {
    if (values.length === 0) return true;
    const distribution = getQuestionModeDistribution(values);
    return MODES.every((mode) => Math.abs(distribution.rates[mode] - targets[mode]) <= tolerance);
}
