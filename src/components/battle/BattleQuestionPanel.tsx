'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Sword, HelpCircle, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TypingQuestion } from '@/components/TypingQuestion';
import { FillBlankQuestion } from '@/components/FillBlankQuestion';
import { VoiceInput } from '@/components/VoiceInput';
import type { Monster } from '@/store/gameStore';
import type { translations } from '@/lib/translations';

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
    onToggleHint: () => void;
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
    onToggleHint,
    onChoiceSelect,
    onTypingAnswer,
    onFillBlankAnswer,
    onVoiceAnswer,
    onSpeakQuestion,
    onSpeakExplanation,
    onOpenMentor,
    onNext
}: BattleQuestionPanelProps) {
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
                                className="text-xs text-primary hover:text-primary/80 underline"
                            >
                                {t.battle.readQuestion}
                            </button>
                        )}
                        {currentQuestion.hint && !showResult && (
                            <button
                                onClick={onToggleHint}
                                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                            >
                                <Lightbulb className="w-3 h-3" />
                                {showHint ? t.battle.hideHint : t.battle.hint}
                            </button>
                        )}
                    </div>
                </div>

                <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4 leading-tight">
                    {currentQuestion.question}
                </h3>

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
                        initial={{ y: 20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -20, opacity: 0 }}
                        className={cn(
                            "p-6 rounded-2xl border-2 shadow-lg backdrop-blur-md",
                            isCorrect
                                ? "bg-green-500/10 border-green-500/30 shadow-green-500/10"
                                : "bg-destructive/10 border-destructive/30 shadow-destructive/10"
                        )}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h4 className={cn("text-xl font-black mb-2 uppercase tracking-wide", isCorrect ? "text-green-500" : "text-destructive")}>
                                    {isCorrect ? `✨ ${t.battle.victory} ` : `💥 ${t.battle.defeat} `}
                                </h4>
                                <div className="flex items-start gap-2">
                                    <p className="text-sm font-medium opacity-90 leading-relaxed text-balance flex-1">{resultMessage}</p>
                                    {ttsEnabled && (
                                        <button
                                            onClick={onSpeakExplanation}
                                            className="text-xs text-primary underline"
                                        >
                                            {t.battle.readExplanation}
                                        </button>
                                    )}
                                </div>
                                {currentQuestion.isBoss && currentMonsterHp > 0 && (
                                    <p className="text-xs text-muted-foreground mt-2">
                                        {t.battle.shieldProgress}: {bossShieldProgress}/{bossComboThreshold}
                                    </p>
                                )}
                                {clarityEffect && clarityEffect.questionId === currentQuestion.id && (
                                    <p className="text-xs text-blue-400 mt-2">{t.battle.clarityActive}</p>
                                )}
                            </div>
                            <div className="flex flex-col gap-2 shrink-0">
                                {!isCorrect && (
                                    <button
                                        onClick={onOpenMentor}
                                        className="px-4 py-2 bg-background/50 hover:bg-background/80 text-foreground rounded-lg border border-border transition-colors flex items-center justify-center gap-2 text-sm font-bold"
                                    >
                                        <HelpCircle className="w-4 h-4" />
                                        {t.battle.analyze}
                                    </button>
                                )}
                                <button
                                    onClick={onNext}
                                    className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25 font-black uppercase tracking-wide"
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
