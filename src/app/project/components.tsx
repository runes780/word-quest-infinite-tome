'use client';

import { useEffect, useState } from 'react';
import { motion, type Transition } from 'framer-motion';
import { Languages, Menu, X } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import { useLandingCopy } from './landingI18n';

// ---------------------------------------------------------------------------
// ThemeScript — reads the main app's theme preference from localStorage
// ---------------------------------------------------------------------------
export function ThemeScript() {
  useEffect(() => {
    try {
      const raw = localStorage.getItem('word-quest-settings');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.state?.theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else if (parsed?.state?.theme === 'light') {
        document.documentElement.classList.remove('dark');
      }
    } catch {
      // ignore parse errors
    }
  }, []);
  return null;
}

// ---------------------------------------------------------------------------
// Spring presets
// ---------------------------------------------------------------------------
export const springSoft: Transition = {
  type: 'spring',
  stiffness: 80,
  damping: 20,
  mass: 1.2,
};

// ---------------------------------------------------------------------------
// Eyebrow — refined editorial label
// ---------------------------------------------------------------------------
interface EyebrowProps {
  children: React.ReactNode;
  className?: string;
  dark?: boolean;
}

export function Eyebrow({ children, className = '', dark = false }: EyebrowProps) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className={`inline-block text-[10px] md:text-[11px] font-medium uppercase tracking-[0.3em] mb-6 font-mono-label ${
        dark ? 'text-slate-500' : 'text-slate-400'
      } ${className}`}
    >
      {children}
    </motion.span>
  );
}

// ---------------------------------------------------------------------------
// ScrollReveal — wraps children in a motion.div that fades in on scroll
// ---------------------------------------------------------------------------
interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  spring?: boolean;
}

