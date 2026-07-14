'use client';

import { createContext, useContext } from 'react';
import type { Language } from '@/store/settingsStore';

const landingCopy = {
  en: {
    nav: {
      home: 'Home',
      problem: 'Problem',
      solution: 'Solution',
      loop: 'Loop',
      preview: 'Preview',
      evidence: 'Evidence',
      responsibleAI: 'AI & Privacy',
      status: 'Status',
      feedback: 'Feedback',
      toggleToEnglish: 'Switch landing page to English',
      toggleToChinese: 'Switch landing page to Chinese',
      menu: 'Toggle menu',
    },
    hero: {
      eyebrow: 'Open Source · AI + Education',
      title: 'Word Quest: Infinite Tome',
      descriptionStart: 'An AI-assisted vocabulary learning game built like an RPG. Battle monsters, master words, and leave transparent evidence of every learning moment',
      descriptionEmphasis: 'built by a teacher',
      tryDemo: 'Try Demo',
      github: 'View on GitHub',
      imageAlt: 'Word Quest battle screen showing a vocabulary question with HP bars, monster encounter, and combat rewards',
    },
    problem: {
      eyebrow: 'The Challenge',
      title: 'Why Vocabulary Learning Is Hard',
      description: 'These problems are especially acute for young learners and self-directed students.',
      items: [
        {
          title: 'Repetitive',
          body: 'Flashcards and drills become boring quickly. Motivation drops after the first few sessions, and learners struggle to stay engaged.',
        },
        {
          title: 'Invisible',
          body: 'Teachers and guardians cannot see what actually happened during practice. Without evidence, it is hard to know where a learner needs help.',
        },
        {
          title: 'Unmotivating',
          body: 'Without feedback loops, progress markers, or meaningful rewards, learners disengage before they ever reach mastery.',
        },
      ],
    },
    solution: {
      eyebrow: 'The Solution',
      title: 'What Word Quest Does',
      features: [
        {
          title: 'Game-Based Battles',
          body: 'RPG-style encounters where answering vocabulary questions deals damage. Wrong answers have consequences. Victory feels earned.',
          imageAlt: 'Generated feature illustration of a learner battling a vocabulary monster projected from a magical tome',
        },
        {
          title: 'SRS / FSRS Review',
          body: 'Spaced repetition scheduling with ts-fsrs. Due cards surface at optimal intervals. Review sessions are focused and efficient.',
          imageAlt: 'Generated feature illustration of vocabulary cards orbiting a magical tome on a spaced review schedule',
        },
        {
          title: 'Mastery Tracking',
          body: 'Skill-level mastery states: new, learning, consolidated, mastered. The system knows what you know and what needs work.',
          imageAlt: 'Generated feature illustration of mastery nodes, progress crystals, and skill analytics rising from a tome',
        },
        {
          title: 'Guardian Dashboard',
          body: 'Learning evidence, weak-skill alerts, due-review recommendations, and exportable reports for teachers and parents.',
          imageAlt: 'Generated feature illustration of a guardian evidence dashboard projected from a magical tome',
        },
      ],
    },
    learningLoop: {
      eyebrow: 'How It Works',
      title: 'The Learning Loop',
      description: 'A continuous cycle of play, record, learn, and observe.',
      imageAlt: 'Generated dark learning engine illustration showing a magical tome with a circular cycle for play, evidence, mastery, review, and guardian insight',
      steps: [
        { title: 'Play', body: 'Battle, daily challenge, or SRS review session.' },
        { title: 'Record', body: 'Every answer, hint, and completion becomes a learning event.' },
        { title: 'Update', body: 'Mastery engine adjusts skill confidence based on performance.' },
        { title: 'Schedule', body: 'FSRS updates review cards and prioritizes next tasks.' },
        { title: 'Observe', body: 'Guardian dashboard shows evidence, trends, and recommendations.' },
      ],
    },
    preview: {
      eyebrow: 'Preview',
      title: 'See It in Action',
      items: [
        {
          alt: 'Word Quest home screen showing the current daily flame, today learning path, SRS review, daily challenge, and mission briefing',
          caption: "Today's learning path with review, challenge, and mission setup",
        },
        {
          alt: 'Current Word Quest battle screen showing the monster encounter, mission objective tags, and guided answer choices',
          caption: 'Guided battle with objective tags, monsters, and answer choices',
        },
        {
          alt: 'Current Guardian Dashboard showing mastery score, missions completed, review queue, learning events, and export controls',
          caption: 'Guardian dashboard with mastery, review queue, events, and export',
        },
      ],
    },
    evidence: {
      eyebrow: 'For Educators',
      title: 'Built for Teachers and Guardians',
      imageAlt: 'Guardian dashboard showing learning analytics, skill mastery bars, and actionable recommendations',
      features: [
        'Due-review evidence with FSRS card status',
        'Repeated-cause alerts for the same mistake patterns',
        'Study action recommendations with execution tracking',
        'Engagement metrics and consistency checks',
        'Exportable reports (image or print-friendly)',
        '7 / 14 / 30-day trend comparisons',
      ],
      privacy: 'All data stays local. No student information leaves the browser.',
    },
    responsibleAI: {
      eyebrow: 'Trust & Safety',
      title: 'Responsible AI and Privacy',
      principles: [
        { title: 'Local-First', body: 'Learning data stays in the browser via IndexedDB. No cloud sync required.' },
        { title: 'Optional AI', body: 'AI question generation is optional. Fallback questions and sample levels work without an API key.' },
        { title: 'Prompt-Constrained', body: 'AI prompts are scoped to educational vocabulary content. No open-ended generation.' },
        { title: 'Sanitized Output', body: 'Generated questions pass validation and sanitization. Malformed output falls back to safe defaults.' },
        { title: 'No Real Student Data', body: 'The project uses generic fixtures only. Never commit real names, schools, or identifiable information.' },
        { title: 'Human Review', body: 'AI-generated content should be reviewed before classroom use. Teachers remain responsible for final educational use.' },
      ],
    },
    status: {
      eyebrow: 'Transparency',
      title: 'Current Status and Limitations',
      badge: 'Early-Stage Prototype',
      intro: 'This is an early-stage open-source project. It is not a commercial product, and it does not claim production deployment, measured learning impact, or school-wide usage.',
      limitations: [
        'No account system or user authentication',
        'No cloud sync — all data is local to the browser',
        'No multiplayer or social features',
        'Limited content libraries — AI generation is optional',
        'The codebase is actively evolving; APIs and data formats may change',
      ],
      note: 'We welcome contributions that improve learning value, reliability, or safety.',
    },
    audience: {
      eyebrow: 'Audience',
      title: 'Who This Is For',
      items: [
        { title: 'Self-Learners', body: 'Practice vocabulary at your own pace with adaptive difficulty and clear progress markers.' },
        { title: 'Teachers', body: 'Generate practice missions from study text and observe student progress locally.' },
        { title: 'Parents / Guardians', body: 'Review learning evidence, weak skills, and recommended actions from a single dashboard.' },
        { title: 'EdTech Developers', body: 'Reusable learning-game patterns: battle loops, SRS integration, mastery engines.' },
        { title: 'AI+Education Researchers', body: 'A concrete, inspectable system for studying AI-assisted content generation in learning contexts.' },
      ],
    },
    differentiators: {
      eyebrow: 'Differentiators',
      title: 'What Makes It Different',
      items: [
        { title: 'Teacher-Built', body: 'Designed by a practicing teacher, not a product team. Every feature starts from a classroom need.' },
        { title: 'Learning Evidence First', body: 'Every interaction is logged as inspectable data, not just points. Teachers can see what actually happened.' },
        { title: 'Local-First Architecture', body: 'Works offline. No signup. No data leaving the device. Privacy by default.' },
        { title: 'Transparent AI', body: 'Prompts, sanitizers, and fallback chains are all visible in the source. No black-box generation.' },
        { title: 'FSRS-Powered Scheduling', body: 'Uses the same spaced-repetition algorithm as advanced flashcard apps — not a simple counter.' },
        { title: 'Open Source', body: 'MIT licensed. Inspect, fork, and adapt for your own learning context.' },
      ],
    },
    feedback: {
      eyebrow: 'Collaborate',
      title: 'Feedback Wanted',
      description: 'This project improves with honest input. Here are four areas where your perspective would help.',
      categories: [
        { title: 'Learning Experience', question: 'Does the battle loop feel motivating or distracting? Is the difficulty curve right?' },
        { title: 'Guardian Dashboard', question: 'Are the recommendations actionable? What evidence would help you support a learner?' },
        { title: 'AI Content Quality', question: 'How accurate are generated questions? What sanitization gaps should we address?' },
        { title: 'Technical Architecture', question: 'Is the local-first model viable for your context? What sync or deployment needs do you have?' },
      ],
      cta: 'Share Feedback',
    },
    techStack: {
      eyebrow: 'Technology',
      title: 'Built With',
      note: 'Frontend-only, local-first architecture. All learning state persists in the browser. Optional AI generation uses a provider-neutral DeepSeek, OpenRouter, or OpenAI adapter with a locally-entered API key.',
    },
    maintainer: {
      eyebrow: 'Behind the Project',
      paragraphs: [
        'This project is maintained as an open AI+education learning-tooling experiment by a primary-school English teacher and independent developer.',
        'It started from a simple question: can we make vocabulary practice something students actually want to do, while giving teachers and parents real evidence of learning?',
        'The answer is still unfolding — and your input shapes where it goes next.',
      ],
      name: 'Runes',
      role: 'Maintainer',
    },
    footer: {
      links: {
        github: 'GitHub',
        issues: 'Issues',
        contributing: 'Contributing',
        security: 'Security',
        roadmap: 'Roadmap',
      },
      copyright: 'Word Quest: Infinite Tome. Released under the MIT License.',
      thoughts: 'Have thoughts?',
      feedbackLink: 'Open an issue or share feedback',
    },
  },
  zh: {
    nav: {
      home: '首页',
      problem: '问题',
      solution: '方案',
      loop: '学习闭环',
      preview: '产品预览',
      evidence: '学习证据',
      responsibleAI: 'AI 与隐私',
      status: '当前状态',
      feedback: '反馈',
      toggleToEnglish: 'Switch landing page to English',
      toggleToChinese: 'Switch landing page to Chinese',
      menu: '打开或关闭导航菜单',
    },
    hero: {
      eyebrow: '开源 · AI + 教育',
      title: 'Word Quest: Infinite Tome',
      descriptionStart: '一个把英语词汇练习做成 RPG 战斗的 AI 辅助学习游戏。学生通过闯关打怪掌握单词，老师和家长可以看到每一次学习发生了什么',
      descriptionEmphasis: '由一线教师发起设计',
      tryDemo: '体验 Demo',
      github: '查看 GitHub',
      imageAlt: 'Word Quest 战斗界面，展示词汇题、生命值、怪物遭遇和战斗奖励',
    },
    problem: {
      eyebrow: '学习难点',
      title: '为什么词汇学习很难坚持',
      description: '这些问题在低龄学习者和自主学习场景中尤其明显。',
      items: [
        {
          title: '重复枯燥',
          body: '单词卡和机械刷题很快会失去新鲜感。几次练习后动力下降，学生很难长期投入。',
        },
        {
          title: '过程不可见',
          body: '老师和家长往往看不到练习过程中真实发生了什么。没有证据，就难以判断孩子真正需要什么支持。',
        },
        {
          title: '缺少激励',
          body: '如果没有反馈闭环、进度标记和有意义的奖励，学习者往往在形成稳定掌握前就放弃了。',
        },
      ],
    },
    solution: {
      eyebrow: '产品方案',
      title: 'Word Quest 能做什么',
      features: [
        {
          title: '游戏化战斗',
          body: '把词汇题放进 RPG 遭遇战。答对造成伤害，答错有代价，胜利来自真实的理解与选择。',
          imageAlt: '生成插画：学习者与从魔法书中投射出的词汇怪物战斗',
        },
        {
          title: 'SRS / FSRS 复习',
          body: '使用 ts-fsrs 做间隔重复调度。到期卡片会在合适时间出现，让复习更聚焦、更高效。',
          imageAlt: '生成插画：词汇卡片围绕魔法书按间隔复习轨道运行',
        },
        {
          title: '掌握度追踪',
          body: '按技能记录 new、learning、consolidated、mastered 等状态。系统知道学生会什么、还需要练什么。',
          imageAlt: '生成插画：掌握节点、进度水晶和技能分析从魔法书中升起',
        },
        {
          title: '家长与教师看板',
          body: '展示学习证据、薄弱技能提醒、到期复习建议，以及可导出的学习报告。',
          imageAlt: '生成插画：从魔法书投射出的学习证据看板',
        },
      ],
    },
    learningLoop: {
      eyebrow: '运行机制',
      title: '学习闭环',
      description: '从游戏练习到证据记录，再到掌握度更新和下一步安排，形成持续闭环。',
      imageAlt: '深色学习引擎插画：魔法书周围环绕游戏、证据、掌握度、复习和看板洞察',
      steps: [
        { title: '练习', body: '进入战斗、每日挑战或 SRS 复习任务。' },
        { title: '记录', body: '每一次作答、提示使用和任务完成都会成为学习事件。' },
        { title: '更新', body: '掌握度引擎根据表现调整技能信心。' },
        { title: '调度', body: 'FSRS 更新复习卡片，并决定下一批优先任务。' },
        { title: '观察', body: '教师/家长看板展示证据、趋势和行动建议。' },
      ],
    },
    preview: {
      eyebrow: '产品预览',
      title: '看看实际运行效果',
      items: [
        {
          alt: 'Word Quest 首页，展示每日火焰、今日学习路径、SRS 复习、每日挑战和任务简报',
          caption: '今日学习路径：复习、挑战和任务启动集中在一个入口',
        },
        {
          alt: '当前 Word Quest 战斗界面，展示怪物遭遇、任务目标标签和引导式选项',
          caption: '带目标标签、怪物遭遇和选项反馈的引导式战斗',
        },
        {
          alt: '当前家长看板，展示掌握度、已完成任务、复习队列、学习事件和导出控件',
          caption: '家长/教师看板：掌握度、复习队列、事件和导出',
        },
      ],
    },
    evidence: {
      eyebrow: '面向教育者',
      title: '为教师和家长设计',
      imageAlt: '家长看板，展示学习分析、技能掌握条和可执行建议',
      features: [
        '基于 FSRS 卡片状态的到期复习证据',
        '同类错因反复出现时自动提醒',
        '可追踪执行情况的学习行动建议',
        '参与度指标和学习稳定性检查',
        '可导出的图片或打印友好报告',
        '7 / 14 / 30 天趋势对比',
      ],
      privacy: '所有学习数据都保存在本地浏览器中。学生信息不会离开设备。',
    },
    responsibleAI: {
      eyebrow: '信任与安全',
      title: '负责任的 AI 与隐私设计',
      principles: [
        { title: '本地优先', body: '学习数据通过 IndexedDB 保存在浏览器里，不依赖云端同步。' },
        { title: 'AI 可选', body: 'AI 出题是可选能力。没有 API Key 时，也可以使用内置样例和兜底题目。' },
        { title: '提示词受限', body: 'AI 提示词只围绕教育词汇内容，不做开放式无边界生成。' },
        { title: '输出校验', body: '生成题目会经过验证和清洗。格式异常时会回退到安全默认内容。' },
        { title: '不使用真实学生数据', body: '项目只使用通用示例数据，不应提交真实姓名、学校或可识别信息。' },
        { title: '教师最终把关', body: 'AI 生成内容应在课堂使用前由教师审核，最终教育使用仍由人负责。' },
      ],
    },
    status: {
      eyebrow: '透明说明',
      title: '当前状态与限制',
      badge: '早期原型',
      intro: '这是一个早期开源项目，不是商业化成品，也不宣称已经完成生产级部署、学习效果实证或校级规模使用。',
      limitations: [
        '暂无账号系统或用户认证',
        '暂无云端同步，所有数据只保存在当前浏览器',
        '暂无多人或社交功能',
        '内容库仍有限，AI 生成是可选能力',
        '代码仍在快速演进，API 和数据格式可能变化',
      ],
      note: '欢迎任何能提升学习价值、可靠性或安全性的贡献。',
    },
    audience: {
      eyebrow: '适合谁',
      title: '这个项目面向哪些人',
      items: [
        { title: '自主学习者', body: '按照自己的节奏练习词汇，并获得清晰的进度反馈。' },
        { title: '英语教师', body: '从学习文本生成练习任务，并在本地观察学生学习进展。' },
        { title: '家长 / 监护人', body: '通过一个看板查看学习证据、薄弱技能和下一步建议。' },
        { title: '教育科技开发者', body: '可复用的学习游戏模式：战斗循环、SRS、掌握度引擎。' },
        { title: 'AI+教育研究者', body: '一个可检查的真实系统，用于观察 AI 辅助内容生成如何进入学习流程。' },
      ],
    },
    differentiators: {
      eyebrow: '差异点',
      title: '它和普通背单词工具有什么不同',
      items: [
        { title: '教师发起', body: '从一线课堂需要出发，而不是先有产品概念再找教育场景。' },
        { title: '学习证据优先', body: '每次互动都会留下可检查的数据，而不只是分数。老师能看到真实发生了什么。' },
        { title: '本地优先架构', body: '可离线使用。无需注册。数据不离开设备。默认保护隐私。' },
        { title: '透明 AI', body: '提示词、清洗器和兜底链路都在源码中可见，不是黑盒生成。' },
        { title: 'FSRS 调度', body: '使用高级记忆软件同类的间隔重复算法，而不是简单计数器。' },
        { title: '开源可改造', body: 'MIT 许可。可以检查、fork，并改造成适合自己教学场景的版本。' },
      ],
    },
    feedback: {
      eyebrow: '一起完善',
      title: '欢迎反馈',
      description: '这个项目需要真实使用者的意见。下面四类反馈会最有帮助。',
      categories: [
        { title: '学习体验', question: '战斗循环是更有动力，还是会分散注意力？难度曲线是否合适？' },
        { title: '家长/教师看板', question: '这些建议是否可执行？还需要哪些证据来支持孩子学习？' },
        { title: 'AI 内容质量', question: '生成题目的准确性如何？还需要补哪些清洗和校验？' },
        { title: '技术架构', question: '本地优先模式是否适合你的场景？是否需要同步、部署或账号能力？' },
      ],
      cta: '分享反馈',
    },
    techStack: {
      eyebrow: '技术栈',
      title: 'Built With',
      note: '前端单体、本地优先架构。所有学习状态都保存在浏览器中。AI 生成可通过统一适配层选择 DeepSeek、OpenRouter 或 OpenAI，API Key 由用户本地输入。',
    },
    maintainer: {
      eyebrow: '项目背后',
      paragraphs: [
        '这个项目由一名小学英语教师和独立开发者维护，是一个开放的 AI+教育学习工具实验。',
        '它从一个简单问题开始：能不能让学生真的愿意做词汇练习，同时让老师和家长看到真实的学习证据？',
        '答案仍在展开中，而你的反馈会影响它走向哪里。',
      ],
      name: 'Runes',
      role: '维护者',
    },
    footer: {
      links: {
        github: 'GitHub',
        issues: 'Issues',
        contributing: '贡献指南',
        security: '安全说明',
        roadmap: '路线图',
      },
      copyright: 'Word Quest: Infinite Tome. MIT License 开源发布。',
      thoughts: '有想法？',
      feedbackLink: '提交 issue 或分享反馈',
    },
  },
} as const;

type LandingCopy = (typeof landingCopy)[Language];

const LandingCopyContext = createContext<{
  language: Language;
  copy: LandingCopy;
}>({
  language: 'en',
  copy: landingCopy.en,
});

export function LandingCopyProvider({
  language,
  children,
}: {
  language: Language;
  children: React.ReactNode;
}) {
  const normalizedLanguage = language === 'zh' ? 'zh' : 'en';

  return (
    <LandingCopyContext.Provider
      value={{
        language: normalizedLanguage,
        copy: landingCopy[normalizedLanguage],
      }}
    >
      {children}
    </LandingCopyContext.Provider>
  );
}

export function useLandingCopy() {
  return useContext(LandingCopyContext);
}
