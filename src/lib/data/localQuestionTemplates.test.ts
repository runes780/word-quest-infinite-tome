import {
    analyzeLocalMaterial,
    planLocalQuest,
    type LocalPlanItem
} from './localMaterialPlanner';
import {
    blankTargetInSpan,
    buildLocalQuest,
    buildMonsterFromLocalPlanItem,
    pickSameSlotDistractors,
    posBucketOf
} from './localQuestionTemplates';
import { FALLBACK_QUESTIONS } from './fallbackQuestions';
import { assessQuestionQuality } from './questionQuality';

const SYNTHETIC_MATERIAL =
    'Yesterday was Sunday. Mia went to the park with her friends. ' +
    'They played football under a big tree. The weather was sunny and warm. ' +
    'She shared her sandwiches because everyone was hungry. ' +
    'Later they walked beside the river and watched the birds.';

function builtQuestFor(material = SYNTHETIC_MATERIAL) {
    const analysis = analyzeLocalMaterial(material);
    const plan = planLocalQuest(analysis, analysis.targets.map((target) => target.targetId));
    return { analysis, plan, built: buildLocalQuest(analysis.material, plan.items) };
}

describe('blankTargetInSpan', () => {
    test('blanks the whole-word target and preserves original casing', () => {
        expect(blankTargetInSpan('Mia went to the park', 'went')).toEqual({
            question: 'Mia ___ to the park',
            correctAnswer: 'went'
        });
        expect(blankTargetInSpan('She Shared her snacks', 'Shared')).toEqual({
            question: 'She ___ her snacks',
            correctAnswer: 'Shared'
        });
    });

    test('does not blank partial word matches', () => {
        expect(blankTargetInSpan('They sat there together', 'her')).toBeNull();
        expect(blankTargetInSpan('Everything was fine', 'thing')).toBeNull();
    });

    test('returns null when the target is absent', () => {
        expect(blankTargetInSpan('The dog barked loudly.', 'cat')).toBeNull();
    });
});

describe('pickSameSlotDistractors', () => {
    test('prefers same-slot words from the material', () => {
        const distractors = pickSameSlotDistractors('went', SYNTHETIC_MATERIAL, 'Mia went to the park with her friends.');

        expect(distractors).not.toBeNull();
        expect(distractors!.length).toBe(3);
        for (const word of distractors!) {
            expect(posBucketOf(word)).toBe('verb-past');
        }
    });

    test('returns null when fewer than the requested same-slot candidates exist', () => {
        // The curated pools make three-distractor requests nearly always
        // satisfiable; a deliberately large count proves the null branch that
        // the planner relies on for template degradation.
        expect(pickSameSlotDistractors('went', SYNTHETIC_MATERIAL, 'Mia went to the park with her friends.', 500)).toBeNull();
    });

    test('never proposes distractors that already appear in the item span', () => {
        const distractors = pickSameSlotDistractors('under', SYNTHETIC_MATERIAL, 'They played football under a big tree.');

        expect(distractors).not.toBeNull();
        const spanWords = new Set('They played football under a big tree'.toLowerCase().split(/\W+/));
        for (const word of distractors!) {
            expect(spanWords.has(word.toLowerCase())).toBe(false);
        }
    });
});

describe('buildMonsterFromLocalPlanItem', () => {
    test('emits sanitizer-compatible monsters with objective and evidence metadata', () => {
        const { analysis, plan } = builtQuestFor();
        const monster = buildMonsterFromLocalPlanItem(plan.items[0], 1, analysis.material);

        expect(monster).not.toBeNull();
        expect(monster!.learningObjectiveId).toBeTruthy();
        expect(monster!.sourceContextSpan).toBe(plan.items[0].sourceSpan);
        expect(monster!.attemptKind).toBe('practice');
        expect(monster!.options).toHaveLength(4);
        expect(new Set(monster!.options.map((option) => option.toLowerCase())).size).toBe(4);
        expect(monster!.options[monster!.correct_index]).toBe(monster!.correctAnswer);
    });
});

