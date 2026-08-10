import type { MasteryState } from '@/db/db';
import type { MonsterDifficulty } from '@/store/gameStore';
import type { Language } from '@/store/settingsStore';

export interface MentorTriggerInput {
    nextWrongCount: number;
    health: number;
    difficulty: MonsterDifficulty;
    masteryState?: MasteryState;
    reviewRisk: number;
    repeatedMistakes: number;
}

export interface BattleAnswerResult {
    explanation: string;
    repairQueued?: boolean;
    isLucky?: boolean;
}

export function formatMasteryStateLabel(state: MasteryState, language: Language) {
    if (language === 'zh') {
        return {
            new: '新学',
            learning: '学习中',
            consolidated: '巩固',
            mastered: '精通'
        }[state];
    }

    return {
        new: 'New',
        learning: 'Learning',
        consolidated: 'Consolidated',
        mastered: 'Mastered'
    }[state];
}

export function shouldAutoOpenMentor({
    nextWrongCount,
    health,
    difficulty,
    masteryState,
    reviewRisk,
    repeatedMistakes
}: MentorTriggerInput) {
    const highValueMistake = difficulty === 'hard' ||
        reviewRisk >= 1.5 ||
        repeatedMistakes >= 2 ||
        masteryState === 'new';

    return nextWrongCount >= 3 || health <= 1 || highValueMistake;
}

export function formatBattleResultExplanation(result: BattleAnswerResult, language: Language) {
    const luckyPrefix = result.isLucky
        ? (language === 'zh' ? '🍀 幸运！奖励 +50% — ' : '🍀 Lucky! +50% rewards — ')
        : '';
    const explanation = `${luckyPrefix}${result.explanation}`;
    if (!result.repairQueued) return explanation;

    const repairMessage = language === 'zh'
        ? '下一题已自动加入同一逻辑的修复练习，先补错因再继续。'
        : 'A same-pattern repair question has been added next, so you can fix the mistake before moving on.';

    return `${explanation}\n\n${repairMessage}`;
}

export function resolveVoiceAnswerIndex({
    options,
    correctIndex,
    correct,
    spokenText
}: {
    options: string[];
    correctIndex: number;
    correct: boolean;
    spokenText: string;
}) {
    if (correct) return correctIndex;

    const normalizedSpeech = spokenText.trim().toLocaleLowerCase();
    const matchedIndex = options.findIndex((option) => {
        const normalizedOption = option.trim().toLocaleLowerCase();
        return normalizedOption.includes(normalizedSpeech) || normalizedSpeech.includes(normalizedOption);
    });

    return matchedIndex >= 0 ? matchedIndex : 0;
}
