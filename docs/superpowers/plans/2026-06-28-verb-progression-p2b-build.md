# 动词-成长解锁树 P2b：build 动词（word-tiles 造句）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 加第二个新动词 `build`（词序造句）：玩家达到 globalLevel 5 解锁后，对局中部分题变成"把打乱的词块重新排成原句"。从"被动选择"变成"主动重构"，Bloom Apply/Create 层、不同动作 verb，对"单一"改善最大。

**Architecture:** build 题在**选题层**（startGame/addQuestions）从题目的 `sourceContextSpan` 构造：tokenize 源句→确定性洗牌→word-tiles。**不经过质量门**（assessQuestionQuality 只在管线内运行）。**复用 typing 作答管线**：BuildQuestion 渲染器内部判分（排列是否匹配原句）→ `onTypingAnswer(correct, arranged)`，无需新回调。`questionMode='typing'`（避免触发 choice 专属 VoiceInput）。`verb='build'` 派发。

**Tech Stack:** TS 5 strict、Jest 30、React 19 + Framer Motion、Zustand。沿用 P1/P2 的 `questionTemplates.ts`/`verbProgression.ts` 模式。

**关联:** spec `docs/superpowers/specs/2026-06-26-verb-progression-design.md`（§4 build）；P2-listen 计划 `2026-06-27-...-p2-listen-unlock.md`。

**决策:** build 在 globalLevel 5 解锁（listen 在 3，build 更深故更晚）。

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `src/lib/data/questionTemplates.ts` | `seededShuffle` + `toBuildMonster` | 追加 |
| `src/lib/data/questionTemplates.test.ts` | 上述单测 | 追加 |
| `src/lib/data/verbProgression.ts` | `applyBuildVerb` 选择变换 + build 里程碑 | 追加 |
| `src/lib/data/verbProgression.test.ts` | applyBuildVerb 单测 | 追加 |
| `src/components/BuildQuestion.tsx`（新） | word-tiles 渲染器 | 创建 |
| `src/components/battle/BattleQuestionPanel.tsx` | verb='build' 派发分支 | 改 |
| `src/store/gameStore.ts` | startGame/addQuestions 接入 applyBuildVerb | 改 |

---

## Task 1: `seededShuffle` + `toBuildMonster` 模板

**Files:** Modify `src/lib/data/questionTemplates.ts`, `src/lib/data/questionTemplates.test.ts`

- [ ] **Step 1: 写失败测试** — append to `src/lib/data/questionTemplates.test.ts`:

```ts
import { seededShuffle, toBuildMonster } from './questionTemplates';

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
        // tiles are the span's words
        expect(m!.options.slice().sort()).toEqual(['She', 'waters', 'the', 'plants', 'today.'].sort());
        // shuffled order must differ from the original
        expect(m!.options.join(' ')).not.toBe('She waters the plants today.');
        // metadata inherited
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
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- questionTemplates`. Expected: FAIL.

- [ ] **Step 3: 实现** — append to `src/lib/data/questionTemplates.ts`:

```ts
/** 确定性 PRNG（mulberry32）——给 shuffle 一个可复现的种子，避免 Math.random。 */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Fisher-Yates 洗牌，种子确定则结果确定（无 Math.random）。不修改原数组。 */
export function seededShuffle<T>(items: T[], seed: number): T[] {
    const out = [...items];
    const rng = mulberry32(seed || 1);
    for (let i = out.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
}

const MIN_BUILD_WORDS = 4;

/**
 * 把一道题改造成 build（词序造句）题：用 sourceContextSpan 的词作为可拖拽词块，
 * 正确排列 = 原句。继承原题的 id/skillTag/domain/objective/supportLevel 等元数据，
 * 只换 verb/questionMode/options/correctAnswer/question。返回 null 表示该题不适合 build
 * （无 span / 词太少 / 占位符 span）。零 LLM、零幻觉（句子就是原文 span）。
 */
export function toBuildMonster(question: Monster): Monster | null {
    const span = question.sourceContextSpan;
    if (!span || span === 'sanitized_fallback') return null;
    const words = span.match(/[A-Za-z''-]+/g);
    if (!words || words.length < MIN_BUILD_WORDS) return null;

    let tiles = seededShuffle(words, question.id);
    // 确保打乱后不等于原序（否则直接给出答案）
    if (tiles.join(' ') === words.join(' ')) {
        tiles = [...tiles.slice(1), tiles[0]];
    }
    return {
        ...question,
        verb: 'build',
        questionMode: 'typing', // 避免触发 choice 专属 VoiceInput；build 题不经过质量门
        options: tiles,
        correct_index: 0,
        correctAnswer: span,
        question: 'Rebuild the sentence.',
    };
}
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npm test -- questionTemplates`. Expected: PASS（含原有 + 新增）。

