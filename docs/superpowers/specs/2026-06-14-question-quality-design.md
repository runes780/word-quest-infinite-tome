# 出题质量重构设计

- 日期：2026-06-14
- 状态：待评审
- 分支：`codex/ocr-modal-sizing`（实现阶段将切到新分支）
- 关联代码：`src/lib/ai/prompts.ts`、`src/lib/ai/materialProfile.ts`、`src/lib/data/questionQuality.ts`、`src/lib/data/questionPackPlanner.ts`、`src/lib/data/fallbackQuestions.ts`、`src/lib/data/missionSanitizer.ts`、`src/components/InputSection.tsx`

## 1. 背景与问题

当前出题链路：

```
用户粘贴文本
  → generateLevelPrompt(): sanitizeContext 清洗 → analyzeMaterialProfile() 算难度
  → LEVEL_GENERATOR_SYSTEM_PROMPT
  → LLM 单段生成
  → normalizeMissionMonsters(): 清洗选项 / 补 sourceContextSpan / 造填空
  → planQuestionPack() + assessQuestionQuality(): 质量门 + 阶梯排序
```

用户反馈三类低质量题，根因如下：

| 问题 | 根因 |
|---|---|
| 用高于材料水平的概念解释材料（如用 "enormous" 解释 "big"） | `materialProfile.ts` 只给粗糙 band，靠词数/句长/35 个硬编码 ADVANCED_WORDS 判断；LLM 从未拿到材料真实词汇。质量门 `assessQuestionQuality` 用同一套启发式，只能命中那 35 个词。 |
| 阅读理解题没有语境 | prompt 有"不要脱离原句问 it 指代"的软约束，sanitizer 有 `ensureQuestionHasSourceContext` 兜底——但都是事后打补丁，LLM 仍在裸奔出题。 |
| 阅读题没有语言意义（考记忆检索而非语言技能） | 阅读被压成 20% 的一个桶，fallback 题库本身充斥检索题（"What color is Tom's ball?"）。无机制强制阅读题测语言技能。 |

外加两个结构性问题：系统提示堆成 60+ 行"不要…"的补丁墙，信号被稀释；"卡片阶梯"只在 prompt 提一句，LLM 吐扁平数组，`planQuestionPack` 事后反推阶梯。

## 2. 核心原则：1T 语境法则

> 每一道题（无论 vocab/grammar/reading）都必须建立在一个真实原文句子上——学习者能读懂整句，只差一个目标元素（一个词 / 一个语法形式 / 一个指代 / 一个推断），题目考的就是**在语境里理解这个元素**。禁止孤立词义题、禁止脱离原文的检索题。

这是 Krashen 的可理解输入 / i+1 / 1T 句子在工程上的强约束。在此法则下：

- **Vocab**：不是 "What does 'bright' mean?"，而是 "Read: 'a bright leaf'. Here 'bright' most nearly means ___"。
- **Grammar**：直接在原文 span 上挖空（cloze on source）。
- **Reading**：测代词指代 / 推断 / 语境词义 / 语篇衔接 / 语用含义——这些技能只在语境里存在，检索题天然被排除。

阅读题标准因此落到"严格：只测语言技能"——因为语境是语言理解的载体。

## 3. 已定决策

| 决策点 | 选择 |
|---|---|
| 路线 | **C 骨架 + B 评判**：两段式（规划→生成）从源头解决超纲与阶梯，外加 LLM 评判员兜底 |
| 阅读题标准 | 严格——只测语言技能（reference/inference/contextual_meaning/discourse/pragmatic） |
| 范围 | AI 路径 + 离线 fallback 题库都按新法则重写 |
| 领域配比默认值 | grammar 50% / vocab 30% / reading 20%（可配置） |
| Critic 默认 | 开启（用更便宜/更快的模型；可在设置里关） |
| Reading skill 清单 | `pronoun_reference` / `inference` / `contextual_meaning` / `discourse` / `pragmatic` |
| Common word list 规模 | ~1000 高频英文词 |

## 4. 架构

