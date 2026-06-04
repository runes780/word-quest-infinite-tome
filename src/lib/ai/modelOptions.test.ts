import { buildModelOptions } from './modelOptions';

describe('model options', () => {
    test('offers DeepSeek choices before the remote model list is loaded', () => {
        const options = buildModelOptions([], false);

        expect(options).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 'deepseek/deepseek-v4-flash',
                name: 'DeepSeek V4 Flash'
            }),
            expect.objectContaining({
                id: 'deepseek/deepseek-v4-pro',
                name: 'DeepSeek V4 Pro'
            }),
            expect.objectContaining({
                id: 'deepseek/deepseek-chat',
                name: 'DeepSeek V3'
            })
        ]));
    });

    test('deduplicates pinned models when OpenRouter returns the same id', () => {
        const options = buildModelOptions([
            {
                id: 'deepseek/deepseek-v4-flash',
                name: 'DeepSeek: DeepSeek V4 Flash',
                pricing: { prompt: '0.0983', completion: '0.1966' }
            }
        ], false);

        expect(options.filter((option) => option.id === 'deepseek/deepseek-v4-flash')).toHaveLength(1);
    });
});
