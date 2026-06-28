import { inferVerbFromMode, blankTargetInSpan, pickDistractors, buildMonsterFromPlanItem, planRoleToVerb, seededShuffle, toBuildMonster } from './questionTemplates';
import type { Verb, Monster } from '@/store/gameStore';
import type { QuestionPlanItem } from './questionPlan';

function item(over: Partial<QuestionPlanItem>): QuestionPlanItem {
    return {
        role: 'cloze',
        domain: 'grammar',
        learningObjectiveId: 'present_simple',
        sourceSpan: 'She waters the plants.',
        target: 'waters',
        targetKind: 'word',
        allowedWords: [],
        supportLevel: 2,
        difficulty: 'easy',
        ...over,
    };
}

describe('inferVerbFromMode', () => {
    test('choice maps to recognize', () => {
        expect(inferVerbFromMode('choice')).toBe<Verb>('recognize');
    });
    test('typing maps to recall', () => {
        expect(inferVerbFromMode('typing')).toBe<Verb>('recall');
    });
    test('fill-blank maps to recall', () => {
        expect(inferVerbFromMode('fill-blank')).toBe<Verb>('recall');
    });
});

describe('blankTargetInSpan', () => {
    test('replaces first occurrence of target with blank marker', () => {
        const r = blankTargetInSpan('Every morning she waters the plants.', 'waters');
        expect(r).not.toBeNull();
        expect(r!.question).toBe('Every morning she ___ the plants.');
        expect(r!.correctAnswer).toBe('waters');
    });

    test('matches case-insensitively but preserves original casing', () => {
        const r = blankTargetInSpan('She Waters the plants today.', 'waters');
        expect(r!.correctAnswer).toBe('Waters');
        expect(r!.question).toBe('She ___ the plants today.');
    });

    test('returns null when target absent', () => {
        expect(blankTargetInSpan('hello world', 'xyz')).toBeNull();
    });

    test('returns null for empty target', () => {
        expect(blankTargetInSpan('hello world', '   ')).toBeNull();
    });
});

describe('pickDistractors', () => {
    test('excludes the target (and its stem-mate)', () => {
        const set = new Set(['waters', 'plants', 'morning', 'today', 'garden']);
        const d = pickDistractors('waters', set, 3);
        expect(d).not.toContain('waters');
        expect(d).toHaveLength(3);
    });

    test('sorts by length similarity to target, deterministic tie-break', () => {
        // target 'cat' (len 3): 'dog'(0),'bat'(0) tie → alpha bat<dog; then 'hi'(1)
        const set = new Set(['elephant', 'hi', 'dog', 'bat']);
        expect(pickDistractors('cat', set, 2)).toEqual(['bat', 'dog']);
    });

    test('returns fewer than count when pool is small', () => {
        expect(pickDistractors('cat', new Set(['dog']), 3)).toEqual(['dog']);
    });

    test('is deterministic (same inputs → same output)', () => {
        const set = new Set(['plants', 'morning', 'today', 'garden', 'picks']);
        expect(pickDistractors('red', set, 3)).toEqual(pickDistractors('red', set, 3));
    });
});

describe('planRoleToVerb', () => {
    test('recognition -> recognize, cloze/recall -> recall, transfer -> null', () => {
        expect(planRoleToVerb('recognition')).toBe('recognize');
        expect(planRoleToVerb('cloze')).toBe('recall');
        expect(planRoleToVerb('recall')).toBe('recall');
        expect(planRoleToVerb('transfer')).toBeNull();
    });
});

