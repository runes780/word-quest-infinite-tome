import { logAIProviderMetric } from './metrics';

interface OpenAIResponseContent {
    type?: string;
    text?: string;
}

interface OpenAIResponseOutput {
    type?: string;
    content?: OpenAIResponseContent[];
}

interface OpenAIResponseBody {
    output_text?: string;
    output?: OpenAIResponseOutput[];
    error?: { message?: string };
}

export interface OpenAIClientOptions {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
    maxRetries?: number;
}

function extractOutputText(body: OpenAIResponseBody): string {
    if (typeof body.output_text === 'string' && body.output_text.trim()) {
        return body.output_text;
    }

    return (body.output ?? [])
        .flatMap((item) => item.type === 'message' ? (item.content ?? []) : [])
        .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
        .map((item) => item.text as string)
        .join('')
        .trim();
}

/** OpenAI Responses API adapter used only through the provider factory. */
export class OpenAIResponsesClient {
    private readonly fetchImpl?: typeof fetch;
    private readonly timeoutMs: number;
    private readonly maxRetries: number;

    constructor(
        private readonly apiKey: string,
        private readonly model: string,
        options: OpenAIClientOptions = {}
    ) {
        this.fetchImpl = options.fetchImpl;
        this.timeoutMs = options.timeoutMs ?? 30000;
        this.maxRetries = options.maxRetries ?? 1;
    }

    async generate(prompt: string, systemPrompt?: string): Promise<string> {
        const requestStartedAt = Date.now();
        let attempts = 0;
        let rateLimitHits = 0;
        let lastStatusCode: number | undefined;
        let lastError = new Error('OpenAI returned no response');
        const fetchImpl = this.fetchImpl ?? globalThis.fetch;
        if (!fetchImpl) throw new Error('Fetch API is unavailable');

        for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
            if (attempt > 0) {
                await new Promise((resolve) => setTimeout(resolve, 1000 * (2 ** (attempt - 1))));
            }

            attempts += 1;
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

            try {
                const response = await fetchImpl('https://api.openai.com/v1/responses', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: this.model,
                        ...(systemPrompt ? { instructions: systemPrompt } : {}),
                        input: prompt,
                        max_output_tokens: 4096,
                        store: false,
                        text: { format: { type: 'json_object' } }
                    }),
                    signal: controller.signal
                });
                lastStatusCode = response.status;
                const body = await response.json() as OpenAIResponseBody;

                if (!response.ok) {
                    lastError = new Error(`OpenAI API Error: ${response.status} - ${body.error?.message ?? 'Request failed'}`);
                    if (response.status === 429) rateLimitHits += 1;
                    if (response.status === 400 || response.status === 401 || response.status === 403) break;
                    continue;
                }

                const content = extractOutputText(body);
                if (!content) {
                    lastError = new Error('OpenAI returned empty response');
                    continue;
                }

                void logAIProviderMetric({
                    provider: 'openai',
                    model: this.model,
                    isFreeModel: false,
                    outcome: 'success',
                    attempts,
                    retryCount: Math.max(0, attempts - 1),
                    rateLimitHits,
                    latencyMs: Math.max(0, Date.now() - requestStartedAt),
                    statusCode: lastStatusCode
                });
                return content;
            } catch (error) {
                const caught = error as Error;
                lastError = caught.name === 'AbortError'
                    ? new Error('OpenAI request timed out')
                    : caught;
            } finally {
                clearTimeout(timeoutId);
            }
        }

        void logAIProviderMetric({
            provider: 'openai',
            model: this.model,
            isFreeModel: false,
            outcome: lastError.message.includes('timed out') ? 'timeout' : 'error',
            attempts,
            retryCount: Math.max(0, attempts - 1),
            rateLimitHits,
            latencyMs: Math.max(0, Date.now() - requestStartedAt),
            statusCode: lastStatusCode,
            errorMessage: lastError.message
        });
        throw lastError;
    }
}
