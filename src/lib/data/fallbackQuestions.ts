import type { PlanDomain, PlanReadingSkill, PlanRole } from './questionPlan';
import type { Monster, QuestionMode } from '@/store/gameStore';
import { COMMON_WORD_SET } from './commonWords';
import { normalizeWord } from './textNormalize';

export interface FallbackPassage {
    id: string;
    text: string;
    band: 'easy' | 'medium' | 'hard';
    vocabulary: string[];
}

export interface FallbackQuestion {
    id: number;
    passageId: string;
    sourceSpan: string;
    target: string;
    type: PlanDomain; // consumer-compatible (Monster.type uses the same union)
    skillTag: string;
    readingSkill?: PlanReadingSkill;
    role: PlanRole;
    questionMode: QuestionMode;
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
    hint: string;
    difficulty: 'easy' | 'medium' | 'hard';
    learningObjectiveId: string;
    supportLevel: 0 | 1 | 2 | 3;
}

function vocabFor(text: string): string[] {
    const words = (text.match(/[a-z']+/gi) || [])
        .map((w) => w.toLowerCase().replace(/[^a-z]/g, ''))
        .map(normalizeWord)
        .filter((w) => w.length >= 2);
    return Array.from(new Set([...words, ...COMMON_WORD_SET]));
}

export const FALLBACK_PASSAGES: FallbackPassage[] = [
    {
        id: 'garden',
        band: 'easy',
        text: 'Mia has a small garden. Every morning she waters the plants. Today the tomatoes are red, so she picks them.',
        vocabulary: []
    },
    {
        id: 'rain',
        band: 'easy',
        text: 'It is raining. Tom takes his umbrella because he does not want to get wet. He walks to school in the rain.',
        vocabulary: []
    }
];
FALLBACK_PASSAGES.forEach((p) => {
    p.vocabulary = vocabFor(p.text);
});

export const FALLBACK_QUESTIONS: FallbackQuestion[] = [
    {
        id: 1, passageId: 'garden', type: 'grammar', skillTag: 'grammar:present_simple', role: 'cloze', questionMode: 'fill-blank',
        sourceSpan: 'Every morning she waters the plants.', target: 'waters',
        question: 'Read: "Every morning she ___ the plants."',
        options: ['waters', 'water', 'watering', 'watered'],
        correct_index: 0, difficulty: 'easy',
        hint: 'With "she", the verb gets an -s.',
        explanation: 'With "she" we add -s: "waters".',
        learningObjectiveId: 'present_simple', supportLevel: 2
    },
    {
        id: 2, passageId: 'garden', type: 'vocab', skillTag: 'vocab:context_meaning', role: 'recognition', questionMode: 'choice',
        readingSkill: 'contextual_meaning',
        sourceSpan: 'Today the tomatoes are red, so she picks them.', target: 'red',
        question: 'Read: "Today the tomatoes are red". Here "red" means the tomatoes are ___.',
        options: ['good to eat', 'too small', 'very cold', 'hard and green'],
        correct_index: 0, difficulty: 'easy',
        hint: 'Red fruit is good to eat.',
        explanation: 'Red tomatoes are good to eat.',
        learningObjectiveId: 'vocab_context_meaning', supportLevel: 3
    },
    {
        id: 3, passageId: 'garden', type: 'reading', skillTag: 'reading:pronoun_reference', role: 'recall', questionMode: 'choice',
        readingSkill: 'pronoun_reference',
        sourceSpan: 'Today the tomatoes are red, so she picks them.', target: 'them',
        question: 'Read: "so she picks them." What does "them" refer to?',
        options: ['the tomatoes', 'the plants', 'the mornings', 'the gardens'],
        correct_index: 0, difficulty: 'easy',
        hint: 'She picks the tomatoes.',
        explanation: 'She picks the tomatoes, so "them" means the tomatoes.',
        learningObjectiveId: 'pronoun_reference', supportLevel: 3
    },
    {
        id: 4, passageId: 'garden', type: 'reading', skillTag: 'reading:inference', role: 'transfer', questionMode: 'choice',
        readingSkill: 'inference',
        sourceSpan: 'Every morning she waters the plants.', target: 'waters',
        question: 'Read: "Every morning she waters the plants." What does this show about Mia?',
        options: ['she cares for the garden', 'she sells things', 'she does not like rain', 'she is always tired'],
        correct_index: 0, difficulty: 'easy',
        hint: 'Every day shows she cares.',
        explanation: 'Watering every day shows she cares for the garden.',
        learningObjectiveId: 'reading_inference', supportLevel: 0
    },
    {
        id: 5, passageId: 'rain', type: 'grammar', skillTag: 'grammar:present_simple', role: 'cloze', questionMode: 'fill-blank',
        sourceSpan: 'He walks to school in the rain.', target: 'walks',
        question: 'Read: "He ___ to school in the rain."',
        options: ['walks', 'walk', 'walking', 'walked'],
        correct_index: 0, difficulty: 'easy',
        hint: 'With "he", the verb gets an -s.',
        explanation: 'With "he" we add -s: "walks".',
        learningObjectiveId: 'present_simple', supportLevel: 2
    },
    {
        id: 6, passageId: 'rain', type: 'reading', skillTag: 'reading:inference', role: 'recall', questionMode: 'choice',
        readingSkill: 'inference',
        sourceSpan: 'Tom takes his umbrella because he does not want to get wet.', target: 'umbrella',
        question: 'Read: "Tom takes his umbrella because he does not want to get wet." Why does Tom take an umbrella?',
        options: ['to keep dry', 'to stay warm', 'to carry things', 'to look nice'],
        correct_index: 0, difficulty: 'easy',
        hint: 'An umbrella keeps you dry.',
        explanation: 'He takes it to keep dry in the rain.',
        learningObjectiveId: 'reading_inference', supportLevel: 3
    }
];

const DIFFICULTY_RANK: Record<'easy' | 'medium' | 'hard', number> = { easy: 0, medium: 1, hard: 2 };

export function getRandomFallbackQuestions(
    count: number,
    difficulty?: 'easy' | 'medium' | 'hard'
): FallbackQuestion[] {
    let pool = FALLBACK_QUESTIONS;
    if (difficulty) pool = pool.filter((q) => q.difficulty === difficulty);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

export function getBalancedFallbackQuestions(
    count: number,
    maxDifficulty: 'easy' | 'medium' | 'hard' = 'medium'
): FallbackQuestion[] {
    const pool = FALLBACK_QUESTIONS.filter((q) => DIFFICULTY_RANK[q.difficulty] <= DIFFICULTY_RANK[maxDifficulty]);
    return [...pool].sort(() => Math.random() - 0.5).slice(0, count);
}

/**
 * Map a fallback-bank question to a fully-formed Monster, preserving its
 * 1T grounding (sourceSpan → sourceContextSpan), objective, support level,
 * and transfer/practice intent. Used by the pipeline safety net so a
 * critic-rejected, unrepairable question is replaced — never shipped as-is.
 */
export function fallbackToMonster(fb: FallbackQuestion, id: number): Monster {
    return {
        id,
        type: fb.type,
        question: fb.question,
        options: fb.options,
        correct_index: fb.correct_index,
        explanation: fb.explanation,
        hint: fb.hint,
        skillTag: fb.skillTag,
        difficulty: fb.difficulty,
        questionMode: fb.questionMode,
        correctAnswer: fb.options[fb.correct_index] || '',
        learningObjectiveId: fb.learningObjectiveId,
        supportLevel: fb.supportLevel,
        attemptKind: fb.role === 'transfer' ? 'transfer' : 'practice',
        sourceContextSpan: fb.sourceSpan
    };
}
