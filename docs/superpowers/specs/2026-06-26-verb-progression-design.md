# 动词-成长解锁树设计（Verb-Progression Unlock Tree）

- 日期：2026-06-26
- 状态：待评审
- 分支：实现阶段将切到新分支
- 关联代码：`src/store/gameStore.ts`（`QuestionMode`/`Monster`）、`src/store/modules/economyRewards.ts`（升级）、`src/store/modules/questionFlow.ts`（选题）、`src/lib/data/questionModes.ts`（配额）、`src/lib/data/questionQuality.ts`（质量门）、`src/lib/ai/questionPipeline.ts`、`src/lib/ai/prompts.ts`、`src/components/battle/BattleQuestionPanel.tsx`（渲染派发）、`src/db/db.ts`（`GlobalPlayerProfile`/`CachedQuestion`）
- 关联记忆：[[question-quality-pipeline]]、[[question-pipeline-live-verification]]

## 1. 背景与问题

向用户展示后收到三条反馈：玩法单一、没有升级等游戏化、出题质量与灵活度不够。代码核查后确认这三条**都成立**，但根因不在"系统数量不足"——项目后台（FSRS、掌握度引擎、三阶段 AI 管线、经济/成就/Boss 系统）相当扎实。问题在**前台单薄**：

| 用户反馈 | 根因（代码证据） | 理论锚点 |
|---|---|---|
| 玩法单一 | 核心动词同构：`BattleInterface.tsx:241/263/283` 中 choice/typing/fill-blank/语音全部汇流到 `answerQuestion(index)`。战斗层是 quiz 的换皮，variety 全在 metadata（relic/blessing 改数值），不在动词。 | MDA（只触发 Challenge+Sensation，缺 Discovery/Narrative/Expression）；Interleaving 缺失导致 blocking 疲劳 |
| 没有升级 | 升级只加数值：`economyRewards.ts:41-45` 仅 `level += 1; maxXp *= 1.2`，**不解锁任何新能力/动词/机制**。 | SDT-Competence（胜任感要靠质变，非量变）；典型的 Hollow Leveling |
| 出题质量/灵活度不够 | 质量：generator 幻觉，靠 safety net 换成 fallback 题库（canned ESL 句），重复且与材料脱节。灵活度：题型格式只有 3 种（`questionModes.ts` 写死 50/30/20），且 1T+verbatim-span 使每题都是"对某 span 的识别/填空"。 | Craik & Lockhart 加工深度（深度有、广度无）；Desirable Difficulty；固定 reward schedule 缺可变峰值 |

**统摄（Octalysis 八核驱动）**：后台扎实是"实现层"，但驱动长期动机的白帽核心——Development（成就质变）、Unpredictability（可变奖励）、Discovery（探索）、Ownership（拥有改变玩法）——前台都没点亮。优化重点不是加系统，是补**能被感知的成长质变**和**动词多样性**，且不推翻现有后台。

## 2. 核心原则

> **把"认知动词"从"渲染格式"里拆出来，让基层玩法随玩家成长而演化；让升级解锁的是新动词（新能力）而非数值；用确定性模板承载新动词，使其构造上可靠。**

三条推导：
1. **动词正交于格式**（§3）：variety 必须发生在玩家每秒的动作层，不只是元层。
2. **成长的叶子节点是新动词**（§5）：升级 = 能做以前做不到的事 = 可感知的胜任感质变。
3. **plan 做合法的创造性决策，模板做机械构造**（§6）：LLM 擅长决定"测哪个 span/target/技能"，模板擅长"怎么拼"。这分离同时解决幻觉（质量）和新动词可靠性（灵活度）——正是 [[question-pipeline-live-verification]] 记录的"减少 fallback 的真正杠杆是 deterministic span-pinning / scoped templating"。

## 3. 二维内容模型：verb × format

