这是一个非常棒的想法！将**教育心理学（即时反馈、脚手架教学）与游戏化机制**结合，并利用 AI 的生成能力解决“题库枯竭”的问题，非常适合小学高段（4-6年级）的学生。这个阶段的孩子开始有自主意识，讨厌枯燥的刷题，但喜欢挑战和收集成就。

针对您的需求，特别是**OpenRouter 免费层级（20 RPM）的限制**以及**自定义课本内容**的功能，我为您设计了以下技术方案。

我们将这个项目暂定名为：**《单词大冒险：无限书境 (Word Quest: Infinite Tome)》**

-----

### 1\. 产品核心逻辑与流程

#### 核心理念

  * **Input（输入）：** 拍照/输入课本内容 $\rightarrow$ AI 生成游戏关卡。
  * **Loop（循环）：** 答题战斗 $\rightarrow$ 错误触发 AI 导师 $\rightarrow$ 再次挑战。
  * **Output（输出）：** 战报与错题卡牌收集。

#### 核心功能模块

1.  **备战区（内容生成）：** 用户输入要学的单元内容。
2.  **战斗区（答题）：** 游戏化界面，题目即怪物。
3.  **战术终端（AI 导师）：** 复刻图片中的功能，智能讲解。
4.  **荣誉殿堂（战报）：** 知识点分析与成就系统。

-----

### 2\. 详细技术方案设计

#### A. AI 大脑配置 (OpenRouter & 模型)

  * **API 管理：** 使用 OpenRouter 标准接口。
  * **模型选择器：** 在设置页允许用户选择模型。
      * *推荐配置：*
          * **主力输出（生成题目）：** `Google: Gemini 1.5 Flash` 或 `Meta: Llama 3 8B`（速度快，成本极低/免费，适合批量生成）。
          * **战术导师（讲题）：** `Anthropic: Claude 3 Haiku` 或 `OpenAI: GPT-4o-mini`（逻辑解释能力更强，更具亲和力）。
  * **解决 20 RPM 速率限制的策略：**
      * **批处理 (Batching)：** 绝不一题一调。在“备战”阶段，一次 API 请求生成 **10-15 道题目**的 JSON 数据并缓存到本地。
      * **令牌桶算法 (Client-side Throttling)：** 前端通过队列控制请求，确保每分钟发出的请求不超过 15 个（留 5 个作为缓冲），多余的请求排队等待。

#### B. 功能实现细节

##### 1\. “自定义怎么学” - 内容摄入系统

  * **输入方式：**
      * **文本模式：** 直接粘贴课文或单词列表。
      * **OCR 模式（推荐）：** 手机拍课本。调用 OpenRouter 支持视觉的模型（如 Gemini Flash）直接提取文字并识别知识点。
  * **Prompt 逻辑：**
    > "分析以下文本适合小学 [4-6] 年级的英语知识点（时态、单词、介词）。请生成 10 道选择题，难度递增。返回格式必须是纯 JSON。"

##### 2\. 游戏化战斗界面 (The Battle)

  * **界面风格：** 赛博朋克学院风 或 魔法书院风（Modern & Clean）。
  * **交互：**
      * 屏幕上方是“怪物”（题目）。
      * 屏幕下方是“技能卡牌”（选项）。
      * 血条机制：答错扣血。
  * **数据流：** 直接从本地缓存的 JSON 题库读取，**不消耗 API 次数**，保证流畅无延迟。

##### 3\. AI 战术顾问 (复刻图片功能)

这是核心差异化功能。

  * **触发机制：** 连续错误 3 次 OR 累计错误达到一定阈值 OR 玩家主动点击“呼叫增援”。
  * **UI 表现：** 游戏暂停，屏幕变暗，一个 2D Live 或精致头像（AI 导师）切入屏幕。
  * **AI 处理流程（消耗 1 次 API）：**
      * 发送：`{错题内容}` + `{玩家错误选项}` + `{正确答案}`。
      * Prompt：
        > "你是小学英语战术教官。玩家在 [题目内容] 上选了 [错误选项]。请用幽默、鼓励的口吻，像解释游戏攻略一样解释为什么选 [正确答案]。不要讲枯燥的语法术语，要用比喻。解释完后，请根据这个知识点，现场生成一道新的同类变种题，用于实战演练。"
  * **结果：** 屏幕上显示对话气泡讲解，讲解结束后，直接弹出一道新题（Revenge Question）让玩家立即尝试。