export function ScrollReveal({
  children,
  className,
  delay = 0,
  direction = 'up',
  distance = 24,
  spring = false,
}: ScrollRevealProps) {
  const directionMap = {
    up: { y: distance, x: 0 },
    down: { y: -distance, x: 0 },
    left: { x: distance, y: 0 },
    right: { x: -distance, y: 0 },
  };

  const offset = directionMap[direction];

  return (
    <motion.div
      initial={{ opacity: 0, ...offset }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={
        spring
          ? { ...springSoft, delay }
          : { duration: 0.6, delay, ease: 'easeOut' }
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// SplitText — animates words in a headline with staggered entrance
// ---------------------------------------------------------------------------
interface SplitTextProps {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
  as?: 'h1' | 'h2' | 'h3' | 'span';
}

export function SplitText({
  text,
  className = '',
  delay = 0,
  stagger = 0.06,
  as: Tag = 'h1',
}: SplitTextProps) {
  const words = text.split(' ');

  return (
    <Tag className={`font-display ${className}`}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{
            ...springSoft,
            delay: delay + i * stagger,
          }}
          className="inline-block mr-[0.18em]"
        >
          {word}
        </motion.span>
      ))}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// StaggerContainer — staggers children entrance animations
// ---------------------------------------------------------------------------
interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}

export function StaggerContainer({ children, className, staggerDelay = 0.08 }: StaggerContainerProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: '-60px' }}
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: staggerDelay,
          },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { ...springSoft },
        },
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader — unified editorial header
// ---------------------------------------------------------------------------
interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: 'left' | 'center';
  dark?: boolean;
  className?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'center',
  dark = false,
  className = '',
}: SectionHeaderProps) {
  const alignClass = align === 'center' ? 'text-center' : 'text-left';
  const descColor = dark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className={`${alignClass} mb-14 md:mb-20 ${className}`}>
      {eyebrow && <Eyebrow dark={dark}>{eyebrow}</Eyebrow>}
      <ScrollReveal delay={eyebrow ? 0.1 : 0}>
        <h2
          className={`font-display text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight ${
            dark ? 'text-white' : 'text-slate-900'
          } mb-5 leading-[1.1]`}
        >
          {title}
        </h2>
      </ScrollReveal>
      {description && (
        <ScrollReveal delay={eyebrow ? 0.2 : 0.1}>
          <p className={`text-base md:text-lg ${descColor} max-w-2xl mx-auto leading-relaxed font-light`}>
            {description}
          </p>
        </ScrollReveal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StickyNav — refined, minimal
// ---------------------------------------------------------------------------
const NAV_ITEMS = [
  { key: 'home', href: '#hero' },
  { key: 'problem', href: '#problem' },
  { key: 'solution', href: '#solution' },
  { key: 'loop', href: '#learning-loop' },
  { key: 'preview', href: '#preview' },
  { key: 'evidence', href: '#evidence' },
  { key: 'responsibleAI', href: '#responsible-ai' },
  { key: 'status', href: '#status' },
  { key: 'feedback', href: '#feedback' },
] as const;

const DARK_SECTION_IDS = ['learning-loop', 'differentiators', 'tech-stack'];

export function StickyNav() {
  const { language, copy } = useLandingCopy();
  const setLanguage = useSettingsStore((state) => state.setLanguage);
  const [active, setActive] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [overDark, setOverDark] = useState(false);
  const navLinks = NAV_ITEMS.map((item) => ({
    ...item,
    label: copy.nav[item.key],
  }));

  /* Single scroll handler: active + scrolled + dark overlap */
  useEffect(() => {
    const ids = NAV_ITEMS.map((l) => l.href.replace('#', ''));
    const NAV_HEIGHT = 56;

    const onScroll = () => {
      setScrolled(window.scrollY > 20);

      /* Active: section whose bounds cover viewport center, fallback closest */
      const center = window.innerHeight / 2;
      let coveringId = '';
      let closestId = '';
      let closestDist = Infinity;

      ids.forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top <= center && rect.bottom >= center) {
          coveringId = id;
        }
        const elCenter = rect.top + rect.height / 2;
        const dist = Math.abs(elCenter - center);
        if (dist < closestDist) {
          closestDist = dist;
          closestId = id;
        }
      });
      setActive(coveringId || closestId);

      /* Dark mode: does a dark section overlap the nav bar? */
      let isDark = false;
      for (const darkId of DARK_SECTION_IDS) {
        const el = document.getElementById(darkId);
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (rect.top < NAV_HEIGHT && rect.bottom > 0) {
          isDark = true;
          break;
        }
      }
      setOverDark(isDark);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
      setMobileOpen(false);
    }
  };

  const navBg = overDark
    ? 'bg-slate-950/80 backdrop-blur-xl border-b border-slate-800'
    : scrolled
      ? 'bg-background/80 backdrop-blur-xl border-b border-slate-100'
      : 'bg-transparent';

  const brandColor = overDark ? 'text-white' : 'text-slate-900';
  const linkIdle = overDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700';
  const linkActive = overDark ? 'text-white' : 'text-slate-900';
  const mobileMenuBg = overDark ? 'bg-slate-950/95 border-slate-800' : 'bg-background/95 border-slate-100';
  const mobileLinkActive = overDark ? 'text-white bg-slate-800' : 'text-slate-900 bg-slate-50';
  const mobileLinkIdle = overDark ? 'text-slate-400 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700';
  const menuBtnHover = overDark ? 'hover:bg-slate-800' : 'hover:bg-slate-50';
  const languageToggleBorder = overDark ? 'border-slate-800 bg-slate-900/70' : 'border-slate-200 bg-white/70';
  const languageToggleIdle = overDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-700';
  const languageToggleActive = overDark ? 'bg-white text-slate-950' : 'bg-slate-900 text-white';

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${navBg}`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <a
            href="#hero"
            onClick={(e) => handleClick(e, '#hero')}
            className={`font-display text-base font-semibold tracking-tight transition-colors duration-500 ${brandColor}`}
          >
            Word Quest
          </a>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => {
              const id = link.href.replace('#', '');
              const isActive = active === id;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleClick(e, link.href)}
                  className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-all duration-300 ${
                    isActive ? linkActive : linkIdle
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className={`hidden sm:inline-flex items-center gap-1 rounded-full border p-1 transition-colors ${languageToggleBorder}`}>
              <Languages className={`ml-1.5 w-3.5 h-3.5 ${languageToggleIdle}`} />
              <button
                type="button"
                onClick={() => setLanguage('en')}
                aria-label={copy.nav.toggleToEnglish}
                className={`rounded-full px-2 py-1 text-[11px] font-semibold transition-colors ${
                  language === 'en' ? languageToggleActive : languageToggleIdle
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('zh')}
                aria-label={copy.nav.toggleToChinese}
                className={`rounded-full px-2 py-1 text-[11px] font-semibold transition-colors ${
                  language === 'zh' ? languageToggleActive : languageToggleIdle
                }`}
              >
                中文
              </button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen((p) => !p)}
              className={`lg:hidden p-2 rounded-lg transition-colors ${menuBtnHover}`}
              aria-label={copy.nav.menu}
            >
              {mobileOpen ? <X className={`w-5 h-5 ${overDark ? 'text-white' : 'text-slate-900'}`} /> : <Menu className={`w-5 h-5 ${overDark ? 'text-white' : 'text-slate-900'}`} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className={`lg:hidden border-t backdrop-blur-xl ${mobileMenuBg}`}>
          <div className="px-4 py-3 space-y-0.5">
            <div className={`mb-3 inline-flex w-full items-center justify-center gap-1 rounded-xl border p-1 ${languageToggleBorder}`}>
              <Languages className={`w-3.5 h-3.5 ${languageToggleIdle}`} />
              <button
                type="button"
                onClick={() => setLanguage('en')}
                aria-label={copy.nav.toggleToEnglish}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  language === 'en' ? languageToggleActive : languageToggleIdle
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('zh')}
                aria-label={copy.nav.toggleToChinese}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  language === 'zh' ? languageToggleActive : languageToggleIdle
                }`}
              >
                中文
              </button>
            </div>

            {navLinks.map((link) => {
              const id = link.href.replace('#', '');
              const isActive = active === id;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleClick(e, link.href)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? mobileLinkActive : mobileLinkIdle
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </div>
        </div>
      )}
    </nav>
  );
}
