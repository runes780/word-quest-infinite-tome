import { useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ShoppingBag, Coins } from 'lucide-react';
import { useGameStore, Item } from '@/store/gameStore';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/store/settingsStore';
import { translations } from '@/lib/translations';

export const SHOP_ITEMS: Item[] = [
    {
        id: 'potion_health',
        type: 'potion_health',
        name: 'Health Potion',
        description: 'Restores 1 Heart',
        cost: 50,
        icon: '❤️'
    },
    {
        id: 'potion_clarity',
        type: 'potion_clarity',
        name: 'Clarity Potion',
        description: 'Restores 1 Heart (Placeholder)', // Simplified for MVP
        cost: 75,
        icon: '🧪'
    },
    {
        id: 'relic_vampire',
        type: 'relic_vampire',
        name: 'Vampire Fangs',
        description: 'Heal on Critical Hit (Passive)',
        cost: 150,
        icon: '🧛'
    }
];

interface ShopModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ShopModal({ isOpen, onClose }: ShopModalProps) {
    const { playerStats, spendGold, addItem } = useGameStore();
    const { language } = useSettingsStore();
    const t = translations[language];
    const purchaseCounter = useRef(0);

    const handleBuy = (item: typeof SHOP_ITEMS[0]) => {
        if (spendGold(item.cost)) {
            purchaseCounter.current += 1;
            const uniqueId = `${item.id}_${purchaseCounter.current}`;
            const newItem = { ...item, id: uniqueId };
            addItem(newItem);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-slate-900 border-2 border-yellow-500/50 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 bg-slate-950/50 border-b border-white/10">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-yellow-500/20 rounded-lg">
                                        <ShoppingBag className="w-6 h-6 text-yellow-500" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-primary">{t.shop.title}</h2>
                                </div>
                                <button onClick={onClose}>
                                    <X className="w-6 h-6 text-muted-foreground hover:text-foreground" />
                                </button>
                            </div>

                            <div className="bg-black/40 rounded-xl p-4 mb-6 flex justify-between items-center border border-white/10">
                                <span className="text-muted-foreground font-medium">{t.shop.yourGold}</span>
                                <div className="flex items-center gap-2 text-yellow-500 font-bold text-xl">
                                    <Coins className="w-5 h-5" />
                                    {playerStats.gold}
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="px-6 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg font-medium transition-colors"
                            >
                                {t.shop.close}
                            </button>
                        </div>

                        {/* Items Grid */}
                        <div className="p-6 grid gap-4">
                            {SHOP_ITEMS.map((item) => {
                                const canAfford = playerStats.gold >= item.cost;
                                return (
                                    <div
                                        key={item.id}
                                        className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-yellow-500/30 transition-colors group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="text-3xl bg-slate-950 p-3 rounded-lg border border-white/10 group-hover:scale-110 transition-transform">
                                                {item.icon}
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-white">{item.name}</h3>
                                                <p className="text-xs text-muted-foreground">{item.description}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleBuy(item)}
                                            disabled={!canAfford}
                                            className={cn(
                                                "px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all",
                                                canAfford
                                                    ? "bg-yellow-500 text-black hover:bg-yellow-400 shadow-lg shadow-yellow-500/20"
                                                    : "bg-white/10 text-white/30 cursor-not-allowed"
                                            )}
                                        >
                                            <span>{item.cost}</span>
                                            <Coins className="w-3 h-3" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-slate-950/30 text-center text-xs text-muted-foreground border-t border-white/5">
                            {t.shop.footer}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
