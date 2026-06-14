import { generateQuestionPack, type LlmClient } from './questionPipeline';
import type { Monster } from '@/store/gameStore';
import { FALLBACK_QUESTIONS } from '@/lib/data/fallbackQuestions';

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

    test('safety net replaces a critic-rejected, unrepairable question with a fallback', async () => {
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
        // Critic rejects monster id=2; repair returns nothing → safety net must kick in.
        const critic = { verdicts: [{ id: 2, pass: false, axisFailures: ['context'], offendingWords: [], reason: 'bad', suggestedFix: 'fix' }] };
        const client: LlmClient = {
            async generate(prompt: string) {
                if (prompt.includes('vocabularyAllowed')) return JSON.stringify(plan);
                if (prompt.includes('questions to review')) return JSON.stringify(critic);
                if (prompt.includes('Previous attempt rejected')) return JSON.stringify({ monsters: [] }); // repair fails
                return JSON.stringify(gen);
            }
        };

        const result = await generateQuestionPack('she waters the plants.', {
            client, criticEnabled: true, material: 'she waters the plants.'
        });

        expect(result.degradedPath).toBe('none');
        const replaced = result.monsters.find((m) => m.id === 2) as (Monster & { lowConfidence?: boolean }) | undefined;
        expect(replaced).toBeDefined();
        // The rejected question was replaced with a known-good fallback-bank question,
        // never shipped as-is or flagged lowConfidence.
        expect(FALLBACK_QUESTIONS.some((fb) => fb.question === replaced!.question)).toBe(true);
        expect(replaced!.sourceContextSpan).toBeTruthy();
        expect(replaced!.lowConfidence).toBeUndefined();
    });
});
