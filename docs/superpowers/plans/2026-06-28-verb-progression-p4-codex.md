# 动词-成长解锁树 P4a：动词典籍（Verb Codex）可见成长面板实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让"升级解锁"从一次性 toast 变成**可见的成长轨迹**：一个"动词典籍"面板展示玩家等级、已解锁动词、以及下一个解锁目标——直接回应"没升级"的反馈（成长可视化，Octalysis Development/Ownership）。

**Architecture:** 自包含模态组件 `VerbCodex`：打开时 `getPlayerProfile()` 读 `globalLevel` + `unlockedVerbs`，配合 `verbProgression.ts` 新增的 `VERB_INFO`/`verbUnlockLevel`/`ALL_VERBS_ORDERED` 渲染动词树。`PlayableApp` 头部加入口按钮，本地 state 控制开关。**不改 store、不改管线**——纯展示层。

**Tech Stack:** TS 5 strict、Jest 30、React 19 + Framer Motion。沿用现有 modal 风格（SettingsModal）。

**关联:** spec `docs/superpowers/specs/2026-06-26-verb-progression-design.md`（§5/§7/§10 P4 成长可视化）；P2-listen/P2b-build 已实现解锁机制。

**范围说明:** 这是 P4 的第一个子计划（成长可视化核心）。可变奖励、章节叙事皮肤留后续 P4 子计划。

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `src/lib/data/verbProgression.ts` | `VERB_INFO` + `verbUnlockLevel` + `ALL_VERBS_ORDERED` | 追加 |
| `src/lib/data/verbProgression.test.ts` | 上述单测 | 追加 |
| `src/components/VerbCodex.tsx`（新） | 动词典籍模态 | 创建 |
| `src/components/PlayableApp.tsx` | 头部入口按钮 + 挂载 VerbCodex | 改 |

---

## Task 1: VERB_INFO + verbUnlockLevel + ALL_VERBS_ORDERED

**Files:** Modify `src/lib/data/verbProgression.ts`, `src/lib/data/verbProgression.test.ts`

- [ ] **Step 1: 写失败测试** — append to `src/lib/data/verbProgression.test.ts`:

```ts
import { VERB_INFO, verbUnlockLevel, ALL_VERBS_ORDERED } from './verbProgression';
import type { Verb } from '@/store/gameStore';

const ALL_VERBS: Verb[] = ['recognize', 'recall', 'listen', 'build', 'match', 'correct', 'apply'];

describe('VERB_INFO', () => {
    test('has metadata for every verb', () => {
        for (const v of ALL_VERBS) {
            expect(VERB_INFO[v]).toBeDefined();
            expect(VERB_INFO[v].name).toBeTruthy();
            expect(VERB_INFO[v].icon).toBeTruthy();
        }
    });
});

describe('verbUnlockLevel', () => {
    test('base verbs unlock at level 1', () => {
        expect(verbUnlockLevel('recognize')).toBe(1);
        expect(verbUnlockLevel('recall')).toBe(1);
    });
    test('milestone verbs unlock at their level', () => {
        expect(verbUnlockLevel('listen')).toBe(3);
        expect(verbUnlockLevel('build')).toBe(5);
    });
    test('unreleased verbs have no unlock level (Infinity)', () => {
        expect(verbUnlockLevel('match')).toBe(Infinity);
        expect(verbUnlockLevel('correct')).toBe(Infinity);
        expect(verbUnlockLevel('apply')).toBe(Infinity);
    });
});

describe('ALL_VERBS_ORDERED', () => {
    test('contains all verbs', () => {
        expect(ALL_VERBS_ORDERED.slice().sort()).toEqual(ALL_VERBS.slice().sort());
    });
    test('is sorted by unlock level (base first, unreleased last)', () => {
        const levels = ALL_VERBS_ORDERED.map((v) => verbUnlockLevel(v));
        for (let i = 1; i < levels.length; i += 1) {
            expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
        }
        expect(ALL_VERBS_ORDERED[0]).toBe('recognize'); // base first
    });
});
```

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- verbProgression`. Expected: FAIL.

- [ ] **Step 3: 实现** — append to `src/lib/data/verbProgression.ts`:

```ts
/** 每个动词的展示元数据（名称/中文名/简介/中文简介/图标）。供 VerbCodex 等展示层使用。 */
export const VERB_INFO: Record<Verb, { name: string; nameZh: string; desc: string; descZh: string; icon: string }> = {
    recognize: { name: 'Recognize', nameZh: '识别', desc: 'Match the word to its meaning', descZh: '识别词义', icon: '👁' },
    recall: { name: 'Recall', nameZh: '回忆', desc: 'Spell the word from memory', descZh: '拼写回忆', icon: '✍️' },
    listen: { name: 'Listen', nameZh: '听音', desc: 'Hear the word and choose', descZh: '听音辨词', icon: '🔊' },
    build: { name: 'Build', nameZh: '造句', desc: 'Rebuild the sentence', descZh: '词序造句', icon: '🧱' },
    match: { name: 'Match', nameZh: '配对', desc: 'Pair synonyms and antonyms', descZh: '同义反义配对', icon: '🔗' },
    correct: { name: 'Correct', nameZh: '改错', desc: 'Spot and fix the error', descZh: '找错改错', icon: '🔍' },
    apply: { name: 'Apply', nameZh: '应用', desc: 'Use the word in context', descZh: '情境应用', icon: '🎯' },
};