describe('buildMonsterFromPlanItem', () => {
    test('cloze role -> fill-blank monster, blank present, correctAnswer set', () => {
        const m = buildMonsterFromPlanItem(item({ role: 'cloze' }), { id: 7 });
        expect(m).not.toBeNull();
        expect(m!.verb).toBe('recall');
        expect(m!.questionMode).toBe('fill-blank');
        expect(m!.question).toContain('___');
        expect(m!.correctAnswer).toBe('waters');
        expect(m!.sourceContextSpan).toBe('She waters the plants.');
        expect(m!.id).toBe(7);
    });

    test('recall role -> typing monster', () => {
        const m = buildMonsterFromPlanItem(item({ role: 'recall' }), { id: 1 });
        expect(m!.questionMode).toBe('typing');
        expect(m!.correctAnswer).toBe('waters');
    });

    test('recognition role -> choice monster with 4 options, correct at correct_index', () => {
        const allowed = new Set(['plants', 'morning', 'today', 'garden', 'picks']);
        const m = buildMonsterFromPlanItem(
            item({ role: 'recognition', target: 'waters' }),
            { id: 2, allowedSet: allowed }
        );
        expect(m).not.toBeNull();
        expect(m!.questionMode).toBe('choice');
        expect(m!.options).toHaveLength(4);
        expect(m!.options[m!.correct_index]).toBe('waters');
        expect(new Set(m!.options).size).toBe(4); // no duplicates
    });

    test('recognition with too few distractors -> null (let bank handle)', () => {
        const m = buildMonsterFromPlanItem(
            item({ role: 'recognition' }),
            { id: 1, allowedSet: new Set(['plants']) }
        );
        expect(m).toBeNull();
    });

    test('transfer role -> null (apply verb is P3)', () => {
        expect(buildMonsterFromPlanItem(item({ role: 'transfer' }), { id: 1 })).toBeNull();
    });

    test('target not in span -> null (defensive)', () => {
        expect(
            buildMonsterFromPlanItem(item({ sourceSpan: 'She runs fast.', target: 'waters' }), { id: 1 })
        ).toBeNull();
    });
});

describe('seededShuffle', () => {
    test('is deterministic (same seed -> same order)', () => {
        const a = ['a', 'b', 'c', 'd', 'e'];
        expect(seededShuffle(a, 7)).toEqual(seededShuffle(a, 7));
    });
    test('contains the same elements', () => {
        const a = ['a', 'b', 'c', 'd', 'e'];
        const out = seededShuffle(a, 7);
        expect(out.slice().sort()).toEqual(a.slice().sort());
    });
    test('different seeds can produce different orders', () => {
        const a = ['a', 'b', 'c', 'd', 'e'];
        const orders = new Set([seededShuffle(a, 1).join(','), seededShuffle(a, 2).join(','), seededShuffle(a, 3).join(',')]);
        expect(orders.size).toBeGreaterThan(1);
    });
});

describe('toBuildMonster', () => {
    const base: Monster = {
        id: 5, type: 'vocab', question: 'q', options: ['a', 'b', 'c', 'd'],
        correct_index: 0, explanation: '', skillTag: 'vocab:x', difficulty: 'easy',
        questionMode: 'choice', correctAnswer: 'a', sourceContextSpan: 'She waters the plants today.',
        learningObjectiveId: 'vocab_context_meaning', supportLevel: 3,
    };

    test('builds a build monster with shuffled tiles and the original sentence as correctAnswer', () => {
        const m = toBuildMonster(base);
        expect(m).not.toBeNull();
        expect(m!.verb).toBe('build');
        expect(m!.questionMode).toBe('typing');
        expect(m!.correctAnswer).toBe('She waters the plants today.');
        expect(m!.options.slice().sort()).toEqual(['She', 'waters', 'the', 'plants', 'today.'].sort());
        expect(m!.options.join(' ')).not.toBe('She waters the plants today.');
        expect(m!.id).toBe(5);
        expect(m!.skillTag).toBe('vocab:x');
        expect(m!.sourceContextSpan).toBe('She waters the plants today.');
    });

    test('returns null when span is missing', () => {
        expect(toBuildMonster({ ...base, sourceContextSpan: undefined })).toBeNull();
    });

    test('returns null when span is too short (<4 words)', () => {
        expect(toBuildMonster({ ...base, sourceContextSpan: 'She runs.' })).toBeNull();
    });

    test('returns null for the sanitized_fallback placeholder span', () => {
        expect(toBuildMonster({ ...base, sourceContextSpan: 'sanitized_fallback' })).toBeNull();
    });
});
