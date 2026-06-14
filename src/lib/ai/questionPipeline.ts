import type { AIProvider } from './modelOptions';
import { OpenRouterClient } from './openrouter';
import { analyzeMaterialProfile } from './materialProfile';
import {
    PLAN_SYSTEM_PROMPT,
    CRITIC_SYSTEM_PROMPT,
    LEVEL_GENERATOR_SYSTEM_PROMPT,
    generatePlanPrompt,
    generateLevelFromPlanPrompt,
    generateCriticPrompt,
    generateLevelPrompt
} from './prompts';
import {
    validateQuestionPlan,
    type QuestionPlan,
    type QuestionPlanItem
} from '@/lib/data/questionPlan';
import { assessQuestionQuality } from '@/lib/data/questionQuality';
import { normalizeMissionMonsters } from '@/lib/data/missionSanitizer';
import type { Monster } from '@/store/gameStore';

/** Minimal LLM interface so tests can inject a fake client. */
export interface LlmClient {
    generate(prompt: string, systemPrompt?: string): Promise<string>;
}

export interface QuestionPipelineOptions {
    /** Provide `client` (test/fake) OR apiKey+model+provider (production). */
    client?: LlmClient;
    apiKey?: string;
    model?: string;
    apiProvider?: AIProvider;
    criticModel?: string;
    learnerLevel?: number;
    criticEnabled?: boolean;
    maxRepairAttempts?: number;
    material: string;
}

export interface CriticVerdict {
    id: number;
    pass: boolean;
    axisFailures: string[];
    offendingWords: string[];
    reason: string;
    suggestedFix: string;
}
export interface CriticReport {
    verdicts: CriticVerdict[];
}

export type DegradedPath = 'none' | 'planner_failed' | 'legacy_single_stage' | 'fallback_bank';

export interface QuestionPipelineResult {
    monsters: Monster[];
    plan?: QuestionPlan;
    criticReport?: CriticReport;
    degradedPath: DegradedPath;
}

function parseJson(raw: string): unknown | null {
    try {
        return JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
        return null;
    }
}

export async function generateQuestionPack(
    text: string,
    opts: QuestionPipelineOptions
): Promise<QuestionPipelineResult> {
    const mainClient: LlmClient = opts.client
        ?? new OpenRouterClient(opts.apiKey as string, opts.model as string, opts.apiProvider);
    const criticClient: LlmClient = opts.client
        ?? new OpenRouterClient(opts.apiKey as string, opts.criticModel ?? (opts.model as string), opts.apiProvider);

    const profile = analyzeMaterialProfile(text);

    // --- Stage 1: plan ---
    let planValidated: QuestionPlan | null = null;
    try {
        const planRaw = await mainClient.generate(generatePlanPrompt(text, profile), PLAN_SYSTEM_PROMPT);
        const parsed = parseJson(planRaw) as QuestionPlan | null;
        if (parsed) {
            const validation = validateQuestionPlan(parsed, text, profile.vocabulary.allowed);
            planValidated = validation.valid ? parsed : null;
        }
    } catch {
        planValidated = null;
    }

    if (!planValidated) {
        // Degrade: legacy single-stage generation.
        try {
            const legacyRaw = await mainClient.generate(
                generateLevelPrompt(text, { learnerLevel: opts.learnerLevel }),
                LEVEL_GENERATOR_SYSTEM_PROMPT
            );
            const parsed = parseJson(legacyRaw) as { monsters?: unknown[] } | null;
            const monsters = normalizeMissionMonsters(parsed?.monsters ?? [], { sourceText: text });
            return { monsters, degradedPath: 'planner_failed' };
        } catch {
            return { monsters: [], degradedPath: 'fallback_bank' };
        }
    }

    const plan: QuestionPlan = planValidated; // const, so narrowing survives awaits

    // --- Stage 2: generate ---
    let genRaw: string;
    try {
        genRaw = await mainClient.generate(generateLevelFromPlanPrompt(plan), LEVEL_GENERATOR_SYSTEM_PROMPT);
    } catch {
        return { monsters: [], plan, degradedPath: 'fallback_bank' };
    }
    const genParsed = parseJson(genRaw) as { monsters?: unknown[] } | null;
    // Task 7 uses only the existing { sourceText } sanitizer option (compiles today).
    // Task 9 will swap in the rich { allowedSet, material, plan } options.
    const monsters = normalizeMissionMonsters(genParsed?.monsters ?? [], { sourceText: text });

    // --- Stage 3: critique + repair ---
    let criticReport: CriticReport | undefined;
    if (opts.criticEnabled !== false) {
        try {
            const criticRaw = await criticClient.generate(
                generateCriticPrompt(text, plan.items, [{ levelTitle: plan.levelTitle, monsters }]),
                CRITIC_SYSTEM_PROMPT
            );
            criticReport = (parseJson(criticRaw) as CriticReport | null) ?? { verdicts: [] };
        } catch {
            criticReport = { verdicts: [] };
        }

        if (criticReport.verdicts.some((v) => !v.pass)) {
            const maxAttempts = opts.maxRepairAttempts ?? 2;
            for (const verdict of criticReport.verdicts) {
                if (verdict.pass) continue;
                const idx = monsters.findIndex((m) => m.id === verdict.id);
                if (idx === -1) continue;
                let repaired = false;
                const fallbackItem: QuestionPlanItem = plan.items[idx] ?? plan.items[0];
                for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
                    try {
                        const fixPrompt =
                            generateLevelFromPlanPrompt({ ...plan, items: [fallbackItem] }) +
                            `\n# Previous attempt rejected. Offending words: ${verdict.offendingWords.join(', ')}. Fix: ${verdict.suggestedFix}`;
                        const fixRaw = await mainClient.generate(fixPrompt, LEVEL_GENERATOR_SYSTEM_PROMPT);
                        const fixedParsed = parseJson(fixRaw) as { monsters?: unknown[] } | null;
                        const fixed = normalizeMissionMonsters(fixedParsed?.monsters ?? [], { sourceText: text });
                        const candidate = fixed[0];
                        if (candidate && assessQuestionQuality(candidate, {
                            maxDifficulty: profile.maxQuestionDifficulty,
                            allowedSet: profile.vocabulary.allowed,
                            material: text,
                            target: fallbackItem.target
                        }).accepted) {
                            monsters[idx] = candidate;
                            repaired = true;
                            break;
                        }
                    } catch {
                        // try again
                    }
                }
                if (!repaired) {
                    (monsters[idx] as Monster & { lowConfidence?: boolean }).lowConfidence = true;
                }
            }
        }
    }

    return { monsters, plan, criticReport, degradedPath: 'none' };
}