当前 `QuestionMode = 'choice' | 'typing' | 'fill-blank'`（`gameStore.ts:122`）把**渲染格式**当成了动词——`choice` 同时承载识别/推断/语法，动词藏在题干里，玩家永远看到 4 个按钮。

拆成两个正交维度：

| 维度 | 含义 | 取值 |
|---|---|---|
| `verb` | 认知动作（做什么） | `recognize` / `recall` / `listen` / `match` / `build` / `correct` / `apply` |
| `format` | 渲染方式（怎么呈现） | `choice` / `text-input` / `pair-grid` / `word-tiles` / `tap` |

- `Monster`/`CachedQuestion` 新增 `verb` 字段，默认 `recognize`，老题向后兼容。
- `questionMode` **保留为 format**（向现有渲染兼容），不重命名以减小爆破半径。
- `questionModes.ts` 的配额从"3 格式 50/30/20"泛化为"动词×格式"矩阵；50/30/20 降级为**开局配额**，随解锁动词扩展。

理论对应：动词多样化 = Interleaving + Levels of Processing。这是治"单一"和"灵活度"的共同本。

## 4. 动词目录（解锁树叶节点，每个对应一个 Bloom 层级）

| verb | 认知层级 | format | 考察什么 | 数据依赖 | 复用 |
|---|---|---|---|---|---|
| recognize | Remember（浅） | choice | 词义识别 | 无 | 现有 |
| recall | Remember→Apply | text-input | 主动回忆拼写 | 无 | 现有 typing/fill-blank |
| listen | Understand + 感知 | choice/input | 听音辨词/听写（语音回路新模态） | 无 | 现有 `tts.ts` |
| match | Understand（关系） | pair-grid | 同义/反义/中英配对 | 需 per-target synonyms/antonyms | 新渲染器 |
| build | Apply/Create（深） | word-tiles | 词序造句（句子=源 span） | 无 | 新渲染器 |
| correct | Analyze（深） | tap/input | 找错改错 | 需 per-target confusables | 新渲染器 |
| apply | Apply/Evaluate（迁移） | choice/input | 情境应用（target 嵌入新 frame） | 无 | 现有 transfer 概念 |

**数据依赖处理**：match/correct 需要 per-target 的 synonyms/confusables。方案是让 planner 在 plan 阶段为每个 target 抽取并写入 plan item（`{span, target, confusables?, synonyms?}`）。**字段前向兼容地加入 plan schema，但 P2/P3 先上无依赖的 listen/build/apply**，match/correct 作为 P3 快速跟进（等 planner 稳定产出 confusables）。这强化了"plan 做创造性决策"的分工。

所有动词仍遵守 1T 语境法则：`build` 直接 tokenize 源 span 的词（句子即原文，不可能幻觉）；`correct` 在源 span 上把 target 换成 confusable；`listen` 对源 span 做 TTS。1T 法则不被破坏。

## 5. 成长质变化：解锁树

**核心**：升级/掌握度解锁新动词（新能力），不是数值被动。

**解锁规则（复用现有引擎，不发明新货币）**：
- 开局只解锁 `recognize` + `recall`（2 个动词，低认知负荷，对应 ZPD 脚手架起点）。
- 每达成 `consolidated` 掌握度 **2** 个目标（初版保守值，可调，见 §12），或一个等级里程碑 → 解锁一个新动词。
- **解锁顺序 = 教学深度顺序，但只在"当前已实现的动词"中推进**：`listen → build → apply → match → correct`（match/correct 因依赖 confusables，实现晚于 listen/build/apply，见 §10）。即 P2 阶段玩家按 `listen → build` 解锁；P3 上线后 `apply/match/correct` 才进入可解锁序列。这样玩家不会"解锁到一个还没实现的动词"。
- **解锁后的动词进入交错轮换池**——基层玩法随玩家成长而演化。这是"单一"被持久治好的关键：循环在演化，不是被装饰。