- [ ] **Step 5: 提交**

```bash
git add src/lib/data/questionTemplates.ts src/lib/data/questionTemplates.test.ts
git commit -m "feat(templates): add seededShuffle + toBuildMonster (word-tiles build verb)"
```

---

## Task 2: `applyBuildVerb` 选择变换 + build 解锁里程碑

**Files:** Modify `src/lib/data/verbProgression.ts`, `src/lib/data/verbProgression.test.ts`

- [ ] **Step 1: 加里程碑** — in `verbProgression.ts`, extend `VERB_UNLOCK_MILESTONES`:

```ts
export const VERB_UNLOCK_MILESTONES: Array<{ level: number; verb: Verb }> = [
    { level: 3, verb: 'listen' },
    { level: 5, verb: 'build' },
];
```

- [ ] **Step 2: 写失败测试** — append to `src/lib/data/verbProgression.test.ts`:

```ts
import { applyBuildVerb } from './verbProgression';

describe('applyBuildVerb', () => {
    function withSpan(id: number, span: string): Monster {
        return {
            id, type: 'vocab', question: 'q', options: ['a', 'b', 'c', 'd'],
            correct_index: 0, explanation: '', skillTag: 'x', difficulty: 'easy',
            questionMode: 'choice', correctAnswer: 'a', sourceContextSpan: span,
        };
    }

    test('does nothing when build is not unlocked', () => {
        const qs = [withSpan(0, 'She waters the plants today.')];
        const out = applyBuildVerb(qs, ['recognize', 'recall', 'listen']);
        expect(out[0].verb === 'build').toBe(false);
    });

    test('converts a subset to build when build is unlocked', () => {
        const qs = [
            withSpan(0, 'She waters the plants today.'),
            withSpan(1, 'He walks to school in the rain.'),
            withSpan(2, 'The tomatoes are red and ready.'),
        ];
        const out = applyBuildVerb(qs, ['recognize', 'recall', 'listen', 'build']);
        const buildCount = out.filter((q) => q.verb === 'build').length;
        expect(buildCount).toBeGreaterThan(0);
        expect(buildCount).toBeLessThan(qs.length); // not all
        // deterministic
        expect(applyBuildVerb(qs, ['recognize', 'recall', 'listen', 'build']).map((q) => q.verb))
            .toEqual(out.map((q) => q.verb));
    });

    test('skips questions already turned into listen', () => {
        const listenQ: Monster = { ...withSpan(0, 'She waters the plants today.'), verb: 'listen' };
        const out = applyBuildVerb([listenQ], ['recognize', 'recall', 'listen', 'build']);
        expect(out[0].verb).toBe('listen'); // untouched
    });

    test('leaves questions with unusable spans untouched', () => {
        const qs = [withSpan(0, 'sanitized_fallback')];
        const out = applyBuildVerb(qs, ['recognize', 'recall', 'listen', 'build']);
        expect(out[0].verb === 'build').toBe(false);
    });
});
```

- [ ] **Step 3: 跑测试确认失败** — Run: `npm test -- verbProgression`. Expected: FAIL.

- [ ] **Step 4: 实现** — append to `src/lib/data/verbProgression.ts`（顶部已有 `Monster` import）:

