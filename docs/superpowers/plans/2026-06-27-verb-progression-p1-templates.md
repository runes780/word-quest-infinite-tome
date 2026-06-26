# 动词-成长解锁树 P1：确定性出题模板（安全网优先）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 引入确定性出题模板，从已验证的 plan item 机械构造 Monster，并在管线安全网中**优先于 canned fallback 题库**使用——使被 critic 拒绝的题被替换成仍扎根于玩家材料的题，而非重复、脱节的预制句。

**Architecture:** P1 只动安全网（最低风险、可证模式），不动 happy-path 的 LLM generate 阶段。新增 `src/lib/data/questionTemplates.ts`（纯函数模板）与 `src/lib/data/safetyNet.ts`（替换调度），并把管线内联的安全网块替换为调用。同时加入前向兼容的 `verb`/`confusables`/`synonyms` schema 字段，为 P2（新动词渲染）与 P3（match/correct）铺路。所有模板遵守 1T 语境法则（target 来自 validated plan 的 sourceSpan），构造上不可能幻觉。

**Tech Stack:** TypeScript 5（严格模式）、Jest 30（`npm test`）、Zustand/Dexie（仅加可选字段，不迁数据）。模板为纯函数，沿用 `fallbackQuestions.ts`/`questionQuality.ts` 既有模式。

**关联 spec:** `docs/superpowers/specs/2026-06-26-verb-progression-design.md`（§4/§6/§10 P1）。

---

## 文件结构

| 文件 | 职责 | 本计划动作 |
|---|---|---|
| `src/store/gameStore.ts` | `Verb` 类型 + `Monster` 定义 | 新增 `Verb` 类型与 `Monster.verb?` |
| `src/db/db.ts` | `CachedQuestion` 缓存 | 新增 `CachedQuestion.verb?` |
| `src/lib/data/questionPlan.ts` | `QuestionPlanItem` | 新增可选 `confusables?`/`synonyms?` |
| `src/lib/data/questionTemplates.ts`（新） | 确定性模板纯函数 | 创建 |
| `src/lib/data/questionTemplates.test.ts`（新） | 模板单测 | 创建 |
| `src/lib/data/safetyNet.ts`（新） | 安全网替换调度（模板优先 → 题库兜底） | 创建 |
| `src/lib/data/safetyNet.test.ts`（新） | 安全网单测 | 创建 |
| `src/lib/ai/questionPipeline.ts` | 三阶段管线 | 安全网块改为调用 `replaceFailedMonsters` |

**向后兼容说明**：`verb` 可选，P1 动词（recognize/recall）可由 `questionMode` 经 `inferVerbFromMode` 重新推导，故 Monster→CachedQuestion 的缓存映射**本阶段无需显式携带 verb**（缺失时按 format 推导）；P2 会显式持久化。

---

## Task 1: 前向兼容 schema：`Verb` 类型与可选字段

**Files:**
- Modify: `src/store/gameStore.ts`（`QuestionMode` 旁加 `Verb`；`Monster` 加 `verb?`）
- Modify: `src/db/db.ts`（`CachedQuestion` 加 `verb?`）
- Modify: `src/lib/data/questionPlan.ts`（`QuestionPlanItem` 加 `confusables?`/`synonyms?`）
- Create: `src/lib/data/questionTemplates.ts`
- Create: `src/lib/data/questionTemplates.test.ts`

- [ ] **Step 1: 写失败测试 `inferVerbFromMode`**

Create `src/lib/data/questionTemplates.test.ts`:

```ts
import { inferVerbFromMode } from './questionTemplates';
import type { Verb } from '@/store/gameStore';

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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- questionTemplates`
Expected: FAIL — `inferVerbFromMode is not defined` / 模块无导出。

- [ ] **Step 3: 加 schema 字段与最小实现**

In `src/store/gameStore.ts`, directly under the `QuestionMode` line (~line 122):

