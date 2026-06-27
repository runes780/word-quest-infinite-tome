# 动词-成长解锁树 P2：解锁骨架 + listen 动词（垂直切片）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让升级真正解锁新玩法：玩家达到 globalLevel 里程碑时解锁 `listen` 动词，之后对局中出现"听音辨词"题（TTS 播目标词 + 选项），玩家首次感到"升级解锁了真东西"且玩法不再单一。

**Architecture:** 一个端到端垂直切片 = (1) 持久化 `unlockedVerbs` + 按 globalLevel 解锁的纯函数；(2) `updatePlayerProfile` 内挂钩解锁；(3) 选题阶段对已解锁玩家把部分 choice 题翻转为 listen；(4) `ListenQuestion` 渲染器（TTS + 选项）+ BattleQuestionPanel 按 verb 派发；(5) 解锁提示。listen 复用整条 choice 作答管线（options + correct_index + onChoiceSelect），**无需新回调**。`unlockedVerbs` 仅读时回填，**不升级 Dexie schema 版本**。

**Tech Stack:** TypeScript 5 strict、Jest 30（`npm test`）、React 19 + Framer Motion、Zustand、Web Speech API（`speakText`）。纯函数沿用 P1 的 `questionTemplates.ts` 模式。

**关联:** spec `docs/superpowers/specs/2026-06-26-verb-progression-design.md`（§3/§4/§5/§10 P2）；P1 计划 `docs/superpowers/plans/2026-06-27-verb-progression-p1-templates.md`。

**本计划决策（spec 容许范围内）:**
- 先做 `listen`（复用 choice 格式 + TTS，过现有质量门），`build`（word-tiles）留 P2-plan-2。
- 解锁触发 = globalLevel 里程碑（单一数据源，纯函数可单测）；掌握度触发作为 `computeUnlockedVerbs` 的可扩展快速跟进。

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `src/lib/data/verbProgression.ts`（新） | 解锁规则纯函数 + 选题翻转纯函数 | 创建 |
| `src/lib/data/verbProgression.test.ts`（新） | 上述纯函数单测 | 创建 |
| `src/db/db.ts` | GlobalPlayerProfile + getDefaultProfile + getPlayerProfile + updatePlayerProfile | 加字段/回填/挂钩 |
| `src/store/gameStore.ts` | unlockedVerbs 状态 + 加载 + 解锁提示 | 加状态/加载 |
| `src/components/ListenQuestion.tsx`（新） | listen 渲染器（TTS + 选项） | 创建 |
| `src/components/battle/BattleQuestionPanel.tsx` | verb 优先派发 + listen 分支 | 改派发 |
| `src/components/BattleInterface.tsx` | 解锁提示 toast | 加 toast |

---

## Task 1: 解锁规则纯函数 `verbProgression.ts`

**Files:** Create `src/lib/data/verbProgression.ts`, `src/lib/data/verbProgression.test.ts`

- [ ] **Step 1: 写失败测试** — create `src/lib/data/verbProgression.test.ts`:

```ts
import { computeUnlockedVerbs, newlyUnlockedVerbs, BASE_VERBS, VERB_UNLOCK_MILESTONES } from './verbProgression';

describe('computeUnlockedVerbs', () => {
    test('new player (level 1) has only base verbs', () => {
        expect(computeUnlockedVerbs(1).sort()).toEqual(['recognize', 'recall']);
    });
    test('listen unlocks at its milestone level', () => {
        const milestone = VERB_UNLOCK_MILESTONES.find((m) => m.verb === 'listen')!.level;
        expect(computeUnlockedVerbs(milestone)).toContain('listen');
        expect(computeUnlockedVerbs(milestone - 1)).not.toContain('listen');
    });
    test('higher level keeps all lower unlocks', () => {
        const all = computeUnlockedVerbs(99);
        expect(all).toEqual(expect.arrayContaining(BASE_VERBS));
        expect(all).toContain('listen');
    });
    test('returns a unique set', () => {
        const all = computeUnlockedVerbs(99);
        expect(new Set(all).size).toBe(all.length);
    });
});

describe('newlyUnlockedVerbs', () => {
    test('returns verbs gained between two levels', () => {
        const milestone = VERB_UNLOCK_MILESTONES.find((m) => m.verb === 'listen')!.level;
        expect(newlyUnlockedVerbs(milestone - 1, milestone)).toEqual(['listen']);
    });
    test('returns empty when no milestone crossed', () => {
        expect(newlyUnlockedVerbs(1, 2)).toEqual([]);
    });
});
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- verbProgression`. Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现** — create `src/lib/data/verbProgression.ts`:

```ts
import type { Verb } from '@/store/gameStore';

/** 玩家开局即拥有的动词。 */
export const BASE_VERBS: Verb[] = ['recognize', 'recall'];

/**
 * 解锁里程碑（按 level 升序）。新增动词时在此追加一行，例如：
 *   { level: 5, verb: 'build' },
 * 掌握度触发可作为本函数的可选第二入参扩展（快速跟进），当前用 level 单一数据源。
 */
export const VERB_UNLOCK_MILESTONES: Array<{ level: number; verb: Verb }> = [
    { level: 3, verb: 'listen' },
];

/**
 * 给定 globalLevel，返回该玩家已解锁的动词集合。纯函数、确定性，便于单测。
 */
export function computeUnlockedVerbs(globalLevel: number): Verb[] {
    const unlocked = new Set<Verb>(BASE_VERBS);
    for (const m of VERB_UNLOCK_MILESTONES) {
        if (globalLevel >= m.level) unlocked.add(m.verb);
    }
    return Array.from(unlocked);
}

/** 从 fromLevel 升到 toLevel 时新解锁的动词（用于解锁提示）。 */
export function newlyUnlockedVerbs(fromLevel: number, toLevel: number): Verb[] {
    const before = new Set(computeUnlockedVerbs(fromLevel));
    return computeUnlockedVerbs(toLevel).filter((v) => !before.has(v));
}
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npm test -- verbProgression`. Expected: PASS（6）。

- [ ] **Step 5: 提交**

```bash
git add src/lib/data/verbProgression.ts src/lib/data/verbProgression.test.ts
git commit -m "feat(verbs): add computeUnlockedVerbs pure unlock rule"
```

---

## Task 2: 持久化 unlockedVerbs（schema 字段 + 读时回填）

**Files:** Modify `src/db/db.ts`

- [ ] **Step 1: 加字段到接口** — in `GlobalPlayerProfile`（约 line 136 `ownedRelics` 之后，`createdAt` 之前）加:

```ts
    // Inventory persisted
    ownedRelics: string[];  // Relic IDs owned permanently

    // 动词解锁（P2）：开局 ['recognize','recall']，按 globalLevel 解锁更多
    unlockedVerbs: Verb[];
```

（`Verb` 类型已在 Task 1 由 gameStore 导出并被 db.ts 导入；若未导入，在 db.ts 顶部对 `@/store/gameStore` 的 named import 中追加 `Verb`。）

- [ ] **Step 2: 默认值** — in `getDefaultProfile()`（约 line 808 `ownedRelics: []` 之后）加:

```ts
        ownedRelics: [],
        unlockedVerbs: ['recognize', 'recall'],
```

- [ ] **Step 3: 读时回填（兼容老存档）** — in `getPlayerProfile()`（约 line 814-822），把 `if (existing) return existing;` 改为:

```ts
    if (existing) {
        // 老存档无 unlockedVerbs 字段，回填为基础动词（无需 Dexie schema 版本升级）
        return { ...existing, unlockedVerbs: existing.unlockedVerbs ?? ['recognize', 'recall'] };
    }
```

- [ ] **Step 4: 验证** — Run: `npm test -- db`. Expected: PASS（无回归）。若 `db.test.ts` 不存在则跑 `npm test -- questionPipeline` 确认 db 改动不破坏导入链。

- [ ] **Step 5: 提交**

```bash
git add src/db/db.ts
git commit -m "feat(profile): persist unlockedVerbs on GlobalPlayerProfile with read-time backfill"
```

---

## Task 3: 在 updatePlayerProfile 挂钩解锁