**叙事皮肤（顺势承载探索/叙事层）**：每个动词 = "无尽典籍"的一个学派/章节（聆听之厅、配对回廊、造句工坊……）。"无尽典籍"第一次名副其实：解锁动词 = 开启图书馆新翼区；mastery 稳定目标 = "稳定"一片区域。给 Octalysis 的 Discovery + Epic Meaning，几乎零额外成本。

**状态持久化**：`GlobalPlayerProfile` 新增 `unlockedVerbs: Verb[]`（IndexedDB，schema bump）。解锁逻辑放新文件 `src/lib/data/verbProgression.ts`，读取现有 `objectiveMastery` / `globalLevel`。

## 6. 模板引擎：质量根基

`src/lib/data/questionTemplates.ts`（新）：每个 verb 一个**确定性模板**（纯函数，重单测，沿用现有测试纪律）。输入 plan item（含 verbatim span + target + 可选 confusables/synonyms），输出完整题目，零 LLM 发明。

示例：
- `build`：tokenize 源 span 词 → 打乱 → word-tiles，正确=原序。
- `correct`：span 中 target 替换为 confusable → 玩家点出错词/输入修正。
- `listen`：TTS 播 span → recognize 但音频优先。
- `apply`：固定 context frame 集合 → target 嵌入 frame。

分工固化：planner 决定"测什么"（擅长），模板决定"怎么拼"（LLM 会幻觉的环节）。`questionPipeline.ts` 的 generate 阶段逐步被模板替代；planner 产出 `confusables`/`synonyms` 供 match/correct 使用。

## 7. 可变奖励 + 探索叙事层（乘数）

轻量叠加，不动核心循环：
- **可变奖励**：暴击倍率浮动、Boss 掉落分稀有度、隐藏成就。可变 schedule（Skinner / Octalysis-Unpredictability）。当前固定 reward schedule 缺这个峰值。
- **探索/叙事**：§5 的学派章节皮肤 + 随解锁展开的稀疏地图。

## 8. 数据模型变更（具体）

```ts
// src/store/gameStore.ts
export type Verb = 'recognize' | 'recall' | 'listen' | 'match' | 'build' | 'correct' | 'apply';

export interface Monster {
  // ...现有字段
  verb?: Verb;            // 新增，默认 'recognize'。老题未填按 recognize/recall(依 questionMode) 兜底
  // questionMode 保留为 format
}

// src/db/db.ts — GlobalPlayerProfile
export interface GlobalPlayerProfile {
  // ...现有字段
  unlockedVerbs: Verb[];  // 新增，默认 ['recognize','recall']
}

// src/lib/data/questionPlan.ts — plan item 扩展（前向兼容，可选）
interface QuestionPlanItem {
  // ...现有字段
  confusables?: string[];  // 供 correct/match 使用
  synonyms?: string[];     // 供 match 使用
}
```

schema 版本 bump（当前 v14 → v15），`unlockedVerbs` 默认值迁移。

## 9. 集成点（文件级，最小侵入）

| 文件 | 改动 |
|---|---|
| `gameStore.ts:122,126` | 加 `Verb` 类型；`Monster` 加 `verb?` 字段 |
| `BattleQuestionPanel.tsx:157-201` | 渲染派发现 `verb` 增加分支；新增 `MatchQuestion`/`BuildQuestion`/`ListenQuestion`/`CorrectQuestion` 组件（平行于 `TypingQuestion.tsx`） |
| `questionModes.ts` | 配额泛化为动词×格式矩阵；`MODES` 数组改为可配置/可扩展 |
| `questionFlow.ts`（选题） | 选题池按 `unlockedVerbs` 过滤；交错轮换逻辑 |
| `verbProgression.ts`（新） | 解锁规则：读 `objectiveMastery`/`globalLevel`，算 `unlockedVerbs` |
| `questionTemplates.ts`（新） | 每 verb 一个确定性模板纯函数 + 单测 |
| `questionPipeline.ts` | generate 阶段逐步走模板；planner 顺带产出 confusables/synonyms |
| `prompts.ts` | plan prompt 增加 confusables/synonyms 抽取指令 |
| `db.ts` | schema v15；`GlobalPlayerProfile.unlockedVerbs` 迁移 |
| `economyRewards.ts` | 升级 hook 触发解锁检查（升级不再只是 `level++`） |

