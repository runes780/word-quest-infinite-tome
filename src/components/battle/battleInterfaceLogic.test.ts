import {
    formatBattleResultExplanation,
    formatMasteryStateLabel,
    resolveVoiceAnswerIndex,
    shouldAutoOpenMentor
} from './battleInterfaceLogic';

describe('battle interface orchestration rules', () => {
    test('opens mentor support for repeated, risky, hard, new-skill, or low-health mistakes', () => {
        const baseline = {
            nextWrongCount: 1,
            health: 3,
            difficulty: 'medium' as const,
            masteryState: 'learning' as const,
            reviewRisk: 0,
            repeatedMistakes: 0
        };

        expect(shouldAutoOpenMentor(baseline)).toBe(false);
        expect(shouldAutoOpenMentor({ ...baseline, nextWrongCount: 3 })).toBe(true);
        expect(shouldAutoOpenMentor({ ...baseline, health: 1 })).toBe(true);
        expect(shouldAutoOpenMentor({ ...baseline, difficulty: 'hard' })).toBe(true);
        expect(shouldAutoOpenMentor({ ...baseline, masteryState: 'new' })).toBe(true);
        expect(shouldAutoOpenMentor({ ...baseline, reviewRisk: 1.5 })).toBe(true);
        expect(shouldAutoOpenMentor({ ...baseline, repeatedMistakes: 2 })).toBe(true);
    });

    test('keeps immediate-repair messaging explicit in both supported languages', () => {
        const result = { explanation: 'Review the evidence.', repairQueued: true };

        expect(formatBattleResultExplanation(result, 'en')).toContain('same-pattern repair question');
        expect(formatBattleResultExplanation(result, 'zh')).toContain('修复练习');
        expect(formatBattleResultExplanation({ explanation: 'Plain explanation.' }, 'en')).toBe('Plain explanation.');
    });

    test('resolves voice answers without changing the authoritative correctness result', () => {
        const input = {
            options: ['Apple', 'Banana', 'Orange', 'Pear'],
            correctIndex: 0,
            spokenText: 'I said banana'
        };

        expect(resolveVoiceAnswerIndex({ ...input, correct: true })).toBe(0);
        expect(resolveVoiceAnswerIndex({ ...input, correct: false })).toBe(1);
        expect(resolveVoiceAnswerIndex({ ...input, correct: false, spokenText: 'unknown' })).toBe(0);
    });

    test('formats mastery states for learner-facing notifications', () => {
        expect(formatMasteryStateLabel('consolidated', 'en')).toBe('Consolidated');
        expect(formatMasteryStateLabel('mastered', 'zh')).toBe('精通');
    });
});
