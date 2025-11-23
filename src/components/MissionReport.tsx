'use client';

import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { OpenRouterClient } from '@/lib/ai/openrouter';
import { REPORT_SYSTEM_PROMPT, generateReportPrompt } from '@/lib/ai/prompts';
import { motion } from 'framer-motion';
import { Trophy, XCircle, RotateCcw, CheckCircle2, AlertTriangle, Sparkles, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

import { translations } from '@/lib/translations';

export function MissionReport() {
    const { score, questions, resetGame, isVictory, userAnswers } = useGameStore();
    const { apiKey, model, language } = useSettingsStore();
    const t = translations[language];
    const [analysis, setAnalysis] = useState<{ mvp_skill: string; weakness: string; advice: string; mistake_analysis?: string } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleAnalyze = async () => {
        if (!apiKey) return;
        setIsLoading(true);
        try {
            const client = new OpenRouterClient(apiKey, model);
            const prompt = generateReportPrompt(score, questions.length, userAnswers);
            const jsonStr = await client.generate(prompt, REPORT_SYSTEM_PROMPT);
            const cleanJson = jsonStr.replace(/```json\n?|\n?```/g, '').trim();
            setAnalysis(JSON.parse(cleanJson));
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    // Simple stats calculation
    // Note: In a real app we might want to track exactly which questions were answered correctly/incorrectly in the store
    // For now, we can infer some data or just show the score. 
    // To make it better, let's assume we want to show a list of all questions and their status?
    // The current store doesn't track "user answers" history for the session explicitly in a list, 
    // but we can add that later. For now, let's show the Score and a summary.

    return (
        <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-2xl mx-auto p-6"
        >
            <div className="bg-card border-2 border-primary/20 rounded-3xl p-8 shadow-2xl text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />

                <div className="relative z-10">
                    <motion.div
                        initial={{ y: -20 }}
                        animate={{ y: 0 }}
                        className="mb-6 flex justify-center"
                    >
                        {isVictory ? (
                            <div className="p-6 bg-yellow-500/20 rounded-full">
                                <Trophy className="w-20 h-20 text-yellow-500 animate-bounce" />
                            </div>
                        ) : (
                            <div className="p-6 bg-destructive/20 rounded-full">
                                <XCircle className="w-20 h-20 text-destructive" />
                            </div>
                        )}
                    </motion.div>

                    <h2 className="text-4xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400">
                        {isVictory ? t.report.missionAccomplished : t.report.missionFailed}
                    </h2>

                    <p className="text-xl text-muted-foreground mb-8">
                        {isVictory ? t.report.victoryMessage : t.report.defeatMessage}
                    </p>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                        <div className="bg-secondary/50 p-4 rounded-2xl">
                            <div className="text-sm text-muted-foreground uppercase tracking-wider font-bold mb-1">{t.report.finalScore}</div>
                            <div className="text-3xl font-mono font-bold text-primary">{score}</div>
                        </div>
                        <div className="bg-secondary/50 p-4 rounded-2xl">
                            <div className="text-sm text-muted-foreground uppercase tracking-wider font-bold mb-1">{t.report.totalTargets}</div>
                            <div className="text-3xl font-mono font-bold text-foreground">{questions.length}</div>
                        </div>
                    </div>

                    {/* AI Analysis Section */}
                    {analysis ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-primary/10 border border-primary/20 rounded-xl p-6 mb-8 text-left"
                        >
                            <h3 className="flex items-center gap-2 font-bold text-primary mb-4">
                                <FileText className="w-5 h-5" /> {t.report.missionDebrief}
                            </h3>
                            <div className="space-y-3 text-sm">
                                <div className="flex gap-2">
                                    <span className="font-bold text-green-500 shrink-0">{t.report.mvpSkill}</span>
                                    <span>{analysis.mvp_skill}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="font-bold text-destructive shrink-0">{t.report.weakness}</span>
                                    <span>{analysis.weakness}</span>
                                </div>
                                <div className="flex gap-2">
                                    <span className="italic">"{analysis.advice}"</span>
                                </div>
                                {analysis.mistake_analysis && (
                                    <div className="mt-4 pt-4 border-t border-primary/20">
                                        <div className="font-bold text-primary mb-1">{t.report.tacticalAnalysis}</div>
                                        <p className="text-muted-foreground">{analysis.mistake_analysis}</p>
                                    </div>
                                )}
                            </div>

                        </motion.div>
                    ) : (
                        <button
                            onClick={handleAnalyze}
                            disabled={isLoading}
                            className="w-full mb-4 py-3 bg-secondary/50 hover:bg-secondary text-secondary-foreground rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4" />
                            )}
                            {t.report.generateAnalysis}
                        </button>
                    )}

                    <button
                        onClick={resetGame}
                        className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
                    >
                        <RotateCcw className="w-5 h-5" />
                        {t.report.initializeNewMission}
                    </button>
                </div>
            </div>
        </motion.div >
    );
}