```ts
export type QuestionMode = 'choice' | 'typing' | 'fill-blank';
// 认知动词（正交于渲染格式 questionMode）。P1 仅 recognize/recall 由模板产出；
// listen/match/build/correct/apply 在 P2/P3 解锁后引入。
export type Verb = 'recognize' | 'recall' | 'listen' | 'match' | 'build' | 'correct' | 'apply';
```

In the `Monster` interface (add after `sourceActionEstimatedMinutes?: number;`, ~line 153):

```ts
    sourceActionEstimatedMinutes?: number;
    verb?: Verb; // 认知动词；缺失时由 questionMode 经 inferVerbFromMode 推导（P1）
```

In `src/db/db.ts`, add `verb?` to `CachedQuestion` (find the `interface CachedQuestion` near line 60; add the import and field):

```ts
import type { ..., Verb } from '@/store/gameStore'; // 在已有 gameStore 类型导入里追加 Verb
```
```ts
    // 在 CachedQuestion 的 questionMode?/correctAnswer? 附近追加：
    verb?: Verb;
```

In `src/lib/data/questionPlan.ts`, add to `QuestionPlanItem` (after `allowedWords: string[];`):

```ts
    allowedWords: string[];
    /** 易混词，供 correct 动词（P3）使用；P1 仅 schema 预留。 */
    confusables?: string[];
    /** 同义/反义，供 match 动词（P3）使用；P1 仅 schema 预留。 */
    synonyms?: string[];
```

Create `src/lib/data/questionTemplates.ts`:

```ts
import type { QuestionMode, Verb } from '@/store/gameStore';

/**
 * 由渲染格式推导认知动词（P1 向后兼容：老题/缓存题无 verb 字段时使用）。
 * P2 引入新渲染器后将由 verb 字段直接判定。
 */
export function inferVerbFromMode(mode: QuestionMode): Verb {
    if (mode === 'choice') return 'recognize';
    return 'recall'; // typing / fill-blank
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -- questionTemplates`
Expected: PASS（3 passed）。

- [ ] **Step 5: 回归——跑受影响套件**

Run: `npm test -- questionPipeline questionPlan questionModes`
Expected: PASS（schema 仅加可选字段，不应破坏现有断言）。

- [ ] **Step 6: 提交**

```bash
git add src/store/gameStore.ts src/db/db.ts src/lib/data/questionPlan.ts src/lib/data/questionTemplates.ts src/lib/data/questionTemplates.test.ts
git commit -m "feat(verbs): add Verb type + forward-compatible verb/confusables/synonyms schema fields"
```

---

## Task 2: 核心机械操作 `blankTargetInSpan`

**Files:**
- Modify: `src/lib/data/questionTemplates.ts`
- Modify: `src/lib/data/questionTemplates.test.ts`

- [ ] **Step 1: 写失败测试**

Append to `src/lib/data/questionTemplates.test.ts`:

```ts
import { blankTargetInSpan } from './questionTemplates';

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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- questionTemplates`
Expected: FAIL — `blankTargetInSpan is not defined`。

- [ ] **Step 3: 实现**

Append to `src/lib/data/questionTemplates.ts`:

```ts
/**
 * 把 span 中第一个（大小写不敏感）target 替换成 "___"。返回 null 表示 target
 * 不在 span 中（防御性——plan validator 对 word/phrase/grammar_form/reference
 * 保证存在，但模板绝不因非合规 item 抛错）。correctAnswer 保留原文大小写。
 */
export function blankTargetInSpan(
    span: string,
    target: string
): { question: string; correctAnswer: string } | null {
    const t = target.trim();
    if (!t) return null;
    const idx = span.toLowerCase().indexOf(t.toLowerCase());
    if (idx === -1) return null;
    const actual = span.slice(idx, idx + t.length);
    const question = span.slice(0, idx) + '___' + span.slice(idx + t.length);
    return { question, correctAnswer: actual };
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -- questionTemplates`
Expected: PASS（7 passed）。

- [ ] **Step 5: 提交**

```bash
git add src/lib/data/questionTemplates.ts src/lib/data/questionTemplates.test.ts
git commit -m "feat(templates): add blankTargetInSpan core helper"
```