## 10. 构建阶段（每阶段独立交付价值）

| 阶段 | 内容 | 解决痛点 | 可感收益 |
|---|---|---|---|
| **P1 地基** | 模板引擎覆盖现有 recognize/recall；plan schema 加可选 confusables/synonyms | D：fallback↓，质量↑ | 现有对局重复感降低 |
| **P2 首批新动词** | listen + build（无数据依赖，复用 TTS + 一个新渲染器）；解锁树骨架 + `unlockedVerbs` | A 起步 + B 骨架 | 玩家首次感到"不单一"，升级首次解锁真东西 |
| **P3 深层动词** | apply；match + correct（planner 产出 confusables 后） | 加工深度 + 灵活度 | 深层认知、迁移 |
| **P4 成长+叙事** | 完整解锁树里程碑 + 可变奖励 + 学派章节皮肤 + 稀疏地图 | B+C 完整 | 成长质变 + 动机放大 |

P1 立即拿质量收益且可感（fallback 减少 → 重复感降低），P2 玩家即感"不单一"，P3 给深度，P4 彻底解决"没升级"。

## 11. 已决策的取舍

1. **match/correct 的数据依赖**：plan schema 前向兼容加入可选 `confusables`/`synonyms`，但 P2/P3 先上无依赖的 listen/build/apply；match/correct 作为 P3 快速跟进。对冲"加 plan 复杂度"与"动词覆盖面"。
2. **构建起点 = P1（模板地基）优先**：跳过 P1 直接用 LLM 生成新动词，新动词会同样幻觉（见 [[question-pipeline-live-verification]]），出现破损的 listen/match 题比没有更糟。P1 本身减少 fallback，玩家可感；P2 紧随其后。

## 12. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 新渲染器（word-tiles/pair-grid）移动端可用性 | P2 先做一个渲染器（build），跑通后再复制模式；保留 choice 兜底 |
| planner 产出 confusables 不准 | match/correct 推到 P3，等 P1/P2 验证 planner 稳定后再启用；模板对缺失 confusables 降级到 recognize |
| schema 迁移破坏老存档 | `unlockedVerbs` 默认 `['recognize','recall']`；`verb` 字段可选；Dexie v15 迁移函数显式回填 |
| 解锁节奏过快/过慢破坏心流 | 解锁阈值读取现有 mastery，初版偏保守（晚解锁优于早解锁，保 ZPD）；上线后按掌握度数据调 |
| 动词多了反而加认知负荷 | 开局只 2 个，按深度渐进解锁；每关动词交错但有上限（如同时不超过 3 种） |

## 13. 非目标（本设计不做）

- 不重写 FSRS / 掌握度引擎 / 经济系统（后台保留）。
- 不做多人/社交/PK（单独议题）。
- 不做角色外观/皮肤等纯装饰收集（Ownership 通过"动词改变玩法"实现，而非外观）。
- 不改 1T 语境法则（新动词都在其约束内）。

## 14. 验证标准

- P1：fallback 率下降（用 [[question-pipeline-live-verification]] 的 live test 量化）；recognize/recall 模板产出与原 LLM 题质量持平或更优。
- P2：新动词（listen/build）渲染正确、判分正确；`unlockedVerbs` 升级后正确扩展；交错轮换池按解锁动词过滤生效。
- P3：match/correct 在 confusables 缺失时安全降级；apply 区分于现有 transfer 不重复。
- P4：升级触发可见解锁事件；可变奖励产生稀有度分布；章节皮肤与解锁状态一致。
- 全程：现有单测/E2E 不回归；新增模板/解锁逻辑有对应单测。