把"单段盲生成 + 事后打补丁"改成**"规划 → 生成 → 评判"三段式**，外加两条贯穿机制。

```
用户文本
   │
   ▼
[0] 材料画像 v2（确定性，无 LLM）
    在现有 band 基础上新增「词汇接地」：
    materialVocab = 材料全部词的归一化表面形式
    commonWordList = 内置 ~1000 高频词表
    allowedSet = materialVocab ∪ commonWordList
    materialSpecific = materialVocab − commonWordList  ← 推荐出题目标
   │
   ▼
[1] 规划器 Planner（LLM · 新）
    吃文本 + allowedSet + materialSpecific + sentences + band
    吐 QuestionPlan：6-8 个 item，每个绑定
    {role, domain, learningObjectiveId, sourceSpan, target, targetKind,
     allowedWords, readingSkill?, supportLevel, difficulty}
   │
   ▼
[2] 生成器 Generator（LLM · 重写提示词，按蓝图填空）
    不再盲生成；输出沿用现有 Monster schema（前端零改动）
   │
   ▼
[3] 评判员 Critic（LLM · 新 · 便宜模型 · 可跳过）
    逐题三连审：① 词汇接地 ② 语境完整 ③ 语言意义
    不合格 → 重生成（≤R 次）→ 仍不行则从 fallback 题库补，标 lowConfidence
   │
   ▼
[4] 确定性质量门（重写 questionQuality.ts）
    词汇：stem/options/hint/explanation 的词 ∈ allowedSet
    1T：题干内嵌原文 span（与材料子串匹配）
    reading 必须有合法 readingSkill 且题干测试该技能
   │
   ▼
质量包（planQuestionPack 排序阶梯）→ 前端
```

**两条贯穿机制：**

- **词汇接地**：`allowedSet = materialVocab ∪ commonWordList` 是整个系统的超纲判据。规划器只分允许词，生成器只用允许词，质量门用集合判定。
- **1T 语境法则**：每个 item 强制带 `sourceSpan` + `target`，生成器在该句上挖空/提问。

## 5. 组件设计

### 5.1 `QuestionPlan` 数据结构（`src/lib/data/questionPlan.ts` 新增）

```ts
export type PlanDomain = 'grammar' | 'vocab' | 'reading';
export type PlanRole = 'recognition' | 'cloze' | 'recall' | 'transfer';
export type PlanReadingSkill =
  | 'pronoun_reference'   // 代词指代
  | 'inference'           // 推断
  | 'contextual_meaning'  // 语境词义
  | 'discourse'           // 语篇衔接
  | 'pragmatic';          // 语用含义

export interface QuestionPlanItem {
  role: PlanRole;
  domain: PlanDomain;
  learningObjectiveId: string;        // 复用现有目标，或自定义如 'vocab:bright'
  readingSkill?: PlanReadingSkill;    // domain==='reading' 时必填
  sourceSpan: string;                 // 材料的精确子串（1T 基句）
  target: string;                     // 唯一的未知元素
  targetKind: 'word' | 'phrase' | 'grammar_form' | 'reference' | 'inference';
  allowedWords: string[];             // ⊆ allowedSet
  supportLevel: 0 | 1 | 2 | 3;
  difficulty: 'easy' | 'medium' | 'hard';  // ≤ 材料 band
}

export interface QuestionPlan {
  levelTitle: string;
  materialSummary: string;
  vocabularyAllowed: string[];        // allowedSet 回显
  items: QuestionPlanItem[];          // 6-8 个，按阶梯排序
}
```

**计划不变量（`validateQuestionPlan` 机器复核）：**

| 不变量 | 判定 | 不满足的处理 |
|---|---|---|
| `sourceSpan` 是材料精确子串 | `material.includes(span)` | 丢弃/重规划 |
| `target`（word/grammar_form/reference 类）出现在 `sourceSpan` 里 | 子串匹配 | 丢弃 |
| `domain==='reading'` 必有 `readingSkill` | 字段存在性 | 丢弃 |
| `allowedWords ⊆ allowedSet` | 集合判定 | 裁掉越界词 |
| `difficulty` ≤ 材料 band | 现有 `difficultyAtOrBelow` | 降级 |
| 阶梯：≥1 个 transfer，role 不全雷同 | 角色集合检查 | `ensureTransfer` 补 |
| 6-8 个 item | 长度检查 | 不足则补 recognition |

