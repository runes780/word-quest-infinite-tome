import {
    canonicalizeLearningObjective,
    mapSkillTagToObjectiveId,
    selectSupportLevelForMastery,
    getLearningObjective,
    objectiveTitle,
    supportLevelLabel
} from './learningObjectives';

describe('learning objective catalog', () => {
    test('maps common skill tags into stable adaptive objectives', () => {
        expect(mapSkillTagToObjectiveId({ skillTag: 'past_tense' })).toBe('past_tense_basic');
        expect(mapSkillTagToObjectiveId({ skillTag: 'grammar:past_simple' })).toBe('past_tense_basic');
        expect(mapSkillTagToObjectiveId({ skillTag: 'reading:inference' })).toBe('reading_inference');
        expect(mapSkillTagToObjectiveId({ skillTag: 'reading:vocabulary_in_context' })).toBe('vocab_context_meaning');
        expect(mapSkillTagToObjectiveId({ skillTag: 'pronoun_reference' })).toBe('pronoun_reference');
        expect(mapSkillTagToObjectiveId({ skillTag: 'preposition_place_time' })).toBe('preposition_place_time');
    });

    test('falls back by question type when skill tag is sparse', () => {
        expect(mapSkillTagToObjectiveId({ type: 'vocab' })).toBe('vocab_context_meaning');
        expect(mapSkillTagToObjectiveId({ type: 'grammar' })).toBe('past_tense_basic');
        expect(mapSkillTagToObjectiveId({ type: 'reading' })).toBe('reading_detail');
    });

    test('defines mastery thresholds and recommended modes for each objective', () => {
        const objective = getLearningObjective('reading_inference');
        expect(objective?.masteryThreshold).toEqual(expect.objectContaining({
            score: expect.any(Number),
            attempts: expect.any(Number),
            accuracy: expect.any(Number)
        }));
        expect(objective?.transferThreshold).toEqual(expect.objectContaining({
            score: expect.any(Number),
            transferAttempts: expect.any(Number),
            accuracy: expect.any(Number)
        }));
        expect(objective?.reviewPolicy).toEqual(expect.objectContaining({
            maxDaysWithoutReview: expect.any(Number),
            riskWeight: expect.any(Number)
        }));
        expect(objective?.recommendedModes).toContain('fill-blank');
    });

    test('canonicalizes AI objective suggestions with confidence and source span', () => {
        expect(canonicalizeLearningObjective({
            suggestedObjectiveId: 'reading_inference',
            skillTag: 'vocab_context',
            type: 'vocab',
            sourceContextSpan: 'The word means warm.'
        })).toEqual(expect.objectContaining({
            objectiveId: 'reading_inference',
            confidence: expect.any(Number),
            source: 'ai',
            sourceContextSpan: 'The word means warm.'
        }));

        expect(canonicalizeLearningObjective({
            suggestedObjectiveId: 'unknown_objective',
            skillTag: 'grammar:past_simple',
            type: 'grammar',
            question: 'Yesterday, she ___ to school.'
        })).toEqual(expect.objectContaining({
            objectiveId: 'past_tense_basic',
            source: 'fallback',
            confidence: expect.any(Number)
        }));
    });

    test('overrides inconsistent AI pronoun objective for ordinary reading detail questions', () => {
        expect(mapSkillTagToObjectiveId({
            skillTag: 'pronoun_reference',
            type: 'reading',
            question: 'What is the weather like today?'
        })).toBe('reading_detail');

        expect(canonicalizeLearningObjective({
            suggestedObjectiveId: 'pronoun_reference',
            skillTag: 'pronoun_reference',
            type: 'reading',
            question: 'What is the weather like today?',
            sourceContextSpan: 'Today is rainy and cold.'
        })).toEqual(expect.objectContaining({
            objectiveId: 'reading_detail',
            source: 'fallback'
        }));
    });

    test('reduces support as mastery rises', () => {
        expect(selectSupportLevelForMastery()).toBe(3);
        expect(selectSupportLevelForMastery({ score: 44, state: 'learning', attempts: 4, correct: 2 })).toBe(2);
        expect(selectSupportLevelForMastery({ score: 76, state: 'consolidated', attempts: 8, correct: 6 })).toBe(1);
        expect(selectSupportLevelForMastery({ score: 91, state: 'mastered', attempts: 12, correct: 11 })).toBe(0);
    });

    test('localizes objective and support labels by UI language', () => {
        expect(objectiveTitle('vocab_context_meaning', 'en')).toBe('Vocabulary in Context');
        expect(objectiveTitle('vocab_context_meaning', 'zh')).toBe('语境词义');
        expect(objectiveTitle('pronoun_reference', 'zh')).toBe('代词指代');
        expect(supportLevelLabel(2, 'en')).toBe('scaffolded');
        expect(supportLevelLabel(2, 'zh')).toBe('支架练习');
    });

    test('localizes common skill and cause tags by UI language', async () => {
        const catalog = await import('./learningObjectives');
        const formatLearningLabel = (catalog as Record<string, unknown>).formatLearningLabel;

        expect(typeof formatLearningLabel).toBe('function');
        expect((formatLearningLabel as (value: string, language: 'en' | 'zh') => string)('vocab_meaning', 'zh')).toBe('词义理解');
        expect((formatLearningLabel as (value: string, language: 'en' | 'zh') => string)('reading:inference', 'zh')).toBe('阅读推断');
        expect((formatLearningLabel as (value: string, language: 'en' | 'zh') => string)('vocab_meaning', 'en')).toBe('Vocabulary Meaning');
    });
});
