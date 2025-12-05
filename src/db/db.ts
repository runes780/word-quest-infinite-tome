
import Dexie, { Table } from 'dexie';

export interface SkillStatSlice {
    correct: number;
    total: number;
}

export interface HistoryRecord {
    id?: number;
    timestamp: number;
    score: number;
    totalQuestions: number;
    levelTitle: string;
    totalCorrect?: number;
    accuracy?: number;
    skillStats?: Record<string, SkillStatSlice>;
}

export type StoredQuestionType = 'vocab' | 'grammar' | 'reading' | undefined;

export interface StoredRevengeQuestion {
    question: string;
    options: string[];
    correct_index: number;
    type?: StoredQuestionType;
    explanation?: string;
}

export interface MistakeRecord {
    id?: number;
    questionId: number;
    questionText: string;
    wrongAnswer: string;
    correctAnswer: string;
    explanation: string;
    options?: string[];
    correctIndex?: number;
    type?: StoredQuestionType;
    skillTag?: string;
    timestamp: number;
    mentorAnalysis?: string;
    revengeQuestion?: StoredRevengeQuestion;
}

// Cached question from AI generation
export interface CachedQuestion {
    id?: number;
    question: string;
    options: string[];
    correct_index: number;
    type: StoredQuestionType;
    explanation: string;
    hint?: string;
    skillTag?: string;
    contextHash: string; // Hash of the source context
    timestamp: number;
    used: boolean;  // Whether this question has been used in a game
}

export class WordQuestDB extends Dexie {
    history!: Table<HistoryRecord>;
    mistakes!: Table<MistakeRecord>;
    questionCache!: Table<CachedQuestion>;

    constructor() {
        super('WordQuestDB');
        this.version(1).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId'
        });
        this.version(2).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag'
        });
        this.version(3).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used'
        });
    }
}

export const db = new WordQuestDB();

// Cache helper functions
export async function cacheQuestions(questions: CachedQuestion[]): Promise<void> {
    await db.questionCache.bulkAdd(questions);
}

export async function getCachedQuestions(contextHash: string, limit = 10): Promise<CachedQuestion[]> {
    // Get unused questions first, then used ones
    const unused = await db.questionCache
        .where('contextHash').equals(contextHash)
        .filter(q => !q.used)
        .limit(limit)
        .toArray();

    if (unused.length >= limit) return unused;

    // If not enough unused, get some used ones too
    const used = await db.questionCache
        .where('contextHash').equals(contextHash)
        .filter(q => q.used)
        .limit(limit - unused.length)
        .toArray();

    return [...unused, ...used];
}

export async function markQuestionsAsUsed(ids: number[]): Promise<void> {
    await db.questionCache.where('id').anyOf(ids).modify({ used: true });
}

// Get total cached questions count
export async function getCachedQuestionsCount(): Promise<number> {
    return await db.questionCache.count();
}

// Simple hash function for context
export function hashContext(context: string): string {
    let hash = 0;
    for (let i = 0; i < context.length; i++) {
        const char = context.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
}
