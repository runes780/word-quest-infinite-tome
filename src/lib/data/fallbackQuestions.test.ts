import { getBalancedFallbackQuestions } from './fallbackQuestions';

describe('fallback question bank', () => {
    test('balanced fallback questions exclude hard items by default', () => {
        const questions = getBalancedFallbackQuestions(12);

        expect(questions).toHaveLength(12);
        expect(questions.every((question) => question.difficulty !== 'hard')).toBe(true);
    });

    test('balanced fallback questions can opt into hard items explicitly', () => {
        const questions = getBalancedFallbackQuestions(30, 'hard');

        expect(questions.some((question) => question.difficulty === 'hard')).toBe(true);
    });
});
