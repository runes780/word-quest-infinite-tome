import { OpenAIResponsesClient } from './openai';
import { OpenRouterClient } from './openrouter';
import { createAIClient } from './providerClient';

describe('createAIClient', () => {
    test('selects the OpenAI Responses adapter', () => {
        expect(createAIClient({
            apiKey: 'synthetic-key',
            model: 'gpt-5.6-luna',
            provider: 'openai'
        })).toBeInstanceOf(OpenAIResponsesClient);
    });

    test.each(['deepseek', 'openrouter'] as const)('preserves the %s chat-completions adapter', (provider) => {
        expect(createAIClient({
            apiKey: 'synthetic-key',
            model: provider === 'deepseek' ? 'deepseek-v4-flash' : 'provider/model',
            provider
        })).toBeInstanceOf(OpenRouterClient);
    });
});
