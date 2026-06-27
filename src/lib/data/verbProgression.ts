import type { Verb, Monster } from '@/store/gameStore';

/** 玩家开局即拥有的动词。 */
export const BASE_VERBS: Verb[] = ['recognize', 'recall'];

/**
 * 解锁里程碑（按 level 升序）。新增动词时在此追加一行，例如：
 *   { level: 5, verb: 'build' },
 * 掌握度触发可作为本函数的可选第二入参扩展（快速跟进），当前用 level 单一数据源。
 */
export const VERB_UNLOCK_MILESTONES: Array<{ level: number; verb: Verb }> = [
    { level: 3, verb: 'listen' },
];

/**
 * 给定 globalLevel，返回该玩家已解锁的动词集合。纯函数、确定性，便于单测。
 */
export function computeUnlockedVerbs(globalLevel: number): Verb[] {
    const unlocked = new Set<Verb>(BASE_VERBS);
    for (const m of VERB_UNLOCK_MILESTONES) {
        if (globalLevel >= m.level) unlocked.add(m.verb);
    }
    return Array.from(unlocked);
}

/** 从 fromLevel 升到 toLevel 时新解锁的动词（用于解锁提示）。 */
export function newlyUnlockedVerbs(fromLevel: number, toLevel: number): Verb[] {
    const before = new Set(computeUnlockedVerbs(fromLevel));
    return computeUnlockedVerbs(toLevel).filter((v) => !before.has(v));
}

/**
 * 对已解锁 listen 的玩家，把 choice 题按确定规则翻转一部分为 listen（听音辨词），
 * 引入新模态（语音回路）带来的交错多样性。非 choice 题不动；未解锁 listen 则原样返回。
 * 确定性（无 RNG）：按数组下标翻转，便于测试与稳定体验。
 */
export function applyUnlockedVerbs<T extends Monster>(questions: T[], unlockedVerbs: Verb[]): T[] {
    if (!unlockedVerbs.includes('listen')) return questions;
    return questions.map((q, i) => {
        if (q.questionMode === 'choice' && i % 2 === 0) {
            return { ...q, verb: 'listen' as Verb };
        }
        return q;
    });
}