---

## Task 3: 确定性干扰项 `pickDistractors`

**Files:**
- Modify: `src/lib/data/questionTemplates.ts`
- Modify: `src/lib/data/questionTemplates.test.ts`

- [ ] **Step 1: 写失败测试**

Append to `src/lib/data/questionTemplates.test.ts`:

```ts
import { pickDistractors } from './questionTemplates';

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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- questionTemplates`
Expected: FAIL — `pickDistractors is not defined`。

- [ ] **Step 3: 实现**

Append to `src/lib/data/questionTemplates.ts`（顶部补 import）:

```ts
import { normalizeWord } from './textNormalize';
```

Append the function:

```ts
/**
 * 从 allowedSet（material ∪ common words）确定性挑 `count` 个干扰项，用于
 * cloze-as-MCQ。排除 target 及其词干等价词，按与 target 的长度相近度排序（长度
 * 相近的干扰项更合理）。无 RNG，输入确定则输出确定，便于测试。池不足时返回少于
 * `count` 个。
 */
export function pickDistractors(target: string, allowedSet: Set<string>, count: number): string[] {
    const targetNorm = normalizeWord(target);
    const unique = Array.from(
        new Set(
            Array.from(allowedSet)
                .map((w) => w.toLowerCase())
                .filter((w) => w.length >= 2 && normalizeWord(w) !== targetNorm)
        )
    );
    const targetLen = target.length;
    unique.sort((a, b) => {
        const sa = Math.abs(a.length - targetLen);
        const sb = Math.abs(b.length - targetLen);
        return sa !== sb ? sa - sb : a.localeCompare(b);
    });
    return unique.slice(0, count);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -- questionTemplates`
Expected: PASS（11 passed）。

- [ ] **Step 5: 提交**

```bash
git add src/lib/data/questionTemplates.ts src/lib/data/questionTemplates.test.ts
git commit -m "feat(templates): add deterministic pickDistractors"
```

---

## Task 4: 模板派发器 `buildMonsterFromPlanItem`

**Files:**
- Modify: `src/lib/data/questionTemplates.ts`
- Modify: `src/lib/data/questionTemplates.test.ts`

- [ ] **Step 1: 写失败测试**

Append to `src/lib/data/questionTemplates.test.ts`:

```ts
import { buildMonsterFromPlanItem, planRoleToVerb } from './questionTemplates';
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- questionTemplates`
Expected: FAIL — `buildMonsterFromPlanItem` / `planRoleToVerb` 未定义。

- [ ] **Step 3: 实现**

Append to `src/lib/data/questionTemplates.ts`（顶部补类型 import）:

```ts
import type { Monster } from '@/store/gameStore';
import type { QuestionPlanItem } from './questionPlan';
```

Append:

