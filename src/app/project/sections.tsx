import Image from 'next/image';
import Link from 'next/link';
import {
  BookOpen,
  EyeOff,
  TrendingDown,
  Swords,
  Timer,
  Target,
  BarChart3,
  Shield,
  Cpu,
  Lock,
  CheckCircle,
  UserX,
  Eye,
  GraduationCap,
  Presentation,
  HeartHandshake,
  Code2,
  Microscope,
  MessageCircle,
  LayoutDashboard,
  Bot,
  Settings2,
  Play,
  Github,
  ExternalLink,
  FileText,
  AlertTriangle,
  Mail,
  ArrowRight,
} from 'lucide-react';
import {
  ScrollReveal,
  StaggerContainer,
  StaggerItem,
  Eyebrow,
  SectionHeader,
} from './components';

const GITHUB_URL = 'https://github.com/runes780/word-quest-infinite-tome';
const FEEDBACK_URL = process.env.NEXT_PUBLIC_WORDQUEST_FEEDBACK_URL ?? '#feedback';

// ---------------------------------------------------------------------------
// Hero — Bold typography, no external fonts needed
// ---------------------------------------------------------------------------
export function HeroSection() {
  return (
    <section id="hero" className="relative overflow-hidden min-h-screen flex items-center">
      {/* Rotating ring decorations — like an astrolabe or magic circle */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] md:w-[900px] md:h-[900px] pointer-events-none"
      >
        <div className="absolute inset-0 border border-slate-100 rounded-full animate-[spin_80s_linear_infinite]" />
        <div className="absolute inset-8 md:inset-12 border border-slate-50 rounded-full animate-[spin_60s_linear_infinite_reverse]" />
        <div className="absolute inset-20 md:inset-28 border border-dashed border-slate-100 rounded-full animate-[spin_100s_linear_infinite]" />
        {/* Crosshair lines */}
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-50" />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-slate-50" />
      </div>

      {/* Ambient glow */}
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-amber-100/40 blur-[120px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 pt-28 pb-20 md:pt-36 md:pb-28 w-full">
        <div className="text-center">
          {/* Eyebrow */}
          <ScrollReveal delay={0.2}>
            <span className="inline-block text-[10px] font-medium uppercase tracking-[0.4em] text-slate-400 mb-12 font-mono-label">
              Open Source &middot; AI + Education
            </span>
          </ScrollReveal>

          {/* Main title — Solid + Stroke with offset */}
          <ScrollReveal delay={0.3}>
            <div className="relative inline-block"
            >
              <h1 className="leading-[0.82] tracking-[-0.05em] uppercase"
              >
                <span className="block text-[3.5rem] sm:text-6xl md:text-8xl lg:text-[9rem] font-black text-slate-900">
                  Word
                </span>
                <span className="block text-[3.5rem] sm:text-6xl md:text-8xl lg:text-[9rem] font-black text-stroke ml-12 sm:ml-20 md:ml-32">
                  Quest
                </span>
              </h1>
            </div>
          </ScrollReveal>

          {/* Subtitle */}
          <ScrollReveal delay={0.5}>
            <p className="mt-6 text-lg md:text-xl font-light text-slate-400 tracking-[0.2em] uppercase mb-10">
              Infinite Tome
            </p>
          </ScrollReveal>

          {/* Decorative rule with diamond */}
          <ScrollReveal delay={0.6}>
            <div className="flex items-center justify-center gap-4 mb-12"
            >
              <div className="h-px w-12 bg-slate-300" />
              <div className="w-2 h-2 rotate-45 bg-slate-300" />
              <div className="h-px w-12 bg-slate-300" />
            </div>
          </ScrollReveal>

          {/* Description */}
          <ScrollReveal delay={0.7}>
            <p className="text-base md:text-lg text-slate-500 leading-[1.8] mb-12 max-w-md mx-auto"
            >
              An open-source AI+education project for vocabulary learning.
              Game-based battles, intelligent review scheduling, and transparent
              learning evidence — <span className="text-slate-800 font-medium">built by a teacher</span>.
            </p>
          </ScrollReveal>

          {/* Buttons — clean, no glow */}
          <ScrollReveal delay={1.1}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/"
                className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-slate-900 text-white font-medium text-sm hover:bg-slate-800 transition-all duration-300 active:scale-[0.97]"
              >
                <Play className="w-4 h-4" />
                Try Demo
                <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full border border-slate-200 text-slate-700 font-medium text-sm hover:border-slate-300 hover:bg-slate-50 transition-all duration-300 active:scale-[0.97]"
              >
                <Github className="w-4 h-4" />
                View on GitHub
              </a>
            </div>
          </ScrollReveal>
        </div>

        {/* Hero image — understated, with subtle frame */}
        <ScrollReveal delay={1.3} className="mt-16 md:mt-20">
          <div className="relative max-w-4xl mx-auto">
            <div className="absolute -inset-3 bg-gradient-to-b from-slate-100/50 to-transparent rounded-[2rem] blur-xl" />
            <div className="relative rounded-2xl overflow-hidden border border-slate-100 shadow-[0_2px_40px_-12px_rgba(0,0,0,0.08)]">
              <div className="relative w-full aspect-[16/9]">
                <Image
                  src="/wordquest/hero.png"
                  alt="Word Quest: Infinite Tome — a magical tome representing the journey of vocabulary learning"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Problem
// ---------------------------------------------------------------------------
export function ProblemSection() {
  const problems = [
    {
      icon: BookOpen,
      title: 'Repetitive',
      body: 'Flashcards and drills become boring quickly. Motivation drops after the first few sessions, and learners struggle to stay engaged.',
      color: 'from-amber-500/20 to-orange-500/10',
      iconColor: 'text-amber-600',
    },
    {
      icon: EyeOff,
      title: 'Invisible',
      body: 'Teachers and guardians cannot see what actually happened during practice. Without evidence, it is hard to know where a learner needs help.',
      color: 'from-rose-500/20 to-pink-500/10',
      iconColor: 'text-rose-600',
    },
    {
      icon: TrendingDown,
      title: 'Unmotivating',
      body: 'Without feedback loops, progress markers, or meaningful rewards, learners disengage before they ever reach mastery.',
      color: 'from-red-500/20 to-rose-500/10',
      iconColor: 'text-red-600',
    },
  ];

  return (
    <section id="problem" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="The Challenge"
          title="Why Vocabulary Learning Is Hard"
          description="These problems are especially acute for young learners and self-directed students."
        />

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {problems.map((p) => (
            <StaggerItem key={p.title}>
              <div className="h-full bg-white border border-slate-100 rounded-2xl p-6 md:p-8 hover:border-slate-200 hover:-translate-y-0.5 transition-all duration-300 group">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center mb-5`}>
                  {(() => { const Icon = p.icon; return <Icon className={`w-6 h-6 ${p.iconColor}`} />; })()}
                </div>
                <h3 className="text-xl font-semibold text-card-foreground mb-3">{p.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{p.body}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Solution — Zigzag layout
// ---------------------------------------------------------------------------
export function SolutionSection() {
  const features = [
    {
      icon: Swords,
      title: 'Game-Based Battles',
      body: 'RPG-style encounters where answering vocabulary questions deals damage. Wrong answers have consequences. Victory feels earned.',
      color: 'from-indigo-500/20 to-violet-500/10',
      iconColor: 'text-indigo-600',
      image: '/wordquest/app-battle-preview.png',
      imageAlt: 'Battle question screen showing a monster encounter with HP bar, multiple-choice question, and combat rewards',
    },
    {
      icon: Timer,
      title: 'SRS / FSRS Review',
      body: 'Spaced repetition scheduling with ts-fsrs. Due cards surface at optimal intervals. Review sessions are focused and efficient.',
      color: 'from-emerald-500/20 to-teal-500/10',
      iconColor: 'text-emerald-600',
      image: '/wordquest/srs-dashboard-screenshot.png',
      imageAlt: 'SRS Review Dashboard showing level progress, today\'s goal, and card status overview',
    },
    {
      icon: Target,
      title: 'Mastery Tracking',
      body: 'Skill-level mastery states: new, learning, consolidated, mastered. The system knows what you know and what needs work.',
      color: 'from-sky-500/20 to-blue-500/10',
      iconColor: 'text-sky-600',
      image: '/wordquest/mastery-tracking-screenshot.png',
      imageAlt: 'Guardian Dashboard showing mastery score, missions completed, questions answered, and mastery progress',
    },
    {
      icon: BarChart3,
      title: 'Guardian Dashboard',
      body: 'Learning evidence, weak-skill alerts, due-review recommendations, and exportable reports for teachers and parents.',
      color: 'from-violet-500/20 to-purple-500/10',
      iconColor: 'text-violet-600',
      image: '/wordquest/dashboard-preview.png',
      imageAlt: 'Guardian dashboard showing learning analytics, skill mastery bars, and actionable recommendations',
    },
  ];

  return (
    <section id="solution" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="The Solution"
          title="What Word Quest Does"
        />

        <div className="space-y-16 md:space-y-24">
          {features.map((f, i) => (
            <ScrollReveal
              key={f.title}
              direction={i % 2 === 0 ? 'left' : 'right'}
              spring
            >
              <div className={`flex flex-col ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-8 lg:gap-16 items-center`}>
                {/* Icon + Title block */}
                <div className="w-full lg:w-1/2">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-5`}>
                    {(() => { const Icon = f.icon; return <Icon className={`w-7 h-7 ${f.iconColor}`} />; })()}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">{f.title}</h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">{f.body}</p>
                </div>

                {/* Feature screenshot */}
                <div className="w-full lg:w-1/2">
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-200 shadow-[0_2px_24px_-8px_rgba(0,0,0,0.06)] group">
                    <Image
                      src={f.image}
                      alt={f.imageAlt}
                      fill
                      className="object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out"
                    />
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Learning Loop — Dark cinema mode
// ---------------------------------------------------------------------------
export function LearningLoopSection() {
  const steps = [
    { num: 1, title: 'Play', body: 'Battle, daily challenge, or SRS review session.', color: 'bg-indigo-500' },
    { num: 2, title: 'Record', body: 'Every answer, hint, and completion becomes a learning event.', color: 'bg-violet-500' },
    { num: 3, title: 'Update', body: 'Mastery engine adjusts skill confidence based on performance.', color: 'bg-purple-500' },
    { num: 4, title: 'Schedule', body: 'FSRS updates review cards and prioritizes next tasks.', color: 'bg-fuchsia-500' },
    { num: 5, title: 'Observe', body: 'Guardian dashboard shows evidence, trends, and recommendations.', color: 'bg-amber-500' },
  ];

  return (
    <section id="learning-loop" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-slate-950 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-indigo-500/[0.04] blur-[150px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] rounded-full bg-violet-500/[0.03] blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative">
        <SectionHeader
          eyebrow="How It Works"
          title="The Learning Loop"
          description="A continuous cycle of play, record, learn, and observe."
          dark
        />

        <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-center">
          <ScrollReveal className="w-full lg:w-1/2" spring>
            <div className="relative w-full aspect-square max-w-md mx-auto rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900">
              <Image
                src="/wordquest/learning-loop.png"
                alt="Learning loop diagram showing the cycle from battle to event logging to mastery update to scheduling to dashboard observation"
                fill
                className="object-contain p-6"
              />
            </div>
          </ScrollReveal>

          <div className="w-full lg:w-1/2 space-y-5">
            {steps.map((s, i) => (
              <ScrollReveal key={s.num} delay={i * 0.1} direction="right">
                <div className="flex gap-4 items-start">
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full ${s.color} text-white flex items-center justify-center text-sm font-bold shadow-lg`}>
                    {s.num}
                  </div>
                  <div className="flex-1 pb-5 border-b border-slate-800/50">
                    <h4 className="font-semibold text-white mb-1">{s.title}</h4>
                    <p className="text-slate-400 leading-relaxed text-sm">{s.body}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Product Preview — Dark cinema mode with gradient borders
// ---------------------------------------------------------------------------
export function ProductPreviewSection() {
  const previews = [
    {
      src: '/wordquest/app-battle-preview.png',
      alt: 'Battle question screen showing a monster encounter with HP bar, multiple-choice question, and combat rewards',
      caption: 'Battle question with HP, rewards, and monster encounter',
    },
    {
      src: '/wordquest/guardian-dashboard-screenshot.png',
      alt: 'Guardian dashboard showing learning history, weak skills, and review recommendations',
      caption: 'Guardian dashboard with learning history and weak skills',
    },
    {
      src: '/wordquest/mission-report-screenshot.png',
      alt: 'Mission report screen showing accuracy score, rewards earned, and recommended next steps',
      caption: 'Mission report with accuracy, rewards, and next steps',
    },
  ];

  return (
    <section id="preview" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-slate-950 relative">
      <div className="max-w-6xl mx-auto relative">
        <SectionHeader
          eyebrow="Preview"
          title="See It in Action"
          dark
        />

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {previews.map((p) => (
            <StaggerItem key={p.src}>
              <div className="group">
                <div className="relative rounded-xl overflow-hidden border border-slate-800/80 bg-slate-900 shadow-2xl">
                  {/* Window title bar */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/60">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                  </div>
                  {/* Screenshot */}
                  <div className="relative w-full aspect-video overflow-hidden">
                    <Image
                      src={p.src}
                      alt={p.alt}
                      fill
                      className="object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out"
                    />
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-500 text-center font-light">{p.caption}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Guardian Evidence
// ---------------------------------------------------------------------------
export function GuardianEvidenceSection() {
  const features = [
    'Due-review evidence with FSRS card status',
    'Repeated-cause alerts for the same mistake patterns',
    'Study action recommendations with execution tracking',
    'Engagement metrics and consistency checks',
    'Exportable reports (image or print-friendly)',
    '7 / 14 / 30-day trend comparisons',
  ];

  return (
    <section id="evidence" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="For Educators"
          title="Built for Teachers and Guardians"
        />

        <div className="flex flex-col lg:flex-row-reverse gap-10 lg:gap-16 items-center">
          <ScrollReveal className="w-full lg:w-1/2" spring>
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-200 shadow-[0_2px_24px_-8px_rgba(0,0,0,0.06)]">
              <Image
                src="/wordquest/dashboard-preview.png"
                alt="Guardian dashboard concept showing learning analytics, skill mastery bars, and actionable recommendations"
                fill
                className="object-cover"
              />
            </div>
          </ScrollReveal>

          <div className="w-full lg:w-1/2">
            <ul className="space-y-4">
              {features.map((f, i) => (
                <ScrollReveal key={i} delay={i * 0.08} direction="left">
                  <li className="flex items-start gap-3 group">
                    <CheckCircle className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 leading-relaxed">{f}</span>
                  </li>
                </ScrollReveal>
              ))}
            </ul>

            <ScrollReveal delay={0.4}>
              <div className="mt-8 p-4 rounded-xl bg-amber-50 border border-amber-200/60">
                <p className="text-sm text-amber-800 leading-relaxed">
                  <Shield className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
                  All data stays local. No student information leaves the browser.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Responsible AI and Privacy — Glass cards on light background
// ---------------------------------------------------------------------------
export function ResponsibleAISection() {
  const principles = [
    { icon: Shield, title: 'Local-First', body: 'Learning data stays in the browser via IndexedDB. No cloud sync required.' },
    { icon: Cpu, title: 'Optional AI', body: 'AI question generation is optional. Fallback questions and sample levels work without an API key.' },
    { icon: Lock, title: 'Prompt-Constrained', body: 'AI prompts are scoped to educational vocabulary content. No open-ended generation.' },
    { icon: CheckCircle, title: 'Sanitized Output', body: 'Generated questions pass validation and sanitization. Malformed output falls back to safe defaults.' },
    { icon: UserX, title: 'No Real Student Data', body: 'The project uses generic fixtures only. Never commit real names, schools, or identifiable information.' },
    { icon: Eye, title: 'Human Review', body: 'AI-generated content should be reviewed before classroom use. Teachers remain responsible for final educational use.' },
  ];

  return (
    <section id="responsible-ai" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="Trust & Safety"
          title="Responsible AI and Privacy"
        />

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {principles.map((p) => (
            <StaggerItem key={p.title}>
              <div className="h-full bg-white border border-slate-100 rounded-2xl p-6 md:p-7 hover:border-slate-200 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
                  {(() => { const Icon = p.icon; return <Icon className="w-5 h-5 text-slate-600" />; })()}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{p.title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm">{p.body}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Current Status — Prominent full-width warning
// ---------------------------------------------------------------------------
export function StatusSection() {
  return (
    <section id="status" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <SectionHeader
          eyebrow="Transparency"
          title="Current Status and Limitations"
        />

        <ScrollReveal spring>
          <div className="relative overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 to-orange-50/60 p-8 md:p-10 shadow-lg">
            {/* Decorative corner accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />

            <div className="relative">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-800 text-sm font-semibold mb-6">
                <AlertTriangle className="w-4 h-4" />
                Early-Stage Prototype
              </div>

              <p className="text-foreground leading-relaxed mb-6 text-lg">
                This is an early-stage open-source project. It is not a commercial product, and it does not claim production deployment, measured learning impact, or school-wide usage.
              </p>

              <ul className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                  No account system or user authentication
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                  No cloud sync — all data is local to the browser
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                  No multiplayer or social features
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                  Limited content libraries — AI generation is optional
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                  The codebase is actively evolving; APIs and data formats may change
                </li>
              </ul>

              <p className="mt-6 text-muted-foreground italic">
                We welcome contributions that improve learning value, reliability, or safety.
              </p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Who This Is For
// ---------------------------------------------------------------------------
export function AudienceSection() {
  const audiences = [
    { icon: GraduationCap, title: 'Self-Learners', body: 'Practice vocabulary at your own pace with adaptive difficulty and clear progress markers.' },
    { icon: Presentation, title: 'Teachers', body: 'Generate practice missions from study text and observe student progress locally.' },
    { icon: HeartHandshake, title: 'Parents / Guardians', body: 'Review learning evidence, weak skills, and recommended actions from a single dashboard.' },
    { icon: Code2, title: 'EdTech Developers', body: 'Reusable learning-game patterns: battle loops, SRS integration, mastery engines.' },
    { icon: Microscope, title: 'AI+Education Researchers', body: 'A concrete, inspectable system for studying AI-assisted content generation in learning contexts.' },
  ];

  return (
    <section id="audience" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="Audience"
          title="Who This Is For"
        />

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {audiences.map((a) => (
            <StaggerItem key={a.title}>
              <div className="h-full bg-white border border-slate-100 rounded-2xl p-6 md:p-7 hover:border-slate-200 transition-all duration-300">
                <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
                  {(() => { const Icon = a.icon; return <Icon className="w-5 h-5 text-slate-600" />; })()}
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{a.title}</h3>
                <p className="text-slate-500 leading-relaxed text-sm">{a.body}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// What Makes It Different — Magazine-style with large numbers
// ---------------------------------------------------------------------------
export function DifferentiatorsSection() {
  const items = [
    { title: 'Teacher-Built', body: 'Designed by a practicing teacher, not a product team. Every feature starts from a classroom need.' },
    { title: 'Learning Evidence First', body: 'Every interaction is logged as inspectable data, not just points. Teachers can see what actually happened.' },
    { title: 'Local-First Architecture', body: 'Works offline. No signup. No data leaving the device. Privacy by default.' },
    { title: 'Transparent AI', body: 'Prompts, sanitizers, and fallback chains are all visible in the source. No black-box generation.' },
    { title: 'FSRS-Powered Scheduling', body: 'Uses the same spaced-repetition algorithm as advanced flashcard apps — not a simple counter.' },
    { title: 'Open Source', body: 'MIT licensed. Inspect, fork, and adapt for your own learning context.' },
  ];

  return (
    <section id="differentiators" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-slate-950 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-0 w-[500px] h-[500px] rounded-full bg-indigo-500/[0.03] blur-[150px] -translate-y-1/2 pointer-events-none" />

      <div className="max-w-6xl mx-auto relative">
        <SectionHeader
          eyebrow="Differentiators"
          title="What Makes It Different"
          dark
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
          {items.map((item, i) => (
            <ScrollReveal key={item.title} delay={i * 0.08} direction="up">
              <div className="group">
                <div className="text-5xl md:text-6xl font-black text-white/[0.06] leading-none mb-2 group-hover:text-white/[0.1] transition-colors duration-300">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-slate-400 leading-relaxed text-sm">{item.body}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Feedback Wanted
// ---------------------------------------------------------------------------
export function FeedbackSection() {
  const categories = [
    { icon: MessageCircle, title: 'Learning Experience', question: 'Does the battle loop feel motivating or distracting? Is the difficulty curve right?' },
    { icon: LayoutDashboard, title: 'Guardian Dashboard', question: 'Are the recommendations actionable? What evidence would help you support a learner?' },
    { icon: Bot, title: 'AI Content Quality', question: 'How accurate are generated questions? What sanitization gaps should we address?' },
    { icon: Settings2, title: 'Technical Architecture', question: 'Is the local-first model viable for your context? What sync or deployment needs do you have?' },
  ];

  return (
    <section id="feedback" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="Collaborate"
          title="Feedback Wanted"
          description="This project improves with honest input. Here are four areas where your perspective would help."
        />

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
          {categories.map((c) => (
            <StaggerItem key={c.title}>
              <div className="h-full bg-card border border-border rounded-2xl p-6 md:p-7 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 group">
                <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center mb-4">
                  {(() => { const Icon = c.icon; return <Icon className="w-5 h-5 text-slate-600" />; })()}
                </div>
                <h3 className="text-lg font-semibold text-card-foreground mb-2">{c.title}</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">{c.question}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <ScrollReveal>
          <div className="text-center">
            <a
              href={FEEDBACK_URL}
              className="group inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full bg-slate-900 text-white font-medium text-sm hover:bg-slate-800 transition-all duration-300 active:scale-[0.97]"
            >
              <Mail className="w-4 h-4" />
              Share Feedback
              <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Tech Stack
// ---------------------------------------------------------------------------
export function TechStackSection() {
  const badges = [
    'Next.js 16', 'React 19', 'TypeScript 5', 'Tailwind CSS v4',
    'Zustand', 'Dexie / IndexedDB', 'ts-fsrs', 'Framer Motion',
    'Lucide React', 'OpenRouter',
  ];

  return (
    <section id="tech-stack" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow="Technology"
          title="Built With"
        />

        <ScrollReveal delay={0.1}>
          <div className="flex flex-wrap justify-center gap-3">
            {badges.map((b) => (
              <span
                key={b}
                className="px-4 py-2 rounded-full bg-white border border-slate-100 text-slate-600 text-sm font-medium hover:border-slate-200 hover:bg-slate-50 transition-all duration-300 cursor-default"
              >
                {b}
              </span>
            ))}
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.2}>
          <div className="mt-10 text-center max-w-2xl mx-auto">
            <p className="text-muted-foreground leading-relaxed">
              Frontend-only, local-first architecture. All learning state persists in the browser.
              Optional AI generation via OpenRouter with a locally-entered API key.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Maintainer Note — Dark section with prominent quote
// ---------------------------------------------------------------------------
export function MaintainerSection() {
  return (
    <section id="maintainer" className="py-20 md:py-32 px-4 sm:px-6 lg:px-8 bg-slate-950 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/2 left-1/2 w-[800px] h-[400px] rounded-full bg-indigo-500/[0.03] blur-[150px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />

      <div className="max-w-3xl mx-auto text-center relative">
        <ScrollReveal>
          <Eyebrow className="mb-6" dark>Behind the Project</Eyebrow>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <blockquote className="relative">
            {/* Large decorative quote mark */}
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-8xl text-white/[0.04] font-serif leading-none select-none">
              &quot;
            </span>

            <div className="space-y-5 text-lg md:text-xl text-slate-300 leading-relaxed italic">
              <p>
                This project is maintained as an open AI+education learning-tooling experiment by a primary-school English teacher and independent developer.
              </p>
              <p>
                It started from a simple question: can we make vocabulary practice something students actually want to do, while giving teachers and parents real evidence of learning?
              </p>
              <p className="text-white font-medium not-italic">
                The answer is still unfolding — and your input shapes where it goes next.
              </p>
            </div>
          </blockquote>
        </ScrollReveal>

        <ScrollReveal delay={0.3}>
          <div className="mt-10 flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center text-white font-bold text-sm">
              R
            </div>
            <div className="text-left">
              <p className="text-white font-semibold">Runes</p>
              <p className="text-slate-500 text-sm">Maintainer</p>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------
export function FooterSection() {
  const links = [
    { label: 'GitHub', href: GITHUB_URL, icon: Github },
    { label: 'Issues', href: `${GITHUB_URL}/issues`, icon: AlertTriangle },
    { label: 'Contributing', href: `${GITHUB_URL}/blob/main/CONTRIBUTING.md`, icon: FileText },
    { label: 'Security', href: `${GITHUB_URL}/blob/main/SECURITY.md`, icon: Shield },
    { label: 'Roadmap', href: `${GITHUB_URL}/blob/main/ROADMAP.md`, icon: ExternalLink },
  ];

  return (
    <footer className="py-14 px-4 sm:px-6 lg:px-8 border-t border-border bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-10">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-slate-400 hover:text-slate-700 transition-colors group"
            >
              <link.icon className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
              <span className="text-sm font-medium">{link.label}</span>
            </a>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} Word Quest: Infinite Tome. Released under the MIT License.
          </p>
          <p className="text-sm text-muted-foreground">
            Have thoughts?{' '}
            <a href={FEEDBACK_URL} className="text-slate-600 hover:text-slate-900 hover:underline transition-colors">
              Open an issue or share feedback
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
