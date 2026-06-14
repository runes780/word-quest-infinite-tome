import type { Monster } from '@/store/gameStore';
import {
    assessQuestionQuality,
    hasVisibleQuestionBlank,
    type QuestionQualityReport
} from './questionQuality';

const baseQuestion: Monster = {
    id: 1,
    type: 'reading',
    question: 'Read: "Mia saw dark clouds, so she took an umbrella." Why did Mia take an umbrella?',
    options: ['It might rain', 'It was lunchtime', 'She lost a book', 'It was sunny'],
    correct_index: 0,
    explanation: 'Dark clouds are a clue that it might rain.',
    hint: 'Look at the weather clue.',
    skillTag: 'reading:inference',
    difficulty: 'medium',
    questionMode: 'choice',
    correctAnswer: 'It might rain',
    learningObjectiveId: 'reading_inference',
    sourceContextSpan: 'Mia saw dark clouds, so she took an umbrella.',
    supportLevel: 3,
    attemptKind: 'practice'
};

describe('question quality assessment', () => {
    test('rejects fill-blank questions without a visible blank', () => {
        const report = assessQuestionQuality({
            ...baseQuestion,
            questionMode: 'fill-blank',
            question: 'What is the weather clue?'
        });

        expect(report.accepted).toBe(false);
        expect(report.flags).toContain('mode_mismatch');
        expect(report.rejectReasons).toContain('fill_blank_missing_visible_blank');
    });

    test('accepts transfer questions in a new context when they keep the same objective and source span', () => {
        const report: QuestionQualityReport = assessQuestionQuality({
            ...baseQuestion,
            question: 'A student sees dark clouds and opens an umbrella. What can you infer?',
            sourceContextSpan: 'Mia saw dark clouds, so she took an umbrella.',
            supportLevel: 0,
            attemptKind: 'transfer',
            questionMode: 'typing'
        });

        expect(report.accepted).toBe(true);
        expect(report.flags).toContain('transfer_check');
        expect(report.score).toBeGreaterThanOrEqual(70);
    });

    test('rejects transfer questions without a learning objective', () => {
        const report = assessQuestionQuality({
            ...baseQuestion,
            learningObjectiveId: undefined,
            question: 'A student sees dark clouds and opens an umbrella. What can you infer?',
            sourceContextSpan: 'Mia saw dark clouds, so she took an umbrella.',
            supportLevel: 0,
            attemptKind: 'transfer',
            questionMode: 'typing'
        });

        expect(report.accepted).toBe(false);
        expect(report.rejectReasons).toContain('transfer_missing_learning_objective');
    });

    test('detects placeholder distractors as low-quality options', () => {
        const report = assessQuestionQuality({
            ...baseQuestion,
            options: ['It might rain', 'Option A', 'Option B', 'Option C']
        });

        expect(report.accepted).toBe(false);
        expect(report.flags).toContain('weak_options');
        expect(report.rejectReasons).toContain('placeholder_options');
    });

    test('rejects non-English question payload text', () => {
        const report = assessQuestionQuality({
            ...baseQuestion,
            question: 'Mia 为什么带伞？',
            options: ['It might rain', '午饭时间', 'She lost a book', 'It was sunny'],
            correctAnswer: 'It might rain'
        });

        expect(report.accepted).toBe(false);
        expect(report.flags).toContain('language_fit');
        expect(report.rejectReasons).toContain('non_english_question_payload');
    });

    test('detects visible blank formats used by fill-blank cards', () => {
        expect(hasVisibleQuestionBlank('She ___ home.')).toBe(true);
        expect(hasVisibleQuestionBlank('She [...] home.')).toBe(true);
        expect(hasVisibleQuestionBlank('She (blank) home.')).toBe(true);
        expect(hasVisibleQuestionBlank('She went home.')).toBe(false);
    });
});

import { COMMON_WORD_SET } from './commonWords';
import { normalizeWord } from './textNormalize';

describe('assessQuestionQuality lexical grounding', () => {
    const MATERIAL = 'The cat sat on the mat.';
    const ALLOWED = new Set([...COMMON_WORD_SET, ...['cat', 'sat', 'mat', 'on'].map(normalizeWord)]);

    function baseMonster(overrides: Partial<Record<string, unknown>> = {}) {
        return {
            question: 'Read: "The cat sat on the ___."',
            options: ['mat', 'cat', 'sat', 'on'],
            correct_index: 0,
            correctAnswer: 'mat',
            questionMode: 'fill-blank',
            difficulty: 'easy',
            learningObjectiveId: 'present_simple',
            sourceContextSpan: 'The cat sat on the mat.',
            supportLevel: 2,
            attemptKind: 'practice',
            ...overrides
        };
    }

    test('flags an above-material word in explanation', () => {
        const report = assessQuestionQuality(
            baseMonster({ explanation: 'The cat is enormous.' }) as Parameters<typeof assessQuestionQuality>[0],
            { maxDifficulty: 'easy', allowedSet: ALLOWED, material: MATERIAL, target: 'mat' }
        );
        expect(report.rejectReasons).toContain('above_material_vocabulary');
    });

    test('accepts when all words are in allowedSet', () => {
        const report = assessQuestionQuality(
            baseMonster({ explanation: 'The cat sat on the mat.' }) as Parameters<typeof assessQuestionQuality>[0],
            { maxDifficulty: 'easy', allowedSet: ALLOWED, material: MATERIAL, target: 'mat' }
        );
        expect(report.rejectReasons).not.toContain('above_material_vocabulary');
    });

    test('flags a question not grounded in material', () => {
        const report = assessQuestionQuality(
            baseMonster({ question: 'What color is the sky?', sourceContextSpan: 'xyz', questionMode: 'choice' }) as Parameters<typeof assessQuestionQuality>[0],
            { maxDifficulty: 'easy', allowedSet: ALLOWED, material: MATERIAL, target: 'sky', domain: 'reading', readingSkill: 'inference' }
        );
        expect(report.rejectReasons).toContain('not_grounded_in_material');
    });

    test('flags a reading item whose stem does not match its readingSkill', () => {
        const report = assessQuestionQuality(
            baseMonster({ question: 'Read: "The cat sat on the mat." What does the cat do?', questionMode: 'choice' }) as Parameters<typeof assessQuestionQuality>[0],
            { maxDifficulty: 'easy', allowedSet: ALLOWED, material: MATERIAL, target: 'cat', domain: 'reading', readingSkill: 'inference' }
        );
        expect(report.rejectReasons).toContain('reading_skill_mismatch');
    });

    test('backward-compatible: no allowedSet/material/domain -> legacy path runs', () => {
        const report = assessQuestionQuality(
            baseMonster() as Parameters<typeof assessQuestionQuality>[0],
            { maxDifficulty: 'easy' }
        );
        expect(typeof report.score).toBe('number');
    });
});
