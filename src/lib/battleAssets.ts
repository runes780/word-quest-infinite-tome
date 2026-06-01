import type { ItemType, Monster } from '@/store/gameStore';

export type BattleAssetTone = 'blue' | 'orange' | 'purple' | 'emerald' | 'red' | 'cyan' | 'yellow';
export type AttackEffectType = 'slash' | 'fireball' | 'lightning';

export interface BattleAsset {
    src: string;
    alt: string;
    tone: BattleAssetTone;
}

const heroAsset: BattleAsset = {
    src: '/assets/battle/hero-book-knight.png',
    alt: 'book knight hero',
    tone: 'blue'
};

const monsterAssets: Record<Monster['type'], BattleAsset> = {
    vocab: {
        src: '/assets/battle/monster-vocab.png',
        alt: 'vocab monster',
        tone: 'orange'
    },
    grammar: {
        src: '/assets/battle/monster-grammar.png',
        alt: 'grammar monster',
        tone: 'purple'
    },
    reading: {
        src: '/assets/battle/monster-reading.png',
        alt: 'reading monster',
        tone: 'emerald'
    }
};

const itemAssets: Record<ItemType, BattleAsset> = {
    potion_health: {
        src: '/assets/battle/item-health-potion.png',
        alt: 'health potion item',
        tone: 'red'
    },
    potion_clarity: {
        src: '/assets/battle/item-clarity-potion.png',
        alt: 'clarity potion item',
        tone: 'cyan'
    },
    relic_vampire: {
        src: '/assets/battle/item-vampire-fangs.png',
        alt: 'vampire fangs relic item',
        tone: 'purple'
    },
    relic_midas: {
        src: '/assets/battle/item-vampire-fangs.png',
        alt: 'midas relic item',
        tone: 'yellow'
    },
    relic_scholar: {
        src: '/assets/battle/item-clarity-potion.png',
        alt: 'scholar relic item',
        tone: 'cyan'
    }
};

const attackEffectAssets: Record<AttackEffectType, BattleAsset> = {
    slash: {
        src: '/assets/battle/effect-slash.png',
        alt: 'slash attack effect',
        tone: 'blue'
    },
    fireball: {
        src: '/assets/battle/effect-fireball.png',
        alt: 'fireball attack effect',
        tone: 'orange'
    },
    lightning: {
        src: '/assets/battle/effect-lightning.png',
        alt: 'lightning attack effect',
        tone: 'yellow'
    }
};

export function getHeroAsset(): BattleAsset {
    return heroAsset;
}

export function getMonsterAsset(type: Monster['type']): BattleAsset {
    return monsterAssets[type] ?? monsterAssets.vocab;
}

export function getItemAsset(type: ItemType): BattleAsset {
    return itemAssets[type] ?? itemAssets.potion_health;
}

export function getAttackEffectAsset(type: AttackEffectType): BattleAsset {
    return attackEffectAssets[type] ?? attackEffectAssets.slash;
}
