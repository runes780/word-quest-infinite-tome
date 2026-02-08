import { OpenRouterClient } from './openrouter';
import { TextDecoder, TextEncoder } from 'util';

global.fetch = jest.fn();
(global as unknown as { TextDecoder: typeof TextDecoder; TextEncoder: typeof TextEncoder; }).TextDecoder = TextDecoder;
(global as unknown as { TextDecoder: typeof TextDecoder; TextEncoder: typeof TextEncoder; }).TextEncoder = TextEncoder;

function createStreamingResponse(content: string) {
    const payload = `data: {"choices":[{"delta":{"content":"${content}"}}]}\n\ndata: [DONE]\n\n`;
    const chunk = Uint8Array.from(Buffer.from(payload, 'utf-8'));
    let emitted = false;

    return {
        ok: true,
        status: 200,
        body: {
            getReader: () => ({
                read: async () => {
                    if (!emitted) {
                        emitted = true;
                        return { done: false, value: chunk };
                    }
                    return { done: true, value: undefined };
                }
            })
        },
        text: async () => ''
    };
}

describe('OpenRouterClient shared scheduler', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date('2026-01-01T00:00:00Z'));
        (global.fetch as jest.Mock).mockReset();
        (global.fetch as jest.Mock).mockImplementation(() => Promise.resolve(createStreamingResponse('ok')));
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('free models are globally throttled', async () => {
        const first = new OpenRouterClient('test-key', 'meta-llama/llama-3-8b-instruct:free');
        const second = new OpenRouterClient('test-key', 'meta-llama/llama-3-8b-instruct:free');

        const p1 = first.generate('prompt-1');
        const p2 = second.generate('prompt-2');

        await jest.advanceTimersByTimeAsync(1);
        expect(global.fetch).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(3600);
        expect(global.fetch).toHaveBeenCalledTimes(2);

        await expect(p1).resolves.toContain('ok');
        await expect(p2).resolves.toContain('ok');
    });

    test('paid models use short scheduler delay', async () => {
        const client = new OpenRouterClient('test-key', 'anthropic/claude-3-opus');

        const p1 = client.generate('prompt-a');
        const p2 = client.generate('prompt-b');

        await jest.advanceTimersByTimeAsync(1);
        expect(global.fetch).toHaveBeenCalledTimes(1);

        await jest.advanceTimersByTimeAsync(220);
        expect(global.fetch).toHaveBeenCalledTimes(2);

        await expect(p1).resolves.toContain('ok');
        await expect(p2).resolves.toContain('ok');
    });
});