**Files:** Modify `src/db/db.ts`（`updatePlayerProfile`，约 line 864-869）；Create/extend `src/lib/data/verbProgression.test.ts`（集成断言可选）。

- [ ] **Step 1: 挂钩** — in `updatePlayerProfile`，在 `nextUpdates.globalLevel = calculateLevel(newXp);`（约 line 868）的 `if (nextUpdates.totalXp !== undefined) { ... }` 块**之后**追加（用"有效等级"以覆盖 totalXp 未变的调用）:

```ts
    // Recompute unlocked verbs from the effective level (P2 unlock hook)
    const effectiveLevel = nextUpdates.globalLevel ?? profile.globalLevel;
    nextUpdates.unlockedVerbs = computeUnlockedVerbs(effectiveLevel);
```

并在 db.ts 顶部 import：`import { computeUnlockedVerbs } from './verbProgression';`（注意路径，db.ts 在 src/db/，verbProgression 在 src/lib/data/，故为 `../lib/data/verbProgression`）。

> 调用方（gameStore，Task 5）通过比较 `merged.unlockedVerbs` 与旧 profile 的 `unlockedVerbs` 来检测"新解锁"并触发提示，因此这里只需保证 `merged` 携带最新 `unlockedVerbs`（已满足，因 `merged = { ...profile, ...persistableUpdates }`）。

- [ ] **Step 2: 验证** — Run: `npm test`. Expected: 全绿（ unlockedVerbs 现在总是随 profile 更新被写入，幂等）。

- [ ] **Step 3: 提交**

```bash
git add src/db/db.ts
git commit -m "feat(profile): recompute unlockedVerbs from globalLevel in updatePlayerProfile"
```

---

## Task 4: 选题翻转纯函数 `applyUnlockedVerbs`

**Files:** Create/extend `src/lib/data/verbProgression.ts`, `src/lib/data/verbProgression.test.ts`

- [ ] **Step 1: 写失败测试** — append to `src/lib/data/verbProgression.test.ts`:

```ts
import { applyUnlockedVerbs } from './verbProgression';
import type { Monster } from '@/store/gameStore';

function choiceMonster(id: number): Monster {
    return {
        id, type: 'vocab', question: 'q', options: ['a', 'b', 'c', 'd'],
        correct_index: 0, explanation: '', skillTag: 'x', difficulty: 'easy',
        questionMode: 'choice', correctAnswer: 'a',
    };
}

describe('applyUnlockedVerbs', () => {
    test('does nothing when listen is not unlocked', () => {
        const qs = [choiceMonster(0), choiceMonster(1)];
        const out = applyUnlockedVerbs(qs, ['recognize', 'recall']);
        expect(out.every((q) => q.verb === undefined)).toBe(true);
    });

    test('flips a deterministic subset of choice questions to listen when unlocked', () => {
        const qs = [choiceMonster(0), choiceMonster(1), choiceMonster(2), choiceMonster(3)];
        const out = applyUnlockedVerbs(qs, ['recognize', 'recall', 'listen']);
        const listenCount = out.filter((q) => q.verb === 'listen').length;
        expect(listenCount).toBeGreaterThan(0);
        expect(listenCount).toBeLessThan(qs.length); // not all flipped
        // deterministic
        expect(applyUnlockedVerbs(qs, ['recognize', 'recall', 'listen']).map((q) => q.verb))
            .toEqual(out.map((q) => q.verb));
    });

    test('preserves correct_index/options so the choice answer path still works', () => {
        const qs = [choiceMonster(0)];
        const out = applyUnlockedVerbs(qs, ['recognize', 'recall', 'listen']);
        const listen = out.find((q) => q.verb === 'listen');
        if (listen) {
            expect(listen.correct_index).toBe(0);
            expect(listen.options).toEqual(['a', 'b', 'c', 'd']);
            expect(listen.correctAnswer).toBe('a');
        }
    });

    test('leaves non-choice questions untouched', () => {
        const typing: Monster = { ...choiceMonster(0), questionMode: 'typing' };
        const out = applyUnlockedVerbs([typing], ['recognize', 'recall', 'listen']);
        expect(out[0].verb === 'listen' ? true : (out[0].questionMode === 'typing')).toBe(true);
        // typing never flipped to listen
        expect(out[0].questionMode).toBe('typing');
    });
});
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- verbProgression`. Expected: FAIL（`applyUnlockedVerbs` 未定义）。