```ts
export interface TemplateContext {
    id: number;
    /** 供 recognition 干扰项挑选；缺省回退到 COMMON_WORD_SET。 */
    allowedSet?: Set<string>;
}

/** plan role -> 可模板化的动词。transfer（apply）在 P3 之前返回 null。 */
export function planRoleToVerb(role: QuestionPlanItem['role']): Verb | null {
    switch (role) {
        case 'recognition':
            return 'recognize';
        case 'cloze':
        case 'recall':
            return 'recall';
        default:
            return null;
    }
}

/**
 * 从一个 validated plan item 确定性构造 Monster（零 LLM）。遵守 1T 语境法则：
 * 句子来自 item.sourceSpan，只挖掉 item.target。返回 null 表示该 role 暂不支持
 * 或 target 不在 span 中——调用方（安全网）应回退到题库。
 */
export function buildMonsterFromPlanItem(
    item: QuestionPlanItem,
    ctx: TemplateContext
): Monster | null {
    const verb = planRoleToVerb(item.role);
    if (!verb) return null;
    const blanked = blankTargetInSpan(item.sourceSpan, item.target);
    if (!blanked) return null;

    const shared = {
        id: ctx.id,
        type: item.domain,
        skillTag: `${item.domain}:${item.learningObjectiveId}`,
        difficulty: item.difficulty,
        learningObjectiveId: item.learningObjectiveId,
        supportLevel: item.supportLevel,
        attemptKind: item.role === 'transfer' ? ('transfer' as const) : ('practice' as const),
        sourceContextSpan: item.sourceSpan,
        explanation: `The word is "${blanked.correctAnswer}". Full sentence: "${item.sourceSpan}".`,
        hint: 'Think about what fits the blank.',
        verb,
    };

    if (item.role === 'cloze') {
        return {
            ...shared,
            question: `Read: "${blanked.question}"`,
            options: [],
            correct_index: 0,
            questionMode: 'fill-blank',
            correctAnswer: blanked.correctAnswer,
        };
    }

    if (item.role === 'recall') {
        return {
            ...shared,
            question: `Read: "${blanked.question}". Type the missing word.`,
            options: [],
            correct_index: 0,
            questionMode: 'typing',
            correctAnswer: blanked.correctAnswer,
        };
    }

    // recognition -> cloze rendered as multiple choice
    const { COMMON_WORD_SET } = require('./commonWords'); // 见下方 Step 4 说明，改用顶部 import
    const pool = ctx.allowedSet ?? COMMON_WORD_SET;
    const distractors = pickDistractors(item.target, pool, 3);
    if (distractors.length < 3) return null;
    const correct_index = ctx.id % 4;
    const options: string[] = [];
    let dIdx = 0;
    for (let i = 0; i < 4; i += 1) {
        if (i === correct_index) options.push(blanked.correctAnswer);
        else options.push(distractors[dIdx++]);
    }
    return {
        ...shared,
        question: `Read: "${blanked.question}". Which word fits the blank?`,
        options,
        correct_index,
        questionMode: 'choice',
        correctAnswer: blanked.correctAnswer,
    };
}
```

- [ ] **Step 4: 修正 import（不要用 require）**

在 `src/lib/data/questionTemplates.ts` 顶部 import 区追加（与其它顶部 import 一起，删除函数体内的 `require` 行）:

```ts
import { COMMON_WORD_SET } from './commonWords';
```

并把函数体内 `const { COMMON_WORD_SET } = require('./commonWords');` 删除，保留 `const pool = ctx.allowedSet ?? COMMON_WORD_SET;`。

- [ ] **Step 5: 跑测试确认通过**

Run: `npm test -- questionTemplates`
Expected: PASS（全部用例）。

- [ ] **Step 6: 提交**

```bash
git add src/lib/data/questionTemplates.ts src/lib/data/questionTemplates.test.ts
git commit -m "feat(templates): add buildMonsterFromPlanItem dispatcher (cloze/recall/recognition)"
```

---

## Task 5: 安全网调度 `replaceFailedMonsters`（模板优先 → 题库兜底）

**Files:**
- Create: `src/lib/data/safetyNet.ts`
- Create: `src/lib/data/safetyNet.test.ts`
- Modify: `src/lib/ai/questionPipeline.ts`（安全网块 ~line 202-212 改为调用）

- [ ] **Step 1: 写失败测试**

Create `src/lib/data/safetyNet.test.ts`:

