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
    },
    {
        id: 'market',
        band: 'easy',
        text: 'Anna goes to the market with her mom. They buy apples, bread, and milk. Anna carries the bag because it is heavy.',
        vocabulary: []
    },
    {
        id: 'sports-day',
        band: 'medium',
        text: 'Last Friday our class had Sports Day. Ben ran fast in the race and won first place. After the race, he drank a lot of water and rested under the tree.',
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
        options: ['water', 'waters', 'watering', 'watered'],
        correct_index: 1, difficulty: 'easy',
        hint: 'With "she", the verb gets an -s.',
        explanation: 'With "she" we add -s: "waters".',
        learningObjectiveId: 'present_simple', supportLevel: 2
    },
    {
        id: 2, passageId: 'garden', type: 'vocab', skillTag: 'vocab:context_meaning', role: 'recognition', questionMode: 'choice',
        readingSkill: 'contextual_meaning',
        sourceSpan: 'Today the tomatoes are red, so she picks them.', target: 'red',
        question: 'Read: "Today the tomatoes are red". Here "red" means the tomatoes are ___.',
        options: ['too small', 'very cold', 'hard and green', 'good to eat'],
        correct_index: 3, difficulty: 'easy',
        hint: 'Red fruit is good to eat.',
        explanation: 'Red tomatoes are good to eat.',
        learningObjectiveId: 'vocab_context_meaning', supportLevel: 3
    },
    {
        id: 3, passageId: 'garden', type: 'reading', skillTag: 'reading:pronoun_reference', role: 'recall', questionMode: 'choice',
        readingSkill: 'pronoun_reference',
        sourceSpan: 'Today the tomatoes are red, so she picks them.', target: 'them',
        question: 'Read: "so she picks them." What does "them" refer to?',
        options: ['the plants', 'the mornings', 'the tomatoes', 'the gardens'],
        correct_index: 2, difficulty: 'easy',
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
        options: ['walking', 'walk', 'walks', 'walked'],
        correct_index: 2, difficulty: 'easy',
        hint: 'With "he", the verb gets an -s.',
        explanation: 'With "he" we add -s: "walks".',
        learningObjectiveId: 'present_simple', supportLevel: 2
    },
    {
        id: 6, passageId: 'rain', type: 'reading', skillTag: 'reading:inference', role: 'recall', questionMode: 'choice',
        readingSkill: 'inference',
        sourceSpan: 'Tom takes his umbrella because he does not want to get wet.', target: 'umbrella',
        question: 'Read: "Tom takes his umbrella because he does not want to get wet." Why does Tom take an umbrella?',
        options: ['to stay warm', 'to carry things', 'to look nice', 'to keep dry'],
        correct_index: 3, difficulty: 'easy',
        hint: 'An umbrella keeps you dry.',
        explanation: 'He takes it to keep dry in the rain.',
        learningObjectiveId: 'reading_inference', supportLevel: 3
    },
    {
        id: 7, passageId: 'market', type: 'grammar', skillTag: 'grammar:present_simple', role: 'cloze', questionMode: 'fill-blank',
        sourceSpan: 'They buy apples, bread, and milk.', target: 'buy',
        question: 'Read: "They ___ apples, bread, and milk."',
        options: ['buys', 'buy', 'buying', 'to buy'],
        correct_index: 1, difficulty: 'easy',
        hint: 'With "they", the verb has no -s.',
        explanation: 'With "they" we say "buy".',
        learningObjectiveId: 'present_simple', supportLevel: 2
    },
    {
        id: 8, passageId: 'market', type: 'vocab', skillTag: 'vocab:context_meaning', role: 'recognition', questionMode: 'choice',
        readingSkill: 'contextual_meaning',
        sourceSpan: 'Anna carries the bag because it is heavy.', target: 'heavy',
        question: 'Read: "Anna carries the bag because it is heavy." Here "heavy" means ___.',
        options: ['not light', 'very small', 'very new', 'sweet to eat'],
        correct_index: 0, difficulty: 'easy',
        hint: 'A heavy bag is hard to carry.',
        explanation: '"Heavy" means it is not light, so the bag is hard to carry.',
        learningObjectiveId: 'vocab_context_meaning', supportLevel: 3
    },
    {
        id: 9, passageId: 'market', type: 'reading', skillTag: 'reading:pronoun_reference', role: 'recall', questionMode: 'choice',
        readingSkill: 'pronoun_reference',
        sourceSpan: 'Anna goes to the market with her mom.', target: 'her',
        question: 'Read: "Anna goes to the market with her mom." The word "her" refers to ___.',
        options: ['the market', 'the milk', 'Anna', 'the bag'],
        correct_index: 2, difficulty: 'easy',
        hint: 'Whose mom is it?',
        explanation: '"Her" refers to Anna, so it is Anna\'s mom.',
        learningObjectiveId: 'pronoun_reference', supportLevel: 3
    },
    {
        id: 10, passageId: 'sports-day', type: 'grammar', skillTag: 'grammar:past_tense', role: 'cloze', questionMode: 'fill-blank',
        sourceSpan: 'Ben ran fast in the race and won first place.', target: 'ran',
        question: 'Read: "Ben ___ fast in the race and won first place."',
        options: ['runs', 'run', 'ran', 'will run'],
        correct_index: 2, difficulty: 'medium',
        hint: 'It happened last Friday.',
        explanation: 'It is about last Friday, so we say "ran".',
        learningObjectiveId: 'past_tense_basic', supportLevel: 2
    },
    {
        id: 11, passageId: 'sports-day', type: 'reading', skillTag: 'reading:contextual_meaning', role: 'recall', questionMode: 'choice',
        readingSkill: 'contextual_meaning',
        sourceSpan: 'After the race, he drank a lot of water and rested under the tree.', target: 'tree',
        question: 'In this story, where did Ben rest after the race?',
        options: ['under the water', 'in the race', 'under the tree', 'at first place'],
        correct_index: 2, difficulty: 'medium',
        hint: 'Read the last part of the story again.',
        explanation: 'He rested under the tree after the race.',
        learningObjectiveId: 'reading_detail', supportLevel: 3
    },
    {
        id: 12, passageId: 'sports-day', type: 'reading', skillTag: 'reading:inference', role: 'recall', questionMode: 'choice',
        readingSkill: 'inference',
        sourceSpan: 'Ben ran fast in the race and won first place.', target: 'place',
        question: 'Read: "Ben ran fast in the race and won first place." What does this show?',
        options: ['Ben came last', 'Ben was very fast', 'Ben did not run', 'Ben was sad'],
        correct_index: 1, difficulty: 'medium',
        hint: 'Think about what "first place" means.',
        explanation: 'Ben ran fast and came first, so he was the best in the race.',
        learningObjectiveId: 'reading_inference', supportLevel: 3
    },
    {
        id: 13, passageId: 'sports-day', type: 'reading', skillTag: 'reading:pronoun_reference', role: 'recall', questionMode: 'choice',
        readingSkill: 'pronoun_reference',
        sourceSpan: 'After the race, he drank a lot of water and rested under the tree.', target: 'he',
        question: 'Read: "he drank a lot of water and rested under the tree." The word "he" refers to ___.',
        options: ['Ben', 'the water', 'the tree', 'the class'],
        correct_index: 0, difficulty: 'medium',
        hint: 'Who ran in the race?',
        explanation: '"He" is Ben, the boy who ran in the race.',
        learningObjectiveId: 'pronoun_reference', supportLevel: 3
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
