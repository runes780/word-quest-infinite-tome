import type { AIProvider } from './modelOptions';
import { createAIClient, type AITextClient } from './providerClient';
import { analyzeMaterialProfile } from './materialProfile';
import type { MaterialProfile } from './materialProfile';
import {
    PLAN_SYSTEM_PROMPT,
    CRITIC_SYSTEM_PROMPT,
    LEVEL_GENERATOR_SYSTEM_PROMPT,
    PLAN_BOUND_GENERATOR_SYSTEM_PROMPT,
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
import { fallbackToMonster, getBalancedFallbackQuestions } from '@/lib/data/fallbackQuestions';
import type { Monster } from '@/store/gameStore';

/** Minimal LLM interface so tests can inject a fake client. */
export type LlmClient = AITextClient;

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

export type DegradedPath = 'none' | 'legacy_single_stage' | 'fallback_bank';

export interface QuestionPipelineResult {
    monsters: Monster[];
    plan?: QuestionPlan;
    criticReport?: CriticReport;
    degradedPath: DegradedPath;
}

const FALLBACK_PACK_SIZE = 6;

function parseJson(raw: string): unknown | null {
    try {
        return JSON.parse(raw.replace(/```json\n?|\n?```/g, '').trim());
    } catch {
        return null;
    }
}

function normalizeCriticReport(value: unknown): CriticReport {
    if (!value || typeof value !== 'object') return { verdicts: [] };
    const verdicts = (value as { verdicts?: unknown }).verdicts;
    if (!Array.isArray(verdicts)) return { verdicts: [] };

    return {
        verdicts: verdicts.flatMap((candidate): CriticVerdict[] => {
            if (!candidate || typeof candidate !== 'object') return [];
            const raw = candidate as Record<string, unknown>;
            if (!Number.isFinite(raw.id) || typeof raw.pass !== 'boolean') return [];
            return [{
                id: Number(raw.id),
                pass: raw.pass,
                axisFailures: Array.isArray(raw.axisFailures)
                    ? raw.axisFailures.filter((item): item is string => typeof item === 'string')
                    : [],
                offendingWords: Array.isArray(raw.offendingWords)
                    ? raw.offendingWords.filter((item): item is string => typeof item === 'string')
                    : [],
                reason: typeof raw.reason === 'string' ? raw.reason : '',
                suggestedFix: typeof raw.suggestedFix === 'string' ? raw.suggestedFix : ''
            }];
        })
    };
}

function buildFallbackPack(profile: MaterialProfile, count = FALLBACK_PACK_SIZE): Monster[] {
    const fallbackQuestions = getBalancedFallbackQuestions(count, profile.maxQuestionDifficulty);
    if (fallbackQuestions.length === 0) return [];

    return Array.from({ length: count }, (_, index) =>
        fallbackToMonster(fallbackQuestions[index % fallbackQuestions.length], index + 1)
    );
}

function replaceWithFallbacks(
    monsters: Monster[],
    indices: number[],
    profile: MaterialProfile
): void {
    if (indices.length === 0) return;
    const replacements = getBalancedFallbackQuestions(
        Math.max(indices.length, FALLBACK_PACK_SIZE),
        profile.maxQuestionDifficulty
    );
    if (replacements.length === 0) return;

    indices.forEach((index, replacementIndex) => {
        const currentId = monsters[index]?.id ?? index + 1;
        monsters[index] = fallbackToMonster(
            replacements[replacementIndex % replacements.length],
            currentId
        );
    });
}

function findPlanItem(plan: QuestionPlan, monster: Monster, fallbackIndex: number): QuestionPlanItem | undefined {
    const exactMatch = plan.items.find((item) =>
        item.learningObjectiveId === monster.learningObjectiveId &&
        item.sourceSpan === monster.sourceContextSpan
    );
    if (exactMatch) return exactMatch;

    const oneBasedIndex = Number.isInteger(monster.id) ? Number(monster.id) - 1 : -1;
    if (oneBasedIndex >= 0 && oneBasedIndex < plan.items.length) {
        return plan.items[oneBasedIndex];
    }
    return plan.items[fallbackIndex];
}

function enforceDeterministicQuality(
    monsters: Monster[],
    profile: MaterialProfile,
    material: string,
    plan?: QuestionPlan
): Monster[] {
    const desiredCount = plan
        ? Math.min(8, Math.max(FALLBACK_PACK_SIZE, plan.items.length))
        : FALLBACK_PACK_SIZE;
    const safe = monsters.slice(0, desiredCount);
    const rejectedIndices: number[] = [];

    for (let index = 0; index < desiredCount; index += 1) {
        const monster = safe[index];
        if (!monster) {
            rejectedIndices.push(index);
            continue;
        }
        const planItem = plan ? findPlanItem(plan, monster, index) : undefined;
        const report = assessQuestionQuality(monster, {
            maxDifficulty: profile.maxQuestionDifficulty,
            allowedSet: profile.vocabulary.allowed,
            material,
            target: planItem?.target,
            domain: planItem?.domain,
            readingSkill: planItem?.readingSkill
        });
        if (!report.accepted) rejectedIndices.push(index);
    }

    replaceWithFallbacks(safe, rejectedIndices, profile);
    return safe;
}

export async function generateQuestionPack(
    text: string,
    opts: QuestionPipelineOptions
): Promise<QuestionPipelineResult> {
    const provider = opts.apiProvider ?? 'openrouter';
    const mainClient: LlmClient = opts.client
        ?? createAIClient({ apiKey: opts.apiKey as string, model: opts.model as string, provider });
    const criticClient: LlmClient = opts.client
        ?? createAIClient({ apiKey: opts.apiKey as string, model: opts.criticModel ?? (opts.model as string), provider });

    const profile = analyzeMaterialProfile(text);

    // --- Stage 1: plan ---
    let planValidated: QuestionPlan | null = null;
    try {
        const planRaw = await mainClient.generate(generatePlanPrompt(text, profile), PLAN_SYSTEM_PROMPT);
        const parsed = parseJson(planRaw) as QuestionPlan | null;
        if (parsed) {
            const validation = validateQuestionPlan(parsed, text, profile.vocabulary.allowed);
            if (validation.valid) {
                planValidated = parsed;
            } else {
                console.warn('[questionPipeline] planner plan rejected, degrading to legacy:', validation.errors.join('; '));
            }
        } else {
            console.warn('[questionPipeline] planner returned non-JSON, degrading to legacy.');
        }
    } catch (e) {
        console.warn('[questionPipeline] planner call failed, degrading to legacy:', (e as Error).message);
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
            return {
                monsters: enforceDeterministicQuality(monsters, profile, text),
                degradedPath: 'legacy_single_stage'
            };
        } catch {
            return { monsters: buildFallbackPack(profile), degradedPath: 'fallback_bank' };
        }
    }

    const plan: QuestionPlan = planValidated; // const, so narrowing survives awaits

    // --- Stage 2: generate (plan-bound — the model must follow the plan verbatim) ---
    let genRaw: string;
    try {
        genRaw = await mainClient.generate(generateLevelFromPlanPrompt(plan), PLAN_BOUND_GENERATOR_SYSTEM_PROMPT);
    } catch {
        return { monsters: buildFallbackPack(profile), plan, degradedPath: 'fallback_bank' };
    }
    const genParsed = parseJson(genRaw) as { monsters?: unknown[] } | null;
    const monsters = enforceDeterministicQuality(normalizeMissionMonsters(genParsed?.monsters ?? [], {
        sourceText: text,
        allowedSet: profile.vocabulary.allowed,
        material: text,
        plan
    }), profile, text, plan);

    // --- Stage 3: critique + repair ---
    let criticReport: CriticReport | undefined;
    if (opts.criticEnabled !== false) {
        try {
            const criticRaw = await criticClient.generate(
                generateCriticPrompt(text, plan.items, [{ levelTitle: plan.levelTitle, monsters }]),
                CRITIC_SYSTEM_PROMPT
            );
            criticReport = normalizeCriticReport(parseJson(criticRaw));
        } catch {
            criticReport = { verdicts: [] };
        }

        if (criticReport.verdicts.some((v) => !v.pass)) {
            const maxAttempts = opts.maxRepairAttempts ?? 2;
            const failedIndices: number[] = [];
            for (const verdict of criticReport.verdicts) {
                if (verdict.pass) continue;
                const idx = monsters.findIndex((m) => m.id === verdict.id);
                if (idx === -1) continue;
                let repaired = false;
                const fallbackItem = findPlanItem(plan, monsters[idx], idx) ?? plan.items[0];
                for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
                    try {
                        const fixPrompt =
                            generateLevelFromPlanPrompt({ ...plan, items: [fallbackItem] }) +
                            `\n# Previous attempt rejected. Offending words: ${verdict.offendingWords.join(', ')}. Fix: ${verdict.suggestedFix}`;
                        const fixRaw = await mainClient.generate(fixPrompt, PLAN_BOUND_GENERATOR_SYSTEM_PROMPT);
                        const fixedParsed = parseJson(fixRaw) as { monsters?: unknown[] } | null;
                        const fixed = normalizeMissionMonsters(fixedParsed?.monsters ?? [], {
                            sourceText: text,
                            allowedSet: profile.vocabulary.allowed,
                            material: text,
                            plan
                        });
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
                if (!repaired) failedIndices.push(idx);
            }

            // SAFETY NET: a critic-rejected question that repair could not fix must
            // never ship. Replace it with a known-good, 1T-grounded fallback-bank
            // question (self-contained English practice).
            if (failedIndices.length > 0) {
                replaceWithFallbacks(monsters, failedIndices, profile);
            }
        }
    }

    return {
        monsters: enforceDeterministicQuality(monsters, profile, text, plan),
        plan,
        criticReport,
        degradedPath: 'none'
    };
}
