/**
 * @jest-environment node
 *
 * Opt-in live verification against a real LLM. The default Jest suite excludes
 * *.live.test.* files. Run with LIVE_TESTS=1 and explicit environment variables.
 *
 * SECURITY: this test never reads browser profiles, localStorage, or application
 * state. The API key is accepted only from WORD_QUEST_LIVE_API_KEY and is never
 * printed. The material below is synthetic.
 */
import { FALLBACK_QUESTIONS } from '@/lib/data/fallbackQuestions';
import { generateQuestionPack } from './questionPipeline';

const MATERIAL =
    'Tom has a small dog named Max. Every morning Tom walks Max in the park. ' +
    'One day it rained, so Tom took an umbrella. Max was happy because he loves the water. ' +
    'Tom and Max walked home together after the rain stopped.';

function readLiveSettings() {
    const apiKey = process.env.WORD_QUEST_LIVE_API_KEY;
    const model = process.env.WORD_QUEST_LIVE_MODEL;
    if (!apiKey || !model) return null;
    return {
        apiKey,
        model,
        apiProvider: process.env.WORD_QUEST_LIVE_PROVIDER === 'deepseek'
            ? 'deepseek' as const
            : process.env.WORD_QUEST_LIVE_PROVIDER === 'openai'
                ? 'openai' as const
                : 'openrouter' as const
    };
}

describe('LIVE end-to-end (real LLM)', () => {
    test('plan -> generate -> critique returns a safe playable pack', async () => {
        const settings = readLiveSettings();
        if (!settings) {
            console.log(
                '[LIVE] SKIPPED - set WORD_QUEST_LIVE_API_KEY and WORD_QUEST_LIVE_MODEL explicitly.'
            );
            return;
        }

        console.log(`[LIVE] provider=${settings.apiProvider} model="${settings.model}" (key hidden)`);
        const result = await generateQuestionPack(MATERIAL, {
            ...settings,
            criticEnabled: true,
            material: MATERIAL
        });

        const fallbackQuestions = new Set(FALLBACK_QUESTIONS.map((question) => question.question));
        const fallbackCount = result.monsters.filter((monster) =>
            fallbackQuestions.has(monster.question)
        ).length;
        console.log(
            `[LIVE] path=${result.degradedPath} total=${result.monsters.length} fallback=${fallbackCount}`
        );

        expect(result.monsters.length).toBeGreaterThanOrEqual(5);
        expect(result.monsters.every((monster) => monster.question && monster.correctAnswer)).toBe(true);
        expect(result.monsters.every((monster) => monster.sourceContextSpan)).toBe(true);
    }, 300000);
});
