import { computeSkillPriority, Monster } from './gameStore';
import { SkillMasteryRecord } from '@/db/db';

function makeQuestion(overrides: Partial<Monster>): Monster {
    return {
        id: 1,
        type: 'vocab',
        question: 'q',
        options: ['a', 'b', 'c', 'd'],
        correct_index: 0,
        explanation: 'exp',
        skillTag: 'skill_a',
        difficulty: 'medium',
        questionMode: 'choice',
        correctAnswer: 'a',
        ...overrides
    };
}

describe('computeSkillPriority', () => {
    test('ranks weak high-risk skills above mastered stable skills', () => {
        const weakQuestion = makeQuestion({ skillTag: 'skill_weak', difficulty: 'hard' });
        const strongQuestion = makeQuestion({ id: 2, skillTag: 'skill_strong', difficulty: 'easy' });

        const stats = {
            skill_weak: { correct: 1, total: 5 },
            skill_strong: { correct: 9, total: 10 }
        };
        const masteryBySkill: Record<string, SkillMasteryRecord> = {
            skill_weak: {
                skillTag: 'skill_weak',
                score: 28,
                state: 'new',
                attempts: 5,
                correct: 1,
                lastReviewedAt: Date.now(),
                updatedAt: Date.now()
            },
            skill_strong: {
                skillTag: 'skill_strong',
                score: 90,
                state: 'mastered',
                attempts: 12,
                correct: 11,
                lastReviewedAt: Date.now(),
                updatedAt: Date.now()
            }
        };
        const reviewRiskBySkill = { skill_weak: 2, skill_strong: 0 };
        const recentMistakeBySkill = { skill_weak: 2, skill_strong: 0 };

        const weakPriority = computeSkillPriority(weakQuestion, stats, masteryBySkill, reviewRiskBySkill, recentMistakeBySkill);
        const strongPriority = computeSkillPriority(strongQuestion, stats, masteryBySkill, reviewRiskBySkill, recentMistakeBySkill);

        expect(weakPriority).toBeGreaterThan(strongPriority);
    });

    test('caps extreme risk and mistake values to keep ordering stable', () => {
        const question = makeQuestion({ skillTag: 'skill_cap', difficulty: 'hard' });
        const stats = { skill_cap: { correct: 0, total: 2 } };
        const masteryBySkill: Record<string, SkillMasteryRecord> = {};

        const capped = computeSkillPriority(question, stats, masteryBySkill, { skill_cap: 99 }, { skill_cap: 99 });
        const expectedUpper = computeSkillPriority(question, stats, masteryBySkill, { skill_cap: 3 }, { skill_cap: 3 });

        expect(capped).toBeCloseTo(expectedUpper, 5);
    });
});
