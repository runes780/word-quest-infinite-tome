import { findBreakthroughSkill, formatSkillLabel, type SkillStatsMap } from '@/store/modules/questionFlow';
import type { Item, ItemType, PlayerStats, Reward } from '@/store/gameStore';

export const RELICS: Item[] = [
    {
        id: 'relic_vampire',
        type: 'relic_vampire',
        name: 'Vampire Fangs',
        description: 'Heal 1 HP on Critical Hit',
        cost: 150,
        icon: '🧛'
    },
    {
        id: 'relic_midas',
        type: 'relic_midas',
        name: 'Hand of Midas',
        description: '+50% Gold from all sources',
        cost: 200,
        icon: '✋'
    },
    {
        id: 'relic_scholar',
        type: 'relic_scholar',
        name: 'Scholar\'s Lens',
        description: '+20% XP gain',
        cost: 120,
        icon: '👓'
    }
];

export const hasRelic = (inventory: Item[], type: ItemType) => inventory.some((item) => item.type === type);

export const applyGoldBonus = (base: number, inventory: Item[]) => Math.floor(base * (hasRelic(inventory, 'relic_midas') ? 1.5 : 1));

export const applyXpBonus = (base: number, inventory: Item[]) => Math.round(base * (hasRelic(inventory, 'relic_scholar') ? 1.2 : 1));

export const applyProgressionReward = (stats: PlayerStats, xpGain: number, goldGain: number): PlayerStats => {
    let xp = stats.xp + xpGain;
    let level = stats.level;
    let maxXp = stats.maxXp;
    while (xp >= maxXp) {
        xp -= maxXp;
        level += 1;
        maxXp = Math.floor(maxXp * 1.2);
    }
    return {
        ...stats,
        xp,
        level,
        maxXp,
        gold: stats.gold + goldGain
    };
};

export const craftRelic = (inventory: Item[]) => {
    const ownedTypes = new Set(inventory.map((item) => item.type));
    const options = RELICS.filter((relic) => !ownedTypes.has(relic.type));
    if (options.length === 0) return null;
    const relic = options[Math.floor(Math.random() * options.length)];
    return { ...relic, id: `${relic.id}_${Date.now()}` };
};

export const buildBossRewardBundle = (
    inventory: Item[],
    skillStats: SkillStatsMap
): Reward[] => {
    const rewards: Reward[] = [];
    const ownedRelicTypes = new Set(inventory.map((entry) => entry.type));
    const availableRelics = RELICS.filter((relic) => !ownedRelicTypes.has(relic.type));

    const guaranteedGold = applyGoldBonus(100, inventory);
    rewards.push({
        id: `gold_${Date.now()}`,
        type: 'gold',
        value: guaranteedGold,
        icon: '💰',
        label: `${guaranteedGold} Gold`,
        description: 'Guaranteed mission payout.'
    });

    rewards.push({
        id: `fragment_${Date.now()}`,
        type: 'fragment',
        value: 2,
        icon: '🪨',
        label: 'Root Fragment x2',
        description: 'Guaranteed progression drop with crafting pity.'
    });

    const breakthrough = findBreakthroughSkill(skillStats);
    if (breakthrough) {
        rewards.push({
            id: `objective_breakthrough_${Date.now()}`,
            type: 'objective',
            value: 'weakness_breakthrough',
            icon: '🎯',
            label: 'Weakness Breakthrough',
            description: `${formatSkillLabel(breakthrough.skillTag)} stabilized at ${Math.round(breakthrough.accuracy * 100)}%.`
        });
    }

    if (availableRelics.length > 0) {
        const guaranteedRelic = availableRelics[0];
        rewards.push({
            id: `relic_${Date.now()}`,
            type: 'relic',
            value: guaranteedRelic.id,
            icon: guaranteedRelic.icon,
            label: guaranteedRelic.name,
            description: 'Guaranteed relic drop (pity protection active).'
        });
    } else {
        rewards.push({
            id: `potion_${Date.now()}`,
            type: 'potion',
            value: 'potion_clarity',
            icon: '💎',
            label: 'Clarity Potion',
            description: 'All relics collected, converted to guaranteed utility drop.'
        });
    }

    return rewards;
};
