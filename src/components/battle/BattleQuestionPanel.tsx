'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Shield, Sparkles, Sword, HelpCircle, Lightbulb, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TypingQuestion } from '@/components/TypingQuestion';
import { FillBlankQuestion } from '@/components/FillBlankQuestion';
import { VoiceInput } from '@/components/VoiceInput';
import type { Monster } from '@/store/gameStore';
import type { translations } from '@/lib/translations';
import { objectiveTitle, supportLevelLabel } from '@/lib/data/learningObjectives';
import type { LearningEventSelfConfidence } from '@/db/db';
import { calibrationSignalFor, shouldCollectSelfConfidence } from '@/lib/data/metacognitiveCalibration';
import type { LearningProgressReward, LearningProgressRewardKind } from '@/lib/data/learningProgressRewards';
import {
    scaffoldDecisionMessage,
    type AdaptiveScaffoldDecision
} from '@/lib/data/adaptiveScaffolding';

interface BattleQuestionPanelProps {
    currentQuestion: Monster;
    t: (typeof translations)['en'];
    language: string;
    ttsEnabled: boolean;
    showHint: boolean;
    showResult: boolean;
    selectedOption: number | null;
    isCorrect: boolean;
    resultMessage: string;
    currentMonsterHp: number;
    bossShieldProgress: number;
    bossComboThreshold: number;
    clarityEffect: { questionId: number; hiddenOptions: number[] } | null;
    selfConfidence?: LearningEventSelfConfidence;
    progressReward: LearningProgressReward | null;
    scaffoldDecision?: AdaptiveScaffoldDecision | null;
    onToggleHint: () => void;
    onConfidenceChange: (confidence: LearningEventSelfConfidence) => void;
    onChoiceSelect: (index: number) => void;
    onTypingAnswer: (correct: boolean, input: string) => void;
    onFillBlankAnswer: (correct: boolean, input: string) => void;
    onVoiceAnswer: (correct: boolean, spokenText: string) => void;
    onSpeakQuestion: () => void;
    onSpeakExplanation: () => void;
    onOpenMentor: () => void;
    onNext: () => void;
}