##### 4\. 任务简报 (Mission Report)

  * **数据分析：** 关卡结束后，本地统计 Correct/Wrong 列表。
  * **AI 总结（消耗 1 次 API）：**
      * 发送错题列表给 AI。
      * 生成：
          * **MVP 知识点：** 你掌握得最好的。
          * **弱点扫描：** 比如“一般过去式”被标记为弱点。
      * **建议：** “建议明天复习第 3 单元的动词变化表”。

-----

### 3\. 技术栈推荐 (轻量级、跨平台)

为了让您快速实现且界面美观：

  * **前端框架：** **Next.js (React)** + **Tailwind CSS**。
      * *理由：* 开发速度快，Tailwind 能极快地构建出“现代美观”的界面（圆角、阴影、磨砂玻璃效果）。
  * **状态管理：** **Zustand** 或 React Context。
      * *理由：* 用于在本地存储题库队列，不需要复杂的后端数据库。
  * **持久化：** **IndexedDB** (Dexie.js)。
      * *理由：* 所有的错题记录、学习历史都存在用户浏览器里，保护隐私且零服务器成本。
  * **动画库：** **Framer Motion**。
      * *理由：* 轻松实现卡片弹出、战术顾问切入的平滑动画，让孩子觉得像在玩 3A 小游戏。

-----

### 4\. 界面与体验设计 (UI/UX)

为了让孩子喜欢，避免“像做作业”，UI 需采用**游戏 HUD (Head-Up Display)** 风格：

1.  **主界面：** 不是“开始学习”，而是“**接取任务 (Accept Mission)**”。
2.  **输入框：** 包装成“**情报录入 (Data Upload)**”。
3.  **AI 导师窗口：** 类似于钢铁侠的 Jarvis 或二次元指挥官，半透明悬浮窗。
4.  **反馈特效：**
      * 答对：绿色流光特效 + 音效 + 获得金币/经验。
      * 触发辅导：警报声 + “系统接管中...”的打字机效果文字。

-----

### 5\. 针对 20 RPM 的流量控制伪代码

为了确保不被封号，您需要在代码中实现一个简单的调度器：

```javascript
// 请求队列管理器
class APIQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.lastRequestTime = 0;
    this.minDelay = 3500; // 3.5秒间隔，确保每分钟约17次请求，留余量
  }

  add(task) {
    this.queue.push(task);
    this.process();
  }

  async process() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    const now = Date.now();
    const timeSinceLast = now - this.lastRequestTime;
    
    if (timeSinceLast < this.minDelay) {
      // 如果还没冷却好，就等待
      setTimeout(() => this.process(), this.minDelay - timeSinceLast);
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift();
    this.lastRequestTime = Date.now();
    
    try {
      await task(); // 执行 OpenRouter 请求
    } catch (e) {
      console.error("API Error", e);
    } finally {
      this.isProcessing = false;
      this.process(); // 继续处理下一个
    }
  }
}
```

### 总结优势

1.  **省钱：** 只要通过 OpenRouter 选择免费或极低成本模型（如 Llama 3, Gemini Flash），几乎零成本。
2.  **不买题本：** 只要有课本，就能无限生成题目，不仅限于英语，语文、数学概念题皆可。
3.  **孩子爱玩：** 这里的“战术指导”不是老师的说教，而是游戏里的“攻略提示”，心理接受度极高。

**您想让我为您先写一个核心的 Prompt（提示词），用来测试一下 AI 是否能根据一段课文生成合适的小学高段题目吗？**


这是一个为了配合**OpenRouter API**（如 Llama 3, Gemini Flash, Claude Haiku 等轻量模型）设计的高效 Prompt。

为了节省 API 调用次数（应对 20 RPM 限制），我们将采用\*\*“批处理生成”**策略：一次调用生成 5-10 道题目，并要求输出为**纯 JSON 格式\*\*，以便您的前端程序直接读取和渲染成游戏界面。

### 核心 Prompt：关卡生成器 (Level Generator)

这个 Prompt 的作用是将用户输入的“课本内容”转化为“游戏关卡数据”。