/** 某动词的解锁等级。基础动词=1；里程碑动词=其 level；未发布动词=Infinity。 */
export function verbUnlockLevel(verb: Verb): number {
    if (BASE_VERBS.includes(verb)) return 1;
    const m = VERB_UNLOCK_MILESTONES.find((entry) => entry.verb === verb);
    return m ? m.level : Infinity;
}

/** 所有动词，按解锁等级排序（基础在前，未发布在后）。 */
export const ALL_VERBS_ORDERED: Verb[] = (
    ['recognize', 'recall', 'listen', 'build', 'match', 'correct', 'apply'] as Verb[]
).sort((a, b) => verbUnlockLevel(a) - verbUnlockLevel(b));
```

- [ ] **Step 4: 跑测试确认通过** — Run: `npm test -- verbProgression`. Expected: PASS（含原有 + 新增）。

- [ ] **Step 5: 提交**

```bash
git add src/lib/data/verbProgression.ts src/lib/data/verbProgression.test.ts
git commit -m "feat(verbs): add VERB_INFO + verbUnlockLevel + ALL_VERBS_ORDERED for codex display"
```

---

## Task 2: VerbCodex 组件

**Files:** Create `src/components/VerbCodex.tsx`

- [ ] **Step 1: 创建组件** — create `src/components/VerbCodex.tsx`：

```tsx
'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPlayerProfile } from '@/db/db';
import { VERB_INFO, verbUnlockLevel, ALL_VERBS_ORDERED } from '@/lib/data/verbProgression';
import { useSettingsStore } from '@/store/settingsStore';
import type { Verb } from '@/store/gameStore';

interface VerbCodexProps {
    isOpen: boolean;
    onClose: () => void;
}

