import { buildModelOptions, getDefaultModelForProvider } from './modelOptions';

describe('model options', () => {
    test('defaults official DeepSeek to V4 Flash', () => {
        expect(getDefaultModelForProvider('deepseek')).toBe('deepseek-v4-flash');
    });

    test('offers official DeepSeek choices before the remote model list is loaded', () => {
        const options = buildModelOptions({
            provider: 'deepseek',
            remoteModels: [],
            freeOnly: false
        });

        expect(options).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'deepseek-v4-flash',
                name: 'DeepSeek V4 Flash'
            }),
            expect.objectContaining({
                id: 'deepseek-v4-pro',
                name: 'DeepSeek V4 Pro'
            })
        ]));
    });

    test('deduplicates pinned models when OpenRouter returns the same id', () => {
        const options = buildModelOptions({
            provider: 'openrouter',
            remoteModels: [
                {
                    id: 'deepseek/deepseek-v4-flash',
                    name: 'DeepSeek: DeepSeek V4 Flash',
                    pricing: { prompt: '0.0983', completion: '0.1966' }
                }
            ],
            freeOnly: false
        });

        expect(options.filter((option) => option.id === 'deepseek/deepseek-v4-flash')).toHaveLength(1);
    });
});
