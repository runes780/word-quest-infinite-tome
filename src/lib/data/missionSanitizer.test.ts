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

    test('replaces schema or app-field questions with safe fallback content', () => {
        const normalized = normalizeMissionMonsters([
            {
                id: 4,
                type: 'reading',
                question: 'What does sourceContextSpan mean?',
                options: ['source text', 'player score', 'model name', 'api key'],
                correct_index: 0,
                questionMode: 'choice',
                correctAnswer: 'source text',
                explanation: 'sourceContextSpan is a field.',
                hint: 'Look at the field name.',
                skillTag: 'schema_field'
            },
            {
                id: 5,
                type: 'vocab',
                question: 'Which API provider is used?',
                options: ['DeepSeek', 'OpenRouter', 'Gemini', 'Claude'],
                correct_index: 0,
                questionMode: 'choice',
                correctAnswer: 'DeepSeek',
                explanation: 'DeepSeek is the selected provider.',
                hint: 'It is in settings.',
                skillTag: 'api_provider'
            }
        ]);

        expect(normalized).toHaveLength(2);
        expect(normalized[0].question).not.toContain('sourceContextSpan');
        expect(normalized[0].sourceContextSpan).toBe('sanitized_fallback');
        expect(normalized[1].question).not.toContain('API provider');
        expect(normalized[1].sourceContextSpan).toBe('sanitized_fallback');
    });

    test('replaces questions above the source material difficulty', () => {
        const normalized = normalizeMissionMonsters([
            {
                id: 6,
                type: 'vocab',
                question: 'What does enormous mean?',
                options: ['small', 'red', 'very big', 'fast'],
                correct_index: 2,
                difficulty: 'hard',
                questionMode: 'choice',
                correctAnswer: 'very big',
                explanation: 'Enormous means very big.',
                hint: 'Think of a giant building.'
            }
        ], { sourceText: 'The cat is big.' });

        expect(normalized[0].id).toBe(6);
        expect(normalized[0].sourceContextSpan).toBe('sanitized_fallback');
        expect(normalized[0].difficulty).toBe('easy');
        expect(normalized[0].question).not.toContain('enormous');
    });

    test('keeps advanced vocabulary questions when the source material supports that level', () => {
        const normalized = normalizeMissionMonsters([
            {
                id: 8,
                type: 'vocab',
                question: 'What does revolutionized mean?',
                options: ['changed greatly', 'stayed the same', 'moved slowly', 'looked small'],
                correct_index: 0,
                difficulty: 'hard',
                questionMode: 'choice',
                correctAnswer: 'changed greatly',
                explanation: 'It means changed something in a big way.',
                hint: 'Look at the result of the discovery.'
            }
        ], {
            sourceText: 'The scientist discovered a new medicine. The discovery revolutionized how doctors helped sick people after many years of research.'
        });

        expect(normalized[0].id).toBe(8);
        expect(normalized[0].question).toBe('What does revolutionized mean?');
        expect(normalized[0].sourceContextSpan).not.toBe('sanitized_fallback');
    });

    test('simplifies hints and explanations that are harder than easy source material', () => {
        const normalized = normalizeMissionMonsters([
            {
                id: 7,
                type: 'grammar',
                question: 'Where is the cat?',
                options: ['on the mat', 'under the bed', 'near the tree', 'in the box'],
                correct_index: 0,
                difficulty: 'easy',
                questionMode: 'choice',
                correctAnswer: 'on the mat',
                hint: 'Analyze the spatial relationship.',
                explanation: 'The prepositional phrase indicates the spatial relationship.'
            }
        ], { sourceText: 'The cat is on the mat.' });

        expect(normalized[0].question).toBe('Where is the cat?');
        expect(normalized[0].hint).not.toContain('spatial');
        expect(normalized[0].explanation).not.toContain('prepositional');
    });
});
