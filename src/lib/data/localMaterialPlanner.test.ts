import {
    analyzeLocalMaterial,
    hasAdjacentSameTarget,
    localTargetFacetLabel,
    planLocalQuest,
    spanDisambiguatesPreposition,
    MIN_LOCAL_TARGETS,
    normalizeMaterialForAnalysis
} from './localMaterialPlanner';

const SYNTHETIC_MATERIAL =
    'Yesterday was Sunday. Mia went to the park with her friends. ' +
    'They played football under a big tree. The weather was sunny and warm. ' +
    'She shared her sandwiches because everyone was hungry. ' +
    'Later they walked beside the river and watched the birds.';

const DISAMBIGUATED_MATERIAL =
    'Yesterday was Monday. Mia went to school on Tuesday. ' +
    'The class starts at nine o\'clock every morning. ' +
    'She found her notebook and opened it quietly. ' +
    'Her teacher smiled because everyone was happy that day.';

describe('local material analysis', () => {
    test('finds 3-8 grounded targets with source spans for English material', () => {
        const analysis = analyzeLocalMaterial(SYNTHETIC_MATERIAL);

        expect(analysis.status).toBe('ready');
        expect(analysis.targets.length).toBeGreaterThanOrEqual(MIN_LOCAL_TARGETS);
        expect(analysis.targets.length).toBeLessThanOrEqual(8);
        for (const target of analysis.targets) {
            expect(analysis.material.includes(target.sourceSpan)).toBe(true);
            expect(target.sourceSpan.toLowerCase()).toContain(target.target.toLowerCase());
        }
    });

    test('maps each target kind to a registered objective id', () => {
        const analysis = analyzeLocalMaterial(SYNTHETIC_MATERIAL);
        const knownObjectives = new Set([
            'vocab_context_meaning',
            'past_tense_basic',
            'preposition_place_time',
            'pronoun_reference'
        ]);

        expect(analysis.targets.length).toBeGreaterThan(0);
        for (const target of analysis.targets) {
            expect(knownObjectives.has(target.learningObjectiveId)).toBe(true);
        }
    });

    test('rejects empty, Chinese-only, mixed, and too-short material with structured reasons', () => {
        expect(analyzeLocalMaterial('')).toEqual(expect.objectContaining({
            status: 'insufficient',
            reason: 'material-empty'
        }));
        expect(analyzeLocalMaterial('这是一个中文测试材料,没有任何英文内容。')).toEqual(expect.objectContaining({
            status: 'insufficient',
            reason: 'material-not-english'
        }));
        expect(analyzeLocalMaterial('Today is Monday. 今天天气很好。 We have class.'))
            .toEqual(expect.objectContaining({ status: 'insufficient', reason: 'material-not-english' }));
        expect(analyzeLocalMaterial('The cat sat on the mat.')).toEqual(expect.objectContaining({
            status: 'insufficient',
            reason: 'material-too-short'
        }));
    });

    test('repeated identical sentences do not duplicate targets', () => {
        const repeated = 'The boy kicked the ball quickly. '.repeat(4);
        const analysis = analyzeLocalMaterial(repeated);

        // The material has enough words, but only a couple of distinct targets.
        const normalizedTargets = new Set(analysis.targets.map((target) => target.target.toLowerCase()));
        expect(normalizedTargets.size).toBe(analysis.targets.length);
    });

    test('target extraction respects word boundaries and casing', () => {
        const analysis = analyzeLocalMaterial(SYNTHETIC_MATERIAL);
        const herTarget = analysis.targets.find((target) => target.target.toLowerCase() === 'her');

        // "her" must be found as a whole word, not inside "there"/"other".
        expect(herTarget).toBeDefined();
        expect(herTarget!.sourceSpan).toContain('her');
    });

    test('punctuation-heavy and uppercase material still analyzes deterministically', () => {
        const material = 'hana visited the museum! she painted a picture of the GARDEN... ' +
            'they waited near the entrance? everyone admired her beautiful painting. ' +
            'after that, they walked home together quietly.';
        const first = analyzeLocalMaterial(material);
        const second = analyzeLocalMaterial(material);

        expect(first).toEqual(second);
    });
});

