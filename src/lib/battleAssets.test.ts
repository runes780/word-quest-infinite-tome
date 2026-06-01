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