### 5.2 材料画像 v2（`src/lib/ai/materialProfile.ts` 增强 + 新增 `src/lib/data/commonWords.ts`）

确定性增强（无 LLM）：

- `materialVocab`：材料全部词的归一化表面形式（小写、轻量去 `-s/-es/-ed/-ing`）。
- `commonWordList`：内置 ~1000 高频英文词表（新数据文件）。
- `allowedSet = materialVocab ∪ commonWordList`。
- `materialSpecific = materialVocab − commonWordList`（推荐 target 候选）。
- 保留现有 `band` / `difficulty` / `allowedQuestionDifficulties`。
- 归一化函数（`normalizeWord`）与质量门的 `checkLexicalFit` 共用，保证两端可比。

`MaterialProfile` 接口扩展 `vocabulary: { material: string[]; common: Set<string>; allowed: Set<string>; materialSpecific: string[] }` 与 `sentences: string[]`。

### 5.3 确定性质量门重写（`src/lib/data/questionQuality.ts`）

新增检查（确定性）：

| 检查 | 判据 | 新 reject reason | 新 flag |
|---|---|---|---|
| 词汇接地 | stem/4 选项/hint/explanation/correctAnswer 每个实词 ∈ allowedSet，或 = target，或为专有名词/数字 | `above_material_vocabulary` | `lexical_fit` |
| 1T 语境 | 题干内嵌一个 span，且该 span 是 `material` 的精确子串 | `not_grounded_in_material` | `context_grounded` |
| 阅读技能 | `domain==='reading'` 时必有 `readingSkill`，且题干关键词匹配该技能 | `reading_skill_missing` / `reading_skill_mismatch` | `reading_skill_fit` |

旧的 `above_material_difficulty`（启发式）**降级为兜底**：仅当调用方未传 `allowedSet` 时走它（向后兼容）。

**词汇接地检查（核心）：**

```ts
function checkLexicalFit(
  texts: string[],
  allowedSet: Set<string>,
  target: string,
): { ok: boolean; offending: string[] } {
  const targetNorm = normalizeWord(target);
  const offending = new Set<string>();
  for (const text of texts) {
    for (const word of contentWords(text)) {
      if (allowedSet.has(word)) continue;
      if (word === targetNorm) continue;
      if (isNumber(word) || isLikelyProperNoun(word, text)) continue;
      offending.add(word);
    }
  }
  return { ok: offending.size === 0, offending: [...offending] };
}
```

- `contentWords` 用与 materialProfile v2 同一套归一化。
- `commonWordList` 覆盖所有功能词，无需单独停用词表。
- 越界词随 reject reason 回传，供 critic 与重生成提示词使用。

**1T 语境检查：**

```ts
function isGroundedInMaterial(question, material: string): boolean {
  const spans = [question.sourceContextSpan, ...extractQuotedSpans(question.question)]
    .map(s => s?.trim()).filter(Boolean);
  return spans.some(span => material.includes(span));
}
```

叠加现有 `GENERIC_SOURCE_SPAN_REGEX`。

**阅读技能信号（启发式，配合 critic）：**

```ts
const READING_SKILL_SIGNALS: Record<PlanReadingSkill, RegExp> = {
  pronoun_reference: /\b(refer(?:s|red|ring)? to|what does ['"]?(?:he|she|it|they|this|that)['"]? mean)\b/i,
  inference:         /\b(why|infer|because|suggest|imply|probably|how (?:do|can|did))\b/i,
  contextual_meaning:/\b(in this (?:sentence|line)|here|most nearly means|closest (?:in )?meaning)\b/i,
  discourse:         /\b(however|then|next|first|finally|transition|connect|in contrast)\b/i,
  pragmatic:         /\b(purpose|intend|trying to|tone|feel|attitude|the writer|the author)\b/i,
};
```

