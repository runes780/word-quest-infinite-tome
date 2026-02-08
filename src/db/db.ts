
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

// Global Player Profile - Persistent across all sessions
export interface GlobalPlayerProfile {
    id?: number;

    // Core progression (never resets)
    totalXp: number;
    globalLevel: number;
    totalGold: number;

    // Daily streak system
    dailyStreak: number;
    lastActiveDate: string;  // YYYY-MM-DD
    dailyXpGoal: number;
    dailyXpEarned: number;

    // Lifetime stats
    wordsLearned: number;
    lessonsCompleted: number;
    totalStudyMinutes: number;
    perfectLessons: number;

    // Skill mastery (0-100)
    vocabMastery: number;
    grammarMastery: number;
    readingMastery: number;

    // Inventory persisted
    ownedRelics: string[];  // Relic IDs owned permanently

    createdAt: number;
    updatedAt: number;
}

export type LearningEventSource = 'battle' | 'srs' | 'daily';
export type LearningEventMode = 'choice' | 'typing' | 'fill-blank';
export type LearningEventResult = 'correct' | 'wrong';

export interface LearningEvent {
    id?: number;
    eventType: 'answer' | 'hint' | 'session_complete';
    questionId?: number;
    questionHash?: string;
    skillTag?: string;
    mode?: LearningEventMode;
    result?: LearningEventResult;
    latencyMs?: number;
    source: LearningEventSource;
    timestamp: number;
}

export class WordQuestDB extends Dexie {
    history!: Table<HistoryRecord>;
    mistakes!: Table<MistakeRecord>;
    questionCache!: Table<CachedQuestion>;
    fsrsCards!: Table<FSRSCard>;
    playerProfile!: Table<GlobalPlayerProfile>;
    learningEvents!: Table<LearningEvent>;

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
        this.version(5).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used',
            fsrsCards: '++id, questionHash, due, state',
            playerProfile: '++id'
        });
        this.version(6).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId, skillTag',
            questionCache: '++id, contextHash, timestamp, used',
            fsrsCards: '++id, questionHash, due, state',
            playerProfile: '++id',
            learningEvents: '++id, timestamp, source, eventType, questionHash, skillTag'
        });
    }
}

export const db = new WordQuestDB();

// ========== Player Profile Functions ==========

function getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
}

