import type { QuestionMode, Verb } from '@/store/gameStore';

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
