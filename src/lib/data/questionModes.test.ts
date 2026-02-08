import {
    buildModeQuota,
    getQuestionModeDistribution,
    isQuestionModeDistributionHealthy,
    rebalanceQuestionModes
} from './questionModes';

describe('question mode distribution utilities', () => {
    test('buildModeQuota produces 50/30/20 split for 100 questions', () => {
        const quota = buildModeQuota(100);
        expect(quota.choice).toBe(50);
        expect(quota.typing).toBe(30);
        expect(quota['fill-blank']).toBe(20);
    });

    test('rebalanceQuestionModes enforces target mix on degenerated input', () => {
        const allChoice = Array.from({ length: 100 }, (_, idx) => ({
            id: idx + 1,
            questionMode: 'choice'
        }));
        const rebalanced = rebalanceQuestionModes(allChoice);
        const distribution = getQuestionModeDistribution(rebalanced);

        expect(distribution.counts.choice).toBe(50);
        expect(distribution.counts.typing).toBe(30);
        expect(distribution.counts['fill-blank']).toBe(20);
        expect(isQuestionModeDistributionHealthy(rebalanced)).toBe(true);
    });

    test('small batch still sums to full quota without loss', () => {
        const quota = buildModeQuota(7);
        expect(quota.choice + quota.typing + quota['fill-blank']).toBe(7);
    });
});
