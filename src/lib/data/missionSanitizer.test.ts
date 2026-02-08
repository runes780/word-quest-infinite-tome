import { normalizeMissionMonsters } from '@/lib/data/missionSanitizer';

const CJK_REGEX = /[\u3400-\u9FFF]/;
const PLACEHOLDER_REGEX = /^(?:[A-D]|option\s*[A-D]?|choice\s*[A-D]?|\d+)$/i;

describe('normalizeMissionMonsters', () => {
    test('replaces placeholder options like A/B/C/D with safe fallback content', () => {
        const normalized = normalizeMissionMonsters([
            {
                id: 1,
                type: 'reading',
                question: 'Where do we put clocks?',
                options: ['A', 'B', 'C', 'D'],
                correct_index: 0,
                questionMode: 'choice'
            }
        ]);

        expect(normalized).toHaveLength(1);
        expect(normalized[0].options).toHaveLength(4);
        expect(normalized[0].options.some((option) => PLACEHOLDER_REGEX.test(option))).toBe(false);
    });

    test('replaces Chinese question payload with English fallback', () => {
        const normalized = normalizeMissionMonsters([
            {
                id: 2,
                type: 'vocab',
                question: '我们在哪里放时钟？',
                options: ['墙上', '桌子', '地上', '书包里'],
                correct_index: 0,
                questionMode: 'choice',
                correctAnswer: '墙上'
            }
        ]);

        expect(normalized).toHaveLength(1);
        expect(CJK_REGEX.test(normalized[0].question)).toBe(false);
        expect(normalized[0].options.every((option) => !CJK_REGEX.test(option))).toBe(true);
        expect(CJK_REGEX.test(normalized[0].correctAnswer)).toBe(false);
    });

    test('keeps valid English payload and strips option labels', () => {
        const normalized = normalizeMissionMonsters([
            {
                id: 3,
                type: 'vocab',
                question: 'Where do we study at school?',
                options: ['A. classroom', 'B. kitchen', 'C. river', 'D. cloud'],
                correct_index: 0,
                questionMode: 'choice',
                correctAnswer: 'classroom',
                explanation: 'The correct place is classroom.',
                hint: 'Think about lessons.'
            }
        ]);

        expect(normalized).toHaveLength(1);
        expect(normalized[0].id).toBe(3);
        expect(normalized[0].question).toBe('Where do we study at school?');
        expect(normalized[0].options).toEqual(['classroom', 'kitchen', 'river', 'cloud']);
        expect(normalized[0].correct_index).toBe(0);
        expect(normalized[0].correctAnswer).toBe('classroom');
    });
});
