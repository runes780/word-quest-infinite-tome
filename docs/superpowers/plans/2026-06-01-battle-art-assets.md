# Battle Art Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Replace symbol/emoji battle visuals with a coherent 3D clay education RPG asset pack wired into the battle scene, inventory, and shop.

**Architecture:** Generated bitmap assets live under `public/assets/battle/` and are referenced through a single metadata module. React components consume metadata (`src`, `alt`, `tone`) instead of hard-coded emoji, preserving existing combat logic and motion.

**Tech Stack:** Next.js 16, React 19, TypeScript, Jest, React Testing Library, Tailwind CSS, Framer Motion, built-in image generation with local project asset persistence.

---

## File Structure

- Create: `public/assets/battle/hero-book-knight.png`
- Create: `public/assets/battle/monster-vocab.png`
- Create: `public/assets/battle/monster-grammar.png`
- Create: `public/assets/battle/monster-reading.png`
- Create: `public/assets/battle/item-health-potion.png`
- Create: `public/assets/battle/item-clarity-potion.png`
- Create: `public/assets/battle/item-vampire-fangs.png`
- Create: `public/assets/battle/effect-slash.png`
- Create: `public/assets/battle/effect-fireball.png`
- Create: `public/assets/battle/effect-lightning.png`
- Create: `src/lib/battleAssets.ts`
- Create: `src/lib/battleAssets.test.ts`
- Modify: `src/components/battle/BattleScene.tsx`
- Create or modify: `src/components/battle/BattleScene.test.tsx`
- Modify: `src/components/BattleInterface.tsx`
- Modify: `src/components/ShopModal.tsx`

---

### Task 1: Asset Metadata

**Files:**
- Create: `src/lib/battleAssets.test.ts`
- Create: `src/lib/battleAssets.ts`

- [x] **Step 1: Write failing tests**

Create tests proving every supported battle visual has a stable URL and accessible alt text:

```ts
import {
    getAttackEffectAsset,
    getHeroAsset,
    getItemAsset,
    getMonsterAsset
} from './battleAssets';

describe('battle asset mapping', () => {
    test('returns hero asset metadata', () => {
        expect(getHeroAsset()).toEqual(expect.objectContaining({
            src: '/assets/battle/hero-book-knight.png',
            alt: expect.stringContaining('hero')
        }));
    });

    test.each(['vocab', 'grammar', 'reading'] as const)('returns monster asset for %s', (type) => {
        const asset = getMonsterAsset(type);
        expect(asset.src).toMatch(/^\/assets\/battle\/monster-/);
        expect(asset.alt).toContain(type);
        expect(asset.tone).toBeTruthy();
    });

    test.each(['potion_health', 'potion_clarity', 'relic_vampire'] as const)('returns item asset for %s', (type) => {
        const asset = getItemAsset(type);
        expect(asset.src).toMatch(/^\/assets\/battle\/item-/);
        expect(asset.alt.length).toBeGreaterThan(8);
    });

    test.each(['slash', 'fireball', 'lightning'] as const)('returns attack effect asset for %s', (type) => {
        const asset = getAttackEffectAsset(type);
        expect(asset.src).toMatch(/^\/assets\/battle\/effect-/);
        expect(asset.alt).toContain(type);
    });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- battleAssets.test.ts --runInBand`

Expected: FAIL because `src/lib/battleAssets.ts` does not exist.

- [x] **Step 3: Implement mapping**

