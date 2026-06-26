import { inferVerbFromMode, blankTargetInSpan, pickDistractors } from './questionTemplates';
import type { Verb } from '@/store/gameStore';

describe('inferVerbFromMode', () => {
    test('choice maps to recognize', () => {
        expect(inferVerbFromMode('choice')).toBe<Verb>('recognize');
    });
    test('typing maps to recall', () => {
        expect(inferVerbFromMode('typing')).toBe<Verb>('recall');
    });
    test('fill-blank maps to recall', () => {
        expect(inferVerbFromMode('fill-blank')).toBe<Verb>('recall');
    });
});

describe('blankTargetInSpan', () => {
    test('replaces first occurrence of target with blank marker', () => {
        const r = blankTargetInSpan('Every morning she waters the plants.', 'waters');
        expect(r).not.toBeNull();
        expect(r!.question).toBe('Every morning she ___ the plants.');
        expect(r!.correctAnswer).toBe('waters');
    });

    test('matches case-insensitively but preserves original casing', () => {
        const r = blankTargetInSpan('She Waters the plants today.', 'waters');
        expect(r!.correctAnswer).toBe('Waters');
        expect(r!.question).toBe('She ___ the plants today.');
    });

    test('returns null when target absent', () => {
        expect(blankTargetInSpan('hello world', 'xyz')).toBeNull();
    });

    test('returns null for empty target', () => {
        expect(blankTargetInSpan('hello world', '   ')).toBeNull();
    });
});

describe('pickDistractors', () => {
    test('excludes the target (and its stem-mate)', () => {
        const set = new Set(['waters', 'plants', 'morning', 'today', 'garden']);
        const d = pickDistractors('waters', set, 3);
        expect(d).not.toContain('waters');
        expect(d).toHaveLength(3);
    });

    test('sorts by length similarity to target, deterministic tie-break', () => {
        // target 'cat' (len 3): 'dog'(0),'bat'(0) tie → alpha bat<dog; then 'hi'(1)
        const set = new Set(['elephant', 'hi', 'dog', 'bat']);
        expect(pickDistractors('cat', set, 2)).toEqual(['bat', 'dog']);
    });

    test('returns fewer than count when pool is small', () => {
        expect(pickDistractors('cat', new Set(['dog']), 3)).toEqual(['dog']);
    });

    test('is deterministic (same inputs → same output)', () => {
        const set = new Set(['plants', 'morning', 'today', 'garden', 'picks']);
        expect(pickDistractors('red', set, 3)).toEqual(pickDistractors('red', set, 3));
    });
});