- [ ] **Step 3: 实现** — append to `src/lib/data/verbProgression.ts`（顶部补 import）:

```ts
import type { Monster } from '@/store/gameStore';
```

append 函数:

```ts
/**
 * 对已解锁 listen 的玩家，把 choice 题按确定规则翻转一部分为 listen（听音辨词），
 * 引入新模态（语音回路）带来的交错多样性。非 choice 题不动；未解锁 listen 则原样返回。
 * 确定性（无 RNG）：按数组下标翻转，便于测试与稳定体验。
 */
export function applyUnlockedVerbs<T extends Monster>(questions: T[], unlockedVerbs: Verb[]): T[] {
    if (!unlockedVerbs.includes('listen')) return questions;
    return questions.map((q, i) => {
        if (q.questionMode === 'choice' && i % 2 === 0) {
            return { ...q, verb: 'listen' as Verb };
        }
        return q;
    });
}
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npm test -- verbProgression`. Expected: PASS（全部）。

- [ ] **Step 5: 提交**

```bash
git add src/lib/data/verbProgression.ts src/lib/data/verbProgression.test.ts
git commit -m "feat(verbs): add applyUnlockedVerbs selection transform (choice->listen)"
```

---

## Task 5: gameStore 状态——加载 unlockedVerbs + 检测新解锁

**Files:** Modify `src/store/gameStore.ts`

- [ ] **Step 1: 定位现状** — grep 出 gameStore 中：玩家档案加载处（找 `getPlayerProfile` 调用）、`answerQuestion` 里调用 `updatePlayerProfile` 的位置、以及 store 状态类型定义处。把这些行号记下来用于精准编辑。

```bash
grep -n "getPlayerProfile\|updatePlayerProfile\|unlockedVerbs\|interface GameState\|type GameState" src/store/gameStore.ts
```

- [ ] **Step 2: 加状态字段** — 在 gameStore 的状态接口（`GameState` 或等价）中加两个字段（与现有 `playerStats` 等并列）:

```ts
    unlockedVerbs: Verb[];          // 当前已解锁动词（默认 BASE_VERBS）
    pendingUnlock: Verb[];          // 待提示的新解锁动词（UI toast 消费后清空）
```

并在 store 的初始 state 中初始化:

```ts
    unlockedVerbs: ['recognize', 'recall'],
    pendingUnlock: [],
```

（顶部 import：`import type { Verb } from ...`（同文件已有 Verb 定义则无需）；`import { computeUnlockedVerbs, newlyUnlockedVerbs, BASE_VERBS } from '@/lib/data/verbProgression';`）

- [ ] **Step 3: 加载时同步** — 在 gameStore 已有"加载玩家档案"的动作里（grep 找到的 `getPlayerProfile` 处），拿到 profile 后设置:

```ts
        set({ unlockedVerbs: profile.unlockedVerbs ?? ['recognize', 'recall'] });
```

- [ ] **Step 4: 答题后检测新解锁** — 在 `answerQuestion` 调用 `updatePlayerProfile(...)` 拿到 `merged` profile 之后（grep 找到的位置），比较并触发提示:

```ts
            // P2: detect newly unlocked verbs and surface them
            const previous = get().unlockedVerbs;
            const fresh = (merged.unlockedVerbs ?? []).filter((v) => !previous.includes(v));
            if (fresh.length > 0) {
                set({ unlockedVerbs: merged.unlockedVerbs ?? previous, pendingUnlock: fresh });
            }
```

（确保 `merged` 变量名与 `updatePlayerProfile` 调用的接收变量一致；若该调用未接收返回值，改为 `const merged = await updatePlayerProfile({...})`。）

- [ ] **Step 5: 加清空动作** — 在 store 的 actions 里加（供 UI toast 关闭后调用）:

```ts
    clearPendingUnlock: () => set({ pendingUnlock: [] }),
```

