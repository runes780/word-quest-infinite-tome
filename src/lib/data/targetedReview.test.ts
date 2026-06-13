import type { MistakeRecord } from '@/db/db';
import { buildTargetedReviewPack } from './targetedReview';

function row(overrides: Partial<MistakeRecord>): MistakeRecord {
    return {
        questionId: 1,
        questionText: 'q',
        wrongAnswer: 'x',
        correctAnswer: 'y',
        explanation: 'exp',
        timestamp: Date.now(),
        ...overrides
    };
}

describe('buildTargetedReviewPack', () => {
    test('prioritizes focus cause tag and weakest skill', () => {
        const base = Date.now();
        const records: MistakeRecord[] = [
            row({ questionText: 'Q1', correctAnswer: 'A1', mentorCauseTag: 'tense_confusion', skillTag: 'grammar:tense', timestamp: base - 1000 }),
            row({ questionText: 'Q2', correctAnswer: 'A2', mentorCauseTag: 'inference_gap', skillTag: 'reading:main', timestamp: base - 500 }),
            row({ questionText: 'Q3', correctAnswer: 'A3', mentorCauseTag: 'tense_confusion', skillTag: 'grammar:tense', timestamp: base - 2000 })
        ];
        const pack = buildTargetedReviewPack({
            mistakes: records,
            focusCauseTag: 'tense_confusion',
            weakestSkillTag: 'grammar:tense',
            desiredCount: 3,
            fallbackQuestions: []
        });

        expect(pack.fromMistakes).toBe(3);
        expect(pack.fromFallback).toBe(0);
        expect(pack.monsters[0].question).toMatch(/Q1|Q3/);
        expect(pack.monsters[0].skillTag).toBe('grammar:tense');
    });

    test('fills with fallback when mistakes are insufficient', () => {
        const pack = buildTargetedReviewPack({
            mistakes: [row({ questionText: 'Only one', correctAnswer: 'A1', options: ['A1', 'B1', 'C1', 'D1'], correctIndex: 0 })],
            desiredCount: 5,
            fallbackQuestions: [
                {
                    id: 10,
                    type: 'vocab',
                    question: 'F1',
                    options: ['alpha', 'beta', 'gamma', 'delta'],
                    correct_index: 0,
                    explanation: 'e',
                    skillTag: 'vocab:f1',
                    difficulty: 'easy'
                },
                {
                    id: 11,
                    type: 'grammar',
                    question: 'F2',
                    options: ['was', 'is', 'are', 'be'],
                    correct_index: 1,
                    explanation: 'e',
                    skillTag: 'grammar:f2',
                    difficulty: 'medium'
                },
                {
                    id: 12,
                    type: 'reading',
                    question: 'F3',
                    options: ['morning', 'afternoon', 'evening', 'night'],
                    correct_index: 2,
                    explanation: 'e',
                    skillTag: 'reading:f3',
                    difficulty: 'hard'
                },
                {
                    id: 13,
                    type: 'vocab',
                    question: 'F4',
                    options: ['small', 'large', 'fast', 'slow'],
                    correct_index: 3,
                    explanation: 'e',
                    skillTag: 'vocab:f4',
                    difficulty: 'easy'
                }
            ]
        });

        expect(pack.monsters).toHaveLength(5);
        expect(pack.fromMistakes).toBe(1);
        expect(pack.fromFallback).toBe(4);
    });

    test('does not emit placeholder options for sparse mistake records', () => {
        const pack = buildTargetedReviewPack({
            mistakes: [row({ questionText: 'Sparse record', wrongAnswer: '', correctAnswer: 'correct', options: undefined })],
            desiredCount: 3,
            fallbackQuestions: [
                {
                    id: 20,
                    type: 'vocab',
                    question: 'Fallback 1',
                    options: ['alpha', 'beta', 'gamma', 'delta'],
                    correct_index: 0,
                    explanation: 'e',
                    skillTag: 'vocab:fallback',
                    difficulty: 'easy'
                },
                {
                    id: 21,
                    type: 'grammar',
                    question: 'Fallback 2',
                    options: ['was', 'is', 'are', 'be'],
                    correct_index: 0,
                    explanation: 'e',
                    skillTag: 'grammar:fallback',
                    difficulty: 'easy'
                }
            ]
        });

        const placeholder = /^(?:[A-D]|option\s*[A-D]?|choice\s*[A-D]?|option\s+\d+|\d+)$/i;
        expect(pack.monsters.flatMap((monster) => monster.options).some((option) => placeholder.test(option))).toBe(false);
    });

    test('repairs duplicate mistake options without adding placeholder choices', () => {
        const pack = buildTargetedReviewPack({
            mistakes: [row({
                questionText: 'Duplicate options',
                wrongAnswer: 'wrong',
                correctAnswer: 'correct',
                options: ['correct', 'correct'],
                correctIndex: 0
            })],
            desiredCount: 3,
            fallbackQuestions: [
                {
                    id: 30,
                    type: 'vocab',
                    question: 'Fallback 1',
                    options: ['alpha', 'beta', 'gamma', 'delta'],
                    correct_index: 0,
                    explanation: 'e',
                    skillTag: 'vocab:fallback',
                    difficulty: 'easy'
                },
                {
                    id: 31,
                    type: 'reading',
                    question: 'Fallback 2',
                    options: ['morning', 'afternoon', 'evening', 'night'],
                    correct_index: 1,
                    explanation: 'e',
                    skillTag: 'reading:fallback',
                    difficulty: 'easy'
                }
            ]
        });

        const duplicateCard = pack.monsters.find((monster) => monster.question === 'Duplicate options');
        const placeholder = /^(?:[A-D]|option\s*[A-D]?|choice\s*[A-D]?|option\s+\d+|\d+)$/i;

        expect(duplicateCard?.options).toHaveLength(4);
        expect(duplicateCard?.options.some((option) => placeholder.test(option))).toBe(false);
    });

    test('does not force targeted review cards into invalid fill-blank modes', () => {
        const records = Array.from({ length: 5 }, (_, index) => row({
            questionId: index + 1,
            questionText: `Review question ${index + 1}`,
            correctAnswer: `answer ${index + 1}`,
            wrongAnswer: `wrong ${index + 1}`,
            options: [`answer ${index + 1}`, `wrong ${index + 1}`, 'near choice', 'far choice'],
            correctIndex: 0,
            skillTag: 'vocab:review'
        }));

        const pack = buildTargetedReviewPack({
            mistakes: records,
            desiredCount: 5,
            fallbackQuestions: []
        });

        const blankPattern = /(?:_{2,}|\[\s*(?:\.\.\.|…)?\s*\]|\(\s*blank\s*\))/i;
        expect(pack.monsters.every((monster) => monster.questionMode !== 'fill-blank' || blankPattern.test(monster.question))).toBe(true);
    });
});