```ts
import { toBuildMonster } from './questionTemplates';

/**
 * 对已解锁 build 的玩家，把一部分题（有可用 sourceContextSpan、且未被翻成 listen）
 * 改造成 build（词序造句）题。确定性（按数组下标选子集）。未解锁 build 或无可用题则原样返回。
 */
export function applyBuildVerb<T extends Monster>(questions: T[], unlockedVerbs: Verb[]): T[] {
    if (!unlockedVerbs.includes('build')) return questions;
    return questions.map((q, i) => {
        if (q.verb === 'listen') return q;          // don't override listen
        if (i % 3 !== 0) return q;                   // deterministic subset (~1/3)
        const built = toBuildMonster(q);
        return built ?? q;
    });
}
```

- [ ] **Step 5: 跑测试确认通过** — Run: `npm test -- verbProgression`. Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add src/lib/data/verbProgression.ts src/lib/data/verbProgression.test.ts
git commit -m "feat(verbs): add applyBuildVerb selection transform + build unlock at level 5"
```

---

## Task 3: BuildQuestion 渲染器

**Files:** Create `src/components/BuildQuestion.tsx`

- [ ] **Step 1: 创建组件** — create `src/components/BuildQuestion.tsx`（参照 TypingQuestion 模式；本题是"点词块组句"）。词块来自 `question.options`（已洗牌），目标句 = `question.correctAnswer`：

```tsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, PenTool, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Monster } from '@/store/gameStore';

interface BuildQuestionProps {
    question: Monster;
    onAnswer: (isCorrect: boolean, userInput: string) => void;
    disabled?: boolean;
}

function normalizeSentence(s: string): string {
    return s.toLowerCase().replace(/[^a-z''\s]/g, '').replace(/\s+/g, ' ').trim();
}

