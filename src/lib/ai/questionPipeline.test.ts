import { generateQuestionPack, type LlmClient } from './questionPipeline';

function makeClient(responses: { plan?: unknown; gen?: unknown; critic?: unknown }): LlmClient {
    return {
        async generate(prompt: string) {
            // Route by USER-prompt content (the fake only sees the user prompt).
            if (prompt.includes('vocabularyAllowed')) {
                return JSON.stringify(responses.plan ?? null);
            }
            if (prompt.includes('questions to review')) {
                return JSON.stringify(responses.critic ?? { verdicts: [] });
            }
            return JSON.stringify(responses.gen ?? { level_title: 'L', monsters: [] });
        }
    };
}

describe('generateQuestionPack', () => {
    test('happy path produces a pack', async () => {
        const plan = {
            levelTitle: 'Garden', materialSummary: 'x',
            vocabularyAllowed: ['water', 'plant', 'she', 'the'],
            items: Array.from({ length: 6 }, (_, i) => ({
                role: i === 5 ? 'transfer' : 'cloze', domain: 'grammar',
                learningObjectiveId: 'present_simple',
                sourceSpan: 'she waters the plants.', target: 'waters',
                targetKind: 'grammar_form', allowedWords: ['water', 'plant', 'she'],
                supportLevel: 2, difficulty: 'easy'
            }))
        };
        const gen = {
            level_title: 'Garden',
            monsters: Array.from({ length: 6 }, (_, i) => ({
                id: i + 1, type: 'grammar',
                question: 'Read: "she waters the plants." she ___ the plants.',
                options: ['waters', 'water', 'watering', 'watered'],
                correct_index: 0, explanation: 'she waters the plants.',
                hint: 'use water', skillTag: 'present_simple', difficulty: 'easy',
                questionMode: 'fill-blank', correctAnswer: 'waters',
                sourceContextSpan: 'she waters the plants.',
                learningObjectiveId: 'present_simple', supportLevel: 2, attemptKind: 'practice'
            }))
        };
        const client = makeClient({ plan, gen, critic: { verdicts: [] } });
        const result = await generateQuestionPack('she waters the plants.', {
            client, criticEnabled: true, material: 'she waters the plants.'
        });
        expect(result.degradedPath).toBe('none');
        expect(result.monsters.length).toBeGreaterThanOrEqual(5);
    });

    test('degrades when planner returns null', async () => {
        const client = makeClient({ plan: null });
        const result = await generateQuestionPack('she waters the plants.', {
            client, criticEnabled: false, material: 'she waters the plants.'
        });
        expect(result.degradedPath).toBe('planner_failed');
    });
});
