import type { Verb, Monster } from '@/store/gameStore';
import { toBuildMonster } from './questionTemplates';

/** 玩家开局即拥有的动词。 */
export const BASE_VERBS: Verb[] = ['recognize', 'recall'];

/**
 * 解锁里程碑（按 level 升序）。新增动词时在此追加一行，例如：
 *   { level: 5, verb: 'build' },
 * 掌握度触发可作为本函数的可选第二入参扩展（快速跟进），当前用 level 单一数据源。
 */
export const VERB_UNLOCK_MILESTONES: Array<{ level: number; verb: Verb }> = [
    { level: 3, verb: 'listen' },
    { level: 5, verb: 'build' },
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

/**
 * 对已解锁 build 的玩家，把一部分题（有可用 sourceContextSpan、且未被翻成 listen）
 * 改造成 build（词序造句）题。确定性（按数组下标选子集）。未解锁 build 或无可用题则原样返回。
 */
export function applyBuildVerb<T extends Monster>(questions: T[], unlockedVerbs: Verb[]): T[] {
    if (!unlockedVerbs.includes('build')) return questions;
    return questions.map((q, i) => {
        if (q.verb === 'listen') return q;          // don't override listen
        if (i % 3 !== 0) return q;                   // deterministic subset (~1/3)
        const built = toBuildMonster(q);
        return built ?? q;
    });
}

/** 每个动词的展示元数据（名称/中文名/简介/中文简介/图标）。供 VerbCodex 等展示层使用。 */
export const VERB_INFO: Record<Verb, { name: string; nameZh: string; desc: string; descZh: string; icon: string }> = {
    recognize: { name: 'Recognize', nameZh: '识别', desc: 'Match the word to its meaning', descZh: '识别词义', icon: '👁' },
    recall: { name: 'Recall', nameZh: '回忆', desc: 'Spell the word from memory', descZh: '拼写回忆', icon: '✍️' },
    listen: { name: 'Listen', nameZh: '听音', desc: 'Hear the word and choose', descZh: '听音辨词', icon: '🔊' },
    build: { name: 'Build', nameZh: '造句', desc: 'Rebuild the sentence', descZh: '词序造句', icon: '🧱' },
    match: { name: 'Match', nameZh: '配对', desc: 'Pair synonyms and antonyms', descZh: '同义反义配对', icon: '🔗' },
    correct: { name: 'Correct', nameZh: '改错', desc: 'Spot and fix the error', descZh: '找错改错', icon: '🔍' },
    apply: { name: 'Apply', nameZh: '应用', desc: 'Use the word in context', descZh: '情境应用', icon: '🎯' },
};

/** 某动词的解锁等级。基础动词=1；里程碑动词=其 level；未发布动词=Infinity。 */
export function verbUnlockLevel(verb: Verb): number {
    if (BASE_VERBS.includes(verb)) return 1;
    const m = VERB_UNLOCK_MILESTONES.find((entry) => entry.verb === verb);
    return m ? m.level : Infinity;
}

/** 所有动词，按解锁等级排序（基础在前，未发布在后）。 */
export const ALL_VERBS_ORDERED: Verb[] = (
    ['recognize', 'recall', 'listen', 'build', 'match', 'correct', 'apply'] as Verb[]
).sort((a, b) => verbUnlockLevel(a) - verbUnlockLevel(b));