export function BuildQuestion({ question, onAnswer, disabled }: BuildQuestionProps) {
    const tiles: string[] = question.options ?? [];
    const target = question.correctAnswer ?? '';
    const [arranged, setArranged] = useState<number[]>([]); // indices into tiles
    const [feedback, setFeedback] = useState<'correct' | 'incorrect' | null>(null);

    const remaining = tiles.map((_, i) => i).filter((i) => !arranged.includes(i));

    const addTile = (i: number) => {
        if (disabled || feedback) return;
        setArranged((prev) => [...prev, i]);
    };
    const removeLast = () => {
        if (disabled || feedback) return;
        setArranged((prev) => prev.slice(0, -1));
    };
    const reset = () => {
        if (disabled || feedback) return;
        setArranged([]);
    };

    const submit = () => {
        if (arranged.length !== tiles.length || disabled || feedback) return;
        const built = arranged.map((i) => tiles[i]).join(' ');
        const isCorrect = normalizeSentence(built) === normalizeSentence(target);
        setFeedback(isCorrect ? 'correct' : 'incorrect');
        setTimeout(() => {
            onAnswer(isCorrect, built);
            setArranged([]);
            setFeedback(null);
        }, 1500);
    };

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <PenTool className="w-4 h-4" />
                <span>Rebuild the sentence</span>
            </div>

            {/* Arrangement area */}
            <div className={cn(
                'min-h-[64px] p-4 rounded-2xl border-2 border-dashed transition-all flex flex-wrap gap-2 items-start',
                feedback === 'correct' ? 'border-green-500 bg-green-500/10'
                    : feedback === 'incorrect' ? 'border-red-500 bg-red-500/10'
                    : 'border-border bg-secondary/40'
            )}>
                {arranged.length === 0 && (
                    <span className="text-sm text-muted-foreground italic">Tap the words in order…</span>
                )}
                {arranged.map((tileIdx, pos) => (
                    <span key={pos} className="px-3 py-2 rounded-xl bg-card border border-border text-lg font-medium shadow-sm">
                        {tiles[tileIdx]}
                    </span>
                ))}
                <AnimatePresence>
                    {feedback && (
                        <motion.span
                            initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                            className={cn('ml-auto self-center p-2 rounded-full', feedback === 'correct' ? 'bg-green-500' : 'bg-red-500')}
                        >
                            {feedback === 'correct' ? <Check className="w-4 h-4 text-white" /> : <X className="w-4 h-4 text-white" />}
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>

            {/* Available tiles */}
            <div className="flex flex-wrap gap-2">
                {remaining.map((i) => (
                    <motion.button
                        key={i}
                        type="button"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        onClick={() => addTile(i)}
                        disabled={disabled || !!feedback}
                        className="px-4 py-3 rounded-xl bg-primary/10 border-2 border-primary/20 text-lg font-medium hover:bg-primary/20 hover:border-primary/40 transition-all disabled:opacity-40"
                    >
                        {tiles[i]}
                    </motion.button>
                ))}
            </div>

            {/* Controls */}
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={removeLast}
                    disabled={!arranged.length || disabled || !!feedback}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary/50 hover:bg-secondary text-muted-foreground transition-colors disabled:opacity-50"
                >
                    <RotateCcw className="w-4 h-4" />
                    Undo
                </button>
                <button
                    type="button"
                    onClick={reset}
                    disabled={!arranged.length || disabled || !!feedback}
                    className="px-4 py-3 rounded-xl bg-secondary/50 hover:bg-secondary text-muted-foreground transition-colors disabled:opacity-50"
                >
                    Clear
                </button>
                <button
                    type="button"
                    onClick={submit}
                    disabled={arranged.length !== tiles.length || disabled || !!feedback}
                    className={cn(
                        'flex-1 py-3 rounded-xl font-bold transition-all',
                        arranged.length !== tiles.length || disabled || feedback
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/25'
                    )}
                >
                    Submit
                </button>
            </div>

            {/* Correct sentence reveal on wrong */}
            <AnimatePresence>
                {feedback === 'incorrect' && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
                        className="p-4 rounded-xl bg-red-500/10 border border-red-500/30"
                    >
                        <div className="text-red-500">
                            <span className="font-medium">Correct sentence: </span>
                            <span className="font-bold">{target}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
```

- [ ] **Step 2: 验证编译** — Run: `npm test`. Expected: 全绿（新组件无单测，但需编译通过）。`npm run build` 确认 TS 通过。

- [ ] **Step 3: 提交**

```bash
git add src/components/BuildQuestion.tsx
git commit -m "feat(build): add BuildQuestion renderer (word-tiles sentence rebuild)"
```

---

## Task 4: BattleQuestionPanel 加 build 派发分支

**Files:** Modify `src/components/battle/BattleQuestionPanel.tsx`

- [ ] **Step 1: import** — 顶部加：

```ts
import { BuildQuestion } from '@/components/BuildQuestion';
```

- [ ] **Step 2: 加 build 分支** — 在现有派发里，`verb === 'listen'` 分支**之前**（build 优先级与 listen 并列，但 build 用 typing 管线、listen 用 choice 管线，互斥），把派发开头从：

```tsx
                {verb === 'listen' ? (
```

改为（在 listen 之前插入 build）：

```tsx
                {verb === 'build' ? (
                    <BuildQuestion
                        question={currentQuestion}
                        onAnswer={onTypingAnswer}
                        disabled={showResult}
                    />
                ) : verb === 'listen' ? (
```

（build 复用 `onTypingAnswer` → `handleTextQuestionAnswer` → `answerQuestion(correct ? correct_index : -1, {userResponse})`，与 typing/fill-blank 同管线，**无需新回调**。其余 listen/choice/typing/fill-blank 分支不动。）

- [ ] **Step 3: 验证** — Run: `npm test`. Expected: 全绿。`npm run build` 确认 TS 通过。

- [ ] **Step 4: 提交**

```bash
git add src/components/battle/BattleQuestionPanel.tsx
git commit -m "feat(battle): dispatch verb=build to BuildQuestion"
```

---

## Task 5: 在 startGame / addQuestions 接入 applyBuildVerb

**Files:** Modify `src/store/gameStore.ts`

- [ ] **Step 1: import** — 在 gameStore 顶部已有的 verbProgression import 行追加 `applyBuildVerb`（当前是 `import { applyUnlockedVerbs } from '@/lib/data/verbProgression';`）：

```ts
import { applyUnlockedVerbs, applyBuildVerb } from '@/lib/data/verbProgression';
```

- [ ] **Step 2: startGame** — 在 `startGame` 里，当前是：

```ts
        const incomingFlipped = applyUnlockedVerbs(questions, get().unlockedVerbs);
        const preparedIncoming = incomingFlipped.map((q, idx) => ...);
```

改为（listen 翻转之后再做 build 改造；build 会跳过已是 listen 的题）：

```ts
        const incomingFlipped = applyUnlockedVerbs(questions, get().unlockedVerbs);
        const incomingBuilt = applyBuildVerb(incomingFlipped, get().unlockedVerbs);
        const preparedIncoming = incomingBuilt.map((q, idx) =>
            applyLearningMetadataForSource(applyQuestionDefaults(q, preparedRevenge.length + idx), source)
        );
```

- [ ] **Step 3: addQuestions** — 当前是：

```ts
        const flipped = applyUnlockedVerbs(processedQuestions, get().unlockedVerbs);
        set({ questions: [...questions, ...flipped] });
```

改为：

```ts
        const flipped = applyUnlockedVerbs(processedQuestions, get().unlockedVerbs);
        const built = applyBuildVerb(flipped, get().unlockedVerbs);
        set({ questions: [...questions, ...built] });
```

- [ ] **Step 4: 验证** — Run: `npm test`. Expected: 全绿。`npm run build` 确认 TS 通过。

- [ ] **Step 5: 提交**

```bash
git add src/store/gameStore.ts
git commit -m "feat(game): apply build transform at startGame/addQuestions for build-unlocked players"
```

---

## Task 6: 全量回归 + 构建终检

**Files:** 无新文件。

- [ ] **Step 1: 全量测试** — Run: `npm test`. Expected: 全绿。

- [ ] **Step 2: 构建** — Run: `npm run build`. Expected: 编译成功、TS 通过。

- [ ] **Step 3: 自检清单**
  - 未解锁 build 的玩家（globalLevel < 5）：applyBuildVerb 原样返回，零影响。
  - 已解锁 build：约 1/3 的可用题（有 ≥4 词 sourceContextSpan、非 listen）变成 build；build 题进 BuildQuestion，复用 typing 作答管线判分。
  - build 题不经过质量门（选题层构造），questionMode='typing' 不触发 VoiceInput。
  - listen 与 build 不冲突（build 跳过已是 listen 的题）。
  - 现有 choice/typing/fill-blank/listen 流程未被破坏。

- [ ] **Step 4: 提交（若有修复）** — 不要 `git add -A`（工作区有用户 WIP）。

---

## Self-Review

**1. Spec 覆盖**：§4 build 动词（word-tiles 词序造句，句子=源 span）→ Task 1/3 ✓；§5 解锁（build @ level 5）→ Task 2 ✓；选题交错 → Task 2/5 ✓。未覆盖（留 P3）：apply/match/correct。

**2. 占位符**：每个 code step 含完整代码。

**3. 类型一致性**：`seededShuffle<T>`、`toBuildMonster(question): Monster|null`、`applyBuildVerb<T extends Monster>`、BuildQuestion props 与 BattleQuestionPanel 传入（`onAnswer={onTypingAnswer}`，签名 `(correct, input)` 匹配）一致。

**4. 风险**：
- build 题不经过质量门——确认 assessQuestionQuality 只在管线内（已核实）。
- sourceContextSpan 可能是 'sanitized_fallback' 或太短——toBuildMonster 已防御（返回 null，变换跳过）。
- 洗牌可能等于原序——seededShuffle 后做 rotate 兜底。
- questionMode='typing' 的 build 题是否触发其它 typing 专属逻辑？派发是 verb 优先，typing 分支不会渲染；其它消费方（错题本/FSRS）按 questionMode 归类为 typing，属轻微误归类但不破坏。
