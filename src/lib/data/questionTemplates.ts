import type { QuestionMode, Verb } from '@/store/gameStore';

/**
 * 由渲染格式推导认知动词（P1 向后兼容：老题/缓存题无 verb 字段时使用）。
 * P2 引入新渲染器后将由 verb 字段直接判定。
 */
export function inferVerbFromMode(mode: QuestionMode): Verb {
    if (mode === 'choice') return 'recognize';
    return 'recall'; // typing / fill-blank
}