export function BattleQuestionPanel({
    currentQuestion,
    t,
    language,
    ttsEnabled,
    showHint,
    showResult,
    selectedOption,
    isCorrect,
    resultMessage,
    currentMonsterHp,
    bossShieldProgress,
    bossComboThreshold,
    clarityEffect,
    selfConfidence,
    progressReward,
    scaffoldDecision = null,
    onToggleHint,
    onConfidenceChange,
    onChoiceSelect,
    onTypingAnswer,
    onFillBlankAnswer,
    onVoiceAnswer,
    onSpeakQuestion,
    onSpeakExplanation,
    onOpenMentor,
    onNext
}: BattleQuestionPanelProps) {
    const feedbackRef = useRef<HTMLDivElement | null>(null);
    const uiLanguage = language === 'zh' ? 'zh' : 'en';
    const bossGateLabel = currentQuestion.isBoss && currentQuestion.bossStage && currentQuestion.bossTotalStages
        ? (uiLanguage === 'zh'
            ? `首领关卡 ${currentQuestion.bossStage}/${currentQuestion.bossTotalStages}`
            : `Boss Gate ${currentQuestion.bossStage}/${currentQuestion.bossTotalStages}`)
        : null;
    const objectiveLabel = objectiveTitle(currentQuestion.learningObjectiveId, uiLanguage);
    const supportLabel = typeof currentQuestion.supportLevel === 'number'
        ? supportLevelLabel(currentQuestion.supportLevel, uiLanguage)
        : null;
    const transferLabel = currentQuestion.attemptKind === 'transfer'
        ? (uiLanguage === 'zh' ? '迁移检查' : 'Transfer Check')
        : null;
    const repairLabel = currentQuestion.isImmediateRepair
        ? (uiLanguage === 'zh' ? '补救反击' : 'Counter-Attack')
        : null;
    const collectSelfConfidence = shouldCollectSelfConfidence(
        currentQuestion.attemptKind,
        currentQuestion.questionMode || 'choice'
    );
    const calibrationSignal = showResult
        ? calibrationSignalFor(selfConfidence, isCorrect)
        : null;
    const confidenceOptions: Array<{ value: LearningEventSelfConfidence; label: string }> = [
        { value: 'low', label: t.battle.confidenceLow },
        { value: 'medium', label: t.battle.confidenceMedium },
        { value: 'high', label: t.battle.confidenceHigh }
    ];
    const progressRewardLabels: Record<LearningProgressRewardKind, string> = {
        'supported-practice': t.battle.rewardSupportedPractice,
        'independent-success': t.battle.rewardIndependentSuccess,
        'repair-success': t.battle.rewardRepairSuccess,
        'delayed-recall': t.battle.rewardDelayedRecall,
        'transfer-success': t.battle.rewardTransferSuccess
    };

    useEffect(() => {
        if (!showResult || typeof feedbackRef.current?.scrollIntoView !== 'function') return;
        feedbackRef.current.scrollIntoView({ behavior: 'auto', block: 'nearest' });
    }, [currentQuestion.id, showResult]);

    return (
        <div className="flex flex-col justify-center space-y-6">
            <motion.div
                key={currentQuestion.id}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                className="bg-card/50 backdrop-blur-sm border-2 border-primary/10 rounded-3xl p-6 md:p-8 shadow-xl"
            >
                <div className="flex items-center gap-3 mb-4">
                    <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                        {t.battle.missionObjective}
                    </span>
                    <div className="ml-auto flex items-center gap-2">
                        {ttsEnabled && (
                            <button
                                onClick={onSpeakQuestion}
                                className="min-h-11 rounded-lg px-2 text-xs text-primary underline hover:bg-primary/10 hover:text-primary/80"
                            >
                                {t.battle.readQuestion}
                            </button>
                        )}
                        {currentQuestion.hint && !showResult && (
                            <button
                                onClick={onToggleHint}
                                className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
                            >
                                <Lightbulb className="w-3 h-3" />
                                {showHint ? t.battle.hideHint : t.battle.hint}
                            </button>
                        )}
                    </div>
                </div>

                <div className="mb-4 flex flex-wrap items-center gap-2">
                    {bossGateLabel && (
                        <span className="rounded-full border border-yellow-500/40 bg-yellow-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-yellow-600 dark:text-yellow-300">
                            {bossGateLabel}
                        </span>
                    )}
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                        {objectiveLabel}
                    </span>
                    {supportLabel && (
                        <span className="rounded-full border border-border bg-secondary/70 px-3 py-1 text-xs font-bold text-muted-foreground">
                            {supportLabel}
                        </span>
                    )}
                    {transferLabel && (
                        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-green-600 dark:text-green-300">
                            {transferLabel}
                        </span>
                    )}
                    {repairLabel && (
                        <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-orange-600 dark:text-orange-300">
                            {repairLabel}
                        </span>
                    )}
                </div>

                <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4 leading-tight">
                    {currentQuestion.question}
                </h3>

                {collectSelfConfidence && !showResult && (
                    <fieldset className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                        <legend className="px-1 text-xs font-black text-foreground">
                            {t.battle.confidencePrompt}
                        </legend>
                        <div className="mt-1 flex flex-wrap gap-2">
                            {confidenceOptions.map((option) => (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => onConfidenceChange(option.value)}
                                    aria-pressed={selfConfidence === option.value}
                                    className={cn(
                                        'min-h-11 flex-1 rounded-xl border px-3 py-2 text-sm font-bold sm:flex-none',
                                        selfConfidence === option.value
                                            ? 'border-primary bg-primary text-primary-foreground'
                                            : 'border-border bg-background/70 text-muted-foreground hover:border-primary hover:text-primary'
                                    )}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                            {t.battle.confidencePurpose}
                        </p>
                    </fieldset>
                )}

                <AnimatePresence>
                    {showHint && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="bg-yellow-500/10 border-l-4 border-yellow-500 pl-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 italic mb-4">
                                &ldquo;{currentQuestion.hint}&rdquo;
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {(!currentQuestion.questionMode || currentQuestion.questionMode === 'choice') ? (
                    <div className="grid grid-cols-1 gap-3">
                        {currentQuestion.options.map((option, index) => {
                            const clarityDisabled = !!(clarityEffect && clarityEffect.questionId === currentQuestion.id && clarityEffect.hiddenOptions.includes(index));
                            return (
                                <motion.button
                                    key={index}
                                    initial={{ x: 20, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{ delay: index * 0.1 }}
                                    onClick={() => onChoiceSelect(index)}
                                    disabled={showResult || clarityDisabled}
                                    className={cn(
                                        "w-full p-4 rounded-xl border-2 text-left font-medium transition-all relative overflow-hidden group hover:shadow-md hover:scale-[1.02]",
                                        clarityDisabled && "opacity-40 pointer-events-none grayscale",
                                        selectedOption === index
                                            ? isCorrect
                                                ? "border-green-500 bg-green-500/10 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                                                : "border-destructive bg-destructive/10 text-destructive shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                                            : "border-border bg-card hover:border-primary hover:bg-primary/5"
                                    )}
                                >
                                    <div className="flex items-center justify-between relative z-10">
                                        <span className="text-lg">{option}</span>
                                        {selectedOption === index && (
                                            isCorrect ? <Sword className="w-5 h-5 animate-bounce" /> : <Shield className="w-5 h-5 animate-pulse" />
                                        )}
                                    </div>
                                </motion.button>
                            );
                        })}
                    </div>
                ) : currentQuestion.questionMode === 'typing' ? (
                    <TypingQuestion
                        question={currentQuestion}
                        onAnswer={onTypingAnswer}
                        disabled={showResult}
                    />
                ) : currentQuestion.questionMode === 'fill-blank' ? (
                    <FillBlankQuestion
                        question={currentQuestion}
                        onAnswer={onFillBlankAnswer}
                        disabled={showResult}
                    />
                ) : null}

                {clarityEffect && clarityEffect.questionId === currentQuestion.id && (
                    <p className="text-xs text-blue-400 mt-2">{t.battle.clarityActive}</p>
                )}

                {(!currentQuestion.questionMode || currentQuestion.questionMode === 'choice') && !showResult && (
                    <div className="mt-6 pt-6 border-t border-border/50">
                        <p className="text-xs text-muted-foreground text-center mb-4">
                            {language === 'zh' ? '或者用语音回答' : 'Or answer with voice'}
                        </p>
                        <VoiceInput
                            correctAnswer={currentQuestion.options[currentQuestion.correct_index]}
                            options={currentQuestion.options}
                            disabled={showResult}
                            onAnswer={onVoiceAnswer}
                        />
                    </div>
                )}
            </motion.div>

            <AnimatePresence mode="wait">
                {showResult && (
                    <motion.div
                        ref={feedbackRef}
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        className={cn(
                            "mb-24 scroll-mb-28 rounded-2xl border-2 p-6 shadow-lg backdrop-blur-md sm:mb-0 sm:scroll-mb-0",
                            isCorrect
                                ? "bg-green-500/10 border-green-500/30 shadow-green-500/10"
                                : "bg-destructive/10 border-destructive/30 shadow-destructive/10"
                        )}
                        role="status"
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                                <h4 className={cn("text-xl font-black mb-2 uppercase tracking-wide", isCorrect ? "text-green-500" : "text-destructive")}>
                                    {isCorrect ? `✨ ${t.battle.victory} ` : `💥 ${t.battle.defeat} `}
                                </h4>
                                <div className="flex items-start gap-2">
                                    <p className="text-sm font-medium opacity-90 leading-relaxed text-balance flex-1">{resultMessage}</p>
                                    {ttsEnabled && (
                                        <button
                                            onClick={onSpeakExplanation}
                                            className="min-h-11 rounded-lg px-2 text-xs text-primary underline hover:bg-primary/10"
                                        >
                                            {t.battle.readExplanation}
                                        </button>
                                    )}
                                </div>
                                {progressReward && (
                                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-foreground">
                                        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-black uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                                {progressReward.counted
                                                    ? t.battle.progressRewardCue
                                                    : t.battle.rewardProtected}
                                            </p>
                                            <p className="mt-1 leading-relaxed">
                                                {progressReward.counted
                                                    ? `${progressRewardLabels[progressReward.kind]} · +${progressReward.xp} XP · +${progressReward.gold} Gold`
                                                    : t.battle.rewardProtectedDetail}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {calibrationSignal && (
                                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-blue-500/25 bg-blue-500/10 p-3 text-sm text-foreground">
                                        <Brain className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wide text-blue-700 dark:text-blue-300">
                                                {t.battle.calibrationCue}
                                            </p>
                                            <p className="mt-1 leading-relaxed">
                                                {calibrationSignal === 'high-confidence-error'
                                                    ? t.battle.highConfidenceError
                                                    : t.battle.lowConfidenceCorrect}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {scaffoldDecision && scaffoldDecision.reason !== 'collect-more-evidence' && (
                                    <div className="mt-3 flex items-start gap-2 rounded-xl border border-violet-500/25 bg-violet-500/10 p-3 text-sm text-foreground">
                                        <Layers className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300" />
                                        <div>
                                            <p className="text-xs font-black uppercase tracking-wide text-violet-700 dark:text-violet-300">
                                                {uiLanguage === 'zh' ? '下一步支架' : 'Next Support Step'}
                                            </p>
                                            <p className="mt-1 leading-relaxed">
                                                {scaffoldDecisionMessage(scaffoldDecision, uiLanguage)}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {currentQuestion.isBoss && currentMonsterHp > 0 && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {t.battle.shieldProgress}: {bossShieldProgress}/{bossComboThreshold}
                                    </p>
                                )}
                                {clarityEffect && clarityEffect.questionId === currentQuestion.id && (
                                    <p className="text-xs text-blue-400 mt-2">{t.battle.clarityActive}</p>
                                )}
                            </div>
                            <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto">
                                {!isCorrect && (
                                    <button
                                        onClick={onOpenMentor}
                                        className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background/50 px-4 py-2 text-sm font-bold text-foreground transition-colors hover:bg-background/80"
                                    >
                                        <HelpCircle className="w-4 h-4" />
                                        {t.battle.analyze}
                                    </button>
                                )}
                                <button
                                    onClick={onNext}
                                    className="min-h-11 w-full rounded-lg bg-primary px-6 py-2 font-black uppercase tracking-wide text-primary-foreground shadow-lg transition-all hover:bg-primary/90 hover:shadow-primary/25 sm:w-auto"
                                >
                                    {t.battle.nextLevel}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
