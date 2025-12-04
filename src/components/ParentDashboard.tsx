'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GraduationCap, LineChart, RefreshCw, Download, Printer, X, Sparkles } from 'lucide-react';

import { useSettingsStore } from '@/store/settingsStore';
import { translations } from '@/lib/translations';
import { DashboardSummary, getDashboardSummary } from '@/lib/data/history';
import { getMistakes, MistakeRecord } from '@/lib/data/mistakes';
import { downloadNodeAsImage, openNodePrintView } from '@/lib/exportReport';

const RANGE_OPTIONS = [7, 14, 30] as const;
type RangeOption = typeof RANGE_OPTIONS[number];

export function ParentDashboard() {
    const { language } = useSettingsStore();
    const t = translations[language];
    const [isOpen, setIsOpen] = useState(false);
    const [range, setRange] = useState<RangeOption>(14);
    const [snapshot, setSnapshot] = useState<DashboardSummary | null>(null);
    const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState<'image' | 'pdf' | null>(null);
    const reportRef = useRef<HTMLDivElement | null>(null);

    const hasHistory = snapshot && snapshot.records.length > 0;

    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [historyData, mistakeData] = await Promise.all([
                getDashboardSummary(range, range * 6),
                getMistakes(40)
            ]);
            setSnapshot(historyData);
            setMistakes(mistakeData);
        } catch (err) {
            console.error(err);
            setError(t.dashboard.loadError || 'Failed to load');
        } finally {
            setIsLoading(false);
        }
    }, [range, t.dashboard.loadError]);

    useEffect(() => {
        if (!isOpen) return;
        loadData();
    }, [isOpen, loadData]);

    const lastActiveLabel = useMemo(() => {
        if (!snapshot?.totals.lastActive) return t.dashboard.noHistoryShort || '—';
        return new Date(snapshot.totals.lastActive).toLocaleDateString();
    }, [snapshot, t.dashboard.noHistoryShort]);

    const averageAccuracy = snapshot ? Math.round((snapshot.totals.accuracy || 0) * 100) : 0;

    const skillRows = snapshot?.skills.slice(0, 6) ?? [];
    const dailyRows = snapshot?.daily ?? [];

    const recentMistakes = mistakes.slice(0, 5);

    const handleExportImage = async () => {
        if (!reportRef.current || !hasHistory) return;
        setExporting('image');
        try {
            await downloadNodeAsImage(reportRef.current, `word-quest-report-${range}d.png`);
        } catch (err) {
            console.error(err);
        } finally {
            setExporting(null);
        }
    };

    const handleExportPdf = async () => {
        if (!reportRef.current || !hasHistory) return;
        setExporting('pdf');
        try {
            openNodePrintView(reportRef.current, 'Word Quest Progress Report');
        } finally {
            setExporting(null);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 p-3 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform z-40"
                aria-label={t.dashboard.open}
            >
                <GraduationCap className="w-6 h-6" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur"
                        onClick={() => setIsOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="w-full max-w-5xl bg-card border border-border rounded-3xl p-6 m-4 overflow-y-auto max-h-[90vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                                <div>
                                    <h3 className="text-3xl font-bold text-primary flex items-center gap-2">
                                        <GraduationCap className="w-7 h-7" /> {t.dashboard.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">{t.dashboard.subtitle}</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs">
                                    <span className="uppercase tracking-widest text-muted-foreground">{t.dashboard.rangeLabel}</span>
                                    <div className="flex gap-2">
                                        {RANGE_OPTIONS.map((days) => {
                                            const label = t.dashboard.rangeOptions?.[String(days) as keyof typeof t.dashboard.rangeOptions] ?? `${days}d`;
                                            return (
                                                <button
                                                    key={days}
                                                    onClick={() => setRange(days)}
                                                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${range === days ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <button onClick={() => setIsOpen(false)} className="ml-auto">
                                    <X className="w-5 h-5 text-muted-foreground" />
                                </button>
                            </div>

                            <div className="flex justify-between items-center mb-4">
                                <div className="text-sm text-muted-foreground">
                                    {isLoading ? t.dashboard.refreshing : t.dashboard.updatedLabel.replace('{date}', new Date().toLocaleTimeString())}
                                </div>
                                <button
                                    onClick={loadData}
                                    className="flex items-center gap-2 text-sm text-primary"
                                    disabled={isLoading}
                                >
                                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                                    {t.dashboard.refresh}
                                </button>
                            </div>

                            {error && (
                                <div className="mb-4 text-sm text-destructive">{error}</div>
                            )}

                            <div ref={reportRef} className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <SummaryCard
                                        label={t.dashboard.lastActive}
                                        value={hasHistory ? lastActiveLabel : '—'}
                                        helper={hasHistory ? t.dashboard.latestMission : t.dashboard.noHistory}
                                    />
                                    <SummaryCard
                                        label={t.dashboard.missions}
                                        value={snapshot?.totals.missions ?? 0}
                                        helper={t.dashboard.sessionsLabel.replace('{count}', String(snapshot?.totals.missions ?? 0))}
                                    />
                                    <SummaryCard
                                        label={t.dashboard.avgAccuracy}
                                        value={`${averageAccuracy}%`}
                                        helper={t.dashboard.accuracyHelper}
                                    />
                                    <SummaryCard
                                        label={t.dashboard.totalQuestions}
                                        value={snapshot?.totals.total ?? 0}
                                        helper={t.dashboard.targetsHelper}
                                    />
                                </div>

                                <div className="grid lg:grid-cols-2 gap-6">
                                    <section className="p-5 rounded-2xl bg-secondary/30 border border-border">
                                        <header className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                                <LineChart className="w-4 h-4 text-primary" />
                                                {t.dashboard.dailyAccuracy}
                                            </div>
                                            <span className="text-xs text-muted-foreground">{t.dashboard.rangeSummary.replace('{days}', String(range))}</span>
                                        </header>
                                        {hasHistory ? (
                                            <div className="flex gap-2 h-32 items-end">
                                                {dailyRows.map((day) => (
                                                    <div key={day.date} className="flex flex-col items-center flex-1">
                                                        <div className="w-full bg-primary/20 rounded-t-lg relative" style={{ height: `${Math.max(5, day.accuracy * 100)}%` }}>
                                                            <span className="absolute -top-6 text-[10px] font-semibold text-primary">
                                                                {Math.round(day.accuracy * 100)}%
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground mt-2">{day.label}</span>
                                                        <span className="text-[10px] text-muted-foreground">{day.missions} {t.dashboard.sessionsShort}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <EmptyState message={t.dashboard.emptyReport} />)
                                        }
                                    </section>

                                    <section className="p-5 rounded-2xl bg-secondary/30 border border-border">
                                        <header className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
                                            <Sparkles className="w-4 h-4 text-primary" />
                                            {t.dashboard.skillBreakdown}
                                        </header>
                                        {skillRows.length > 0 ? (
                                            <div className="space-y-3">
                                                {skillRows.map((row) => (
                                                    <div key={row.skill} className="text-sm">
                                                        <div className="flex justify-between text-xs text-muted-foreground">
                                                            <span>{row.skill.replace(/_/g, ' ')}</span>
                                                            <span>{Math.round(row.accuracy * 100)}% · {row.total} {t.dashboard.attempts}</span>
                                                        </div>
                                                        <div className="h-2 bg-background/40 rounded-full overflow-hidden mt-1">
                                                            <div className="h-full bg-gradient-to-r from-primary to-purple-400" style={{ width: `${Math.max(5, row.accuracy * 100)}%` }} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <EmptyState message={t.dashboard.noSkillData} />)
                                        }
                                    </section>
                                </div>

                                <section className="p-5 rounded-2xl bg-secondary/30 border border-border">
                                    <header className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                                            <GraduationCap className="w-4 h-4 text-primary" />
                                            {t.dashboard.recentMistakes}
                                        </div>
                                        <span className="text-xs text-muted-foreground">{t.dashboard.reviewHint}</span>
                                    </header>
                                    {recentMistakes.length > 0 ? (
                                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                                            {recentMistakes.map((mistake) => (
                                                <div key={mistake.id} className="p-3 rounded-2xl bg-background/40 border border-border/40">
                                                    <div className="text-xs text-muted-foreground flex justify-between">
                                                        <span>{new Date(mistake.timestamp).toLocaleString()}</span>
                                                        {mistake.skillTag && (
                                                            <span className="uppercase tracking-wide">{mistake.skillTag}</span>
                                                        )}
                                                    </div>
                                                    <p className="font-semibold text-sm mt-2">{mistake.questionText}</p>
                                                    <div className="flex flex-wrap gap-2 text-xs mt-3">
                                                        <span className="px-2 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-400">
                                                            {t.dashboard.correct}: {mistake.correctAnswer}
                                                        </span>
                                                        <span className="px-2 py-1 rounded-full bg-destructive/10 border border-destructive/20 text-destructive">
                                                            {t.dashboard.chosen}: {mistake.wrongAnswer}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyState message={t.dashboard.noMistakes} />)
                                    }
                                </section>
                            </div>

                            <div className="flex flex-wrap gap-3 mt-6">
                                <button
                                    onClick={handleExportImage}
                                    disabled={!hasHistory || isLoading || exporting !== null}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                                >
                                    <Download className="w-4 h-4" />
                                    {t.dashboard.exportImage}
                                </button>
                                <button
                                    onClick={handleExportPdf}
                                    disabled={!hasHistory || isLoading || exporting !== null}
                                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-foreground border border-border disabled:opacity-50"
                                >
                                    <Printer className="w-4 h-4" />
                                    {t.dashboard.exportPdf}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

function SummaryCard({ label, value, helper }: { label: string; value: string | number; helper?: string; }) {
    return (
        <div className="p-4 rounded-2xl bg-secondary/30 border border-border/60">
            <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
            <div className="text-2xl font-bold text-foreground">{value}</div>
            {helper && <div className="text-[11px] text-muted-foreground mt-1">{helper}</div>}
        </div>
    );
}

function EmptyState({ message }: { message: string; }) {
    return (
        <div className="flex flex-col items-center justify-center text-center gap-2 text-sm text-muted-foreground py-6">
            <LineChart className="w-6 h-6" />
            <p>{message}</p>
        </div>
    );
}