```ts
import { replaceFailedMonsters } from './safetyNet';
import type { Monster } from '@/store/gameStore';
import type { QuestionPlan } from './questionPlan';

const plan: QuestionPlan = {
    levelTitle: 't',
    materialSummary: 'm',
    vocabularyAllowed: [],
    items: [
        {
            role: 'cloze', domain: 'grammar', learningObjectiveId: 'present_simple',
            sourceSpan: 'She waters the plants.', target: 'waters', targetKind: 'word',
            allowedWords: [], supportLevel: 2, difficulty: 'easy',
        },
        {
            role: 'recognition', domain: 'vocab', learningObjectiveId: 'vocab_context_meaning',
            sourceSpan: 'The tomatoes are red.', target: 'red', targetKind: 'word',
            allowedWords: [], supportLevel: 3, difficulty: 'easy',
        },
    ],
};

function monster(id: number, type: Monster['type']): Monster {
    return {
        id, type, question: 'bad unfaithful', options: ['a', 'b', 'c', 'd'],
        correct_index: 0, explanation: '', skillTag: 'x', difficulty: 'easy',
        questionMode: 'choice', correctAnswer: 'a',
    };
}

describe('replaceFailedMonsters', () => {
    test('replaces a failed cloze slot with a material-grounded template monster', () => {
        const monsters = [monster(1, 'grammar'), monster(2, 'vocab')];
        const out = replaceFailedMonsters(monsters, [0], plan, {
            allowedSet: new Set(['she', 'waters', 'the', 'plants', 'tomatoes', 'red']),
            material: 'She waters the plants.',
            maxDifficulty: 'easy',
        });
        expect(out[0].verb).toBe('recall');
        expect(out[0].sourceContextSpan).toBe('She waters the plants.');
        expect(out[0].correctAnswer).toBe('waters');
        expect(out[0].questionMode).toBe('fill-blank');
    });

    test('leaves non-failed slots untouched', () => {
        const monsters = [monster(1, 'grammar'), monster(2, 'vocab')];
        const out = replaceFailedMonsters(monsters, [0], plan, {
            allowedSet: new Set(['she', 'waters', 'the', 'plants']),
            material: 'She waters the plants.',
            maxDifficulty: 'easy',
        });
        expect(out[1]).toBe(monsters[1]);
    });

    test('returns original length and order', () => {
        const monsters = [monster(1, 'grammar'), monster(2, 'vocab')];
        const out = replaceFailedMonsters(monsters, [1], plan, {
            allowedSet: new Set(['she', 'waters', 'the', 'plants']),
            material: 'She waters the plants.',
            maxDifficulty: 'easy',
        });
        expect(out).toHaveLength(2);
    });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npm test -- safetyNet`
Expected: FAIL — `safetyNet` 模块不存在。

- [ ] **Step 3: 实现 `safetyNet.ts`**

Create `src/lib/data/safetyNet.ts`:

```ts
import type { Monster } from '@/store/gameStore';
import { assessQuestionQuality } from './questionQuality';
import { buildMonsterFromPlanItem } from './questionTemplates';
import { fallbackToMonster, getBalancedFallbackQuestions } from './fallbackQuestions';
import type { QuestionPlan } from './questionPlan';

export interface SafetyNetContext {
    allowedSet: Set<string>;
    material: string;
    maxDifficulty: 'easy' | 'medium' | 'hard';
}

/**
 * 替换 critic 拒绝且修复失败的 monster。P1：优先用确定性、扎根材料的模板
 * （仍绑定学习者材料），仅在模板构造不出或过不了质量门时回退到 canned 题库；
 * 题库也耗尽则标记 lowConfidence。绝不让被拒题原样发出。
 */
export function replaceFailedMonsters(
    monsters: Monster[],
    failedIndices: number[],
    plan: QuestionPlan,
    ctx: SafetyNetContext
): Monster[] {
    const next = [...monsters];
    failedIndices.forEach((idx) => {
        const original = next[idx];
        if (!original) return;
        const planItem = plan.items[idx] ?? plan.items[0];

        const templated = buildMonsterFromPlanItem(planItem, {
            id: original.id,
            allowedSet: ctx.allowedSet,
        });
        if (
            templated &&
            assessQuestionQuality(templated, {
                maxDifficulty: ctx.maxDifficulty,
                allowedSet: ctx.allowedSet,
                material: ctx.material,
                target: planItem.target,
            }).accepted
        ) {
            next[idx] = templated;
            return;
        }

        const [fb] = getBalancedFallbackQuestions(1, ctx.maxDifficulty);
        if (fb) {
            next[idx] = fallbackToMonster(fb, original.id);
        } else {
            (next[idx] as Monster & { lowConfidence?: boolean }).lowConfidence = true;
        }
    });
    return next;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npm test -- safetyNet`
Expected: PASS（3 passed）。

- [ ] **Step 5: 接入管线**

