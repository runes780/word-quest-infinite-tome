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
                    options: ['a', 'b', 'c', 'd'],
                    correct_index: 0,
                    explanation: 'e',
                    skillTag: 'vocab:f1',
                    difficulty: 'easy'
                },
                {
                    id: 11,
                    type: 'grammar',
                    question: 'F2',
                    options: ['a', 'b', 'c', 'd'],
                    correct_index: 1,
                    explanation: 'e',
                    skillTag: 'grammar:f2',
                    difficulty: 'medium'
                },
                {
                    id: 12,
                    type: 'reading',
                    question: 'F3',
                    options: ['a', 'b', 'c', 'd'],
                    correct_index: 2,
                    explanation: 'e',
                    skillTag: 'reading:f3',
                    difficulty: 'hard'
                },
                {
                    id: 13,
                    type: 'vocab',
                    question: 'F4',
                    options: ['a', 'b', 'c', 'd'],
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
});
