import {
    mapSkillTagToObjectiveId,
    selectSupportLevelForMastery,
    getLearningObjective
} from './learningObjectives';

describe('learning objective catalog', () => {
    test('maps common skill tags into stable Grade 5 objectives', () => {
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
        expect(objective?.recommendedModes).toContain('fill-blank');
    });

    test('reduces support as mastery rises', () => {
        expect(selectSupportLevelForMastery()).toBe(3);
        expect(selectSupportLevelForMastery({ score: 44, state: 'learning', attempts: 4, correct: 2 })).toBe(2);
        expect(selectSupportLevelForMastery({ score: 76, state: 'consolidated', attempts: 8, correct: 6 })).toBe(1);
        expect(selectSupportLevelForMastery({ score: 91, state: 'mastered', attempts: 12, correct: 11 })).toBe(0);
    });
});