**签名（向后兼容）：**

```ts
assessQuestionQuality(question, {
  maxDifficulty?,
  allowedSet?: Set<string>,     // 新
  material?: string,            // 新
  target?: string,              // 新
  domain?: PlanDomain,          // 新
  readingSkill?: PlanReadingSkill,
}): QuestionQualityReport
```

AI 路径全传 → 强检查；fallback/旧测试不传 → 退回启发式。`repairSuggestion` 扩充 `clamp_to_allowed_vocabulary` / `embed_source_span` / `assign_reading_skill`。

### 5.4 提示词（`src/lib/ai/prompts.ts`）

**Planner 系统提示（`PLAN_SYSTEM_PROMPT`，新增）：**

```
# 角色
你是 ESL 课程设计师。基于材料设计一份 6-8 题的「1T 语境练习计划」。

# 1T 语境法则（最高优先级）
每个 item 必须绑定一句你能从材料里逐字复制的 sourceSpan，
且 sourceSpan 里只有 target 这一处是学习者可能不懂的。

# 阶梯
按 recognition → cloze → recall → transfer 排列，至少 1 个 transfer。

# 领域配比（默认，可配置）
grammar 50% / vocab 30% / reading 20%。

# 阅读题规则
domain=reading 时必须填 readingSkill ∈
{pronoun_reference, inference, contextual_meaning, discourse, pragmatic}。
禁止"他找到什么/什么颜色"这类检索题。

# 词汇接地
allowedWords 只能从给定的 vocabularyAllowed 里选。
禁止用 allowedSet 之外的词解释 target。

# 输出
严格 JSON，schema = QuestionPlan。
```

Planner 用户提示（`generatePlanPrompt(text, profile)`）携带：材料文本、allowedSet、materialSpecific、sentences、band。

**Generator 系统提示（`LEVEL_GENERATOR_SYSTEM_PROMPT`，重写为短而指令化）：**

```
# 角色
你是按蓝图填空的出题工坊。

# 输入
一份 QuestionPlan（每题的 sourceSpan / target / allowedWords / readingSkill 已定）
+ 材料的 allowedSet。

# 硬规则
1. 每题用 plan 给的 sourceSpan 作语境，target 作唯一考点。
2. 题干、4 选项、hint、explanation 只能用 allowedWords 或更简单的常用词。
3. cloze 直接在 sourceSpan 上挖掉 target；recognition 把 sourceSpan 作为 Read 引文。
4. reading 题只测它被分配的 readingSkill，禁止检索题。
5. 4 选项 = 1 正解 + 3 plausible 干扰，干扰项也只用允许词。
6. hint/explanation 用比 target 更简单的词。
7. 全英文 JSON，schema = 现有 Monster。

# 输出
{ level_title, monsters: [...] }
```

Generator 用户提示（`generateLevelFromPlanPrompt(plan)`）携带整个 QuestionPlan。

**Critic 系统提示（`CRITIC_SYSTEM_PROMPT`，新增）：**

```
# 角色
苛刻的 ESL 题目审稿人。

# 逐题三连审
① 词汇接地：stem/选项/hint/explanation 是否只用 allowedSet 的词（或 target 本身/更简单）？
   列出任何越界词。
② 语境完整：题干是否内嵌原文 span？target 是否就是那唯一的未知点？
③ 语言意义：测的是语言技能还是记忆检索？reading 题是否真测了它的 readingSkill？

# 输出（严格 JSON）
{ verdicts: [{ id, pass, axisFailures: ['lexical'|'context'|'meaning'],
               offendingWords: [...], reason, suggestedFix }] }
```

### 5.5 编排器（`src/lib/ai/questionPipeline.ts` 新增）

把现在埋在 `InputSection.tsx` 的 `fetchMissionWithRetry` 抽出，变成可独立测试的编排器。

