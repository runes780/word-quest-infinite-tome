'use client';

import { useEffect, useState } from 'react';
import { motion, type Transition } from 'framer-motion';
import { Menu, X } from 'lucide-react';

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
          className={`font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight ${
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
const NAV_LINKS = [
  { label: 'Home', href: '#hero' },
  { label: 'Problem', href: '#problem' },
  { label: 'Solution', href: '#solution' },
  { label: 'Loop', href: '#learning-loop' },
  { label: 'Preview', href: '#preview' },
  { label: 'Evidence', href: '#evidence' },
  { label: 'AI & Privacy', href: '#responsible-ai' },
  { label: 'Status', href: '#status' },
  { label: 'Feedback', href: '#feedback' },
];

export function StickyNav() {
  const [active, setActive] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.href.replace('#', ''));
    const observers: IntersectionObserver[] = [];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActive(id);
          }
        },
        { rootMargin: '-40% 0px -55% 0px', threshold: 0 }
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
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

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-background/80 backdrop-blur-xl border-b border-slate-100'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <a
            href="#hero"
            onClick={(e) => handleClick(e, '#hero')}
            className="font-display text-base font-semibold text-slate-900 tracking-tight"
          >
            Word Quest
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5">
            {NAV_LINKS.map((link) => {
              const id = link.href.replace('#', '');
              const isActive = active === id;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleClick(e, link.href)}
                  className={`px-3 py-1.5 rounded-full text-[13px] font-medium transition-all duration-300 ${
                    isActive
                      ? 'text-slate-900'
                      : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen((p) => !p)}
            className="md:hidden p-2 rounded-lg hover:bg-slate-50 transition-colors"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-100 bg-background/95 backdrop-blur-xl">
          <div className="px-4 py-3 space-y-0.5">
            {NAV_LINKS.map((link) => {
              const id = link.href.replace('#', '');
              const isActive = active === id;
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleClick(e, link.href)}
                  className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-slate-900 bg-slate-50'
                      : 'text-slate-400 hover:text-slate-700'
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
