
import { generateLevelPrompt, generateMentorPrompt, generateReportPrompt, LEVEL_GENERATOR_SYSTEM_PROMPT } from '@/lib/ai/prompts';

describe('Prompt Generators', () => {
    test('generateLevelPrompt includes input text', () => {
        const input = 'Hello World';
        const prompt = generateLevelPrompt(input);
        expect(prompt).toContain('Hello World');
        expect(prompt).toContain('JSON Only');
    });

    test('LEVEL_GENERATOR_SYSTEM_PROMPT includes new requirements', () => {
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('Grammar (50%)');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('Hint');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('Contextual Understanding');
    });

    test('generateMentorPrompt includes context', () => {
        const prompt = generateMentorPrompt('What is 1+1?', '3', '2');
        expect(prompt).toContain('What is 1+1?');
        expect(prompt).toContain('3');
        expect(prompt).toContain('2');
    });

    test('generateReportPrompt calculates score correctly', () => {
        const prompt = generateReportPrompt(50, 10);
        expect(prompt).toContain('Mission Score: 50 / 100');
        expect(prompt).toContain('Total Questions: 10');
    });
});