```ts
interface QuestionPipelineOptions {
  apiKey: string;
  model: string;              // 主模型（planner + generator）
  apiProvider: AIProvider;
  criticModel?: string;       // 便宜模型；省略则跳过 critic
  learnerLevel?: number;
  criticEnabled?: boolean;    // 默认 true
  maxRepairAttempts?: number; // 默认 2
}
interface QuestionPipelineResult {
  monsters: Monster[];
  plan?: QuestionPlan;
  criticReport?: CriticReport;
  degradedPath?: 'none' | 'legacy_single_stage' | 'fallback_bank';
}
async function generateQuestionPack(text: string, opts: QuestionPipelineOptions): Promise<QuestionPipelineResult>
```

**流程：**

1. `profile = analyzeMaterialProfileV2(text)`（确定性）。
2. `plan = await callPlanner(text, profile)`；`validateQuestionPlan(plan, text, profile.allowedSet)`；不可修复 → `degradedPath='legacy_single_stage'`，走当前单段路径。
3. `monsters = await callGenerator(plan, profile)`；`normalizeMissionMonsters(monsters, { sourceText, allowedSet, material, plan })`（内部跑确定性质量门）。
4. 若 `criticEnabled`：`verdicts = await callCritic(monsters, plan, text)`；逐题按 `offendingWords + suggestedFix` 重生成（≤R 次）；仍失败 → 从 fallback 题库补一道语篇接地题，标 `lowConfidence`。
5. `planQuestionPack(final monsters)` → 阶梯排序。
6. 返回。

**模型与成本：**

| 阶段 | 模型 | 理由 |
|---|---|---|
| Planner | 主模型 | 需要真正的语言理解 |
| Generator | 主模型 | 同上 |
| Critic | 更便宜/更快（可配置） | 分类/核验，便宜模型胜任 |

三次串行，墙钟约 2–3× 现状。UI 在 planner 阶段显示"设计任务中…"、generator 阶段"出题中…"。对延迟敏感可关 critic → 2 次调用。

**降级矩阵：**

| 失败点 | 降级 |
|---|---|
| planner 调用/解析失败 | `degradedPath='legacy_single_stage'`，退回当前单段生成 |
| `validateQuestionPlan` 否决且不可修复 | 同上 |
| generator 失败 | 重试 → fallback 题库 |
| critic 否决某题，重生成 ≤R 次仍失败 | 从 fallback 题库补一道语篇接地题，标 `lowConfidence` |
| critic 否决 >50% | 取质量分子集，不足 5 题补 fallback，不无限循环 |
| 离线/无 API | 重写后的 fallback 题库 |

### 5.6 Fallback 题库重写（`src/lib/data/fallbackQuestions.ts`）

离线无用户材料，靠**题库自带微型语篇**接地。

```ts
interface FallbackPassage {
  id: string;
  text: string;            // 2-4 句微型语篇
  band: 'easy'|'medium'|'hard';
  vocabulary: string[];    // 本语篇 allowedSet（自身词 ∪ common）
}
interface FallbackQuestion {
  passageId: string;
  sourceSpan: string;      // passage.text 精确子串
  target: string;
  domain: 'grammar'|'vocab'|'reading';
  readingSkill?: PlanReadingSkill;   // reading 必填
  role: PlanRole;
  question: string; options: string[]; correct_index: number;
  hint: string; explanation: string; difficulty: 'easy'|'medium'|'hard';
}
```

示例单元（easy）：语篇 *"Mia has a small garden. Every morning she waters the plants. Today the tomatoes are red, so she picks them."*

| 领域 | 题目 | 测的技能 |
|---|---|---|
| vocab · contextual_meaning | Read: "the tomatoes are **red**". Here "red" means the tomatoes are ___. [ripe/ growing/ frozen/ broken] | 语境词义 |
| grammar · cloze | "Every morning she ___ the plants." [waters/ water/ watering/ watered] | 三单现在时 |
| reading · pronoun_reference | Read: "…so she picks **them**." What does "them" refer to? [the tomatoes/ the plants/ the mornings/ the gardens] | 代词指代 |
| reading · inference | Read: "Every morning she waters the plants." This shows Mia ___. [cares for the garden/ sells tomatoes/ hates mornings/ is tired] | 推断 |

