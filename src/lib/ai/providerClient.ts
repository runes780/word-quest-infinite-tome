import type { AIProvider } from './modelOptions';
import { OpenAIResponsesClient } from './openai';
import { OpenRouterClient } from './openrouter';

export interface AITextClient {
    generate(prompt: string, systemPrompt?: string): Promise<string>;
}

export interface CreateAIClientOptions {
    apiKey: string;
    model: string;
    provider: AIProvider;
}

export function createAIClient({
    apiKey,
    model,
    provider
}: CreateAIClientOptions): AITextClient {
    if (provider === 'openai') {
        return new OpenAIResponsesClient(apiKey, model);
    }
    return new OpenRouterClient(apiKey, model, provider);
}
