
import Dexie, { Table } from 'dexie';
import { createEmptyCard, fsrs, generatorParameters, Rating, State, Card as FSRSCardType, RecordLogItem } from 'ts-fsrs';

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

// FSRS Spaced Repetition Card
export interface FSRSCard {
    id?: number;
    // Question identifier (hash of question text)
    questionHash: string;
    // Question data for review
    question: string;
    options: string[];
    correct_index: number;
    type: StoredQuestionType;
    explanation?: string;
    hint?: string;
    skillTag?: string;
    // FSRS scheduling fields
    due: number;           // Next review timestamp
    stability: number;     // Memory stability
    difficulty: number;    // Card difficulty (0-1)
    elapsed_days: number;  // Days since last review
    scheduled_days: number;// Scheduled interval
    reps: number;          // Number of reviews
    lapses: number;        // Number of lapses
    state: number;         // 0=New, 1=Learning, 2=Review, 3=Relearning
    last_review?: number;  // Last review timestamp
}

export class WordQuestDB extends Dexie {
    history!: Table<HistoryRecord>;
    mistakes!: Table<MistakeRecord>;
    questionCache!: Table<CachedQuestion>;
    fsrsCards!: Table<FSRSCard>;

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
        this.version(4).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used',
            fsrsCards: '++id, questionHash, due, state'
        });
    }
}

export const db = new WordQuestDB();

// ========== FSRS Functions ==========

// Initialize FSRS with default parameters
const params = generatorParameters();
const f = fsrs(params);

// Simple hash for question text
export function hashQuestion(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
        const char = text.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return 'q_' + hash.toString(16);
}

// Convert FSRSCard to ts-fsrs Card format
function toFSRSCard(card: FSRSCard): FSRSCardType {
    return {
        due: new Date(card.due),
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        reps: card.reps,
        lapses: card.lapses,
        state: card.state as State,
        last_review: card.last_review ? new Date(card.last_review) : undefined,
        learning_steps: 0 // Default learning steps
    };
}

// Convert ts-fsrs Card back to FSRSCard format
function fromFSRSCard(card: FSRSCardType, original: Partial<FSRSCard>): Partial<FSRSCard> {
    return {
        ...original,
        due: card.due.getTime(),
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        reps: card.reps,
        lapses: card.lapses,
        state: card.state,
        last_review: card.last_review?.getTime()
    };
}

// Add or update a card after answering
export async function reviewCard(
    questionHash: string,
    rating: 'again' | 'hard' | 'good' | 'easy',
    questionData?: {
        question: string;
        options: string[];
        correct_index: number;
        type: StoredQuestionType;
        explanation?: string;
        hint?: string;
        skillTag?: string;
    }
): Promise<FSRSCard> {
    const ratingMap: Record<string, Rating> = {
        again: Rating.Again,
        hard: Rating.Hard,
        good: Rating.Good,
        easy: Rating.Easy
    };

    const now = new Date();
    const fsrsRating = ratingMap[rating];
    const existing = await db.fsrsCards.where('questionHash').equals(questionHash).first();

    if (!existing) {
        // Create new card
        const emptyCard = createEmptyCard(now);
        const scheduled = f.repeat(emptyCard, now);
        // Access the result by rating key and cast to RecordLogItem
        const result = scheduled[fsrsRating as keyof typeof scheduled] as RecordLogItem;

        const newCard: FSRSCard = {
            questionHash,
            question: questionData?.question || '',
            options: questionData?.options || [],
            correct_index: questionData?.correct_index ?? 0,
            type: questionData?.type,
            explanation: questionData?.explanation,
            hint: questionData?.hint,
            skillTag: questionData?.skillTag,
            ...fromFSRSCard(result.card, {})
        } as FSRSCard;

        const id = await db.fsrsCards.add(newCard);
        return { ...newCard, id };
    } else {
        // Review existing card
        const fsrsCard = toFSRSCard(existing);
        const scheduled = f.repeat(fsrsCard, now);
        const result = scheduled[fsrsRating as keyof typeof scheduled] as RecordLogItem;

        const updated = fromFSRSCard(result.card, existing);
        await db.fsrsCards.update(existing.id!, updated);
        return { ...existing, ...updated } as FSRSCard;
    }
}

// Get cards due for review
export async function getDueCards(limit = 10): Promise<FSRSCard[]> {
    const now = Date.now();
    return await db.fsrsCards
        .where('due')
        .belowOrEqual(now)
        .limit(limit)
        .toArray();
}

// Get cards due for review with priority (overdue first)
export async function getDueCardsWithPriority(limit = 10): Promise<FSRSCard[]> {
    const now = Date.now();
    const cards = await db.fsrsCards
        .where('due')
        .belowOrEqual(now)
        .toArray();

    // Sort by how overdue they are (most overdue first)
    cards.sort((a, b) => a.due - b.due);
    return cards.slice(0, limit);
}

// Get total cards and due count for stats
export async function getSRSStats(): Promise<{ total: number; due: number; new: number; learning: number; review: number }> {
    const now = Date.now();
    const all = await db.fsrsCards.toArray();

    return {
        total: all.length,
        due: all.filter(c => c.due <= now).length,
        new: all.filter(c => c.state === State.New).length,
        learning: all.filter(c => c.state === State.Learning || c.state === State.Relearning).length,
        review: all.filter(c => c.state === State.Review).length
    };
}

// Delete a card
export async function deleteCard(questionHash: string): Promise<void> {
    await db.fsrsCards.where('questionHash').equals(questionHash).delete();
}

// ========== Cache Functions ==========

export async function cacheQuestions(questions: CachedQuestion[]): Promise<void> {
    await db.questionCache.bulkAdd(questions);
}

export async function getCachedQuestions(contextHash: string, limit = 10): Promise<CachedQuestion[]> {
    const unused = await db.questionCache
        .where('contextHash').equals(contextHash)
        .filter(q => !q.used)
        .limit(limit)
        .toArray();

    if (unused.length >= limit) return unused;

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

export async function getCachedQuestionsCount(): Promise<number> {
    return await db.questionCache.count();
}

export function hashContext(context: string): string {
    let hash = 0;
    for (let i = 0; i < context.length; i++) {
        const char = context.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}
