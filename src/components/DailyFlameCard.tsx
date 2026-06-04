import { Flame, ShieldCheck, Sparkles } from 'lucide-react';
import type { DailyFlameStatus } from '@/lib/data/dailyFlame';

interface DailyFlameCardProps {
    status: DailyFlameStatus;
    language: 'en' | 'zh';
}

export function DailyFlameCard({ status, language }: DailyFlameCardProps) {
    const isZh = language === 'zh';
    const isStarter = status.state === 'starter';
    const protectedToday = status.state === 'protected';
    const atRisk = status.state === 'at-risk';
    const title = isStarter
        ? (isZh ? '点亮今日火苗' : 'Start today\'s flame')
        : (isZh ? `${status.streakDays} 天火苗` : `${status.streakDays} day flame`);
    const subtitle = protectedToday
        ? (isZh ? '今天已守护' : 'Protected for today')
        : isStarter
            ? (isZh ? `${status.remainingXp} XP 建立第一天` : `${status.remainingXp} XP starts day one`)
        : isZh
            ? `还需 ${status.remainingXp} XP 守护今天`
            : `${status.remainingXp} XP to protect today`;
    const helper = atRisk && status.canUseFreeze
        ? (isZh ? '可使用休息保护' : 'Rest day available')
        : protectedToday
            ? (isZh ? '明天继续一点点前进' : 'Come back tomorrow for the next step')
            : (isZh ? '完成一个短练习即可点亮' : 'Finish one short practice to keep it lit');

    return (
        <section className="mb-4 rounded-3xl border border-orange-400/30 bg-gradient-to-br from-orange-500/15 via-amber-500/10 to-card/80 p-4 shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-orange-500/20 text-orange-500">
                        {protectedToday ? <ShieldCheck className="h-6 w-6" /> : <Flame className="h-7 w-7" />}
                    </div>
                    <div className="min-w-0">
                        <p className="text-lg font-black text-foreground">{title}</p>
                        <p className="text-sm font-semibold text-orange-500">{subtitle}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xl font-black text-foreground">{status.progressPercent}%</p>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        {isZh ? '今日目标' : 'Today'}
                    </p>
                </div>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-background/70">
                <div
                    className="h-full rounded-full bg-orange-500 transition-all"
                    style={{ width: `${status.progressPercent}%` }}
                />
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>{helper}</span>
            </div>
        </section>
    );
}
