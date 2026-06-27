import type { Monster } from '@/store/gameStore';
import { assessQuestionQuality } from './questionQuality';
import { buildMonsterFromPlanItem } from './questionTemplates';
import { fallbackToMonster, getBalancedFallbackQuestions } from './fallbackQuestions';
import type { QuestionPlan } from './questionPlan';

export interface SafetyNetContext {
    allowedSet: Set<string>;
    material: string;
    maxDifficulty: 'easy' | 'medium' | 'hard';
}

/**
 * 替换 critic 拒绝且修复失败的 monster。P1：优先用确定性、扎根材料的模板
 * （仍绑定学习者材料），仅在模板构造不出或过不了质量门时回退到 canned 题库；
 * 题库也耗尽则标记 lowConfidence。绝不让被拒题原样发出。
 */
export function replaceFailedMonsters(
    monsters: Monster[],
    failedIndices: number[],
    plan: QuestionPlan,
    ctx: SafetyNetContext
): Monster[] {
    const next = [...monsters];
    failedIndices.forEach((idx) => {
        const original = next[idx];
        if (!original) return;
        // Monsters are role-reordered (≥5 items) after generation, so array position
        // `idx` is NOT the plan index. Each monster's `id` is its true plan-item index
        // (per the generator contract), so look the plan item up by id — otherwise the
        // replacement would be built from a different material span than the rejected
        // question. Fall back to position/0 only if the id is out of range.
        const planItem = plan.items[original.id] ?? plan.items[idx] ?? plan.items[0];

        const templated = buildMonsterFromPlanItem(planItem, {
            id: original.id,
            allowedSet: ctx.allowedSet,
        });
        if (
            templated &&
            assessQuestionQuality(templated, {
                maxDifficulty: ctx.maxDifficulty,
                allowedSet: ctx.allowedSet,
                material: ctx.material,
                target: planItem.target,
            }).accepted
        ) {
            next[idx] = templated;
            return;
        }

        // Template could not build or failed the gate: replace with a known-good
        // 1T-grounded fallback-bank question so the rejected one never ships as-is.
        const [fb] = getBalancedFallbackQuestions(1, ctx.maxDifficulty);
        if (fb) {
            next[idx] = fallbackToMonster(fb, original.id);
        } else {
            // Bank exhausted (defensive last resort): flag rather than ship junk.
            (next[idx] as Monster & { lowConfidence?: boolean }).lowConfidence = true;
        }
    });
    return next;
}
