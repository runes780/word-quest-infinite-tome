import { computeUnlockedVerbs, newlyUnlockedVerbs, BASE_VERBS, VERB_UNLOCK_MILESTONES } from './verbProgression';

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
