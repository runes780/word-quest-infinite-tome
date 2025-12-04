import { db, MistakeRecord, StoredRevengeQuestion, StoredQuestionType } from '@/db/db';
export type { MistakeRecord } from '@/db/db';

const isBrowser = typeof window !== 'undefined';

export interface LogMistakeArgs {
    questionId: number;
    questionText: string;
    wrongAnswer: string;
    correctAnswer: string;
    explanation: string;
    options?: string[];
    correctIndex?: number;
    type?: StoredQuestionType;
}

async function findMistake(questionId: number, wrongAnswer: string): Promise<MistakeRecord | null> {
    if (!isBrowser) return null;
    try {
        const collection = db.mistakes
            .where('questionId')
            .equals(questionId)
            .filter((record) => record.wrongAnswer === wrongAnswer);
        const record = await collection.last();
        return record ?? null;
    } catch (error) {
        console.error('findMistake error', error);
        return null;
    }
}

export async function logMistake(args: LogMistakeArgs) {
    if (!isBrowser) return;
    try {
        await db.mistakes.add({
            ...args,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('logMistake error', error);
    }
}

export interface CacheMentorArgs extends LogMistakeArgs {
    analysis: string;
    mentorExplanation?: string;
    revengeQuestion?: StoredRevengeQuestion;
}

export async function cacheMentorAnalysis(args: CacheMentorArgs) {
    if (!isBrowser) return;
    try {
        const existing = await findMistake(args.questionId, args.wrongAnswer);
        if (existing?.id) {
            await db.mistakes.update(existing.id, {
                mentorAnalysis: args.analysis,
                revengeQuestion: args.revengeQuestion,
                explanation: args.mentorExplanation || existing.explanation,
                options: existing.options || args.options,
                correctIndex: existing.correctIndex ?? args.correctIndex,
                type: existing.type || args.type,
                timestamp: Date.now()
            });
        } else {
            await db.mistakes.add({
                questionId: args.questionId,
                questionText: args.questionText,
                wrongAnswer: args.wrongAnswer,
                correctAnswer: args.correctAnswer,
                explanation: args.mentorExplanation || args.explanation,
                options: args.options,
                correctIndex: args.correctIndex,
                type: args.type,
                mentorAnalysis: args.analysis,
                revengeQuestion: args.revengeQuestion,
                timestamp: Date.now()
            });
        }
    } catch (error) {
        console.error('cacheMentorAnalysis error', error);
    }
}

export async function loadMentorCache(questionId: number, wrongAnswer: string): Promise<MistakeRecord | null> {
    if (!isBrowser) return null;
    try {
        const record = await findMistake(questionId, wrongAnswer);
        if (record?.mentorAnalysis) {
            return record;
        }
        return null;
    } catch (error) {
        console.error('loadMentorCache error', error);
        return null;
    }
}

export async function getMistakes(limit = 50): Promise<MistakeRecord[]> {
    if (!isBrowser) return [];
    try {
        return await db.mistakes.orderBy('timestamp').reverse().limit(limit).toArray();
    } catch (error) {
        console.error('getMistakes error', error);
        return [];
    }
}

export async function deleteMistake(id: number) {
    if (!isBrowser) return;
    try {
        await db.mistakes.delete(id);
    } catch (error) {
        console.error('deleteMistake error', error);
    }
}
