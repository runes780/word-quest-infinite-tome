'use client';

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Check, PlayCircle, X } from 'lucide-react';
import { useSettingsStore } from '@/store/settingsStore';
import { translations } from '@/lib/translations';
import {
    analyzeLocalMaterial,
    MIN_LOCAL_TARGETS,
    type LocalDomain,
    type LocalMaterialAnalysis
} from '@/lib/data/localMaterialPlanner';
import { objectiveTitle } from '@/lib/data/learningObjectives';

interface LocalMaterialBriefProps {
    analysis: LocalMaterialAnalysis;
    onDismiss: () => void;
    onStart: (selectedTargetIds: string[]) => void;
}

const DOMAIN_ORDER: LocalDomain[] = ['vocab', 'grammar', 'reading'];

function domainLabel(domain: LocalDomain, isZh: boolean): string {
    if (isZh) {
        return { vocab: '词汇', grammar: '语法', reading: '阅读' }[domain];
    }
    return { vocab: 'Vocabulary', grammar: 'Grammar', reading: 'Reading' }[domain];
}

function kindLabel(kind: string, isZh: boolean): string {
    if (isZh) {
        return { word: '词', grammar_form: '语法形式', reference: '指代' }[kind] || kind;
    }
    return { word: 'word', grammar_form: 'grammar form', reference: 'reference' }[kind] || kind;
}

/**
 * Pre-quest learning brief: shows the analyzed material language, difficulty
 * band, and candidate targets with their source sentences. The learner can
 * remove candidates before starting; at least three targets must remain.
 */
export function LocalMaterialBrief({ analysis, onDismiss, onStart }: LocalMaterialBriefProps) {
    const { language } = useSettingsStore();
    const isZh = language === 'zh';
    const t = translations[language].input;

    const [removedTargetIds, setRemovedTargetIds] = useState<Set<string>>(new Set());

    const selected = useMemo(
        () => analysis.targets.filter((target) => !removedTargetIds.has(target.targetId)),
        [analysis.targets, removedTargetIds]
    );

    const toggleDomain = (domain: LocalDomain) => {
        const domainTargets = analysis.targets.filter((target) => target.domain === domain);
        const anySelected = domainTargets.some((target) => !removedTargetIds.has(target.targetId));
        setRemovedTargetIds((prev) => {
            const next = new Set(prev);
            for (const target of domainTargets) {
                if (anySelected) next.add(target.targetId);
                else next.delete(target.targetId);
            }
            return next;
        });
    };

    const removeTarget = (targetId: string) => {
        setRemovedTargetIds((prev) => new Set(prev).add(targetId));
    };

    const domainCounts = DOMAIN_ORDER.map((domain) => {
        const total = analysis.targets.filter((target) => target.domain === domain).length;
        const kept = selected.filter((target) => target.domain === domain).length;
        return { domain, total, kept, active: kept > 0 };
    });

    const canStart = selected.length >= MIN_LOCAL_TARGETS;

    return (
        <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            role="group"
            className="mb-6 rounded-2xl border border-primary/30 bg-primary/5 p-4"
            aria-label={t.briefTitle}
            data-testid="local-material-brief"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                        <BookOpen className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-black text-foreground">{t.briefTitle}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {isZh ? '材料语言' : 'Material language'}: English ·{' '}
                            {isZh ? '难度带' : 'Difficulty band'}: {analysis.bandLabel}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label={t.briefCancel}
                    className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
                {domainCounts.filter((entry) => entry.total > 0).map(({ domain, total, kept, active }) => (
                    <button
                        key={domain}
                        type="button"
                        onClick={() => toggleDomain(domain)}
                        aria-pressed={active}
                        className={`rounded-full border px-3 py-1 text-xs font-bold transition-colors ${
                            active
                                ? 'border-primary/50 bg-primary/15 text-primary'
                                : 'border-border bg-background/60 text-muted-foreground'
                        }`}
                    >
                        {domainLabel(domain, isZh)} · {kept}/{total}
                    </button>
                ))}
            </div>

            <ul className="mt-3 grid gap-2" aria-label={t.briefTargets}>
                {analysis.targets.map((target) => {
                    const removed = removedTargetIds.has(target.targetId);
                    return (
                        <li
                            key={target.targetId}
                            className={`flex items-start justify-between gap-3 rounded-xl border p-3 transition-colors ${
                                removed ? 'border-border/50 bg-background/40 opacity-55' : 'border-border bg-background/70'
                            }`}
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-bold text-foreground">
                                    <span className="font-black">{target.target}</span>
                                    <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                                        {kindLabel(target.targetKind, isZh)}
                                    </span>
                                    <span className="ml-2 text-[11px] text-muted-foreground">
                                        {objectiveTitle(target.learningObjectiveId, language)}
                                    </span>
                                </p>
                                <p className="mt-1 truncate text-xs text-muted-foreground" title={target.sourceSpan}>
                                    “{target.sourceSpan}”
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => (removed
                                    ? setRemovedTargetIds((prev) => {
                                        const next = new Set(prev);
                                        next.delete(target.targetId);
                                        return next;
                                    })
                                    : removeTarget(target.targetId))}
                                aria-label={removed ? t.briefRestoreTarget : t.briefRemoveTarget}
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
                            >
                                {removed ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                            </button>
                        </li>
                    );
                })}
            </ul>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className={`text-xs font-semibold ${canStart ? 'text-muted-foreground' : 'text-destructive'}`}>
                    {canStart
                        ? (isZh
                            ? `已选 ${selected.length} 个学习目标;题目全部来自你的原文。`
                            : `${selected.length} target${selected.length === 1 ? '' : 's'} selected; every question comes from your text.`)
                        : t.briefMinTargets}
                </p>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={onDismiss}
                        className="min-h-11 rounded-xl border border-border bg-background/70 px-4 py-2 font-bold text-foreground hover:bg-secondary"
                    >
                        {t.briefCancel}
                    </button>
                    <button
                        type="button"
                        disabled={!canStart}
                        onClick={() => onStart(selected.map((target) => target.targetId))}
                        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 font-bold transition-colors ${
                            canStart
                                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/90'
                                : 'cursor-not-allowed bg-muted text-muted-foreground'
                        }`}
                    >
                        <PlayCircle className="h-5 w-5" />
                        {t.briefStart}
                    </button>
                </div>
            </div>
        </motion.section>
    );
}

export function localMaterialStatusHint(analysis: ReturnType<typeof analyzeLocalMaterial>, isZh: boolean): string {
    if (analysis.status === 'ready') return '';
    if (analysis.reason === 'material-not-english') {
        return isZh
            ? '本地任务需要英文材料;请粘贴一段英文课文。'
            : 'Local quests need English learning material. Paste an English passage to continue.';
    }
    if (analysis.reason === 'too-few-targets') {
        return isZh
            ? '这段文字里可练习的目标还不够;请再补充几个不同的句子。'
            : 'Not enough learning targets were found. Add a few more varied sentences.';
    }
    return isZh
        ? '再多粘贴几句完整的英文(约三四句以上),就能从这份材料直接开始本地任务。'
        : 'Paste a few more full English sentences to unlock a local quest from this material.';
}