describe('local quest planning', () => {
    test('same material and selection produce the same plan', () => {
        const first = planLocalQuest(analyzeLocalMaterial(SYNTHETIC_MATERIAL), allTargetIds(SYNTHETIC_MATERIAL));
        const second = planLocalQuest(analyzeLocalMaterial(SYNTHETIC_MATERIAL), allTargetIds(SYNTHETIC_MATERIAL));

        expect(first).toEqual(second);
    });

    test('plans 6-8 items carrying plan metadata', () => {
        const analysis = analyzeLocalMaterial(SYNTHETIC_MATERIAL);
        const plan = planLocalQuest(analysis, allTargetIds(SYNTHETIC_MATERIAL));

        expect(plan.status).toBe('ready');
        expect(plan.items.length).toBeGreaterThanOrEqual(6);
        expect(plan.items.length).toBeLessThanOrEqual(8);
        for (const item of plan.items) {
            expect(item.planItemId).toBeTruthy();
            expect(item.planItemId).not.toMatch(/^\d+$/);
            expect(analysis.material.includes(item.sourceSpan)).toBe(true);
            expect(item.sourceSpan.toLowerCase()).toContain(item.target.toLowerCase());
            expect(item.cognitiveAction).toBeTruthy();
            expect([0, 1, 2, 3]).toContain(item.supportLevel);
            expect(['easy', 'medium', 'hard']).toContain(item.difficulty);
        }
    });

    test('plan item ids are unique per target and template', () => {
        const plan = planLocalQuest(analyzeLocalMaterial(SYNTHETIC_MATERIAL), allTargetIds(SYNTHETIC_MATERIAL));
        const ids = plan.items.map((item) => item.planItemId);

        expect(new Set(ids).size).toBe(ids.length);
    });

    test('excluded targets never appear in the plan', () => {
        const analysis = analyzeLocalMaterial(SYNTHETIC_MATERIAL);
        const removed = analysis.targets.slice(0, analysis.targets.length - MIN_LOCAL_TARGETS);
        const kept = analysis.targets.filter((target) => !removed.includes(target)).map((t) => t.targetId);

        const plan = planLocalQuest(analysis, kept);

        expect(plan.status).toBe('ready');
        const plannedTargets = new Set(plan.items.map((item) => item.targetId));
        for (const target of removed) {
            expect(plannedTargets.has(target.targetId)).toBe(false);
        }
    });

    test('fewer than three selected targets returns a structured reason', () => {
        const analysis = analyzeLocalMaterial(SYNTHETIC_MATERIAL);
        const plan = planLocalQuest(analysis, analysis.targets.slice(0, 2).map((t) => t.targetId));

        expect(plan).toEqual(expect.objectContaining({
            status: 'insufficient',
            reason: 'too-few-targets'
        }));
    });

    test('normalizeMaterialForAnalysis collapses whitespace so spans stay substrings', () => {
        const material = normalizeMaterialForAnalysis('First sentence.\n\nSecond   sentence with   gaps.');
        const analysis = analyzeLocalMaterial(material);

        expect(analysis.material).toBe(material);
        for (const target of analysis.targets) {
            expect(material.includes(target.sourceSpan)).toBe(true);
        }
    });
});