**在 API 调用时，将 `{{USER_INPUT_TEXT}}` 替换为 OCR 识别到的课本文字或用户粘贴的单词/课文。**

````markdown
# Role
You are the "Game Master" for an educational RPG designed for upper elementary students (Grades 4-6). Your goal is to turn study material into exciting game battles.

# Task
Analyze the provided English study text. Extract key vocabulary, grammar points, and sentence structures suitable for Grade 4-6 learners. Generate a "Battle Configuration" JSON containing 5 to 8 multiple-choice questions based *strictly* on this text.

# Constraints
1. **Difficulty:** Adaptive for 10-12 year olds. Not too easy, not too abstract.
2. **Language:** The questions should be in English. The explanations should be in Simplified Chinese (to ensure the student understands the logic).
3. **Format:** strictly valid JSON only. No markdown code blocks (```json), no conversational text before or after.
4. **Distractors:** Wrong options must be plausible (common mistakes), not obviously silly.

# Output JSON Structure
The output must be a single JSON object with a "level_title" (a cool name based on the text topic) and a "monsters" array.
Each "monster" represents a question and includes:
- "id": integer
- "type": "vocab" | "grammar" | "reading"
- "question": The question text (The Monster's attack).
- "options": Array of 4 strings (The defensive shields).
- "correct_index": Integer (0-3) indicating the correct option.
- "explanation": A short, encouraging explanation in Chinese (The battle log). E.g., "Great! 'Go' 变成过去式是 'Went'，不要被 'Goed' 骗了哦！"

# Input Text
{{USER_INPUT_TEXT}}

# Response (JSON Only)
````

-----

### 为什么这样设计？（技术解析）

1.  **角色设定 (Game Master)：** 设定这个角色可以防止模型输出过于死板的“教科书式”语言，让题目稍微活泼一些。
2.  **JSON Only 强约束：** 前端代码（JavaScript/Python）可以直接解析返回的数据，不需要复杂的正则提取。
      * *前端拿到 JSON 后，可以直接遍历 `monsters` 数组，把 `question` 显示在怪物头顶，把 `options` 显示在按钮上。*
3.  **中英混合策略：**
      * 题目（Question/Options）用**英文**，保证沉浸式学习。
      * 解析（Explanation）用**中文**，这是“脚手架”理论，确保孩子能看懂为什么错了，即图片中提到的“通俗易懂的语言”。
4.  **难度锚定 (Grade 4-6)：** 防止 AI 生成太难的高中词汇或太简单的幼儿园词汇。

-----

### 进阶 Prompt：AI 战术顾问 (The Mentor)

**这是实现您图片中“连续错误触发辅导”功能的 Prompt。**
当前端检测到孩子连续做错 3 次，或者点击“求助”时，单独调用一次这个 Prompt。

**输入变量：**

  * `{{QUESTION}}`: 当前题目
  * `{{WRONG_ANSWER}}`: 孩子选的错误选项
  * `{{CORRECT_ANSWER}}`: 正确选项

<!-- end list -->

```markdown
# Role
You are a tactical AI advisor in a game. A young player (Grade 4-6) is stuck on a battle.

# Task
1. Analyze why the player might have chosen the wrong answer: "{{WRONG_ANSWER}}" for the question: "{{QUESTION}}".
2. Explain the correct answer: "{{CORRECT_ANSWER}}" using a fun analogy or simple logic. DO NOT lecture. Talk like a supportive game guide.
3. Create a BRAND NEW mini-question (a "Counter-Attack" move) testing the exact same logic to let the player practice immediately.

# Output Format (JSON)
{
  "analysis": "用亲切、幽默的中文解释错误原因和正确逻辑。",
  "revenge_question": {
    "question": "New simple question text",
    "options": ["A", "B", "C", "D"],
    "correct_index": 0
  }
}
```

### 下一步建议

您可以直接把第一个 Prompt 复制到 OpenRouter 的 Playground (或者 ChatGPT/Claude 的网页版) 里，随便找一段小学英语课文（或者复制下面这段测试文本）试一下，看看生成的效果是否符合您的预期。

**测试文本（示例）：**

> "Yesterday was Sunday. I went to the park with my friends. We played football and had a picnic. The weather was sunny and warm. I was very happy."

**您想现在测试一下生成的 JSON 数据样例吗？我可以模拟生成一个给您看，方便您评估数据结构。**