公共 API（`getRandomFallbackQuestions` / `getBalancedFallbackQuestions`）签名不变，内部改成按语篇聚簇返回。

**自验证护栏：** 新增测试——每条 fallback 题用它自己的语篇当 `material`、`vocabulary` 当 `allowedSet` 跑 `assessQuestionQuality`，必须通过。任何漂回检索题/孤立题会被 CI 拦下。

### 5.7 接线

- `InputSection.tsx`：删除内联 `fetchMissionWithRetry`，改为调用 `generateQuestionPack`。`degradedPath==='legacy_single_stage'` 时行为与今天逐字一致。
- `normalizeMissionMonsters`：扩 options 透传 `{ allowedSet, material, plan }`；不传时保持现状——`targetedReview.ts`、`bossGateVariants.ts` 这类直接造题的调用零回归。

## 6. 测试策略（实现阶段 TDD）

**① 确定性逻辑单元测试**
- `materialProfile` v2：词汇抽取、allowedSet 构造、`goes↔go` 归一化一致性。
- `validateQuestionPlan`：7 条不变量各一个反例。
- `assessQuestionQuality` 新检查：词汇接地（检出 offending）、1T 子串匹配、reading-skill 信号匹配；向后兼容（不传 allowedSet → 旧启发式）。
- `checkLexicalFit`：target 豁免、专有名词/数字豁免、归一化两端一致。

**② 提示词测试**（沿用 `prompts.test.ts` 风格）
- 断言 planner/generator/critic 三份系统提示包含关键指令（1T 法则、词汇接地、reading skill 清单、JSON schema）。
- 断言 planner 输入携带 allowedSet / materialSpecific / sentences / band。

**③ Fallback 题库审计测试**（5.6 护栏）
- 每条 fallback 题过 `assessQuestionQuality` → 全部 accepted。

**④ 编排器集成测试**
- 假 `OpenRouterClient`（canned plan / monsters / verdicts）：happy path → 合法 pack；critic 否决 → 触发重生成并修复；planner 失败 → `degradedPath==='legacy'`；critic 否决 >50% → 取子集 + 补 fallback。

**⑤ 回归护栏**
- 现有全部测试保持绿色（`assessQuestionQuality` 签名向后兼容、`normalizeMissionMonsters` 不传新 options 时行为不变）。

## 7. 交付清单

1. `src/lib/data/commonWords.ts`（新）— ~1000 高频词表。
2. `src/lib/ai/materialProfile.ts`（增强）— 词汇接地。
3. `src/lib/data/questionPlan.ts`（新）— `QuestionPlan` 类型 + `validateQuestionPlan`。
4. `src/lib/ai/prompts.ts`（改）— `PLAN_SYSTEM_PROMPT` / 重写 `LEVEL_GENERATOR_SYSTEM_PROMPT` / 新 `CRITIC_SYSTEM_PROMPT` + 对应 user prompt 构造器。
5. `src/lib/ai/questionPipeline.ts`（新）— 编排器 + 降级。
6. `src/lib/data/questionQuality.ts`（重写）— 词汇接地 / 1T / reading-skill 三检查 + 向后兼容。
7. `src/lib/data/fallbackQuestions.ts`（重写）— 语篇聚簇 + 自验证。
8. `src/components/InputSection.tsx`（改）— 调用编排器，删内联生成。
9. 全套测试（上述五类）。

## 8. 范围之外

- 不改前端题目渲染组件（`BattleQuestionPanel`、`TypingQuestion`、`FillBlankQuestion`）——Monster schema 不变。
- 不改 SRS / mastery / 守护面板逻辑。
- 不新增 LLM provider；仍走 OpenRouterClient。
- Mentor（错题反攻）和 Report 提示词暂不在本次重构内（可后续按同样法则套用）。