In `src/lib/ai/questionPipeline.ts`, add to imports (near the other `@/lib/data` imports, ~line 14-21):

```ts
import { replaceFailedMonsters } from '@/lib/data/safetyNet';
```

Replace the safety-net block (the `if (failedIndices.length > 0) { ... }` at ~line 202-212) with:

```ts
            if (failedIndices.length > 0) {
                const replaced = replaceFailedMonsters(monsters, failedIndices, plan, {
                    allowedSet: profile.vocabulary.allowed,
                    material: text,
                    maxDifficulty: profile.maxQuestionDifficulty,
                });
                replaced.forEach((m, i) => {
                    monsters[i] = m;
                });
            }
```

- [ ] **Step 6: 回归——管线套件**

Run: `npm test -- questionPipeline`
Expected: PASS。若某既有用例断言"替换物来自 fallback 题库"（如断言 garden/rain 文本），则把它改为断言"替换物扎根于 plan 材料"（`sourceContextSpan` 为某 plan span）——这是本计划的有意行为变更。

- [ ] **Step 7: 提交**

```bash
git add src/lib/data/safetyNet.ts src/lib/data/safetyNet.test.ts src/lib/ai/questionPipeline.ts
git commit -m "feat(pipeline): template-first safety net replaces rejected questions with material-grounded items"
```

---

## Task 6: 全量回归与类型检查

**Files:** 无新文件。

- [ ] **Step 1: 全量测试**

Run: `npm test`
Expected: 全部 PASS（新增 questionTemplates + safetyNet 套件通过，既有套件无回归）。

- [ ] **Step 2: 类型检查（通过 build）**

Run: `npm run build`
Expected: 构建成功，无 TS 错误（验证 `Verb`/`verb?`/`confusables?`/`synonyms?` 加字段后类型自洽）。

- [ ] **Step 3: 可选——live 验证 fallback 占比下降**

若需量化收益（spec §14 验证标准），跑：`LIVE_TESTS=1 npm test -- questionPipeline.live`
（读取本机 Chrome localStorage 的 DeepSeek key；见 [[question-pipeline-live-verification]]）。观察 critic 拒绝的题是否被**扎根材料的模板题**替换（而非 garden/rain 预制句）。该步可选、默认跳过。

- [ ] **Step 4: 提交（若有 lint/build 修复）**

```bash
git add -A
git commit -m "chore(verbs-p1): full regression green"
```

---

## Self-Review（写完后自查记录）

**1. Spec 覆盖**：
- §4 动词目录 recognize/recall 的模板化 → Task 2/3/4 ✓
- §6 模板引擎（plan 决定测什么 / 模板决定怎么拼）→ Task 4 `buildMonsterFromPlanItem` ✓
- §10 P1「模板覆盖现有 recognize/recall + plan schema 加可选字段 + fallback↓」→ Task 1（schema）+ Task 5（安全网模板优先）+ Task 6（回归）✓
- §11 决策 2「P1 模板地基优先」→ 本计划即 P1，且只动安全网（最低风险）✓
- §8 数据模型 `verb`/`confusables`/`synonyms` → Task 1 ✓
- 未覆盖（故意留给后续 plan）：listen/match/build/correct/apply 渲染器（P2/P3）、解锁树 `unlockedVerbs`（P2/P4）、可变奖励+叙事（P4）。这些是独立 plan，不在 P1 范围。

**2. 占位符扫描**：无 TBD/TODO；每个 code step 含完整代码；命令含 expected 输出。✓

**3. 类型一致性**：`Verb`、`TemplateContext`、`SafetyNetContext`、`buildMonsterFromPlanItem`、`planRoleToVerb`、`blankTargetInSpan`、`pickDistractors`、`replaceFailedMonsters`、`inferVerbFromMode` 名称与签名跨任务一致。`COMMON_WORD_SET` 顶部 import（Task 4 Step 4 已纠正 require）。✓

**4. 范围**：P1 为单一可交付单元（模板 + 安全网接入），独立产出可测软件。P2–P4 另起 plan。
