import { useEffect, useState } from 'react';
import type { Monster } from '@/store/gameStore';
import { OpenRouterClient } from '@/lib/ai/openrouter';
import { LEVEL_GENERATOR_SYSTEM_PROMPT, generateLevelPrompt } from '@/lib/ai/prompts';
import { normalizeMissionMonsters } from '@/lib/data/missionSanitizer';

interface UseEndlessWaveParams {
    apiKey: string;
    model: string;
    context: string;
    currentIndex: number;
    questionsLength: number;
    playerLevel: number;
    addQuestions: (questions: Monster[]) => void;
}

function extractJsonObject(raw: string): Record<string, unknown> {
    let cleanJson = raw.replace(/```json\n?|\n?```/g, '').trim();
    const firstBrace = cleanJson.indexOf('{');
    if (firstBrace === -1) {
        throw new Error('No JSON object found');
    }

    let braceCount = 0;
    let lastBrace = -1;
    for (let i = firstBrace; i < cleanJson.length; i++) {
        if (cleanJson[i] === '{') braceCount++;
        if (cleanJson[i] === '}') braceCount--;
        if (braceCount === 0) {
            lastBrace = i;
            break;
        }
    }

    if (lastBrace === -1) {
        throw new Error('Malformed JSON');
    }

    cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
    return JSON.parse(cleanJson) as Record<string, unknown>;
}

function mapCachedQuestionToMonster(item: {
    id?: number;
    type?: string;
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
    hint?: string;
    skillTag?: string;
}): Monster {
    return {
        id: item.id || Date.now(),
        type: item.type === 'grammar' || item.type === 'reading' ? item.type : 'vocab',
        question: item.question,
        options: item.options,
        correct_index: item.correct_index,
        explanation: item.explanation,
        hint: item.hint,
        skillTag: item.skillTag || 'vocab_core',
        difficulty: 'easy',
        questionMode: 'choice',
        correctAnswer: item.options[item.correct_index] || ''
    };
}

function mapFallbackQuestionToMonster(item: {
    id: number;
    type: 'vocab' | 'grammar' | 'reading';
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
    hint?: string;
    skillTag: string;
}): Monster {
    return {
        id: item.id,
        type: item.type,
        question: item.question,
        options: item.options,
        correct_index: item.correct_index,
        explanation: item.explanation,
        hint: item.hint,
        skillTag: item.skillTag,
        difficulty: 'easy',
        questionMode: 'choice',
        correctAnswer: item.options[item.correct_index] || ''
    };
}

export function useEndlessWave({
    apiKey,
    model,
    context,
    currentIndex,
    questionsLength,
    playerLevel,
    addQuestions
}: UseEndlessWaveParams) {
    const [isGeneratingMore, setIsGeneratingMore] = useState(false);

    useEffect(() => {
        const shouldGenerate = questionsLength > 0 && currentIndex >= questionsLength - 2;
        if (!shouldGenerate || isGeneratingMore || !apiKey || !context) return;

        const generateMoreQuestions = async () => {
            setIsGeneratingMore(true);

            const { cacheQuestions, getCachedQuestions, hashContext } = await import('@/db/db');
            const { getRandomFallbackQuestions } = await import('@/lib/data/fallbackQuestions');
            const contextHash = hashContext(context);

            try {
                const client = new OpenRouterClient(apiKey, model);
                const prompt = generateLevelPrompt(
                    `${context}\n\n(Player is Level ${playerLevel}. Generate a new wave of challengers!)`
                );
                const jsonStr = await client.generate(prompt, LEVEL_GENERATOR_SYSTEM_PROMPT);
                const data = extractJsonObject(jsonStr);

                if (Array.isArray(data.monsters)) {
                    const normalizedWave = normalizeMissionMonsters(data.monsters);
                    if (normalizedWave.length === 0) {
                        throw new Error('Generated mission has no valid questions');
                    }

                    try {
                        const questionsToCache = normalizedWave.map((monster) => ({
                            question: monster.question,
                            options: monster.options,
                            correct_index: monster.correct_index,
                            type: monster.type,
                            explanation: monster.explanation,
                            hint: monster.hint,
                            skillTag: monster.skillTag,
                            contextHash,
                            timestamp: Date.now(),
                            used: false
                        }));
                        await cacheQuestions(questionsToCache);
                        console.log(`[Cache] Saved ${questionsToCache.length} questions`);
                    } catch (cacheError) {
                        console.warn('[Cache] Failed to cache questions:', cacheError);
                    }

                    setTimeout(() => addQuestions(normalizedWave), 500);
                }
            } catch (error) {
                console.error('API failed, trying cache/fallback', error);
                const cached = await getCachedQuestions(contextHash, 5);

                if (cached.length > 0) {
                    console.log(`[Cache] Using ${cached.length} cached questions`);
                    const normalizedCached = normalizeMissionMonsters(cached.map(mapCachedQuestionToMonster));
                    setTimeout(() => addQuestions(normalizedCached), 500);
                } else {
                    console.log('[Fallback] Using local question bank');
                    const fallback = getRandomFallbackQuestions(5, 'easy');
                    const normalizedFallback = normalizeMissionMonsters(fallback.map(mapFallbackQuestionToMonster));
                    setTimeout(() => addQuestions(normalizedFallback), 500);
                }
            } finally {
                setIsGeneratingMore(false);
            }
        };

        generateMoreQuestions();
    }, [currentIndex, questionsLength, isGeneratingMore, context, apiKey, model, addQuestions, playerLevel]);

    return { isGeneratingMore };
}
