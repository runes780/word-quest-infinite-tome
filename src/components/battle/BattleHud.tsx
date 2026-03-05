import { motion } from 'framer-motion';
import { Heart, Shield, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Item, PlayerStats } from '@/store/gameStore';

interface BattleHudProps {
    health: number;
    maxHealth: number;
    playerStats: PlayerStats;
    score: number;
    currentIndex: number;
    totalQuestions: number;
    goldScale: number;
    inventory: Item[];
    knowledgeCardsCount: number;
    rootFragments: number;
    fragmentsUntilCraft: number;
    onOpenShop: () => void;
    t: {
        battle: {
            level: string;
            xp: string;
            score: string;
            activeRelics: string;
            relicMidas: string;
            relicScholar: string;
            knowledgeCards: string;
            rootFragments: string;
            fragmentsHint: string;
        };
    };
}

export function BattleHud({
    health,
    maxHealth,
    playerStats,
    score,
    currentIndex,
    totalQuestions,
    goldScale,
    inventory,
    knowledgeCardsCount,
    rootFragments,
    fragmentsUntilCraft,
    onOpenShop,
    t
}: BattleHudProps) {
    return (
        <>
            <div className="flex justify-between items-center mb-4 bg-secondary/30 p-4 rounded-2xl backdrop-blur-sm border border-border">
                <div className="flex items-center gap-4">
                    <div className="flex gap-1">
                        {[...Array(maxHealth)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ scale: 1 }}
                                animate={{
                                    scale: i < health ? 1 : 0.8,
                                    opacity: i < health ? 1 : 0.2
                                }}
                                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            >
                                <Heart
                                    className={cn(
                                        'w-8 h-8 transition-colors',
                                        i < health ? 'text-destructive fill-destructive' : 'text-muted-foreground'
                                    )}
                                />
                            </motion.div>
                        ))}
                    </div>

                    <div className="flex flex-col gap-1 min-w-[120px]">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            <span>{t.battle.level} {playerStats.level}</span>
                            <span>{t.battle.xp} {playerStats.xp}/{playerStats.maxXp}</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-blue-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${(playerStats.xp / playerStats.maxXp) * 100}% ` }}
                                transition={{ type: 'spring', stiffness: 100 }}
                            />
                        </div>
                    </div>
                </div>

                <div className="font-mono text-xl font-bold text-primary">
                    {t.battle.score}: {score.toString().padStart(6, '0')}
                </div>

                <div className="flex items-center gap-4">
                    <motion.button
                        animate={{ scale: goldScale }}
                        onClick={onOpenShop}
                        className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-lg border border-yellow-500/30 transition-colors relative z-50"
                    >
                        <Coins className="w-4 h-4" />
                        <span className="font-mono font-bold">{playerStats.gold}</span>
                    </motion.button>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Shield className="w-5 h-5" />
                        <span>{t.battle.level} {currentIndex + 1}/{totalQuestions}</span>
                    </div>
                </div>
            </div>

            {(inventory.some((item) => item.type === 'relic_midas') || inventory.some((item) => item.type === 'relic_scholar')) && (
                <div className="flex gap-2 flex-wrap text-xs text-muted-foreground mb-8">
                    <span className="font-bold text-primary mr-1">{t.battle.activeRelics}:</span>
                    {inventory.some((item) => item.type === 'relic_midas') && (
                        <span className="px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-500">
                            {t.battle.relicMidas}
                        </span>
                    )}
                    {inventory.some((item) => item.type === 'relic_scholar') && (
                        <span className="px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">
                            {t.battle.relicScholar}
                        </span>
                    )}
                </div>
            )}

            <div className="flex gap-4 text-xs text-muted-foreground mb-6">
                <span>{t.battle.knowledgeCards}: {knowledgeCardsCount}</span>
                <span>
                    {t.battle.rootFragments}: {rootFragments}
                    <span className="ml-2 text-[10px] text-muted-foreground/80">
                        {t.battle.fragmentsHint.replace('{count}', fragmentsUntilCraft.toString())}
                    </span>
                </span>
            </div>
        </>
    );
}