describe('buildLocalQuest', () => {
    test('same material and items produce the same quest', () => {
        const first = builtQuestFor();
        const second = builtQuestFor();

        expect(first.built).toEqual(second.built);
    });

    test('delivers 6-8 questions whose spans and answers come from the material', () => {
        const { analysis, built } = builtQuestFor();

        expect(built.status).toBe('ready');
        expect(built.questions.length).toBeGreaterThanOrEqual(6);
        expect(built.questions.length).toBeLessThanOrEqual(8);
        for (const question of built.questions) {
            const monster = question.monster;
            expect(analysis.material.includes(monster.sourceContextSpan!)).toBe(true);
            expect(monster.sourceContextSpan!.toLowerCase()).toContain(monster.correctAnswer.toLowerCase());
            expect(monster.question).toContain('___');
            expect(monster.options).toHaveLength(4);
            expect(new Set(monster.options.map((option) => option.toLowerCase())).size).toBe(4);
            // Exactly one option equals the keyed answer.
            const answerMatches = monster.options.filter(
                (option) => option.toLowerCase() === monster.correctAnswer.toLowerCase()
            );
            expect(answerMatches).toHaveLength(1);
        }
    });

    test('no delivered question duplicates a fixed fallback-bank question', () => {
        const { built } = builtQuestFor();
        const fallbackQuestions = new Set(FALLBACK_QUESTIONS.map((item) => item.question));

        for (const question of built.questions) {
            expect(fallbackQuestions.has(question.monster.question)).toBe(false);
            expect(question.monster.question).not.toMatch(/^Transfer check:/i);
        }
    });

    test('every delivered question passes the deterministic quality gate', () => {
        const { analysis, built, plan } = builtQuestFor();

        for (const question of built.questions) {
            const item = plan.items.find((planItem) => planItem.planItemId === question.planItemId)!;
            const report = assessQuestionQuality(question.monster, {
                material: analysis.material,
                target: item.target
            });
            expect(report.rejectReasons).toEqual([]);
            expect(report.accepted).toBe(true);
        }
    });

    test('plan item association survives monster reordering', () => {
        const { analysis, plan } = builtQuestFor();
        const reordered: LocalPlanItem[] = [...plan.items].reverse();

        const builtFromReordered = buildLocalQuest(analysis.material, reordered);
        const byPlanItemId = new Map(builtFromReordered.questions.map((q) => [q.planItemId, q.monster.question]));
        const original = buildLocalQuest(analysis.material, plan.items);

        expect(builtFromReordered.status).toBe(original.status);
        expect(builtFromReordered.questions.length).toBe(original.questions.length);
        for (const question of original.questions) {
            expect(byPlanItemId.has(question.planItemId)).toBe(true);
            expect(byPlanItemId.get(question.planItemId)).toBe(question.monster.question);
        }
    });

    test('every choice question uses same-slot distractors that cannot fit its own span', () => {
        const { analysis, built, plan } = builtQuestFor();

        for (const question of built.questions) {
            if (question.monster.questionMode !== 'choice') continue;
            const item = plan.items.find((planItem) => planItem.planItemId === question.planItemId)!;
            expect(item.template).toBe('context-recognition');
            const targetBucket = posBucketOf(item.target);
            const spanWords = new Set(item.sourceSpan.toLowerCase().match(/[a-z']+/g));
            for (const option of question.monster.options) {
                if (option === question.monster.correctAnswer) continue;
                expect(posBucketOf(option)).toBe(targetBucket);
                expect(spanWords.has(option.toLowerCase())).toBe(false);
            }
        }
        expect(analysis.status).toBe('ready');
    });

    test('returns a structured reason instead of unrelated questions when items run short', () => {
        const result = buildLocalQuest('One short sentence.', []);

        expect(result.status).toBe('insufficient');
        expect(result.reason).toBe('insufficient-local-items');
        expect(result.questions).toEqual([]);
    });
});
