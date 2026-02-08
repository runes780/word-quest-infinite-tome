import type { Monster } from '@/store/gameStore';

export type RevengeEntry = Pick<Monster, 'id' | 'type' | 'question' | 'options' | 'correct_index' | 'explanation' | 'hint' | 'skillTag' | 'difficulty' | 'questionMode' | 'correctAnswer' | 'sourceContextSpan'>;

const REVENGE_STORAGE_KEY = 'word-quest-revenge';

export const loadInitialRevengeQueue = (): RevengeEntry[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(REVENGE_STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw);
    } catch (error) {
        console.error('Failed to load revenge queue', error);
        return [];
    }
};

export const persistRevengeQueue = (entries: RevengeEntry[]) => {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(REVENGE_STORAGE_KEY, JSON.stringify(entries));
    } catch (error) {
        console.error('Failed to persist revenge queue', error);
    }
};

export const sanitizeForQueue = (question: Monster): RevengeEntry => ({
    id: Date.now(),
    type: question.type,
    question: question.question,
    options: question.options,
    correct_index: question.correct_index,
    explanation: question.explanation,
    hint: question.hint,
    skillTag: question.skillTag,
    difficulty: question.difficulty,
    questionMode: question.questionMode,
    correctAnswer: question.correctAnswer,
    sourceContextSpan: 'revenge'
});
