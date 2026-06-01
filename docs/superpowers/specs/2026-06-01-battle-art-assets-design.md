# Battle Art Assets Design

## Goal

Replace the current symbol-like battle visuals with a small, coherent 3D clay education RPG asset pack. The first implementation should improve the battle arena, monster presentation, item slots, and attack feedback without changing combat rules or question flow.

## Approved Direction

Use the selected `3D Clay Education RPG` direction:

- Soft, rounded, colorful, tactile assets.
- Friendly enough for grade-school learning.
- Readable at small sizes in battle and inventory UI.
- No text embedded in images.
- Avoid dark arcade styling and per-question generated art.

## Asset Scope

Generate and commit project-local bitmap assets for:

- Hero avatar: one blue book-knight / learning champion style figure.
- Monsters: one each for `vocab`, `grammar`, and `reading`.
- Items: one each for `potion_health`, `potion_clarity`, and `relic_vampire`.
- Attack effects: one each for `slash`, `fireball`, and `lightning`.

Assets should be saved under `public/assets/battle/` so Next.js can serve them by stable URL. The images should be square PNG/WebP with clean subject separation. If transparent output requires local processing, use chroma-key removal and verify alpha before wiring the asset into the app.

## Integration Design

Add a small battle asset mapping module, for example `src/lib/battleAssets.ts`, that maps:

- `Monster['type']` to monster asset metadata.
- `ItemType` to item asset metadata.
- attack type to effect asset metadata.
- hero to a single hero asset.

The module should return `src`, `alt`, and visual tone metadata. Components should consume this mapping instead of hard-coded emoji. This keeps generated file paths out of the store and avoids changing persisted game data.

Update:

- `src/components/battle/BattleScene.tsx`: replace the hero icon block and monster emoji block with image-backed figures while preserving current motion, HP, combo, shield, particles, and damage text.
- `src/components/BattleInterface.tsx`: replace inventory item emoji with mapped item artwork.
- `src/components/ShopModal.tsx`: keep the store item data compatible, but render shop items through the same mapping where possible.

Do not change answer validation, reward math, item effects, SRS logging, or dashboard data.

## Accessibility And Fallbacks

- Each image must have meaningful `alt` text.
- If an unknown monster or item type appears, render a deterministic fallback asset or existing icon rather than failing.
- Image containers should keep stable dimensions to avoid layout shifts.
- Respect current reduced-motion behavior by keeping assets static; existing Framer Motion animation remains the only motion layer.

## Testing

Add focused tests that prove:

- Battle asset mapping returns URLs and alt text for all supported monster types, item types, and attack types.
- `BattleScene` renders image-backed hero and monster assets instead of the old emoji-only monster.
- Inventory/shop rendering can display item artwork from the shared mapping.

Then run:

- `npm run lint`
- `npm test -- --runInBand`
- `npm run build`
- Browser smoke test at `http://localhost:3000/` to verify the battle scene opens and the assets render without horizontal overflow.

## Out Of Scope

- Generating unique art for every AI-created question.
- Reworking combat mechanics.
- Replacing the achievement system visuals.
- Replacing reward screen artwork beyond item icons reused from the shared mapping.
