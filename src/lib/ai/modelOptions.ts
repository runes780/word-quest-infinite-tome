export interface RouterModelOption {
    id: string;
    name: string;
    pricing?: {
        prompt: string;
        completion: string;
    };
}

export const PINNED_MODEL_OPTIONS: RouterModelOption[] = [
    { id: 'deepseek/deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
    { id: 'deepseek/deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
    { id: 'deepseek/deepseek-chat', name: 'DeepSeek V3' },
    { id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash' },
    { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
    { id: 'meta-llama/llama-3-8b-instruct:free', name: 'Llama 3 8B (Free)' }
];

export function buildModelOptions(
    remoteModels: RouterModelOption[],
    freeOnly: boolean
): RouterModelOption[] {
    const options = [...PINNED_MODEL_OPTIONS, ...remoteModels];
    const deduped = new Map<string, RouterModelOption>();

    options.forEach((option) => {
        if (freeOnly && !option.id.endsWith(':free')) return;
        if (!deduped.has(option.id)) {
            deduped.set(option.id, option);
        }
    });

    return Array.from(deduped.values());
}
