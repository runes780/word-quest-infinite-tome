import type { AIProvider } from './modelOptions';

export interface OpenRouterMetricInput {
    provider: AIProvider;
    model: string;
    isFreeModel: boolean;
    outcome: 'success' | 'error' | 'timeout';
    attempts: number;
    retryCount: number;
    rateLimitHits: number;
    latencyMs: number;
    statusCode?: number;
    errorMessage?: string;
    timestamp?: number;
}

export async function logOpenRouterMetric(input: OpenRouterMetricInput): Promise<void> {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') return;
    try {
        const { logAIRequestMetric } = await import('@/db/db');
        await logAIRequestMetric({
            provider: input.provider,
            model: input.model,
            isFreeModel: input.isFreeModel,
            outcome: input.outcome,
            attempts: input.attempts,
            retryCount: input.retryCount,
            rateLimitHits: input.rateLimitHits,
            latencyMs: input.latencyMs,
            statusCode: input.statusCode,
            errorMessage: input.errorMessage,
            timestamp: input.timestamp
        });
    } catch (error) {
        console.error('logOpenRouterMetric error', error);
    }
}
