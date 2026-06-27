import { computeUnlockedVerbs, newlyUnlockedVerbs, BASE_VERBS, VERB_UNLOCK_MILESTONES, applyUnlockedVerbs } from './verbProgression';
import type { Monster } from '@/store/gameStore';

function choiceMonster(id: number): Monster {
    return {
        id, type: 'vocab', question: 'q', options: ['a', 'b', 'c', 'd'],
        correct_index: 0, explanation: '', skillTag: 'x', difficulty: 'easy',
        questionMode: 'choice', correctAnswer: 'a',
    };
}

describe('computeUnlockedVerbs', () => {
    test('new player (level 1) has only base verbs', () => {
        const result = computeUnlockedVerbs(1);
        expect(result).toHaveLength(2);
        expect(result).toEqual(expect.arrayContaining(['recognize', 'recall']));
    });
    test('listen unlocks at its milestone level', () => {
        const milestone = VERB_UNLOCK_MILESTONES.find((m) => m.verb === 'listen')!.level;
        expect(computeUnlockedVerbs(milestone)).toContain('listen');
        expect(computeUnlockedVerbs(milestone - 1)).not.toContain('listen');
    });
    test('higher level keeps all lower unlocks', () => {
        const all = computeUnlockedVerbs(99);
        expect(all).toEqual(expect.arrayContaining(BASE_VERBS));
        expect(all).toContain('listen');
    });
    test('returns a unique set', () => {
        const all = computeUnlockedVerbs(99);
        expect(new Set(all).size).toBe(all.length);
    });
});

describe('newlyUnlockedVerbs', () => {
    test('returns verbs gained between two levels', () => {
        const milestone = VERB_UNLOCK_MILESTONES.find((m) => m.verb === 'listen')!.level;
        expect(newlyUnlockedVerbs(milestone - 1, milestone)).toEqual(['listen']);
    });
    test('returns empty when no milestone crossed', () => {
        expect(newlyUnlockedVerbs(1, 2)).toEqual([]);
    });
});

describe('applyUnlockedVerbs', () => {
    test('does nothing when listen is not unlocked', () => {
        const qs = [choiceMonster(0), choiceMonster(1)];
        const out = applyUnlockedVerbs(qs, ['recognize', 'recall']);
        expect(out.every((q) => q.verb === undefined)).toBe(true);
    });

    test('flips a deterministic subset of choice questions to listen when unlocked', () => {
        const qs = [choiceMonster(0), choiceMonster(1), choiceMonster(2), choiceMonster(3)];
        const out = applyUnlockedVerbs(qs, ['recognize', 'recall', 'listen']);
        const listenCount = out.filter((q) => q.verb === 'listen').length;
        expect(listenCount).toBeGreaterThan(0);
        expect(listenCount).toBeLessThan(qs.length); // not all flipped
        // deterministic
        expect(applyUnlockedVerbs(qs, ['recognize', 'recall', 'listen']).map((q) => q.verb))
            .toEqual(out.map((q) => q.verb));
    });

    test('preserves correct_index/options so the choice answer path still works', () => {
        const qs = [choiceMonster(0)];
        const out = applyUnlockedVerbs(qs, ['recognize', 'recall', 'listen']);
        const listen = out.find((q) => q.verb === 'listen');
        if (listen) {
            expect(listen.correct_index).toBe(0);
            expect(listen.options).toEqual(['a', 'b', 'c', 'd']);
            expect(listen.correctAnswer).toBe('a');
        }
    });

    test('leaves non-choice questions untouched', () => {
        const typing: Monster = { ...choiceMonster(0), questionMode: 'typing' };
        const out = applyUnlockedVerbs([typing], ['recognize', 'recall', 'listen']);
        expect(out[0].questionMode).toBe('typing');
        expect(out[0].verb === 'listen').toBe(false);
    });
});
