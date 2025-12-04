
import Dexie, { Table } from 'dexie';

export interface HistoryRecord {
    id?: number;
    timestamp: number;
    score: number;
    totalQuestions: number;
    levelTitle: string;
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
    timestamp: number;
    mentorAnalysis?: string;
    revengeQuestion?: StoredRevengeQuestion;
}

export class WordQuestDB extends Dexie {
    history!: Table<HistoryRecord>;
    mistakes!: Table<MistakeRecord>;

    constructor() {
        super('WordQuestDB');
        this.version(1).stores({
            history: '++id, timestamp, score',
            mistakes: '++id, timestamp, questionId'
        });
    }
}

export const db = new WordQuestDB();
