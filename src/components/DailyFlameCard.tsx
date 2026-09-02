import { CalendarHeart, CheckCircle2, Sparkles } from 'lucide-react';
import type { DailyFlameStatus } from '@/lib/data/dailyFlame';

interface DailyFlameCardProps {
    status: DailyFlameStatus;
    language: 'en' | 'zh';
}

export function DailyFlameCard({ status, language }: DailyFlameCardProps) {
    const isZh = language === 'zh';
    const isStarter = status.state === 'starter';
    const completedToday = status.state === 'protected';
    const returningAfterBreak = status.state === 'at-risk';
    const title = isStarter
        ? (isZh ? '开始今天的小步学习' : 'Start with one small step')
        : (isZh ? `${status.streakDays} 个活跃学习日` : `${status.streakDays} active learning days`);
    const subtitle = completedToday
        ? (isZh ? '今天的自选目标已完成' : 'Today\'s optional goal is complete')
        : isZh
            ? `再获得 ${status.remainingXp} XP 可完成今天的自选目标`
            : `${status.remainingXp} XP completes today\'s optional goal`;
    const helper = returningAfterBreak
        ? (isZh ? '欢迎回来。休息不会抹去已经学会的内容。' : 'Welcome back. A break does not erase what you learned.')
        : completedToday
            ? (isZh ? '可以在精力合适时再继续；今天无需追加练习。' : 'Continue when it suits you; no extra practice is required today.')
            : (isZh ? '短练习也算进步；这个目标不会影响已获得的掌握证据。' : 'A short practice still counts; this goal never removes mastery evidence.');

    return (
        <section
            aria-label={isZh ? '灵活学习节奏' : 'Flexible learning rhythm'}
            className="mb-4 rounded-3xl border border-orange-400/30 bg-gradient-to-br from-orange-500/15 via-amber-500/10 to-card/80 p-4 shadow-lg backdrop-blur-sm"
        >
            <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-orange-500/20 text-orange-600 dark:text-orange-400">
                        {completedToday ? <CheckCircle2 aria-hidden="true" className="h-6 w-6" /> : <CalendarHeart aria-hidden="true" className="h-7 w-7" />}
                    </div>
                    <div className="min-w-0">
                        <p className="text-lg font-black text-foreground">{title}</p>
                        <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">{subtitle}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xl font-black text-foreground">{status.progressPercent}%</p>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        {isZh ? '自选目标' : 'Optional goal'}
                    </p>
                </div>
            </div>

            <div
                aria-label={isZh ? `今天自选目标完成 ${status.progressPercent}%` : `Today's optional goal ${status.progressPercent}% complete`}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={status.progressPercent}
                className="mt-3 h-2 overflow-hidden rounded-full bg-background/70"
                role="progressbar"
            >
                <div className="h-full rounded-full bg-orange-500 transition-[width]" style={{ width: `${status.progressPercent}%` }} />
            </div>

            <div className="mt-3 flex items-start gap-2 text-xs font-semibold leading-relaxed text-muted-foreground">
                <Sparkles aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{helper}</span>
            </div>
        </section>
    );
}
