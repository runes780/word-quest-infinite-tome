import { logAIProviderMetric } from './metrics';
import { OpenAIResponsesClient } from './openai';

jest.mock('./metrics', () => ({
    logAIProviderMetric: jest.fn(async () => undefined)
}));

function response(body: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => body
    } as Response;
}

describe('OpenAIResponsesClient', () => {
    beforeEach(() => {
        jest.mocked(logAIProviderMetric).mockClear();
    });

    test('uses the official Responses endpoint and privacy-minimizing JSON request', async () => {
        const fetchImpl = jest.fn(async () => response({ output_text: '{"monsters":[]}' }));
        const client = new OpenAIResponsesClient('synthetic-key', 'gpt-5.6-luna', {
            fetchImpl: fetchImpl as unknown as typeof fetch,
            maxRetries: 0
        });

        await expect(client.generate('synthetic study text', 'return JSON')).resolves.toBe('{"monsters":[]}');

        expect(fetchImpl).toHaveBeenCalledWith(
            'https://api.openai.com/v1/responses',
            expect.objectContaining({
                method: 'POST',
                headers: {
                    Authorization: 'Bearer synthetic-key',
                    'Content-Type': 'application/json'
                }
            })
        );
        const request = fetchImpl.mock.calls[0][1] as RequestInit;
        expect(JSON.parse(request.body as string)).toEqual({
            model: 'gpt-5.6-luna',
            instructions: 'return JSON',
            input: 'synthetic study text',
            max_output_tokens: 4096,
            store: false,
            text: { format: { type: 'json_object' } }
        });
        expect(logAIProviderMetric).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'openai',
            outcome: 'success'
        }));
    });

    test('extracts raw API output_text content from message output', async () => {
        const fetchImpl = jest.fn(async () => response({
            output: [{
                type: 'message',
                content: [{ type: 'output_text', text: '{"ok":true}' }]
            }]
        }));
        const client = new OpenAIResponsesClient('synthetic-key', 'gpt-5.6', {
            fetchImpl: fetchImpl as unknown as typeof fetch,
            maxRetries: 0
        });

        await expect(client.generate('synthetic input')).resolves.toBe('{"ok":true}');
    });

    test('does not retry invalid credentials', async () => {
        const fetchImpl = jest.fn(async () => response({
            error: { message: 'invalid synthetic credential' }
        }, 401));
        const client = new OpenAIResponsesClient('synthetic-key', 'gpt-5.6-luna', {
            fetchImpl: fetchImpl as unknown as typeof fetch
        });

        await expect(client.generate('synthetic input')).rejects.toThrow(/401/);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
        expect(logAIProviderMetric).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'openai',
            outcome: 'error',
            attempts: 1
        }));
    });

    test('rejects an empty or malformed success so callers can use local fallback', async () => {
        const fetchImpl = jest.fn(async () => response({ output: [] }));
        const client = new OpenAIResponsesClient('synthetic-key', 'gpt-5.6-luna', {
            fetchImpl: fetchImpl as unknown as typeof fetch,
            maxRetries: 0
        });

        await expect(client.generate('synthetic input')).rejects.toThrow('empty response');
    });
});
