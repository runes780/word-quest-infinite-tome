import type { QuestionMode, Verb } from '@/store/gameStore';
import type { Monster } from '@/store/gameStore';
import type { QuestionPlanItem } from './questionPlan';
import { normalizeWord } from './textNormalize';
import { COMMON_WORD_SET } from './commonWords';

/**
 * 由渲染格式推导认知动词（P1 向后兼容：老题/缓存题无 verb 字段时使用）。
 * P2 引入新渲染器后将由 verb 字段直接判定。
 */
export function inferVerbFromMode(mode: QuestionMode): Verb {
    if (mode === 'choice') return 'recognize';
    return 'recall'; // typing / fill-blank
}

/**
 * 把 span 中第一个（大小写不敏感）target 替换成 "___"。返回 null 表示 target
 * 不在 span 中（防御性——plan validator 对 word/phrase/grammar_form/reference
 * 保证存在，但模板绝不因非合规 item 抛错）。correctAnswer 保留原文大小写。
 */
export function blankTargetInSpan(
    span: string,
    target: string
): { question: string; correctAnswer: string } | null {
    const t = target.trim();
    if (!t) return null;
    const idx = span.toLowerCase().indexOf(t.toLowerCase());
    if (idx === -1) return null;
    const actual = span.slice(idx, idx + t.length);
    const question = span.slice(0, idx) + '___' + span.slice(idx + t.length);
    return { question, correctAnswer: actual };
}

/**
 * 从 allowedSet（material ∪ common words）确定性挑 `count` 个干扰项，用于
 * cloze-as-MCQ。排除 target 及其词干等价词，按与 target 的长度相近度排序（长度
 * 相近的干扰项更合理）。无 RNG，输入确定则输出确定，便于测试。池不足时返回少于
 * `count` 个。
 */
export function pickDistractors(target: string, allowedSet: Set<string>, count: number): string[] {
    const targetNorm = normalizeWord(target);
    const unique = Array.from(
        new Set(
            Array.from(allowedSet)
                .map((w) => w.toLowerCase())
                .filter((w) => w.length >= 2 && normalizeWord(w) !== targetNorm)
        )
    );
    const targetLen = target.length;
    unique.sort((a, b) => {
        const sa = Math.abs(a.length - targetLen);
        const sb = Math.abs(b.length - targetLen);
        return sa !== sb ? sa - sb : a.localeCompare(b);
    });
    return unique.slice(0, count);
}

export interface TemplateContext {
    id: number;
    /** 供 recognition 干扰项挑选；缺省回退到 COMMON_WORD_SET。 */
    allowedSet?: Set<string>;
}

/** plan role -> 可模板化的动词。transfer（apply）在 P3 之前返回 null。 */
export function planRoleToVerb(role: QuestionPlanItem['role']): Verb | null {
    switch (role) {
        case 'recognition':
            return 'recognize';
        case 'cloze':
        case 'recall':
            return 'recall';
        default:
            return null;
    }
}

/**
 * 从一个 validated plan item 确定性构造 Monster（零 LLM）。遵守 1T 语境法则：
 * 句子来自 item.sourceSpan，只挖掉 item.target。返回 null 表示该 role 暂不支持
 * 或 target 不在 span 中——调用方（安全网）应回退到题库。
 */
export function buildMonsterFromPlanItem(
    item: QuestionPlanItem,
    ctx: TemplateContext
): Monster | null {
    const verb = planRoleToVerb(item.role);
    if (!verb) return null;
    const blanked = blankTargetInSpan(item.sourceSpan, item.target);
    if (!blanked) return null;

    const shared = {
        id: ctx.id,
        type: item.domain,
        skillTag: `${item.domain}:${item.learningObjectiveId}`,
        difficulty: item.difficulty,
        learningObjectiveId: item.learningObjectiveId,
        supportLevel: item.supportLevel,
        attemptKind: item.role === 'transfer' ? ('transfer' as const) : ('practice' as const),
        sourceContextSpan: item.sourceSpan,
        explanation: `The word is "${blanked.correctAnswer}". Full sentence: "${item.sourceSpan}".`,
        hint: 'Think about the word.',
        verb,
    };

    if (item.role === 'cloze') {
        return {
            ...shared,
            question: `Read: "${blanked.question}"`,
            options: [],
            correct_index: 0,
            questionMode: 'fill-blank',
            correctAnswer: blanked.correctAnswer,
        };
    }

    if (item.role === 'recall') {
        return {
            ...shared,
            question: `Read: "${blanked.question}". Type the missing word.`,
            options: [],
            correct_index: 0,
            questionMode: 'typing',
            correctAnswer: blanked.correctAnswer,
        };
    }

    // recognition -> cloze rendered as multiple choice
    const pool = ctx.allowedSet ?? COMMON_WORD_SET;
    const distractors = pickDistractors(item.target, pool, 3);
    if (distractors.length < 3) return null;
    const correct_index = ctx.id % 4;
    const options: string[] = [];
    let dIdx = 0;
    for (let i = 0; i < 4; i += 1) {
        if (i === correct_index) options.push(blanked.correctAnswer);
        else options.push(distractors[dIdx++]);
    }
    return {
        ...shared,
        question: `Read: "${blanked.question}". Which word fits the blank?`,
        options,
        correct_index,
        questionMode: 'choice',
        correctAnswer: blanked.correctAnswer,
    };
}

/** 确定性 PRNG（mulberry32）——给 shuffle 一个可复现的种子，避免 Math.random。 */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Fisher-Yates 洗牌，种子确定则结果确定（无 Math.random）。不修改原数组。 */
export function seededShuffle<T>(items: T[], seed: number): T[] {
    const out = [...items];
    const rng = mulberry32(seed || 1);
    for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

const MIN_BUILD_WORDS = 4;

/**
 * 把一道题改造成 build（词序造句）题：用 sourceContextSpan 的词作为可拖拽词块，
 * 正确排列 = 原句。继承原题的 id/skillTag/domain/objective/supportLevel 等元数据，
 * 只换 verb/questionMode/options/correctAnswer/question。返回 null 表示该题不适合 build
 * （无 span / 词太少 / 占位符 span）。零 LLM、零幻觉（句子就是原文 span）。
 */
export function toBuildMonster(question: Monster): Monster | null {
    const span = question.sourceContextSpan;
    if (!span || span === 'sanitized_fallback') return null;
    const words = span.match(/\S+/g);
    if (!words || words.length < MIN_BUILD_WORDS) return null;

    let tiles = seededShuffle(words, question.id);
    // 确保打乱后不等于原序（否则直接给出答案）
    if (tiles.join(' ') === words.join(' ')) {
        tiles = [...tiles.slice(1), tiles[0]];
    }
    return {
        ...question,
        verb: 'build',
        questionMode: 'typing', // 避免触发 choice 专属 VoiceInput；build 题不经过质量门
        options: tiles,
        correct_index: 0,
        correctAnswer: span,
        question: 'Rebuild the sentence.',
    };
}
