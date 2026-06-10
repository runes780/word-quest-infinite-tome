# Kimi Landing Reference Pack

This pack is for redesigning the Word Quest: Infinite Tome landing page. Use it as visual direction, not as assets to copy.

## Format Choice

Use this order:

1. Short videos for motion and scroll rhythm.
2. Screenshots for layout, spacing, typography, and section structure.
3. Live URLs for extra inspection.

For Kimi Code, the most useful input is usually:

- This folder.
- The current Word Quest landing page URL: `http://localhost:3000/project#hero`
- 5-8 screenshots from `screenshots/`.
- 2-4 short screen recordings, each under 60 seconds.
- The prompt in `kimi-prompt.md`.

Do not ask Kimi to clone any reference. Ask it to synthesize the layout language for Word Quest.

## Included Files

- `kimi-prompt.md`: Copy this into Kimi Code as the implementation brief.
- `capture-checklist.md`: Use this if you want to record extra videos.
- `reference-links.md`: Live URL list.
- `capture-reference-screenshots.mjs`: Re-runnable screenshot capture script.
- `screenshots/contact-sheet.png`: One-page visual overview.
- `screenshots/manifest.json`: Screenshot capture status.

If a screenshot contains a cookie banner, translation banner, browser prompt, or other temporary overlay, ignore that overlay. The reference is the page structure and visual language underneath.

## Final Reference Set

| Priority | Site | URL | Why It Fits Word Quest | What To Study |
|---|---|---|---|---|
| 1 | Linear | https://linear.app/ | Best match for premium product-system storytelling. It uses restrained typography, numbered sections, dark UI screenshots, and long-page rhythm. | Dense product mockups, module numbering, dark/light section pacing, precise spacing. |
| 2 | Cursor | https://cursor.com/ | Best match for AI-native product narrative. It shows AI agents, interactive demos, social proof, and technical credibility without looking generic. | AI demo framing, layered product UI, trusted-by sections, agent workflow storytelling. |
| 3 | Raycast | https://www.raycast.com/ | Best match for command-center energy. Its dark premium interface, red accent, and compact feature cards can map to Word Quest's mission/control/tome feel. | Dark hero mood, command palette metaphor, crisp icon-card rhythm, accent restraint. |
| 4 | Framer | https://www.framer.com/ | Best motion reference. It shows how to make a page feel alive without relying on gimmicky copy. | Scroll-triggered reveals, product as stage, section transitions, hero motion timing. |
| 5 | Apple iPad Pro | https://www.apple.com/ipad-pro/ | Best product-reveal reference. Word Quest needs the app/game surface to appear earlier and feel like the hero object. | Product-first hero, cinematic reveal, large confident type, scroll-controlled focus. |
| 6 | Anthropic | https://www.anthropic.com/ | Best trust and research tone. Useful for Responsible AI, local-first privacy, and maintainer credibility. | Editorial restraint, warm trust tone, serious copy hierarchy, ethical AI framing. |
| 7 | Codédex | https://www.codedex.io/ | Best thematic reference for learning as an adventure. It is closer to quest/game education without becoming childish. | Adventure language, progress journey, playful illustration balance, achievement framing. |
| Optional | Vercel | https://vercel.com/ | Good if the redesign should feel more technical/open-source and less whimsical. | Minimal tech credibility, monochrome discipline, product grid hierarchy. |

## Direction For Word Quest

The target is not a children's education page. The target is:

> A premium AI learning-game system: part interactive product, part RPG learning journey, part local-first open-source research artifact.

Keep:

- Current project transparency and open-source honesty.
- Battle / SRS / Guardian Dashboard / Responsible AI sections.
- Real product screenshots.
- Teacher-built credibility.

Change:

- Make the product surface visible much earlier in the hero.
- Reduce oversized empty space.
- Replace generic rounded cards with more intentional product frames and editorial sections.
- Use dark sections with actual screenshots to create contrast and rhythm.
- Give the landing page a stronger visual system: mission/tome/product-console, not generic education.

## Reference-to-Word-Quest Mapping

| Word Quest Section | Learn From | Redesign Cue |
|---|---|---|
| Hero | Apple + Linear + Cursor | Large confident title, app/game screenshot visible in first viewport, primary CTA beside a concise product promise. |
| Problem | Anthropic + Linear | Editorial text, fewer generic cards, sharper statements about why vocabulary practice fails. |
| Solution | Linear + Raycast | Numbered product modules with real screenshots and concise feature claims. |
| Learning Loop | Framer + Cursor | Animated or staged cycle, not a static diagram card only. |
| Preview | Linear + Cursor | Screenshot wall or staged product boards with labels; no blank image frames. |
| Guardian Evidence | Anthropic + Mercury-like restraint | Trust-first, local-first, evidence-first copy. |
| Responsible AI | Anthropic | Serious tone, clear privacy promises, no decorative excess. |
| Maintainer / Open Source | Vercel + Anthropic | Credible, compact, transparent, developer-friendly. |

## Non-Negotiables

- Do not copy reference branding, logos, copy, images, mascots, or product UI.
- Do not turn Word Quest into a generic SaaS page.
- Do not overuse purple-blue gradients.
- Do not hide the actual product screenshots below the fold.
- Do not rely on decorative blobs or empty cinematic whitespace.
- Do not make cards inside cards.
- Do not make the page feel like a toy app; it can be playful, but the craft should feel premium.

## Deliverable Expectations For Kimi

Kimi should produce a redesign of `src/app/project/page.tsx`, `src/app/project/sections.tsx`, and `src/app/project/components.tsx` only if necessary.

Expected outcome:

- First viewport shows the Word Quest product/game surface clearly.
- Page feels premium and specific to Word Quest.
- Layout works at 390px, 768px, 1024px, and 1440px.
- Screenshots load correctly and have `sizes` configured when using `next/image fill`.
- No missing image paths.
- Motion respects `prefers-reduced-motion`.
- Existing metadata and external links remain valid.