describe('local quest task constructs', () => {
    test('targets carry honest form facets: word and pronoun blanks are practice-only', () => {
        const analysis = analyzeLocalMaterial(SYNTHETIC_MATERIAL);

        for (const target of analysis.targets) {
            if (target.targetKind === 'word') {
                expect(target.taskFacet).toBe('vocab-form');
                expect(target.measurementEligibility).toBe('practice-only');
            } else if (target.targetKind === 'reference') {
                expect(target.taskFacet).toBe('pronoun-form');
                expect(target.measurementEligibility).toBe('practice-only');
            } else if (target.learningObjectiveId === 'past_tense_basic') {
                expect(target.taskFacet).toBe('grammar-form');
                expect(target.measurementEligibility).toBe('objective-evidence');
            } else {
                expect(target.taskFacet).toBe('grammar-form');
            }
        }
    });

    test('a cue-disambiguated preposition can carry objective evidence; a bare one cannot', () => {
        expect(spanDisambiguatesPreposition('at', 'The class starts at nine o\'clock every morning.')).toBe(true);
        expect(spanDisambiguatesPreposition('on', 'Mia went to school on Tuesday.')).toBe(true);
        expect(spanDisambiguatesPreposition('under', 'They played football under a big tree.')).toBe(false);
        expect(spanDisambiguatesPreposition('near', 'Later they walked near the river.')).toBe(false);

        const analysis = analyzeLocalMaterial(DISAMBIGUATED_MATERIAL);
        const clockAt = analysis.targets.find((target) => target.target.toLowerCase() === 'at');
        expect(clockAt).toBeDefined();
        expect(clockAt!.targetKind).toBe('grammar_form');
        expect(clockAt!.taskFacet).toBe('grammar-form');
        expect(clockAt!.measurementEligibility).toBe('objective-evidence');
    });

    test('plan items carry a coherent same-source task contract', () => {
        const analysis = analyzeLocalMaterial(SYNTHETIC_MATERIAL);
        const plan = planLocalQuest(analysis, analysis.targets.map((target) => target.targetId));

        expect(plan.status).toBe('ready');
        for (const item of plan.items) {
            expect(item.learningTask.schemaVersion).toBe(1);
            expect(item.learningTask.contextRelation).toBe('same-source');
            expect(item.learningTask.encounterRole).toBe('skirmish');
            expect(['recognize-form', 'retrieve-form']).toContain(item.learningTask.cognitiveAction);

            const target = analysis.targets.find((entry) => entry.targetId === item.targetId);
            expect(target).toBeDefined();
            expect(item.learningTask.targetFacet).toBe(target!.taskFacet);
            expect(item.learningTask.measurementEligibility).toBe(target!.measurementEligibility);
        }
    });

    test('two items for the same target are never adjacent in the plan', () => {
        for (const material of [SYNTHETIC_MATERIAL, DISAMBIGUATED_MATERIAL]) {
            const analysis = analyzeLocalMaterial(material);
            const plan = planLocalQuest(analysis, analysis.targets.map((target) => target.targetId));
            expect(plan.status).toBe('ready');
            expect(hasAdjacentSameTarget(plan.items)).toBe(false);
            // Every repeated target is separated by at least one other target.
            for (let index = 2; index < plan.items.length; index += 1) {
                expect(plan.items[index - 2].targetId === plan.items[index].targetId).toBe(false);
            }
        }
    });

    test('facet labels name the practiced form instead of the discovered objective', () => {
        const analysis = analyzeLocalMaterial(SYNTHETIC_MATERIAL);
        const word = analysis.targets.find((target) => target.targetKind === 'word');
        const pronoun = analysis.targets.find((target) => target.targetKind === 'reference');
        const past = analysis.targets.find((target) => target.learningObjectiveId === 'past_tense_basic');

        expect(word).toBeDefined();
        expect(pronoun).toBeDefined();
        expect(past).toBeDefined();
        expect(localTargetFacetLabel(word!, 'en')).toBe('word form');
        expect(localTargetFacetLabel(word!, 'zh')).toBe('词形练习');
        expect(localTargetFacetLabel(pronoun!, 'en')).toBe('pronoun form');
        expect(localTargetFacetLabel(pronoun!, 'zh')).toBe('代词形式练习');
        expect(localTargetFacetLabel(past!, 'en')).toBe('past-tense form');
        expect(localTargetFacetLabel(past!, 'zh')).toBe('过去时形式练习');
    });
});

function allTargetIds(material: string): string[] {
    return analyzeLocalMaterial(material).targets.map((target) => target.targetId);
}
