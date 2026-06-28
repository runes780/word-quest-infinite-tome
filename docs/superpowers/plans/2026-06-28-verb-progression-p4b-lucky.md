# 动词-成长解锁树 P4b：轻量可变奖励（Lucky 加成）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给每次答对加上一个**可变奖励**：≈15% 概率触发"Lucky"，XP/金币 ×1.5 + 分数加成，并在反馈里显示"🍀 Lucky!"。点亮诊断表里唯一还没触达的 Octalytics 核心驱动——**Unpredictability（未知/可变奖励）**——把"固定 reward schedule"变成有惊喜峰值的循环。

**Architecture:** 沿用现有战斗结算链路。`resolveCorrectCombat` 多滚一个 `isLucky`（复用已有的 `randomFn` 注入，可单测）→ `answerQuestion` 捕获并对 XP/金币套 ×1.5 → 结果对象携带 `isLucky` → `BattleInterface.resultExplanation` 显示"🍀 Lucky!"。**保持轻量**：只叠加在明确的对错反馈之上，不改变判分、不遮蔽学习反馈。不碰 WIP 文件（prompts.ts 等）。

**Tech Stack:** TS 5 strict、Jest 30、Zustand。沿用 `combatResolution.ts` 的 `randomFn` 注入模式。

**关联:** spec `docs/superpowers/specs/2026-06-26-verb-progression-design.md`（§7 可变奖励层）；P4a 已完成成长可视化（Codex）。

**决策:** 15% 触发概率，×1.5 奖励——平均 +7.5% XP/金币，不致通胀，又有清晰惊喜点。

---

## 文件结构

| 文件 | 职责 | 动作 |
|---|---|---|
| `src/store/modules/combatResolution.ts` | `isLucky` 进 outcome + roll + scoreGain | 改 |
| `src/store/modules/combatResolution.test.ts` | isLucky 单测（randomFn 注入） | 追加 |
| `src/store/gameStore.ts` | answerQuestion 捕获 isLucky、套 ×1.5、返回 | 改 |
| `src/components/BattleInterface.tsx` | resultExplanation 显示 Lucky | 改 |

---

## Task 1: combatResolution 加 isLucky

**Files:** Modify `src/store/modules/combatResolution.ts`, `src/store/modules/combatResolution.test.ts`

- [ ] **Step 1: 写失败测试** — append to `src/store/modules/combatResolution.test.ts`（沿用现有 randomFn 注入模式；先读现有测试确认 fixture 风格）：

```ts
describe('resolveCorrectCombat — lucky', () => {
    const baseInput = {
        playerStats: { level: 1, xp: 0, maxXp: 100, streak: 0, gold: 0 },
        currentMonsterHp: 5,
        bossShieldProgress: 0,
        isBoss: false,
        damageMultiplier: 1,
        bossComboThreshold: 2,
    };

    test('isLucky is true when randomFn > 0.85', () => {
        const out = resolveCorrectCombat({ ...baseInput, randomFn: () => 0.9 });
        expect(out.isLucky).toBe(true);
    });

    test('isLucky is false when randomFn <= 0.85', () => {
        const out = resolveCorrectCombat({ ...baseInput, randomFn: () => 0.5 });
        expect(out.isLucky).toBe(false);
    });

    test('lucky grants a score bonus', () => {
        const lucky = resolveCorrectCombat({ ...baseInput, randomFn: () => 0.9 });
        const normal = resolveCorrectCombat({ ...baseInput, randomFn: () => 0.5 });
        expect(lucky.scoreGain).toBeGreaterThan(normal.scoreGain);
    });

    test('lucky does not change damage (it is a reward bonus, not a damage event)', () => {
        const lucky = resolveCorrectCombat({ ...baseInput, randomFn: () => 0.9 });
        const normal = resolveCorrectCombat({ ...baseInput, randomFn: () => 0.5 });
        expect(lucky.damageDealt).toBe(normal.damageDealt);
    });
});
```

(Confirm the existing test file imports `resolveCorrectCombat` and the `PlayerStats` shape; adapt the `baseInput.playerStats` to match if the existing tests use a different fixture.)

- [ ] **Step 2: 跑测试确认失败** — Run: `npm test -- combatResolution`. Expected: FAIL (`isLucky` not on outcome).

- [ ] **Step 3: 实现** — in `src/store/modules/combatResolution.ts`:
- 给 `CorrectCombatOutcome` 加字段：

```ts
export interface CorrectCombatOutcome {
    damageDealt: number;
    isCritical: boolean;
    isSuperEffective: boolean;
    isLucky: boolean;
    nextBossShieldProgress: number;
    nextMonsterHp: number;
    scoreGain: number;
}
```

- 在 `resolveCorrectCombat` 里（`isSuperEffective = randomFn() > 0.8;` 之后）加：

```ts
    const isSuperEffective = randomFn() > 0.8;
    const isLucky = randomFn() > 0.85; // ~15% chance — variable reward (Octalysis Unpredictability)
```

- return 里加 `isLucky,` 并把 scoreGain 改为含 lucky 加成：

```ts
    return {
        damageDealt,
        isCritical,
        isSuperEffective,
        isLucky,
        nextBossShieldProgress,
        nextMonsterHp,
        scoreGain: 10 + (isCritical ? 5 : 0) + (isSuperEffective ? 5 : 0) + (isLucky ? 5 : 0)
    };
```

（lucky 不改 `damageDealt`——它是奖励加成，不是伤害事件，保持学习反馈清晰。）

- [ ] **Step 4: 跑测试确认通过** — Run: `npm test -- combatResolution`. Expected: PASS（含原有 + 新增）。

