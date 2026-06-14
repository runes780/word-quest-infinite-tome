'use client';

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
import { useLandingCopy } from './landingI18n';

const GITHUB_URL = 'https://github.com/runes780/word-quest-infinite-tome';
const FEEDBACK_URL = process.env.NEXT_PUBLIC_WORDQUEST_FEEDBACK_URL ?? '#feedback';

// ---------------------------------------------------------------------------
// Hero — Product-first, compact, no decorative noise
// ---------------------------------------------------------------------------
export function HeroSection() {
  const { copy } = useLandingCopy();
  const t = copy.hero;

  return (
    <section id="hero" className="relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12 pt-24 pb-8 md:pt-28 md:pb-10 w-full">
        <div className="text-center max-w-3xl mx-auto">
          {/* Eyebrow */}
          <ScrollReveal delay={0.1}>
            <span className="inline-block text-[10px] font-medium uppercase tracking-[0.4em] text-slate-400 mb-6 font-mono-label">
              {t.eyebrow}
            </span>
          </ScrollReveal>

          {/* Main title */}
          <ScrollReveal delay={0.2}>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-slate-900 leading-[1.05] mb-5">
              {t.title}
            </h1>
          </ScrollReveal>

          {/* Description */}
          <ScrollReveal delay={0.3}>
            <p className="text-base md:text-lg text-slate-500 leading-relaxed mb-8 max-w-xl mx-auto">
              {t.descriptionStart} — <span className="text-slate-800 font-medium">{t.descriptionEmphasis}</span>.
            </p>
          </ScrollReveal>

          {/* Buttons */}
          <ScrollReveal delay={0.4}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/demo"
                className="group inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-slate-900 text-white font-medium text-sm hover:bg-slate-800 transition-all duration-300 active:scale-[0.97]"
              >
                <Play className="w-4 h-4" />
                {t.tryDemo}
                <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full border border-slate-200 text-slate-700 font-medium text-sm hover:border-slate-300 hover:bg-slate-50 transition-all duration-300 active:scale-[0.97]"
              >
                <Github className="w-4 h-4" />
                {t.github}
              </a>
            </div>
          </ScrollReveal>
        </div>

        {/* Hero image — product-first, visible immediately */}
        <ScrollReveal delay={0.5} className="mt-10 md:mt-12">
          <div className="relative max-w-5xl mx-auto">
            <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-[0_2px_40px_-12px_rgba(0,0,0,0.08)]">
              <div className="relative w-full aspect-[16/9]">
                <Image
                  src="/wordquest/hero.png"
                  alt={t.imageAlt}
                  fill
                  className="object-cover"
                  priority
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 1152px"
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
// Problem — Flat, editorial, no gradient noise
// ---------------------------------------------------------------------------
export function ProblemSection() {
  const { copy } = useLandingCopy();
  const t = copy.problem;
  const problemMeta = [
    {
      icon: BookOpen,
      iconColor: 'text-amber-600',
    },
    {
      icon: EyeOff,
      iconColor: 'text-slate-500',
    },
    {
      icon: TrendingDown,
      iconColor: 'text-rose-500',
    },
  ];
  const problems = t.items.map((item, index) => ({
    ...item,
    ...problemMeta[index],
  }));

  return (
    <section id="problem" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow={t.eyebrow}
          title={t.title}
          description={t.description}
        />

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {problems.map((p) => (
            <StaggerItem key={p.title}>
              <div className="h-full">
                <div className="flex items-center gap-3 mb-4">
                  {(() => { const Icon = p.icon; return <Icon className={`w-5 h-5 ${p.iconColor}`} />; })()}
                  <h3 className="text-lg font-semibold text-slate-900">{p.title}</h3>
                </div>
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
// Solution — Numbered modules, real screenshots, no gradient noise
// ---------------------------------------------------------------------------
export function SolutionSection() {
  const { copy } = useLandingCopy();
  const t = copy.solution;
  const featureMeta = [
    {
      num: '01',
      icon: Swords,
      iconColor: 'text-slate-700',
      image: '/wordquest/solution-battle.png',
    },
    {
      num: '02',
      icon: Timer,
      iconColor: 'text-slate-700',
      image: '/wordquest/solution-srs.png',
    },
    {
      num: '03',
      icon: Target,
      iconColor: 'text-slate-700',
      image: '/wordquest/solution-mastery.png',
    },
    {
      num: '04',
      icon: BarChart3,
      iconColor: 'text-slate-700',
      image: '/wordquest/solution-evidence.png',
    },
  ];
  const features = t.features.map((feature, index) => ({
    ...feature,
    ...featureMeta[index],
  }));

  return (
    <section id="solution" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-slate-50/50 overflow-x-hidden">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow={t.eyebrow}
          title={t.title}
        />

        <div className="space-y-20 md:space-y-28">
          {features.map((f, i) => (
            <ScrollReveal
              key={f.title}
              direction={i % 2 === 0 ? 'left' : 'right'}
              spring
            >
              <div className={`flex flex-col ${i % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} gap-8 lg:gap-16 items-center`}>
                {/* Text block */}
                <div className="w-full lg:w-1/2">
                  <span className="inline-block font-mono text-[11px] text-slate-400 tracking-wider mb-3">
                    {f.num}
                  </span>
                  <div className="flex items-center gap-3 mb-4">
                    {(() => { const Icon = f.icon; return <Icon className={`w-5 h-5 ${f.iconColor}`} />; })()}
                    <h3 className="text-2xl md:text-3xl font-bold text-slate-900">{f.title}</h3>
                  </div>
                  <p className="text-base md:text-lg text-slate-500 leading-relaxed">{f.body}</p>
                </div>

                {/* Feature screenshot */}
                <div className="w-full lg:w-1/2">
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 shadow-[0_2px_24px_-8px_rgba(0,0,0,0.06)] group">
                    <Image
                      src={f.image}
                      alt={f.imageAlt}
                      fill
                      className="object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out"
                      sizes="(max-width: 1024px) 100vw, 50vw"
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
// Learning Loop — Dark command-center mode, no decorative orbs
// ---------------------------------------------------------------------------
export function LearningLoopSection() {
  const { copy } = useLandingCopy();
  const t = copy.learningLoop;
  const stepColors = ['bg-slate-700', 'bg-slate-600', 'bg-slate-500', 'bg-slate-600', 'bg-slate-700'];
  const steps = t.steps.map((step, index) => ({
    num: index + 1,
    color: stepColors[index],
    ...step,
  }));

  return (
    <section id="learning-loop" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-slate-950 overflow-x-hidden">
      <div className="max-w-6xl mx-auto relative">
        <SectionHeader
          eyebrow={t.eyebrow}
          title={t.title}
          description={t.description}
          dark
        />

        <div className="flex flex-col lg:flex-row gap-10 lg:gap-16 items-center">
          <ScrollReveal className="w-full lg:w-1/2" spring>
            <div className="relative w-full aspect-square max-w-md mx-auto rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
              <Image
                src="/wordquest/learning-loop-engine.png"
                alt={t.imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </ScrollReveal>

          <div className="w-full lg:w-1/2 space-y-5">
            {steps.map((s, i) => (
              <ScrollReveal key={s.num} delay={i * 0.1} direction="right">
                <div className="flex gap-4 items-start">
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full ${s.color} text-white flex items-center justify-center text-xs font-bold`}>
                    {s.num}
                  </div>
                  <div className="flex-1 pb-5 border-b border-slate-800/50">
                    <h4 className="font-semibold text-white mb-1 text-sm">{s.title}</h4>
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
// Product Preview — Light product showcase with real screenshots
// ---------------------------------------------------------------------------
export function ProductPreviewSection() {
  const { copy } = useLandingCopy();
  const t = copy.preview;
  const previewImages = [
    {
      src: '/wordquest/app-current-overview.png',
    },
    {
      src: '/wordquest/app-current-battle-focus.png',
    },
    {
      src: '/wordquest/app-current-dashboard.png',
    },
  ];
  const previews = t.items.map((item, index) => ({
    ...item,
    ...previewImages[index],
  }));

  return (
    <section id="preview" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-white border-y border-slate-200/70">
      <div className="max-w-6xl mx-auto relative">
        <SectionHeader
          eyebrow={t.eyebrow}
          title={t.title}
        />

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {previews.map((p) => (
            <StaggerItem key={p.src}>
              <div className="group">
                <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-white shadow-[0_24px_70px_-42px_rgba(15,23,42,0.35)] transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_28px_80px_-40px_rgba(15,23,42,0.45)]">
                  {/* Window title bar */}
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50">
                    <div className="w-3 h-3 rounded-full bg-rose-400/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
                  </div>
                  {/* Screenshot */}
                  <div className="relative w-full aspect-video overflow-hidden">
                    <Image
                      src={p.src}
                      alt={p.alt}
                      fill
                      className="object-cover group-hover:scale-[1.02] transition-transform duration-700 ease-out"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>
                </div>
                <p className="mt-4 text-sm text-slate-600 text-center leading-relaxed">{p.caption}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Guardian Evidence — Flat, trust-first, no cards inside cards
// ---------------------------------------------------------------------------
export function GuardianEvidenceSection() {
  const { copy } = useLandingCopy();
  const t = copy.evidence;

  return (
    <section id="evidence" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-slate-50/50 overflow-x-hidden">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow={t.eyebrow}
          title={t.title}
        />

        <div className="flex flex-col lg:flex-row-reverse gap-10 lg:gap-16 items-center">
          <ScrollReveal className="w-full lg:w-1/2" spring>
            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-200 shadow-[0_2px_24px_-8px_rgba(0,0,0,0.06)]">
              <Image
                src="/wordquest/dashboard-preview.png"
                alt={t.imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </ScrollReveal>

          <div className="w-full lg:w-1/2">
            <ul className="space-y-4 list-none pl-0">
              {t.features.map((f, i) => (
                <ScrollReveal key={i} delay={i * 0.08} direction="left">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                    <span className="text-slate-600 leading-relaxed text-sm">{f}</span>
                  </li>
                </ScrollReveal>
              ))}
            </ul>

            <ScrollReveal delay={0.4}>
              <p className="mt-8 text-sm text-slate-500 leading-relaxed flex items-start gap-2">
                <Shield className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                {t.privacy}
              </p>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Responsible AI and Privacy — Flat grid, editorial restraint
// ---------------------------------------------------------------------------
export function ResponsibleAISection() {
  const { copy } = useLandingCopy();
  const t = copy.responsibleAI;
  const principleMeta = [
    { icon: Shield },
    { icon: Cpu },
    { icon: Lock },
    { icon: CheckCircle },
    { icon: UserX },
    { icon: Eye },
  ];
  const principles = t.principles.map((principle, index) => ({
    ...principle,
    ...principleMeta[index],
  }));

  return (
    <section id="responsible-ai" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow={t.eyebrow}
          title={t.title}
        />

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
          {principles.map((p) => (
            <StaggerItem key={p.title}>
              <div className="h-full">
                <div className="flex items-center gap-3 mb-3">
                  {(() => { const Icon = p.icon; return <Icon className="w-4 h-4 text-slate-500" />; })()}
                  <h3 className="text-base font-semibold text-slate-900">{p.title}</h3>
                </div>
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
// Current Status — Flat warning panel, no decorative corner accent
// ---------------------------------------------------------------------------
export function StatusSection() {
  const { copy } = useLandingCopy();
  const t = copy.status;

  return (
    <section id="status" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <SectionHeader
          eyebrow={t.eyebrow}
          title={t.title}
        />

        <ScrollReveal spring>
          <div className="rounded-xl border border-amber-200/60 bg-amber-50/60 p-8 md:p-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 text-amber-800 text-sm font-semibold mb-6">
              <AlertTriangle className="w-4 h-4" />
              {t.badge}
            </div>

            <p className="text-slate-800 leading-relaxed mb-6 text-lg">
              {t.intro}
            </p>

            <ul className="space-y-3 text-slate-600 list-none pl-0">
              {t.limitations.map((limitation) => (
                <li key={limitation} className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0" />
                  {limitation}
                </li>
              ))}
            </ul>

            <p className="mt-6 text-slate-500 italic text-sm">
              {t.note}
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Who This Is For — Flat grid
// ---------------------------------------------------------------------------
export function AudienceSection() {
  const { copy } = useLandingCopy();
  const t = copy.audience;
  const audienceMeta = [
    { icon: GraduationCap },
    { icon: Presentation },
    { icon: HeartHandshake },
    { icon: Code2 },
    { icon: Microscope },
  ];
  const audiences = t.items.map((audience, index) => ({
    ...audience,
    ...audienceMeta[index],
  }));

  return (
    <section id="audience" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-slate-50/50">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow={t.eyebrow}
          title={t.title}
        />

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
          {audiences.map((a) => (
            <StaggerItem key={a.title}>
              <div className="h-full">
                <div className="flex items-center gap-3 mb-3">
                  {(() => { const Icon = a.icon; return <Icon className="w-4 h-4 text-slate-500" />; })()}
                  <h3 className="text-base font-semibold text-slate-900">{a.title}</h3>
                </div>
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
// What Makes It Different — Dark mode, large numbers, no decorative orbs
// ---------------------------------------------------------------------------
export function DifferentiatorsSection() {
  const { copy } = useLandingCopy();
  const t = copy.differentiators;

  return (
    <section id="differentiators" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-slate-950">
      <div className="max-w-6xl mx-auto relative">
        <SectionHeader
          eyebrow={t.eyebrow}
          title={t.title}
          dark
        />

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-10">
          {t.items.map((item, i) => (
            <ScrollReveal key={item.title} delay={i * 0.08} direction="up">
              <div>
                <div className="text-4xl md:text-5xl font-black text-white/[0.06] leading-none mb-2">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
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
// Feedback Wanted — Flat grid
// ---------------------------------------------------------------------------
export function FeedbackSection() {
  const { copy } = useLandingCopy();
  const t = copy.feedback;
  const categoryMeta = [
    { icon: MessageCircle },
    { icon: LayoutDashboard },
    { icon: Bot },
    { icon: Settings2 },
  ];
  const categories = t.categories.map((category, index) => ({
    ...category,
    ...categoryMeta[index],
  }));

  return (
    <section id="feedback" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-slate-50/50">
      <div className="max-w-6xl mx-auto">
        <SectionHeader
          eyebrow={t.eyebrow}
          title={t.title}
          description={t.description}
        />

        <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10 mb-10">
          {categories.map((c) => (
            <StaggerItem key={c.title}>
              <div className="h-full">
                <div className="flex items-center gap-3 mb-3">
                  {(() => { const Icon = c.icon; return <Icon className="w-4 h-4 text-slate-500" />; })()}
                  <h3 className="text-base font-semibold text-slate-900">{c.title}</h3>
                </div>
                <p className="text-slate-500 leading-relaxed text-sm">{c.question}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        <ScrollReveal>
          <div className="text-center">
            <a
              href={FEEDBACK_URL}
              className="group inline-flex items-center gap-2.5 px-6 py-3 rounded-full bg-slate-900 text-white font-medium text-sm hover:bg-slate-800 transition-all duration-300 active:scale-[0.97]"
            >
              <Mail className="w-4 h-4" />
              {t.cta}
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
// ---------------------------------------------------------------------------
// Tech Stack — Cinematic dark band with infinite marquee
// ---------------------------------------------------------------------------
const TECH_ROW_1 = [
  'Next.js 16',
  'React 19',
  'TypeScript 5',
  'Tailwind CSS v4',
  'Zustand',
  'Dexie / IndexedDB',
  'ts-fsrs',
  'Framer Motion',
  'Lucide React',
  'OpenRouter',
];

const TECH_ROW_2 = [...TECH_ROW_1].reverse();

function MarqueeRow({
  items,
  direction,
  speed,
  dimmed = false,
}: {
  items: string[];
  direction: 'left' | 'right';
  speed: number;
  dimmed?: boolean;
}) {
  // 5× copy ensures seamless loop even on ultrawide screens
  const quint = [...items, ...items, ...items, ...items, ...items];
  const anim = direction === 'left' ? 'animate-marquee-left' : 'animate-marquee-right';

  return (
    <div
      className={`${anim} marquee-spotlight flex whitespace-nowrap items-center`}
      style={{ animationDuration: `${speed}s` }}
    >
      {quint.map((item, i) => (
        <span
          key={`${item}-${i}`}
          className={`marquee-item inline-flex items-center cursor-default transition-opacity duration-300 px-5 md:px-8 ${
            dimmed ? 'text-slate-600' : 'text-slate-300'
          }`}
        >
          <span className="font-mono text-base md:text-lg tracking-wide">
            {item}
          </span>
          <span className="text-slate-800 ml-5 md:ml-8 select-none text-sm">/</span>
        </span>
      ))}
    </div>
  );
}

export function TechStackSection() {
  const { copy } = useLandingCopy();
  const t = copy.techStack;

  return (
    <section
      id="tech-stack"
      className="relative py-20 md:py-28 bg-slate-950 overflow-hidden group"
    >
      {/* Section header */}
      <div className="relative text-center mb-10 md:mb-14">
        <ScrollReveal>
          <Eyebrow dark>{t.eyebrow}</Eyebrow>
        </ScrollReveal>
        <ScrollReveal delay={0.1}>
          <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold text-white tracking-tight">
            {t.title}
          </h2>
        </ScrollReveal>
      </div>

      {/* Marquee band with top/bottom hairlines */}
      <div className="relative py-5 md:py-6 space-y-4 md:space-y-5">
        {/* Top hairline */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />

        <MarqueeRow items={TECH_ROW_1} direction="left" speed={50} />
        <MarqueeRow items={TECH_ROW_2} direction="right" speed={42} dimmed />

        {/* Bottom hairline */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-800 to-transparent" />
      </div>

      {/* Architecture note */}
      <ScrollReveal delay={0.2}>
        <div className="relative mt-12 md:mt-16 text-center max-w-lg mx-auto px-6">
          <p className="text-slate-500 text-sm leading-relaxed">
            {t.note}
          </p>
        </div>
      </ScrollReveal>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Maintainer Note — Dark section, no decorative orbs
// ---------------------------------------------------------------------------
export function MaintainerSection() {
  const { copy } = useLandingCopy();
  const t = copy.maintainer;

  return (
    <section id="maintainer" className="py-20 md:py-28 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-3xl mx-auto text-center relative">
        <ScrollReveal>
          <Eyebrow className="mb-6">{t.eyebrow}</Eyebrow>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <blockquote className="relative">
            {/* Large decorative quote mark */}
            <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-8xl text-slate-900/[0.04] font-serif leading-none select-none">
              &quot;
            </span>

            <div className="space-y-5 text-lg md:text-xl text-slate-600 leading-relaxed italic">
              {t.paragraphs.slice(0, 2).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <p className="text-slate-900 font-medium not-italic">
                {t.paragraphs[2]}
              </p>
            </div>
          </blockquote>
        </ScrollReveal>

        <ScrollReveal delay={0.3}>
          <div className="mt-10 flex items-center justify-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-900 font-bold text-sm">
              R
            </div>
            <div className="text-left">
              <p className="text-slate-900 font-semibold">{t.name}</p>
              <p className="text-slate-500 text-sm">{t.role}</p>
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
  const { copy } = useLandingCopy();
  const t = copy.footer;
  const links = [
    { label: t.links.github, href: GITHUB_URL, icon: Github },
    { label: t.links.issues, href: `${GITHUB_URL}/issues`, icon: AlertTriangle },
    { label: t.links.contributing, href: `${GITHUB_URL}/blob/main/CONTRIBUTING.md`, icon: FileText },
    { label: t.links.security, href: `${GITHUB_URL}/blob/main/SECURITY.md`, icon: Shield },
    { label: t.links.roadmap, href: `${GITHUB_URL}/blob/main/ROADMAP.md`, icon: ExternalLink },
  ];

  return (
    <footer className="py-14 px-4 sm:px-6 lg:px-8 border-t border-slate-100 bg-background">
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

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-100">
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} {t.copyright}
          </p>
          <p className="text-sm text-slate-400">
            {t.thoughts}{' '}
            <a href={FEEDBACK_URL} className="text-slate-600 hover:text-slate-900 hover:underline transition-colors">
              {t.feedbackLink}
            </a>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
