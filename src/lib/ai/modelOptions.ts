export interface RouterModelOption {
    id: string;
    name: string;
    pricing?: {
        prompt: string;
        completion: string;
    };
}

export type AIProvider = 'deepseek' | 'openrouter';

export const DEEPSEEK_MODEL_OPTIONS: RouterModelOption[] = [
    { id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
    { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' }
];

export const OPENROUTER_PINNED_MODEL_OPTIONS: RouterModelOption[] = [
    { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
    { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
    { id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash' },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
    { id: 'meta-llama/llama-3-8b-instruct:free', name: 'Llama 3 8B (Free)' }
];

interface BuildModelOptionsInput {
    provider: AIProvider;
    remoteModels: RouterModelOption[],
    freeOnly: boolean;
}

export function getDefaultModelForProvider(provider: AIProvider): string {
    return provider === 'deepseek' ? 'deepseek-v4-flash' : 'google/gemini-flash-1.5';
}

export function isModelAvailableForProvider(provider: AIProvider, model: string): boolean {
    if (provider === 'deepseek') {
        return DEEPSEEK_MODEL_OPTIONS.some((option) => option.id === model);
    }

    return model.includes('/');
}

export function buildModelOptions({
    provider,
    remoteModels,
    freeOnly
}: BuildModelOptionsInput): RouterModelOption[] {
    const options = provider === 'deepseek'
        ? DEEPSEEK_MODEL_OPTIONS
        : [...OPENROUTER_PINNED_MODEL_OPTIONS, ...remoteModels];
    const deduped = new Map<string, RouterModelOption>();

    options.forEach((option) => {
        if (provider === 'openrouter' && freeOnly && !option.id.endsWith(':free')) return;
        if (!deduped.has(option.id)) {
            deduped.set(option.id, option);
        }
    });

    return Array.from(deduped.values());
}
