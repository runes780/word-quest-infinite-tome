
import {
    generateLevelPrompt,
    generateMentorPrompt,
    generateReportPrompt,
    LEVEL_GENERATOR_SYSTEM_PROMPT,
    MENTOR_SYSTEM_PROMPT,
    REPORT_SYSTEM_PROMPT
} from '@/lib/ai/prompts';

describe('Prompt Generators', () => {
    test('generateLevelPrompt includes input text', () => {
        const input = 'Hello World';
        const prompt = generateLevelPrompt(input);
        expect(prompt).toContain('Hello World');
        expect(prompt).toContain('JSON Only');
    });

    test('generateLevelPrompt removes app schema and generator instructions from source material', () => {
        const input = `
Open Guardian Dashboard
questionMode: choice
skillTag: reading_detail
correct_index: 0
sourceContextSpan: daily_plan
The fox runs under the pine tree.
(Player is Level 5. Generate a new wave of challengers!)
`;

        const prompt = generateLevelPrompt(input);

        expect(prompt).toContain('The fox runs under the pine tree.');
        expect(prompt).not.toContain('Open Guardian Dashboard');
        expect(prompt).not.toContain('questionMode');
        expect(prompt).not.toContain('skillTag');
        expect(prompt).not.toContain('correct_index');
        expect(prompt).not.toContain('sourceContextSpan: daily_plan');
        expect(prompt).not.toContain('Player is Level');
        expect(prompt).not.toContain('Generate a new wave');
    });

    test('generateLevelPrompt trims unrelated large context while preserving learning material', () => {
        const noisyUiContext = Array.from({ length: 120 }, (_, index) =>
            `Guardian Dashboard setting row ${index}: apiProvider deepseek modelName config ${index}`
        ).join('\n');
        const learningMaterial = [
            'The small fox sleeps under the tree.',
            'Yesterday, the fox found a red leaf.',
            'The leaf was bright, so the fox kept it.'
        ].join('\n');

        const prompt = generateLevelPrompt(`${noisyUiContext}\n${learningMaterial}\n${noisyUiContext}`);

        expect(prompt.length).toBeLessThan(9000);
        expect(prompt).toContain('The small fox sleeps under the tree.');
        expect(prompt).toContain('Yesterday, the fox found a red leaf.');
        expect(prompt).toContain('The leaf was bright, so the fox kept it.');
        expect(prompt).not.toContain('apiProvider deepseek modelName config 40');
    });

    test('generateLevelPrompt includes learner level guidance outside the reading material', () => {
        const prompt = generateLevelPrompt('The fox runs under the pine tree.', { learnerLevel: 5 });

        expect(prompt).toContain('Learner level: 5');
        expect(prompt).toContain('Use this as a soft signal only');
    });

    test('generateLevelPrompt adapts to material profile without a fixed school grade', () => {
        const prompt = generateLevelPrompt('The cat is on the mat. It is big.', { learnerLevel: 5 });

        expect(prompt).toContain('Source language: english');
        expect(prompt).toContain('Estimated material difficulty: easy (starter)');
        expect(prompt).toContain('Allowed question difficulties: easy');
        expect(prompt).toContain('Maximum question difficulty: easy');
        expect(prompt).toContain('Do not explain simple source words with harder synonyms');
        expect(prompt).toContain('If the source is English, never generate Chinese question text');
        expect(prompt).toContain('soft signal only');
        expect(prompt).not.toContain('Grade 5');
        expect(prompt).not.toContain('A1/A2');
    });

    test('LEVEL_GENERATOR_SYSTEM_PROMPT includes new requirements', () => {
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('Grammar (50%)');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('Hint');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('Contextual Understanding');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('skillTag');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('difficulty');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('questionMode');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('correctAnswer');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('Never ask about JSON keys, app labels, provider names, model names, or internal field names');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('Do not exceed the source material difficulty');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('Different questions may have different difficulty');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).not.toContain('Grade 5');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).not.toContain('A1/A2');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('Never output all questions in "choice" mode');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('one clear learning target');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('Every question must include a sourceContextSpan');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('Never ask "What does it refer to?" without the source sentence');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('Card ladder contract');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('1T sentence');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('recognition -> cloze -> active recall -> transfer');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('Fill-blank questions must contain one visible blank');
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('Do not ask standalone trivia');
    });

    test('generateMentorPrompt includes context', () => {
        const prompt = generateMentorPrompt('What is 1+1?', '3', '2', 'number_sense', 'easy', 'choice');
        expect(prompt).toContain('What is 1+1?');
        expect(prompt).toContain('3');
        expect(prompt).toContain('2');
        expect(prompt).toContain('number_sense');
        expect(prompt).toContain('easy');
        expect(prompt).toContain('choice');
    });

    test('MENTOR prompt format requires cause tag and next action', () => {
        expect(LEVEL_GENERATOR_SYSTEM_PROMPT).toContain('questionMode');
        expect(MENTOR_SYSTEM_PROMPT).toContain('cause_tag');
        expect(MENTOR_SYSTEM_PROMPT).toContain('next_action');
        expect(MENTOR_SYSTEM_PROMPT).toContain('revenge_question must be English-only');
        expect(MENTOR_SYSTEM_PROMPT).not.toContain('Grade 4-6');
    });

    test('report prompt does not assume a fixed school grade', () => {
        expect(REPORT_SYSTEM_PROMPT).toContain('Do not assume a fixed school grade');
        expect(REPORT_SYSTEM_PROMPT).not.toContain('Grade 4-6');
    });

    test('buildReportSystemPrompt follows the selected UI language', async () => {
        const prompts = await import('@/lib/ai/prompts');
        const buildReportSystemPrompt = (prompts as Record<string, unknown>).buildReportSystemPrompt;

        expect(typeof buildReportSystemPrompt).toBe('function');
        expect((buildReportSystemPrompt as (language: 'en' | 'zh') => string)('zh')).toContain('Simplified Chinese');
        expect((buildReportSystemPrompt as (language: 'en' | 'zh') => string)('en')).toContain('English');
        expect((buildReportSystemPrompt as (language: 'en' | 'zh') => string)('en')).not.toContain('Generate a brief "Mission Debrief" in Chinese');
    });

    test('generateReportPrompt calculates score correctly', () => {
        const prompt = generateReportPrompt(50, 10, []);
        expect(prompt).toContain('Mission Score: 50 / 100');
        expect(prompt).toContain('Total Questions: 10');
    });

    test('generateReportPrompt keeps analysis payload compact for large sessions', () => {
        const history = Array.from({ length: 60 }, (_, index) => ({
            questionId: index + 1,
            questionText: `Very long generated question ${index + 1} `.repeat(12),
            userChoice: index % 3 === 0 ? 'wrong answer with extra text' : 'correct answer with extra text',
            correctChoice: 'correct answer with extra text',
            isCorrect: index % 3 !== 0,
            learningObjectiveId: index % 2 === 0 ? 'vocab_context_meaning' : 'reading_inference',
            attemptKind: index % 4 === 0 ? 'transfer' : 'practice',
            supportLevel: index % 4,
            causeTag: index % 3 === 0 ? 'context_clue' : undefined
        }));

        const prompt = generateReportPrompt(400, 60, history);

        expect(prompt.length).toBeLessThan(6000);
        expect(prompt).toContain('Objective Summary');
        expect(prompt).toContain('Recent Mistakes');
        expect(prompt).not.toContain('Very long generated question 1 Very long generated question 1 Very long generated question 1');
    });
});
