
export interface OpenRouterResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
    error?: {
        message: string;
        code?: string;
    };
}

// SSE streaming event interface
interface StreamDelta {
    choices?: {
        delta?: {
            content?: string;
        };
        finish_reason?: string;
    }[];
}

class RequestScheduler {
    private queue: Array<() => Promise<void>> = [];
    private isProcessing = false;
    private lastRequestTime: number;

    constructor(private minDelay: number) {
        this.lastRequestTime = Date.now() - minDelay;
    }

    enqueue(task: () => Promise<void>) {
        this.queue.push(task);
        this.processQueue();
    }

    private processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        const now = Date.now();
        const timeSinceLast = now - this.lastRequestTime;
        const waitMs = Math.max(0, this.minDelay - timeSinceLast);

        this.isProcessing = true;
        setTimeout(async () => {
            const nextTask = this.queue.shift();
            this.lastRequestTime = Date.now();

            try {
                if (nextTask) await nextTask();
            } catch (e) {
                console.error('[OpenRouter] Scheduler task error', e);
            } finally {
                this.isProcessing = false;
                this.processQueue();
            }
        }, waitMs);
    }
}

const sharedSchedulers = {
    free: new RequestScheduler(3500),
    paid: new RequestScheduler(100)
};

export class OpenRouterClient {
    private fetchTimeoutMs = 30000;
    private maxRetries: number;
    private isFreeModel: boolean;
    private scheduler: RequestScheduler;

    constructor(private apiKey: string, private model: string) {
        this.isFreeModel = model.endsWith(':free');
        this.scheduler = this.isFreeModel ? sharedSchedulers.free : sharedSchedulers.paid;
        // Free models need more retries due to rate limits
        this.maxRetries = this.isFreeModel ? 4 : 2;
        if (!this.isFreeModel) {
            this.fetchTimeoutMs = 20000;
        }
    }

    async generate(prompt: string, systemPrompt?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const task = async () => {
                let lastError: Error | null = null;

                for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
                    const controller = new AbortController();
                    let fetchTimeoutId: ReturnType<typeof setTimeout> | undefined;

                    try {
                        if (attempt > 0) {
                            const backoffMs = Math.pow(2, attempt) * 1000;
                            console.log(`[OpenRouter] Retry ${attempt}/${this.maxRetries} after ${backoffMs}ms`);
                            await new Promise(r => setTimeout(r, backoffMs));
                        }

                        console.log(`[OpenRouter] Sending streaming request to ${this.model}...`);

                        fetchTimeoutId = setTimeout(() => {
                            console.log(`[OpenRouter] Fetch timed out after ${this.fetchTimeoutMs / 1000}s`);
                            controller.abort();
                        }, this.fetchTimeoutMs);

                        const requestBody: Record<string, unknown> = {
                            model: this.model,
                            messages: [
                                ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
                                { role: "user", content: prompt },
                            ],
                            stream: true, // Enable streaming!
                        };

                        if (!this.isFreeModel) {
                            requestBody.response_format = { type: "json_object" };
                        }

                        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                            method: "POST",
                            headers: {
                                "Authorization": `Bearer ${this.apiKey}`,
                                "Content-Type": "application/json",
                                "HTTP-Referer": "https://wordquest.app",
                                "X-Title": "Word Quest",
                            },
                            body: JSON.stringify(requestBody),
                            signal: controller.signal
                        });

                        clearTimeout(fetchTimeoutId);
                        fetchTimeoutId = undefined;

                        console.log(`[OpenRouter] Response status: ${response.status}`);

                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error(`[OpenRouter] API Error: ${response.status} - ${errorText}`);

                            // Fatal errors - don't retry
                            if (response.status === 401 || response.status === 400) {
                                throw new Error(`OpenRouter API Error: ${response.status} - ${errorText}`);
                            }

                            // Rate limit - wait longer before retry
                            if (response.status === 429) {
                                const waitTime = this.isFreeModel ? 8000 + attempt * 5000 : 3000 + attempt * 2000;
                                console.log(`[OpenRouter] Rate limited (429). Waiting ${waitTime / 1000}s before retry...`);
                                await new Promise(r => setTimeout(r, waitTime));
                            }

                            lastError = new Error(`OpenRouter API Error: ${response.status} - ${errorText}`);
                            continue;
                        }

                        // Stream reading using ReadableStream
                        console.log(`[OpenRouter] Reading streaming response...`);

                        const reader = response.body?.getReader();
                        if (!reader) {
                            throw new Error('Response body is not readable');
                        }

                        const decoder = new TextDecoder();
                        let fullContent = '';
                        let buffer = '';
                        let chunkCount = 0;

                        while (true) {
                            const { done, value } = await reader.read();

                            if (done) {
                                console.log(`[OpenRouter] Stream complete. Total chunks: ${chunkCount}`);
                                break;
                            }

                            buffer += decoder.decode(value, { stream: true });

                            // SSE format: "data: {...}\n\n"
                            const lines = buffer.split('\n');
                            buffer = lines.pop() || ''; // Keep incomplete line in buffer

                            for (const line of lines) {
                                const trimmed = line.trim();
                                if (!trimmed || trimmed === 'data: [DONE]') continue;

                                if (trimmed.startsWith('data: ')) {
                                    try {
                                        const json = JSON.parse(trimmed.slice(6)) as StreamDelta;
                                        const deltaContent = json.choices?.[0]?.delta?.content;
                                        if (deltaContent) {
                                            fullContent += deltaContent;
                                            chunkCount++;

                                            // Log progress every 10 chunks
                                            if (chunkCount % 10 === 0) {
                                                console.log(`[OpenRouter] Received ${chunkCount} chunks, ${fullContent.length} chars...`);
                                            }
                                        }
                                    } catch {
                                        // Skip malformed JSON
                                    }
                                }
                            }
                        }

                        if (!fullContent) {
                            console.warn(`[OpenRouter] Empty response received`);
                            lastError = new Error('OpenRouter returned empty response');
                            continue;
                        }

                        console.log(`[OpenRouter] Success! Total: ${fullContent.length} chars`);
                        resolve(fullContent);
                        return;
                    } catch (error) {
                        const err = error as Error;
                        if (err.name === 'AbortError') {
                            lastError = new Error(`Request aborted (fetch timeout). The model may be overloaded.`);
                        } else {
                            console.error(`[OpenRouter] Error:`, err.message);
                            lastError = err;
                        }
                    } finally {
                        if (fetchTimeoutId) clearTimeout(fetchTimeoutId);
                    }
                }

                reject(lastError || new Error('Unknown error occurred'));
            };

            this.scheduler.enqueue(task);
        });
    }
}
