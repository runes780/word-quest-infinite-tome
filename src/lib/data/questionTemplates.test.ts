import { inferVerbFromMode } from './questionTemplates';
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
