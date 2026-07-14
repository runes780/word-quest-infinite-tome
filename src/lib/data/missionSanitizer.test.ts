import { normalizeMissionMonsters } from '@/lib/data/missionSanitizer';

const CJK_REGEX = /[\u3400-\u9FFF]/;
const PLACEHOLDER_REGEX = /^(?:[A-D]|option\s*[A-D]?|choice\s*[A-D]?|\d+)$/i;

describe('normalizeMissionMonsters', () => {
    test('does not force valid choice questions into invalid fill-blank cards', () => {
        const input = Array.from({ length: 6 }, (_, index) => ({
            id: index + 100,
            type: 'vocab',
            question: `Read: "The bright star shines at night." What does "bright" mean? ${index}`,
            options: ['shining', 'dark', 'quiet', 'late'],
            correct_index: 0,
            questionMode: 'choice',
            correctAnswer: 'shining',
            explanation: 'Bright means shining.',
            hint: 'Look for light.',
            skillTag: 'vocab:bright',
            learningObjectiveId: 'vocab_context_meaning',
            sourceContextSpan: 'The bright star shines at night.'
        }));

        const normalized = normalizeMissionMonsters(input);

        expect(normalized).toHaveLength(6);
        expect(normalized.some((item) => item.attemptKind === 'transfer')).toBe(true);
        expect(normalized.every((item) => item.questionMode !== 'fill-blank' || /_{2,}|\[\s*(?:\.\.\.|…)?\s*\]|\(\s*blank\s*\)/i.test(item.question))).toBe(true);
    });

    test('keeps valid transfer questions with new context and an original source span', () => {
        const normalized = normalizeMissionMonsters([
            {
                id: 101,
                type: 'reading',
                question: 'A student sees dark clouds and opens an umbrella. What can you infer?',
                options: ['It might rain', 'It is lunchtime', 'The bag is heavy', 'The student is asleep'],
                correct_index: 0,
                difficulty: 'medium',
                questionMode: 'typing',
                correctAnswer: 'It might rain',
                explanation: 'Dark clouds and an umbrella are clues about rain.',
                hint: 'Connect the weather clue to the action.',
                skillTag: 'reading:inference',
                learningObjectiveId: 'reading_inference',
                sourceContextSpan: 'Mia saw dark clouds, so she took an umbrella.',
                supportLevel: 0,
                attemptKind: 'transfer'
            }
        ], {
            sourceText: 'Mia saw dark clouds, so she took an umbrella.'
        });

        expect(normalized[0]).toEqual(expect.objectContaining({
            id: 101,
            questionMode: 'typing',
            attemptKind: 'transfer',
            supportLevel: 0,
            learningObjectiveId: 'reading_inference',
            sourceContextSpan: 'Mia saw dark clouds, so she took an umbrella.'
        }));
    });

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

    test('replaces orphan pronoun reference questions without a source sentence', () => {
        const normalized = normalizeMissionMonsters([
            {
                id: 9,
                type: 'reading',
                question: 'What does "it" refer to?',
                options: ['notebook', 'school', 'weather', 'time'],
                correct_index: 0,
                questionMode: 'choice',
                correctAnswer: 'notebook',
                explanation: 'It refers to the notebook.',
                hint: 'Look before the pronoun.',
                skillTag: 'pronoun_reference',
                learningObjectiveId: 'pronoun_reference'
            }
        ]);

        expect(normalized[0].id).toBe(9);
        expect(normalized[0].sourceContextSpan).toBe('sanitized_fallback');
        expect(normalized[0].question).not.toBe('What does "it" refer to?');
    });

    test('embeds the source sentence for pronoun reference questions', () => {
        const normalized = normalizeMissionMonsters([
            {
                id: 10,
                type: 'reading',
                question: 'What does "it" refer to?',
                options: ['notebook', 'school', 'weather', 'time'],
                correct_index: 0,
                questionMode: 'choice',
                correctAnswer: 'notebook',
                explanation: 'It refers to the notebook.',
                hint: 'Look before the pronoun.',
                skillTag: 'pronoun_reference',
                learningObjectiveId: 'pronoun_reference',
                sourceContextSpan: 'Lily found her notebook and put it away.'
            }
        ]);

        expect(normalized[0].id).toBe(10);
        expect(normalized[0].sourceContextSpan).toBe('Lily found her notebook and put it away.');
        expect(normalized[0].question).toContain('Read: "Lily found her notebook and put it away."');
        expect(normalized[0].question).toContain('What does "it" refer to?');
    });

    test('infers the source sentence from source text when the model omits sourceContextSpan', () => {
        const normalized = normalizeMissionMonsters([
            {
                id: 12,
                type: 'reading',
                question: 'What does "it" refer to?',
                options: ['notebook', 'school', 'weather', 'time'],
                correct_index: 0,
                questionMode: 'choice',
                correctAnswer: 'notebook',
                explanation: 'It refers to the notebook.',
                hint: 'Look before the pronoun.',
                skillTag: 'pronoun_reference',
                learningObjectiveId: 'pronoun_reference'
            }
        ], {
            sourceText: 'Lily found her notebook and put it away. Then she went home.'
        });

        expect(normalized[0].id).toBe(12);
        expect(normalized[0].sourceContextSpan).toBe('Lily found her notebook and put it away.');
        expect(normalized[0].question).toContain('Read: "Lily found her notebook and put it away."');
    });

    test('corrects inconsistent pronoun objective on ordinary reading detail questions', () => {
        const normalized = normalizeMissionMonsters([
            {
                id: 13,
                type: 'reading',
                question: 'What is the weather like today?',
                options: ['rainy and cold', 'summer and hot', 'spring and green', 'autumn and golden'],
                correct_index: 0,
                questionMode: 'choice',
                correctAnswer: 'rainy and cold',
                explanation: 'The text says today is rainy and cold.',
                hint: 'Look at the beginning of the text.',
                skillTag: 'pronoun_reference',
                learningObjectiveId: 'pronoun_reference',
                sourceContextSpan: 'Today is rainy and cold.'
            }
        ]);

        expect(normalized[0].learningObjectiveId).toBe('reading_detail');
        expect(normalized[0].question).toContain('Read: "Today is rainy and cold."');
        expect(normalized[0].question).toContain('What is the weather like today?');
    });

    test('repairs fill-blank questions by turning the source sentence into a cloze card', () => {
        const normalized = normalizeMissionMonsters([
            {
                id: 14,
                type: 'reading',
                question: 'What is the weather like today?',
                options: ['rainy and cold', 'summer and hot', 'spring and green', 'autumn and golden'],
                correct_index: 0,
                questionMode: 'fill-blank',
                correctAnswer: 'rainy and cold',
                explanation: 'The text says today is rainy and cold.',
                hint: 'Use the weather words.',
                skillTag: 'reading_detail',
                learningObjectiveId: 'reading_detail',
                sourceContextSpan: 'Today is rainy and cold.'
            }
        ]);

        expect(normalized[0].id).toBe(14);
        expect(normalized[0].questionMode).toBe('fill-blank');
        expect(normalized[0].question).toContain('Today is ___.');
        expect(normalized[0].question).toContain('Complete the missing words');
    });

    test('rejects unsupported direct reading detail cards instead of inventing facts', () => {
        const normalized = normalizeMissionMonsters([
            {
                id: 15,
                type: 'reading',
                question: 'What color is the bag?',
                options: ['blue', 'red', 'green', 'yellow'],
                correct_index: 0,
                questionMode: 'choice',
                correctAnswer: 'blue',
                explanation: 'The bag is blue.',
                hint: 'Look for the color.',
                skillTag: 'reading_detail',
                learningObjectiveId: 'reading_detail',
                sourceContextSpan: 'Tom puts a book in the bag.'
            }
        ]);

        expect(normalized[0].id).toBe(15);
        expect(normalized[0].sourceContextSpan).toBe('sanitized_fallback');
        expect(normalized[0].question).not.toContain('bag');
    });

    test('rejects speaker-label answer options generated from textbook dialogue labels', () => {
        const normalized = normalizeMissionMonsters([
            {
                id: 16,
                type: 'reading',
                question: 'Who says hello?',
                options: ['Mike:', 'Sarah:', 'Tom:', 'Lily:'],
                correct_index: 0,
                questionMode: 'choice',
                correctAnswer: 'Mike:',
                explanation: 'Mike says hello.',
                hint: 'Look at the speaker.',
                skillTag: 'reading_detail',
                learningObjectiveId: 'reading_detail',
                sourceContextSpan: 'Mike: Hello!'
            }
        ]);

        expect(normalized[0].id).toBe(16);
        expect(normalized[0].sourceContextSpan).toBe('sanitized_fallback');
        expect(normalized[0].options.every((option) => !option.endsWith(':'))).toBe(true);
    });

    test('does not invent unrelated context when no source span can be matched', () => {
        const normalized = normalizeMissionMonsters([
            {
                id: 11,
                type: 'reading',
                question: 'Why did Mia go home?',
                options: ['rain', 'lunch', 'game', 'bus'],
                correct_index: 0,
                questionMode: 'choice',
                correctAnswer: 'rain',
                explanation: 'The rain made Mia go home.',
                hint: 'Find the reason.',
                skillTag: 'reading_inference',
                learningObjectiveId: 'reading_inference'
            }
        ], {
            sourceText: 'Tom has a dog. The sky is blue.'
        });

        expect(normalized[0].id).toBe(11);
        expect(normalized[0].sourceContextSpan).toBe('sanitized_fallback');
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
                options: ['OpenAI', 'OpenRouter', 'Gemini', 'Claude'],
                correct_index: 0,
                questionMode: 'choice',
                correctAnswer: 'OpenAI',
                explanation: 'OpenAI is the selected provider.',
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