function getDefaultProfile(): GlobalPlayerProfile {
    return {
        totalXp: 0,
        globalLevel: 1,
        totalGold: 0,
        dailyStreak: 0,
        lastActiveDate: '',
        dailyXpGoal: 50,
        dailyXpEarned: 0,
        wordsLearned: 0,
        lessonsCompleted: 0,
        totalStudyMinutes: 0,
        perfectLessons: 0,
        vocabMastery: 0,
        grammarMastery: 0,
        readingMastery: 0,
        ownedRelics: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
}

export async function getPlayerProfile(): Promise<GlobalPlayerProfile> {
    const existing = await db.playerProfile.toCollection().first();
    if (existing) return existing;

    // Create new profile
    const profile = getDefaultProfile();
    const id = await db.playerProfile.add(profile);
    return { ...profile, id };
}

interface MasteryDeltas {
    vocab?: number;
    grammar?: number;
    reading?: number;
}

export type PlayerProfileUpdates = Partial<GlobalPlayerProfile> & {
    masteryDeltas?: MasteryDeltas;
};

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export async function updatePlayerProfile(updates: PlayerProfileUpdates): Promise<GlobalPlayerProfile> {
    const profile = await getPlayerProfile();
    const today = getTodayKey();
    const nextUpdates: PlayerProfileUpdates = { ...updates };

    // Handle daily streak logic
    if (nextUpdates.dailyXpEarned !== undefined) {
        const lastDate = profile.lastActiveDate;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = yesterday.toISOString().split('T')[0];

        if (lastDate === today) {
            // Same day, just add XP
            nextUpdates.dailyXpEarned = profile.dailyXpEarned + (nextUpdates.dailyXpEarned || 0);
        } else if (lastDate === yesterdayKey) {
            // Consecutive day, increment streak
            nextUpdates.dailyStreak = profile.dailyStreak + 1;
            nextUpdates.lastActiveDate = today;
        } else if (lastDate !== today) {
            // Streak broken or first day
            nextUpdates.dailyStreak = 1;
            nextUpdates.lastActiveDate = today;
        }
    }

    // Calculate level from XP
    if (nextUpdates.totalXp !== undefined) {
        const newXp = profile.totalXp + nextUpdates.totalXp;
        nextUpdates.totalXp = newXp;
        nextUpdates.globalLevel = calculateLevel(newXp);
    }

    // Add gold (don't replace)
    if (nextUpdates.totalGold !== undefined) {
        nextUpdates.totalGold = profile.totalGold + nextUpdates.totalGold;
    }

    // Atomic additive updates for core counters
    if (nextUpdates.wordsLearned !== undefined) {
        nextUpdates.wordsLearned = profile.wordsLearned + nextUpdates.wordsLearned;
    }
    if (nextUpdates.lessonsCompleted !== undefined) {
        nextUpdates.lessonsCompleted = profile.lessonsCompleted + nextUpdates.lessonsCompleted;
    }
    if (nextUpdates.totalStudyMinutes !== undefined) {
        nextUpdates.totalStudyMinutes = profile.totalStudyMinutes + nextUpdates.totalStudyMinutes;
    }
    if (nextUpdates.perfectLessons !== undefined) {
        nextUpdates.perfectLessons = profile.perfectLessons + nextUpdates.perfectLessons;
    }

    if (nextUpdates.masteryDeltas) {
        const deltas = nextUpdates.masteryDeltas;
        nextUpdates.vocabMastery = clamp(profile.vocabMastery + (deltas.vocab || 0), 0, 100);
        nextUpdates.grammarMastery = clamp(profile.grammarMastery + (deltas.grammar || 0), 0, 100);
        nextUpdates.readingMastery = clamp(profile.readingMastery + (deltas.reading || 0), 0, 100);
    }

    const { masteryDeltas, ...persistableUpdates } = nextUpdates;
    void masteryDeltas;

    const merged = {
        ...profile,
        ...persistableUpdates,
        updatedAt: Date.now()
    };

    await db.playerProfile.update(profile.id!, merged);
    return merged;
}

export async function logLearningEvent(event: Omit<LearningEvent, 'id' | 'timestamp'> & { timestamp?: number }): Promise<void> {
    const payload: LearningEvent = {
        ...event,
        timestamp: event.timestamp ?? Date.now()
    };
    await db.learningEvents.add(payload);
}

// XP to Level calculation (similar to Duolingo)
function calculateLevel(xp: number): number {
    // Level 1: 0 XP, Level 2: 100 XP, Level 3: 250 XP, etc.
    // Formula: XP needed = 50 * level^1.5
    let level = 1;
    let totalNeeded = 0;
    while (totalNeeded <= xp) {
        level++;
        totalNeeded += Math.floor(50 * Math.pow(level, 1.5));
    }
    return level - 1;
}

export function xpForNextLevel(currentLevel: number): number {
    return Math.floor(50 * Math.pow(currentLevel + 1, 1.5));
}

export function xpProgressInLevel(totalXp: number, currentLevel: number): { current: number; needed: number } {
    let accumulated = 0;
    for (let l = 1; l <= currentLevel; l++) {
        accumulated += Math.floor(50 * Math.pow(l, 1.5));
    }
    const currentLevelXp = totalXp - accumulated + Math.floor(50 * Math.pow(currentLevel, 1.5));
    const neededForNext = xpForNextLevel(currentLevel);
    return { current: Math.max(0, currentLevelXp), needed: neededForNext };
}

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

// Get card by question text (for display in mistake notebook)
export async function getCardByQuestionText(questionText: string): Promise<FSRSCard | null> {
    const hash = hashQuestion(questionText);
    const card = await db.fsrsCards.where('questionHash').equals(hash).first();
    return card || null;
}

// Calculate memory retrievability (probability of recall)
// Based on FSRS formula: R = e^(-t/S) where t = elapsed time, S = stability
export function calculateRetrievability(card: FSRSCard): number {
    if (card.state === 0) return 1; // New card, not yet learned

    const now = Date.now();
    const lastReview = card.last_review || card.due - (card.scheduled_days * 24 * 60 * 60 * 1000);
    const elapsedDays = (now - lastReview) / (24 * 60 * 60 * 1000);

    if (card.stability <= 0) return 0;

    // R = e^(-t/S) where t is in days and S is stability in days
    const retrievability = Math.exp(-elapsedDays / card.stability);
    return Math.max(0, Math.min(1, retrievability));
}

// Get human-readable memory status
export function getMemoryStatus(card: FSRSCard): {
    retrievability: number;
    stability: number;
    status: 'new' | 'learning' | 'strong' | 'weak' | 'forgotten';
    daysUntilDue: number;
    statusEmoji: string;
    statusText: { en: string; zh: string };
} {
    const retrievability = calculateRetrievability(card);
    const now = Date.now();
    const daysUntilDue = (card.due - now) / (24 * 60 * 60 * 1000);

    let status: 'new' | 'learning' | 'strong' | 'weak' | 'forgotten';
    let statusEmoji: string;
    let statusText: { en: string; zh: string };

    if (card.state === 0) {
        status = 'new';
        statusEmoji = '🆕';
        statusText = { en: 'New', zh: '新卡片' };
    } else if (card.state === 1 || card.state === 3) {
        status = 'learning';
        statusEmoji = '📖';
        statusText = { en: 'Learning', zh: '学习中' };
    } else if (retrievability >= 0.9) {
        status = 'strong';
        statusEmoji = '💪';
        statusText = { en: 'Strong', zh: '记忆牢固' };
    } else if (retrievability >= 0.7) {
        status = 'weak';
        statusEmoji = '⚠️';
        statusText = { en: 'Needs Review', zh: '需要复习' };
    } else {
        status = 'forgotten';
        statusEmoji = '🔴';
        statusText = { en: 'Forgotten', zh: '几乎遗忘' };
    }

    return {
        retrievability,
        stability: card.stability,
        status,
        daysUntilDue,
        statusEmoji,
        statusText
    };
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
