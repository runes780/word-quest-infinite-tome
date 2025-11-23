
export interface OpenRouterResponse {
    choices: {
        message: {
            content: string;
        };
    }[];
}

export class OpenRouterClient {
    private queue: (() => Promise<void>)[] = [];
    private isProcessing = false;
    private lastRequestTime = 0;
    private minDelay = 3500; // Default to ~17 RPM for free tier

    constructor(private apiKey: string, private model: string) {
        // User Requirement: Only limit rate for free models.
        // Free models on OpenRouter typically end with ":free".
        if (!model.endsWith(':free')) {
            this.minDelay = 50; // Negligible delay for paid models
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
                try {
                    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${this.apiKey}`,
                            "Content-Type": "application/json",
                            "HTTP-Referer": "https://wordquest.app", // Optional
                            "X-Title": "Word Quest", // Optional
                        },
                        body: JSON.stringify({
                            model: this.model,
                            messages: [
                                ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
                                { role: "user", content: prompt },
                            ],
                            response_format: { type: "json_object" }, // Force JSON if supported
                        }),
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`OpenRouter API Error: ${response.status} - ${errorText}`);
                    }

                    const data = (await response.json()) as OpenRouterResponse;
                    const content = data.choices[0]?.message?.content || "";
                    resolve(content);
                } catch (error) {
                    reject(error);
                }
            };

            this.queue.push(task);
            this.processQueue();
        });
    }
}
