export type CacheQuestionType = 'vocab' | 'grammar' | 'reading' | undefined;

export interface QuestionCacheEntry {
    id?: number;
    question: string;
    options: string[];
    correct_index: number;
    type: CacheQuestionType;
    explanation: string;
    hint?: string;
    skillTag?: string;
    contextHash: string;
    timestamp: number;
    used: boolean;
}

export interface QuestionCachePolicy {
    ttlMs: number;
    maxTotal: number;
    maxPerContext: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_QUESTION_CACHE_POLICY: QuestionCachePolicy = {
    ttlMs: 7 * DAY_MS,
    maxTotal: 600,
    maxPerContext: 120
};

function normalizeText(value: unknown): string {
    if (typeof value !== 'string') return '';
    return value.trim().replace(/\s+/g, ' ');
}

function normalizeOptions(options: unknown): string[] {
    if (!Array.isArray(options)) return [];
    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const item of options) {
        const option = normalizeText(item);
        if (!option) continue;
        const key = option.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push(option);
        if (cleaned.length >= 4) break;
    }
    return cleaned;
}

function normalizeType(value: unknown): CacheQuestionType {
    if (value === 'vocab' || value === 'grammar' || value === 'reading') return value;
    return 'vocab';
}

function normalizeTimestamp(value: unknown, now: number): number {
    return Number.isFinite(value) && typeof value === 'number' && value > 0 ? value : now;
}

export function buildQuestionCacheKey(entry: Pick<QuestionCacheEntry, 'contextHash' | 'type' | 'question'>): string {
    return `${entry.contextHash}::${entry.type || 'vocab'}::${entry.question.toLowerCase()}`;
}

export function normalizeQuestionCacheEntry(
    raw: Partial<QuestionCacheEntry>,
    now = Date.now(),
    forceUnused = false
): QuestionCacheEntry | null {
    const question = normalizeText(raw.question);
    const contextHash = normalizeText(raw.contextHash);
    const options = normalizeOptions(raw.options);
    if (!question || !contextHash || options.length < 2) return null;

    const correctIndex = typeof raw.correct_index === 'number' && raw.correct_index >= 0 && raw.correct_index < options.length
        ? raw.correct_index
        : 0;

    return {
        id: raw.id,
        question,
        options,
        correct_index: correctIndex,
        type: normalizeType(raw.type),
        explanation: normalizeText(raw.explanation),
        hint: normalizeText(raw.hint) || undefined,
        skillTag: normalizeText(raw.skillTag) || undefined,
        contextHash,
        timestamp: normalizeTimestamp(raw.timestamp, now),
        used: forceUnused ? false : Boolean(raw.used)
    };
}

function sortNewestFirst(a: QuestionCacheEntry, b: QuestionCacheEntry): number {
    return b.timestamp - a.timestamp;
}

function applyQuestionCachePolicy(
    rows: QuestionCacheEntry[],
    now: number,
    policy: QuestionCachePolicy
): QuestionCacheEntry[] {
    const cutoff = now - policy.ttlMs;
    const fresh = rows.filter((row) => row.timestamp >= cutoff).sort(sortNewestFirst);

    const deduped = new Map<string, QuestionCacheEntry>();
    for (const row of fresh) {
        const key = buildQuestionCacheKey(row);
        const previous = deduped.get(key);
        if (!previous) {
            deduped.set(key, row);
            continue;
        }
        if (row.timestamp > previous.timestamp || (row.timestamp === previous.timestamp && !row.used && previous.used)) {
            deduped.set(key, row);
        }
    }

    const byContext = new Map<string, QuestionCacheEntry[]>();
    for (const row of deduped.values()) {
        const group = byContext.get(row.contextHash) || [];
        group.push(row);
        byContext.set(row.contextHash, group);
    }

    const retainedPerContext: QuestionCacheEntry[] = [];
    for (const group of byContext.values()) {
        group.sort(sortNewestFirst);
        retainedPerContext.push(...group.slice(0, policy.maxPerContext));
    }

    return retainedPerContext
        .sort(sortNewestFirst)
        .slice(0, policy.maxTotal);
}

export function mergeQuestionCache(
    existing: Partial<QuestionCacheEntry>[],
    incoming: Partial<QuestionCacheEntry>[],
    now = Date.now(),
    policy: QuestionCachePolicy = DEFAULT_QUESTION_CACHE_POLICY
): QuestionCacheEntry[] {
    const normalizedExisting = existing
        .map((row) => normalizeQuestionCacheEntry(row, now))
        .filter((row): row is QuestionCacheEntry => Boolean(row));
    const normalizedIncoming = incoming
        .map((row) => normalizeQuestionCacheEntry(row, now, true))
        .filter((row): row is QuestionCacheEntry => Boolean(row));

    return applyQuestionCachePolicy([...normalizedExisting, ...normalizedIncoming], now, policy);
}
