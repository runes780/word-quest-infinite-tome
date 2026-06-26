import { inferVerbFromMode, blankTargetInSpan } from './questionTemplates';
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
