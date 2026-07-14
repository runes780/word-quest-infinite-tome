import { analyzeMaterialProfile } from './materialProfile';

describe('material profile analysis', () => {
    test('classifies short simple English material as starter material', () => {
        const profile = analyzeMaterialProfile('The cat is on the mat. It is big.');

        expect(profile.language).toBe('english');
        expect(profile.difficulty).toBe('easy');
        expect(profile.maxQuestionDifficulty).toBe('easy');
        expect(profile.bandLabel).toBe('starter');
        expect(profile.allowedQuestionDifficulties).toEqual(['easy']);
    });

    test('classifies longer abstract English material as advanced while allowing mixed question difficulty', () => {
        const profile = analyzeMaterialProfile(
            'Although the discovery transformed medicine, the researchers analyzed several complicated consequences before publishing their conclusion.'
        );

        expect(profile.language).toBe('english');
        expect(profile.difficulty).toBe('hard');
        expect(profile.maxQuestionDifficulty).toBe('hard');
        expect(profile.bandLabel).toBe('advanced');
        expect(profile.allowedQuestionDifficulties).toEqual(['easy', 'medium', 'hard']);
    });

    test('uses grammar signals instead of only word length', () => {
        const profile = analyzeMaterialProfile(
            'Yesterday I went to the park. We played football and had a picnic.'
        );

        expect(profile.difficulty).toBe('medium');
        expect(profile.allowedQuestionDifficulties).toEqual(['easy', 'medium']);
        expect(profile.grammarSignalCount).toBeGreaterThan(0);
    });

    test('detects Chinese or mixed source material instead of treating it as English', () => {
        expect(analyzeMaterialProfile('这是中文材料。').language).toBe('chinese');
        expect(analyzeMaterialProfile('This is English. 这是中文提示。').language).toBe('mixed');
    });
});

describe('analyzeMaterialProfile vocabulary grounding', () => {
    test('extracts material vocabulary and builds allowed set', () => {
        const profile = analyzeMaterialProfile('The small fox found a bright leaf.');
        expect(profile.vocabulary.material).toContain('fox');
        expect(profile.vocabulary.material).toContain('leaf');
        expect(profile.vocabulary.allowed.has('fox')).toBe(true);
        expect(profile.vocabulary.allowed.has('because')).toBe(true);
        expect(profile.vocabulary.allowed.has('enormous')).toBe(false);
    });

    test('materialSpecific excludes common words', () => {
        const profile = analyzeMaterialProfile('The small fox found a bright leaf.');
        expect(profile.vocabulary.materialSpecific).toContain('fox');
        expect(profile.vocabulary.materialSpecific).not.toContain('small');
    });

    test('sentences are split from the material', () => {
        const profile = analyzeMaterialProfile('Mia has a garden. She waters it.');
        expect(profile.sentences.length).toBeGreaterThanOrEqual(2);
        expect(profile.sentences[0]).toContain('Mia');
    });
});
