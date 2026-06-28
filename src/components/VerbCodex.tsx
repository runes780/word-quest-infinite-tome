'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPlayerProfile } from '@/db/db';
import { VERB_INFO, verbUnlockLevel, ALL_VERBS_ORDERED } from '@/lib/data/verbProgression';
import { useSettingsStore } from '@/store/settingsStore';
import type { Verb } from '@/store/gameStore';

interface VerbCodexProps {
    isOpen: boolean;
    onClose: () => void;
}

export function VerbCodex({ isOpen, onClose }: VerbCodexProps) {
    const { language } = useSettingsStore();
    const isZh = language === 'zh';
    const [level, setLevel] = useState(1);
    const [unlocked, setUnlocked] = useState<Verb[]>(['recognize', 'recall']);

    useEffect(() => {
        if (!isOpen) return;
        getPlayerProfile()
            .then((p) => {
                setLevel(p.globalLevel);
                setUnlocked(p.unlockedVerbs ?? ['recognize', 'recall']);
            })
            .catch(() => { /* best-effort */ });
    }, [isOpen]);

    const nextUnlock = ALL_VERBS_ORDERED.find(
        (v) => !unlocked.includes(v) && verbUnlockLevel(v) !== Infinity
    );

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                >
                    <motion.div
                        className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-card border-2 border-primary/20 rounded-3xl p-6 shadow-2xl"
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            type="button"
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="flex items-center gap-2 mb-1">
                            <BookOpen className="w-6 h-6 text-primary" />
                            <h2 className="text-2xl font-black">{isZh ? '动词典籍' : 'Verb Codex'}</h2>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">
                            {isZh ? '解锁并精通不同的认知动词' : 'Unlock and master different cognitive verbs'}
                        </p>

                        <div className="flex items-center gap-3 mb-5">
                            <span className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-black text-lg shadow-lg">
                                {isZh ? '等级' : 'Lv'} {level}
                            </span>
                            {nextUnlock ? (
                                <span className="text-sm text-muted-foreground">
                                    {isZh
                                        ? `下一个：${VERB_INFO[nextUnlock].nameZh}（Lv ${verbUnlockLevel(nextUnlock)}）`
                                        : `Next: ${VERB_INFO[nextUnlock].name} at Lv ${verbUnlockLevel(nextUnlock)}`}
                                </span>
                            ) : (
                                <span className="text-sm text-green-500 font-medium">
                                    {isZh ? '全部动词已解锁！' : 'All verbs unlocked!'}
                                </span>
                            )}
                        </div>

                        <div className="space-y-2">
                            {ALL_VERBS_ORDERED.map((v) => {
                                const info = VERB_INFO[v];
                                const ul = verbUnlockLevel(v);
                                const isReleased = ul !== Infinity;
                                const isUnlocked = unlocked.includes(v) || ul <= level;
                                return (
                                    <div
                                        key={v}
                                        className={cn(
                                            'flex items-center gap-3 p-3 rounded-xl border transition-colors',
                                            isUnlocked
                                                ? 'border-green-500/30 bg-green-500/5'
                                                : 'border-border bg-secondary/30'
                                        )}
                                    >
                                        <span className="text-2xl shrink-0">{info.icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold">{isZh ? info.nameZh : info.name}</p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {isZh ? info.descZh : info.desc}
                                            </p>
                                        </div>
                                        {isUnlocked ? (
                                            <span className="text-green-500 text-xs font-bold shrink-0">
                                                ✓ {isZh ? '已解锁' : 'Unlocked'}
                                            </span>
                                        ) : isReleased ? (
                                            <span className="text-muted-foreground text-xs shrink-0">🔒 Lv {ul}</span>
                                        ) : (
                                            <span className="text-muted-foreground/60 text-xs shrink-0">
                                                {isZh ? '即将推出' : 'Soon'}
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
