
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

export class OpenRouterClient {
    private queue: (() => Promise<void>)[] = [];
    private isProcessing = false;
    private lastRequestTime = 0;
    private minDelay = 3500; // Default to ~17 RPM for free tier
    private fetchTimeoutMs = 30000; // 30s to get a response status
    private bodyTimeoutMs = 120000; // 120s to read the full body (streaming can be slow)
    private maxRetries = 1; // Reduced to prevent excessive API calls
    private isFreeModel: boolean;

    constructor(private apiKey: string, private model: string) {
        this.isFreeModel = model.endsWith(':free');
        if (!this.isFreeModel) {
            this.minDelay = 100;
            this.fetchTimeoutMs = 20000;
            this.bodyTimeoutMs = 60000;
        }
    }

    private async processQueue() {
        if (this.isProcessing || this.queue.length === 0) return;

        const now = Date.now();
        const timeSinceLast = now - this.lastRequestTime;

        if (timeSinceLast < this.minDelay) {
            setTimeout(() => this.processQueue(), this.minDelay - timeSinceLast);
            return;
        }

        this.isProcessing = true;
        const task = this.queue.shift();
        this.lastRequestTime = Date.now();

        try {
            if (task) await task();
        } catch (e) {
            console.error("Queue processing error", e);
        } finally {
            this.isProcessing = false;
            this.processQueue();
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

                        console.log(`[OpenRouter] Sending request to ${this.model}...`);

                        // Timeout for the initial fetch (getting response headers)
                        fetchTimeoutId = setTimeout(() => {
                            console.log(`[OpenRouter] Fetch timed out after ${this.fetchTimeoutMs / 1000}s`);
                            controller.abort();
                        }, this.fetchTimeoutMs);

                        // Build request body - DON'T use response_format for free models
                        const requestBody: Record<string, unknown> = {
                            model: this.model,
                            messages: [
                                ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
                                { role: "user", content: prompt },
                            ],
                        };

                        // Only add response_format for paid models that support it
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

                        // Clear fetch timeout immediately after getting response
                        clearTimeout(fetchTimeoutId);
                        fetchTimeoutId = undefined;

                        console.log(`[OpenRouter] Response status: ${response.status}`);

                        if (!response.ok) {
                            const errorText = await response.text();
                            console.error(`[OpenRouter] API Error: ${response.status} - ${errorText}`);
                            if (response.status === 401 || response.status === 400) {
                                throw new Error(`OpenRouter API Error: ${response.status} - ${errorText}`);
                            }
                            lastError = new Error(`OpenRouter API Error: ${response.status} - ${errorText}`);
                            continue;
                        }

                        // Read the body with a separate, longer timeout using Promise.race
                        console.log(`[OpenRouter] Reading response body (timeout: ${this.bodyTimeoutMs / 1000}s)...`);

                        const bodyPromise = response.text(); // Use text() first, then parse
                        const timeoutPromise = new Promise<never>((_, reject) => {
                            setTimeout(() => reject(new Error('Body read timed out')), this.bodyTimeoutMs);
                        });

                        const bodyText = await Promise.race([bodyPromise, timeoutPromise]);

                        console.log(`[OpenRouter] Received ${bodyText.length} chars, parsing JSON...`);

                        let data: OpenRouterResponse;
                        try {
                            data = JSON.parse(bodyText) as OpenRouterResponse;
                        } catch (parseError) {
                            console.error(`[OpenRouter] JSON parse error:`, bodyText.substring(0, 200));
                            throw new Error(`Failed to parse response: ${(parseError as Error).message}`);
                        }

                        // Check for API-level errors in the response
                        if (data.error) {
                            console.error(`[OpenRouter] Response error:`, data.error);
                            throw new Error(`OpenRouter Error: ${data.error.message}`);
                        }

                        const content = data.choices?.[0]?.message?.content || "";
                        if (!content) {
                            console.warn(`[OpenRouter] Empty response received`);
                            lastError = new Error('OpenRouter returned empty response');
                            continue;
                        }

                        console.log(`[OpenRouter] Success! Content length: ${content.length} chars`);
                        resolve(content);
                        return;
                    } catch (error) {
                        const err = error as Error;
                        if (err.name === 'AbortError') {
                            lastError = new Error(`Request aborted (fetch timeout). The model may be overloaded.`);
                        } else if (err.message === 'Body read timed out') {
                            lastError = new Error(`Response body read timed out after ${this.bodyTimeoutMs / 1000}s. Try a faster model.`);
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

            this.queue.push(task);
            this.processQueue();
        });
    }
}