（若 store 用显式 actions 对象，按其模式追加。）

- [ ] **Step 6: 验证** — Run: `npm test`. Expected: 全绿（仅加状态与同步，不改答题判定逻辑）。

- [ ] **Step 7: 提交**

```bash
git add src/store/gameStore.ts
git commit -m "feat(game): load unlockedVerbs into store + surface newly-unlocked verbs"
```

---

## Task 6: 选题阶段接入 applyUnlockedVerbs

**Files:** Modify 题目入库点（定位）；很可能涉及 `src/components/battle/useEndlessWave.ts` 与 gameStore 的题目加载动作。

- [ ] **Step 1: 定位题目入库点** — grep 出所有把生成/规范化后的题目写入 store 的位置:

```bash
grep -rn "normalizeMissionMonsters\|set({ questions\|setQuestions\|questions:" src/store src/components/battle src/components/InputSection.tsx
```

记下每个入库点（至少：初始题目加载 + useEndlessWave 追加）。

- [ ] **Step 2: 在每个入库点应用翻转** — 在题目进入 store 之前，用当前 `unlockedVerbs` 翻转。在每个入库点（拿到 `monsters`/`questions` 之后、`set` 之前）插入:

```ts
import { applyUnlockedVerbs } from '@/lib/data/verbProgression';
// ...
const finalQuestions = applyUnlockedVerbs(monsters, useGameStore.getState().unlockedVerbs);
// 用 finalQuestions 入库
```

（在 React 组件中若已有 `useGameStore`，可用 selector 取 `unlockedVerbs`；在 store action 内用 `get().unlockedVerbs`。）

- [ ] **Step 3: 验证** — Run: `npm test`. Expected: 全绿。手动逻辑确认：未解锁 listen 时 `applyUnlockedVerbs` 原样返回（无副作用），故对新手体验零影响。

- [ ] **Step 4: 提交**

```bash
git add <入库点文件们>
git commit -m "feat(game): flip choice->listen for players who unlocked listen at question intake"
```

---

## Task 7: ListenQuestion 渲染器

**Files:** Create `src/components/ListenQuestion.tsx`

- [ ] **Step 1: 实现组件** — create `src/components/ListenQuestion.tsx`（参照 `TypingQuestion.tsx` 的 props/样式模式；本题是"听音 + 选选项"）:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2, Shield, Sword } from 'lucide-react';
import { cn } from '@/lib/utils';
import { speakText } from '@/lib/tts';
import type { Monster } from '@/store/gameStore';

interface ListenQuestionProps {
    question: Monster;
    selectedOption: number | null;
    isCorrect: boolean;
    showResult: boolean;
    disabled?: boolean;
    onAnswer: (index: number) => void;
    hiddenOptions?: number[]; // clarity effect 兼容
}