Create `src/lib/battleAssets.ts` with deterministic mappings for hero, monsters, items, and attack effects. Include fallback handling for unknown item types by returning the health potion metadata.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- battleAssets.test.ts --runInBand`

Expected: PASS.

---

### Task 2: Generate Project Assets

**Files:**
- Create: `public/assets/battle/*.png`

- [x] **Step 1: Generate image assets**

Use built-in image generation, one project-bound asset per prompt. Use the shared style:

```text
Use case: stylized-concept
Asset type: square game UI asset for a children education RPG
Style: friendly 3D claymorphism, rounded tactile shapes, soft studio lighting, colorful but readable, no text, no watermark
Background: perfectly flat solid #00ff00 chroma-key background, no shadows on background, subject fully separated with generous padding
Output intent: transparent PNG after local chroma-key removal
```

Generate these subjects:

- `hero-book-knight`: blue book-knight learning champion, heroic but friendly.
- `monster-vocab`: orange vocabulary blob monster with letter-token motifs, cute rather than scary.
- `monster-grammar`: purple grammar wizard monster with punctuation motifs, cute rather than scary.
- `monster-reading`: emerald reading forest monster with page/leaf motifs, cute rather than scary.
- `item-health-potion`: red heart potion bottle.
- `item-clarity-potion`: cyan clarity potion bottle with sparkle.
- `item-vampire-fangs`: friendly ivory fang relic charm with small jewel.
- `effect-slash`: bright white-blue diagonal slash energy.
- `effect-fireball`: rounded orange fireball burst.
- `effect-lightning`: yellow lightning burst.

- [x] **Step 2: Remove chroma key and save into project**

Run the imagegen chroma-key helper for each generated image:

```powershell
python C:\Users\runes780\.codex\skills\.system\imagegen\scripts\remove_chroma_key.py --input <generated-source> --out public\assets\battle\<name>.png --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

- [x] **Step 3: Validate assets exist**

Run:

```powershell
Get-ChildItem public\assets\battle\*.png | Select-Object Name,Length
```

Expected: 10 non-empty PNG files.

---

### Task 3: Battle Scene Rendering

**Files:**
- Create or modify: `src/components/battle/BattleScene.test.tsx`
- Modify: `src/components/battle/BattleScene.tsx`

- [x] **Step 1: Write failing render test**

Test that the scene renders accessible image assets for hero and monster:

```tsx
import { render, screen } from '@testing-library/react';
import { BattleScene } from './BattleScene';
import type { Monster } from '@/store/gameStore';
import { translations } from '@/lib/translations';

const question: Monster = {
    id: 1,
    type: 'vocab',
    question: 'Choose the word.',
    options: ['a', 'b'],
    correct_index: 0,
    explanation: 'Good.',
    skillTag: 'vocab_basic',
    difficulty: 'easy',
    questionMode: 'choice',
    correctAnswer: 'a'
};

test('renders image-backed hero and monster assets', () => {
    render(
        <BattleScene
            currentQuestion={question}
            showResult={false}
            isCorrect={false}
            attackType="slash"
            particles={[]}
            damageText={[]}
            currentMonsterHp={1}
            bossShieldProgress={0}
            playerStreak={0}
            comboScale={1}
            bossComboThreshold={2}
            t={translations.en}
        />
    );

    expect(screen.getByAltText(/hero/i)).toHaveAttribute('src', expect.stringContaining('/assets/battle/hero-book-knight.png'));
    expect(screen.getByAltText(/vocab/i)).toHaveAttribute('src', expect.stringContaining('/assets/battle/monster-vocab.png'));
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- BattleScene.test.tsx --runInBand`

Expected: FAIL because current scene uses icons and emoji instead of images.

- [x] **Step 3: Update BattleScene**

Import `getHeroAsset`, `getMonsterAsset`, and `getAttackEffectAsset`. Render image-backed hero and monster figures with stable dimensions. For correct answers, render the mapped effect image in the existing effect overlay. Keep existing `particles`, `damageText`, combo, boss HP, and shield UI.

- [x] **Step 4: Run test to verify it passes**

Run: `npm test -- BattleScene.test.tsx --runInBand`

Expected: PASS.

---

### Task 4: Inventory And Shop Item Artwork

**Files:**
- Modify: `src/components/BattleInterface.tsx`
- Modify: `src/components/ShopModal.tsx`
- Modify or create tests if existing component tests cover these paths.

- [x] **Step 1: Write or update focused tests**

Add assertions where practical that rendered inventory/shop items include mapped artwork with meaningful alt text.

- [x] **Step 2: Update inventory rendering**

In `BattleInterface.tsx`, import `getItemAsset` and render an `<img>` inside inventory buttons instead of `item.icon`.

- [x] **Step 3: Update shop rendering**

In `ShopModal.tsx`, import `getItemAsset` and render mapped item images. Keep `SHOP_ITEMS` item shape unchanged so store/reward logic remains compatible.

- [x] **Step 4: Run targeted tests**

Run:

```powershell
npm test -- BattleScene.test.tsx battleAssets.test.ts --runInBand
```

Expected: PASS.

---

### Task 5: Final Verification

**Files:**
- No production edits unless verification exposes a bug.

- [x] **Step 1: Run lint**

Run: `npm run lint`

Expected: exit code 0.

- [x] **Step 2: Run full tests**

Run: `npm test -- --runInBand`

Expected: all suites pass. Existing OpenRouter tests may print expected error-path console output while passing.

- [x] **Step 3: Run production build**

Run: `npm run build`

Expected: Next.js build succeeds.

- [x] **Step 4: Browser smoke test**

Open `http://localhost:3000/`, start or seed a battle, verify hero, monster, item artwork, and attack effects render without layout overflow at desktop and 390px mobile widths.

- [x] **Step 5: Commit**

Commit implementation separately from the design and plan:

```powershell
git add public/assets/battle src/lib/battleAssets.ts src/lib/battleAssets.test.ts src/components/battle/BattleScene.tsx src/components/battle/BattleScene.test.tsx src/components/BattleInterface.tsx src/components/ShopModal.tsx docs/superpowers/plans/2026-06-01-battle-art-assets.md
git commit -m "feat: add battle art assets"
```