- [ ] **Step 5: 提交**

```bash
git add src/store/modules/combatResolution.ts src/store/modules/combatResolution.test.ts
git commit -m "feat(combat): add isLucky variable-reward roll (~15%) to resolveCorrectCombat"
```

---

## Task 2: answerQuestion 应用 Lucky ×1.5

**Files:** Modify `src/store/gameStore.ts`

- [ ] **Step 1: 捕获 isLucky** — 在 `answerQuestion`，`let isCritical = false; let isSuperEffective = false;`（约 line 457-458）旁加 `let isLucky = false;`。在 `isSuperEffective = combatOutcome.isSuperEffective;` 之后加 `isLucky = combatOutcome.isLucky;`。

- [ ] **Step 2: 套 ×1.5 到 XP/金币** — 当前（约 line 488-504）：

```ts
            const xpBase = 20 + (isCritical ? 10 : 0);
            const xpGain = Math.floor(applyXpBonus(xpBase, inventory) * blessing.xpMultiplier);
```
改为：

```ts
            const xpBase = 20 + (isCritical ? 10 : 0);
            const xpGain = Math.floor(applyXpBonus(xpBase, inventory) * blessing.xpMultiplier * (isLucky ? 1.5 : 1));
```

同样，金币那行（约 line 504，`goldBase = 15 + (isCritical ? 10 : 0)` 后的 `goldGain = Math.floor(applyGoldBonus(goldBase, inventory) * blessing.goldMultiplier)`）改为：

```ts
            const goldGain = Math.floor(applyGoldBonus(goldBase, inventory) * blessing.goldMultiplier * (isLucky ? 1.5 : 1));
```

（读实际行确认 goldGain 的精确表达式；若与上述不同，把 `* (isLucky ? 1.5 : 1)` 追加到现有乘法链末尾即可。）

- [ ] **Step 3: 返回 isLucky** — answerQuestion 的返回对象（约 line 784，与 `isCritical, isSuperEffective,` 并列）加 `isLucky,`。同时若该返回对象有独立类型声明（如 line 289 附近的 `isSuperEffective: boolean;`），加 `isLucky: boolean;`。

- [ ] **Step 4: 验证** — Run: `npm test`. Expected: 全绿（lucky 是叠加乘子，不改判分逻辑）。

- [ ] **Step 5: 提交**

```bash
git add src/store/gameStore.ts
git commit -m "feat(game): apply Lucky x1.5 to XP/gold on correct answers"
```

---

## Task 3: BattleInterface 显示 Lucky

**Files:** Modify `src/components/BattleInterface.tsx`

- [ ] **Step 1: resultExplanation 显示 Lucky** — 当前（约 line 161）：

```ts
    const resultExplanation = (result: { explanation: string; repairQueued?: boolean }) => {
```

改为（加 `isLucky?: boolean` 并在前面拼"🍀 Lucky!"）：

```ts
    const resultExplanation = (result: { explanation: string; repairQueued?: boolean; isLucky?: boolean }) => {
        const luckyPrefix = result.isLucky ? '🍀 Lucky! +50% rewards — ' : '';
```

然后在 resultExplanation 的 return 里把消息包成 `${luckyPrefix}${...原有消息...}`（读现有 return 结构，把 luckyPrefix 前置到给玩家的文本）。

- [ ] **Step 2: triggerCorrectCombatFeedback（可选，加音效）** — 若想加音效，在 `triggerCorrectCombatFeedback`（约 line 169）的 param 类型加 `isLucky?: boolean`，并在 `if (result.isCritical) {...}` 分支里，lucky 时也触发一个庆祝音（如 `playSound.success()` 或现有 critical 音）。若音效 API 不明确，跳过本步——消息提示已足够。

- [ ] **Step 3: 验证** — Run: `npm test`. Expected: 全绿。`npm run build` 确认 TS 通过（resultExplanation 的 param 类型已扩，调用处传入的 result 对象含 isLucky）。

- [ ] **Step 4: 提交**

```bash
git add src/components/BattleInterface.tsx
git commit -m "feat(battle): surface Lucky bonus in the result message"
```

---

## Task 4: 全量回归 + 构建终检

- [ ] **Step 1: 全量测试** — Run: `npm test`. Expected: 全绿。
- [ ] **Step 2: 构建** — Run: `npm run build`. Expected: 编译成功、TS 通过。
- [ ] **Step 3: 自检**
  - ~15% 答对触发 Lucky（randomFn 注入可证）。
  - Lucky 时 XP/金币 ×1.5、分数 +5；伤害不变（学习反馈不被遮蔽）。
  - 反馈消息显示"🍀 Lucky! +50% rewards"。
  - 现有 crit/super-effective/答错 流程未破坏。
- [ ] **Step 4: 提交（若有修复）** — 不要 `git add -A`（工作区有用户 WIP）。

---

## Self-Review

**1. Spec 覆盖**：§7 可变奖励层 → Task 1/2/3 ✓。章节叙事皮肤、Boss 掉落稀有度留后续。

**2. 占位符**：每个 code step 含完整代码；Task 2/3 含"读实际行确认"指引（因精确行号需现场核对）。

**3. 类型一致性**：`CorrectCombatOutcome.isLucky`、answerQuestion 返回 `isLucky`、resultExplanation param `isLucky?` 一致。

**4. 风险**：
- lucky 不改 damageDealt——学习反馈（对错+伤害）清晰，lucky 纯奖励叠加。
- ×1.5 / 15% → 平均 +7.5% XP/金币，经济不致通胀。
- randomFn 注入已在 combatResolution 现有模式中，isLucky 可干净单测。