export function ListenQuestion({
    question,
    selectedOption,
    isCorrect,
    showResult,
    disabled,
    onAnswer,
    hiddenOptions = [],
}: ListenQuestionProps) {
    // 播目标词（choice 的正确选项即 correctAnswer）
    const target = question.correctAnswer || question.options[question.correct_index] || '';

    useEffect(() => {
        if (!disabled && target) {
            speakText(target, 'en-US');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [question.id]);

    const replay = () => {
        if (target) speakText(target, 'en-US');
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-300 text-xs font-bold uppercase tracking-wider">
                    Listen
                </span>
                <button
                    type="button"
                    onClick={replay}
                    disabled={showResult}
                    className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 disabled:opacity-50"
                >
                    <Volume2 className="w-4 h-4" />
                    Replay
                </button>
            </div>

            <p className="text-sm text-muted-foreground">
                Choose the word you heard.
            </p>

            <div className="grid grid-cols-1 gap-3">
                {question.options.map((option, index) => {
                    const clarityDisabled = hiddenOptions.includes(index);
                    const isSelected = selectedOption === index;
                    return (
                        <motion.button
                            key={index}
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: index * 0.1 }}
                            type="button"
                            onClick={() => onAnswer(index)}
                            disabled={showResult || clarityDisabled}
                            className={cn(
                                'w-full p-4 rounded-xl border-2 text-left font-medium transition-all hover:shadow-md hover:scale-[1.02]',
                                clarityDisabled && 'opacity-40 pointer-events-none grayscale',
                                isSelected
                                    ? isCorrect
                                        ? 'border-green-500 bg-green-500/10 text-green-500'
                                        : 'border-destructive bg-destructive/10 text-destructive'
                                    : 'border-border bg-card hover:border-primary hover:bg-primary/5'
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-lg">{option}</span>
                                {isSelected && (isCorrect
                                    ? <Sword className="w-5 h-5 animate-bounce" />
                                    : <Shield className="w-5 h-5 animate-pulse" />)}
                            </div>
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
}
```

- [ ] **Step 2: 验证** — Run: `npm test`. Expected: 全绿（新组件尚无单测；构建会编译它）。若项目有组件测试 lint，确认无报错。

- [ ] **Step 3: 提交**

```bash
git add src/components/ListenQuestion.tsx
git commit -m "feat(listen): add ListenQuestion renderer (TTS target + choice options)"
```

---

## Task 8: BattleQuestionPanel 按 verb 派发 + listen 分支

**Files:** Modify `src/components/battle/BattleQuestionPanel.tsx`

- [ ] **Step 1: import** — 在文件顶部加:

```ts
import { ListenQuestion } from '@/components/ListenQuestion';
import { inferVerbFromMode } from '@/lib/data/questionTemplates';
import type { Verb } from '@/store/gameStore';
```

- [ ] **Step 2: 计算 verb** — 在组件内（约 line 62 `const uiLanguage = ...` 附近）加:

```ts
    const verb: Verb = currentQuestion.verb ?? inferVerbFromMode(currentQuestion.questionMode || 'choice');
```

- [ ] **Step 3: 加 listen 分支** — 把现有派发三元（约 line 157）从：
```tsx
                {(!currentQuestion.questionMode || currentQuestion.questionMode === 'choice') ? (
```
改为 verb 优先（在原三元之前包一层 listen 判断）。即把整段 choice/typing/fill-blank 渲染替换为：

```tsx
                {verb === 'listen' ? (
                    <ListenQuestion
                        question={currentQuestion}
                        selectedOption={selectedOption}
                        isCorrect={isCorrect}
                        showResult={showResult}
                        disabled={showResult}
                        onAnswer={onChoiceSelect}
                        hiddenOptions={
                            clarityEffect && clarityEffect.questionId === currentQuestion.id
                                ? clarityEffect.hiddenOptions
                                : undefined
                        }
                    />
                ) : (!currentQuestion.questionMode || currentQuestion.questionMode === 'choice') ? (
                    <div className="grid grid-cols-1 gap-3">
                        {currentQuestion.options.map((option, index) => {
```

（即：在原 `(!currentQuestion.questionMode ...)` 三元**之前**插入 `verb === 'listen' ? <ListenQuestion .../> :`，其余 choice/typing/fill-blank 分支原样不动。listen 复用 `onChoiceSelect` → `handleOptionClick` → `answerQuestion(index)`，**无需新回调**。）

- [ ] **Step 4: 验证** — Run: `npm test`. Expected: 全绿。`npm run build` 确认 TS 通过（ListenQuestion props 与 BattleQuestionPanel 传入一致）。

- [ ] **Step 5: 提交**

```bash
git add src/components/battle/BattleQuestionPanel.tsx
git commit -m "feat(battle): dispatch by verb, render ListenQuestion for listen"
```

---

## Task 9: 解锁提示 toast

**Files:** Modify `src/components/BattleInterface.tsx`

- [ ] **Step 1: 取状态** — 在 BattleInterface 顶部 `useGameStore` 选择器里加（与现有 `currentQuestion` 等并列）:

```ts
    const pendingUnlock = useGameStore((s) => s.pendingUnlock);
    const clearPendingUnlock = useGameStore((s) => s.clearPendingUnlock);
```

- [ ] **Step 2: 渲染 toast** — 在 BattleInterface 的返回 JSX 顶层（与现有 `<MentorOverlay .../>` 同级）加一个轻量 toast：

```tsx
            <AnimatePresence>
                {pendingUnlock.length > 0 && (
                    <motion.div
                        initial={{ y: -40, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -40, opacity: 0 }}
                        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl bg-purple-600 text-white shadow-xl flex items-center gap-3"
                    >
                        <span className="text-2xl">🔓</span>
                        <div>
                            <p className="font-bold">
                                {language === 'zh' ? '解锁新题型！' : 'New question type unlocked!'}
                            </p>
                            <p className="text-sm opacity-90 capitalize">
                                {pendingUnlock.join(', ')}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={clearPendingUnlock}
                            className="ml-2 text-white/80 hover:text-white"
                        >
                            ✕
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
```

（确认 `AnimatePresence`/`motion` 已在 BattleInterface 顶部 import；若无需补。）

- [ ] **Step 3: 验证** — Run: `npm test`. Expected: 全绿。`npm run build` 确认编译。

- [ ] **Step 4: 提交**

```bash
git add src/components/BattleInterface.tsx
git commit -m "feat(battle): show unlock toast when new verbs unlock"
```

---

## Task 10: 全量回归 + 构建终检

**Files:** 无新文件。

- [ ] **Step 1: 全量测试** — Run: `npm test`. Expected: 全绿。

- [ ] **Step 2: 构建** — Run: `npm run build`. Expected: 编译成功、TypeScript 通过。

- [ ] **Step 3: 自检清单**
  - 未解锁 listen 的玩家：选题翻转无副作用（applyUnlockedVerbs 原样返回）。
  - 已解锁 listen 的玩家：choice 题按 `i%2===0` 翻转为 listen；listen 题进 ListenQuestion（TTS 播目标词），复用 onChoiceSelect 判分。
  - 升级跨过 level 3：updatePlayerProfile 重算 unlockedVerbs，gameStore 检测到 fresh → toast。
  - 老存档：getPlayerProfile 回填 unlockedVerbs 为基础动词。
  - 现有 choice/typing/fill-blank 流程未被破坏（verb 仅在 listen 时改派发，其余走原 questionMode 三元）。

- [ ] **Step 4: 提交（若有修复）** — 若 lint/build 有修复则提交；否则跳过。**不要 `git add -A`**（工作区有用户 WIP）。

---

## Self-Review

**1. Spec 覆盖**：
- §3 verb×format / verb 派发 → Task 8（verb-first dispatch）✓
- §4 listen 动词（TTS 播 span/target + choice）→ Task 7 ✓
- §5 解锁树骨架（unlockedVerbs + 里程碑解锁 + 进入交错轮换）→ Task 1/2/3/5/6 ✓
- §10 P2「首批新动词 listen + 解锁骨架」→ 全计划 ✓
- 未覆盖（留给后续 plan）：build（word-tiles，P2-plan-2）、match/correct/apply（P3）、可变奖励+章节叙事（P4）。

**2. 占位符**：每个 code step 含完整代码；Task 5/6 含定位 grep + 精准编辑指令（因入库点需现场定位）。

**3. 类型一致性**：`Verb`（gameStore 导出）、`unlockedVerbs: Verb[]`、`pendingUnlock: Verb[]`、`computeUnlockedVerbs/globalLevel→Verb[]`、`applyUnlockedVerbs<T extends Monster>`、ListenQuestion props 与 BattleQuestionPanel 传入一致。

**4. 范围**：单个垂直切片（解锁骨架 + listen），独立可交付。build/listen-match 等留独立 plan。

**5. 风险**：
- Task 5/6 入库点定位依赖现场 grep——若 gameStore 结构与预期不符，实现者应 NEEDS_CONTEXT 反馈而非臆测。
- listen 复用 choice 管线：已确认 `answerQuestion(index)` 按 `correct_index` 判分，options 不变 → 安全。
- TTS：浏览器 Web Speech API，SSR 安全（`speakText` 已 guard `window`）；听音题在禁用 TTS 的浏览器上仍可用（玩家看不到字、只能靠 Replay，可接受；若需兜底可后续在题目里补文字提示）。
