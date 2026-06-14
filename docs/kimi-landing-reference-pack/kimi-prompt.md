# Prompt For Kimi Code

You are redesigning the Word Quest: Infinite Tome landing page.

Context:

- Local project path: `/Users/xuqining/Documents/code/Claude-Code/Word Quest: Infinite Tome`
- Current landing page: `http://localhost:3000/project#hero`
- Main files:
  - `src/app/project/page.tsx`
  - `src/app/project/sections.tsx`
  - `src/app/project/components.tsx`
  - `src/app/globals.css`
- Reference pack: `docs/kimi-landing-reference-pack/`

Read `docs/kimi-landing-reference-pack/README.md` first. Use the linked references and screenshots as design inspiration only. Do not copy any brand, logo, text, image, mascot, exact layout, or proprietary UI from the references.

Design target:

> A premium AI learning-game system: part interactive product, part RPG learning journey, part local-first open-source research artifact.

Primary references:

1. Linear: premium product-system storytelling, dense product screenshots, numbered modules.
2. Cursor: AI-native workflow narrative, interactive product demo framing.
3. Raycast: dark command-center mood, restrained accent, compact feature cards.
4. Framer: tasteful motion and scroll rhythm.
5. Apple iPad Pro: product-first hero and cinematic reveal.
6. Anthropic: responsible AI trust, editorial restraint.
7. Codédex: learning as adventure without childishness.

What needs improvement from the current page:

- The hero has too much empty vertical space.
- The actual product/game screenshot appears too late.
- Some screenshot references are broken or missing.
- Some `next/image fill` usages lack `sizes`.
- The page feels polished but not yet specific enough to Word Quest's product identity.

Redesign requirements:

- Keep the existing content strategy: problem, solution, learning loop, preview, guardian evidence, responsible AI, status, audience, differentiators, feedback, tech stack, maintainer, footer.
- Make the first viewport show the product/game surface clearly.
- Build a stronger visual metaphor around "mission console + infinite tome + learning battle system".
- Use real Word Quest screenshots from `public/wordquest/` only.
- Fix missing image references. Available images include:
  - `/wordquest/hero.png`
  - `/wordquest/app-battle-preview.png`
  - `/wordquest/dashboard-preview.png`
  - `/wordquest/guardian-dashboard-screenshot.png`
  - `/wordquest/learning-loop.png`
  - `/wordquest/mission-report-screenshot.png`
- Add accurate `sizes` to every `next/image` with `fill`.
- Use lucide icons where useful.
- Keep accessibility: semantic sections, contrast, keyboard focus, `prefers-reduced-motion`.
- Avoid cards inside cards and avoid decorative gradient orbs/blobs.
- Avoid generic purple SaaS gradients.
- Use responsive constraints so text and screenshots do not overlap.

Implementation guardrails:

- Stay scoped to landing page files unless a small CSS utility is necessary.
- Do not modify game logic, database logic, stores, tests, package files, or unrelated app pages.
- Preserve current route `/project`.
- Preserve external GitHub and feedback link behavior.
- After changes, run:
  - `npm run lint`
  - a local browser check at `/project`
  - desktop viewport around 1440x900
  - mobile viewport around 390x844

Suggested page language:

- Premium, precise, teacher-built.
- Avoid childish phrasing.
- Avoid overpromising learning impact.
- Keep the early-stage prototype transparency.

Success criteria:

- A first-time visitor understands this is an AI-assisted vocabulary learning game within 5 seconds.
- The first screen already shows or strongly previews the real product.
- The page looks premium enough to sit near Linear/Cursor/Raycast references, while still feeling like Word Quest.
- The design is not just "beautiful"; it explains the learning loop and trust model clearly.
