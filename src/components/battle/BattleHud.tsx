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
    shopLabel: string;
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
    shopLabel,
    onOpenShop,
    t
}: BattleHudProps) {
    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4 bg-secondary/30 p-4 rounded-2xl backdrop-blur-sm border border-border">
                <div className="flex min-w-0 flex-1 basis-full items-center gap-4 sm:basis-auto">
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

                    <div className="flex min-w-[120px] flex-1 flex-col gap-1 sm:flex-none">
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

                <div className="min-w-0 flex-1 basis-[8rem] text-center font-mono text-lg font-bold text-primary sm:flex-none sm:text-xl">
                    {t.battle.score}: {score.toString().padStart(6, '0')}
                </div>

                <div className="flex flex-1 basis-[9rem] items-center justify-end gap-3 sm:flex-none sm:gap-4">
                    <motion.button
                        type="button"
                        animate={{ scale: goldScale }}
                        onClick={onOpenShop}
                        aria-label={`${shopLabel}: ${playerStats.gold}`}
                        className="relative z-50 flex min-h-11 items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-yellow-600 transition-colors hover:bg-yellow-500/20 dark:text-yellow-400"
                    >
                        <Coins className="w-4 h-4" />
                        <span className="font-mono font-bold">{playerStats.gold}</span>
                    </motion.button>
                    <div className="flex items-center gap-2 whitespace-nowrap text-muted-foreground">
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