export function VerbCodex({ isOpen, onClose }: VerbCodexProps) {
    const { language } = useSettingsStore();
    const isZh = language === 'zh';
    const [level, setLevel] = useState(1);
    const [unlocked, setUnlocked] = useState<Verb[]>(['recognize', 'recall']);

    useEffect(() => {
        if (!isOpen) return;
        getPlayerProfile()
            .then((p) => {
                setLevel(p.globalLevel);
                setUnlocked(p.unlockedVerbs ?? ['recognize', 'recall']);
            })
            .catch(() => { /* best-effort */ });
    }, [isOpen]);

    const nextUnlock = ALL_VERBS_ORDERED.find(
        (v) => !unlocked.includes(v) && verbUnlockLevel(v) !== Infinity
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-card border-2 border-primary/20 rounded-3xl p-6 shadow-2xl"
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-2 mb-1">
                            <BookOpen className="w-6 h-6 text-primary" />
                            <h2 className="text-2xl font-black">{isZh ? '动词典籍' : 'Verb Codex'}</h2>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                            {isZh ? '解锁并精通不同的认知动词' : 'Unlock and master different cognitive verbs'}
                        </p>

                        <div className="flex items-center gap-3 mb-5">
                            <span className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-black text-lg shadow-lg">
                                {isZh ? '等级' : 'Lv'} {level}
                            </span>
                            {nextUnlock ? (
                                <span className="text-sm text-muted-foreground">
                                    {isZh
                                        ? `下一个：${VERB_INFO[nextUnlock].nameZh}（Lv ${verbUnlockLevel(nextUnlock)}）`
                                        : `Next: ${VERB_INFO[nextUnlock].name} at Lv ${verbUnlockLevel(nextUnlock)}`}
                                </span>
                            ) : (
                                <span className="text-sm text-green-500 font-medium">
                                    {isZh ? '全部动词已解锁！' : 'All verbs unlocked!'}
                                </span>
                            )}
                        </div>

                        <div className="space-y-2">
                            {ALL_VERBS_ORDERED.map((v) => {
                                const info = VERB_INFO[v];
                                const ul = verbUnlockLevel(v);
                                const isReleased = ul !== Infinity;
                                const isUnlocked = unlocked.includes(v) || ul <= level;
                                return (
                                    <div
                                        key={v}
                                        className={cn(
                                            'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                                            isUnlocked
                                                ? 'border-green-500/30 bg-green-500/5'
                                                : 'border-border bg-secondary/30'
                                        )}
                                    >
                                        <span className="text-2xl shrink-0">{info.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold">{isZh ? info.nameZh : info.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {isZh ? info.descZh : info.desc}
                                            </p>
                                        </div>
                                        {isUnlocked ? (
                                            <span className="text-green-500 text-xs font-bold shrink-0">
                                                ✓ {isZh ? '已解锁' : 'Unlocked'}
                                            </span>
                                        ) : isReleased ? (
                                            <span className="text-muted-foreground text-xs shrink-0">🔒 Lv {ul}</span>
                                        ) : (
                                            <span className="text-muted-foreground/60 text-xs shrink-0">
                                                {isZh ? '即将推出' : 'Soon'}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
```

- [ ] **Step 2: 验证编译** — Run: `npm test`. Expected: 全绿。`npm run build` 确认 TS 通过。

- [ ] **Step 3: 提交**

```bash
git add src/components/VerbCodex.tsx
git commit -m "feat(codex): add VerbCodex modal showing level + verb unlock tree"
```

---

## Task 3: PlayableApp 头部入口

**Files:** Modify `src/components/PlayableApp.tsx`

- [ ] **Step 1: import + state + 挂载** — in `src/components/PlayableApp.tsx`:
- 顶部 import 加：

```tsx
import { useState } from 'react';
import { VerbCodex } from '@/components/VerbCodex';
import { BookOpen } from 'lucide-react';
```

（`useState` 与现有 `useEffect` 同来自 react；`BookOpen` 来自 lucide-react。）

- 在 `PlayableApp` 组件内（`const { questions } = useGameStore();` 附近）加本地 state：

```tsx
  const [codexOpen, setCodexOpen] = useState(false);
```

- 在 `<main>` 内、与 `<SettingsModal />` 同级处挂载 VerbCodex：

```tsx
      <SettingsModal />
      <VerbCodex isOpen={codexOpen} onClose={() => setCodexOpen(false)} />
```

- [ ] **Step 2: 入口按钮** — 在 header 的副标题（`INFINITE TOME PROTOCOL` 段落）之后、`</header>` 之前，加一个打开典籍的按钮：

```tsx
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setCodexOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-bold hover:bg-primary/20 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              {language === 'zh' ? '动词典籍' : 'Verb Codex'}
            </button>
          </div>
```

- [ ] **Step 3: 验证** — Run: `npm test`. Expected: 全绿。`npm run build` 确认 TS 通过。

- [ ] **Step 4: 提交**

```bash
git add src/components/PlayableApp.tsx
git commit -m "feat(codex): add Verb Codex entry button in PlayableApp header"
```

---

## Task 4: 全量回归 + 构建终检

**Files:** 无新文件。

- [ ] **Step 1: 全量测试** — Run: `npm test`. Expected: 全绿。

- [ ] **Step 2: 构建** — Run: `npm run build`. Expected: 编译成功、TS 通过。

- [ ] **Step 3: 自检清单**
  - 打开典籍：显示当前 globalLevel + unlockedVerbs（从 profile 读，反映最新持久化状态）。
  - 已解锁动词（recognize/recall/listen/build）标绿 ✓；未达等级的里程碑标 🔒 Lv N；未发布动词（match/correct/apply）标"即将推出"。
  - "下一个解锁"提示正确指向下一个未解锁里程碑。
  - 头部按钮可开关典籍；点背景或 ✕ 关闭。
  - 现有游戏流程未被破坏。

- [ ] **Step 4: 提交（若有修复）** — 不要 `git add -A`（工作区有用户 WIP）。

---

## Self-Review

**1. Spec 覆盖**：§5/§7/§10 P4「成长可视化」→ Task 1/2/3 ✓。可变奖励 + 章节皮肤留后续 P4 子计划（本计划范围已声明）。

**2. 占位符**：每个 code step 含完整代码。

**3. 类型一致性**：`VERB_INFO: Record<Verb, ...>`、`verbUnlockLevel(verb): number`、`ALL_VERBS_ORDERED: Verb[]`、VerbCodex props `{isOpen, onClose}` 与 PlayableApp 传入一致。

**4. 风险**：
- VerbCodex 在打开时异步读 profile——若读取失败有 `.catch` 兜底（显示默认 level 1 + base verbs），不崩溃。
- 不改 store/管线——零回归风险给游戏逻辑。
- `ALL_VERBS_ORDERED` 用 `verbUnlockLevel` 排序，Infinity 元素排末尾且彼此顺序稳定（原数组顺序）。
