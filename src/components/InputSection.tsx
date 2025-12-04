
'use client';

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { OpenRouterClient } from '@/lib/ai/openrouter';
import { translations } from '@/lib/translations';
import { LEVEL_GENERATOR_SYSTEM_PROMPT, generateLevelPrompt } from '@/lib/ai/prompts';
import { motion } from 'framer-motion';
import { Sparkles, BookOpen, AlertCircle, Settings } from 'lucide-react';
import { SAMPLE_LEVELS, SampleLevel } from '@/lib/sampleLevels';

export function InputSection() {
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [fallbackLevel, setFallbackLevel] = useState<SampleLevel | null>(null);
    const { startGame } = useGameStore();
    const { apiKey, model, setSettingsOpen, language } = useSettingsStore();
    const t = translations[language];

    const handleGenerate = async () => {
        if (!input.trim()) return;
        if (!apiKey) {
            setSettingsOpen(true);
            return;
        }

        setIsLoading(true);
        setError('');
        setFallbackLevel(null);

        try {
            const client = new OpenRouterClient(apiKey, model);
            const prompt = generateLevelPrompt(input);
            const jsonStr = await client.generate(prompt, LEVEL_GENERATOR_SYSTEM_PROMPT);

            // Clean up JSON string if it contains markdown code blocks
            const cleanJson = jsonStr.replace(/```json\n?|\n?```/g, '').trim();

            const data = JSON.parse(cleanJson);

            if (!data.monsters || !Array.isArray(data.monsters)) {
                throw new Error('Invalid data format received from AI');
            }

            startGame(data.monsters, input);
            setFallbackLevel(null);
        } catch (err) {
            console.error(err);
            const isTimeout = err instanceof Error && err.message.includes('timed out');
            setError(isTimeout ? t.input.timeout : t.input.error);
            const sample = SAMPLE_LEVELS[Math.floor(Math.random() * SAMPLE_LEVELS.length)];
            setFallbackLevel(sample);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUseSample = () => {
        if (!fallbackLevel) return;
        startGame(
            fallbackLevel.monsters,
            `${fallbackLevel.title}\n${fallbackLevel.context}`
        );
        setFallbackLevel(null);
        setError('');
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-6">
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="bg-card/50 backdrop-blur-sm border border-border rounded-3xl p-8 shadow-2xl"
            >
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-primary/20 rounded-xl">
                        <BookOpen className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-foreground">{t.input.title}</h2>
                        <p className="text-muted-foreground">{t.input.subtitle}</p>
                    </div>
                </div>

                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={t.input.placeholder}
                    className="w-full h-48 bg-secondary/50 border border-input rounded-xl p-4 text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-primary outline-none resize-none mb-6 transition-all"
                />

                {error && (
                    <div className="space-y-3 mb-4">
                        <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg">
                            <AlertCircle className="w-5 h-5" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                        {fallbackLevel && (
                            <div className="flex flex-col gap-3 bg-secondary/40 border border-border rounded-xl p-4">
                                <div>
                                    <p className="text-sm font-bold">{t.input.fallbackTitle}</p>
                                    <p className="text-xs text-muted-foreground">{t.input.fallbackSubtitle}</p>
                                </div>
                                <button
                                    onClick={handleUseSample}
                                    className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition-colors"
                                >
                                    {t.input.useSample}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {!apiKey ? (
                    <button
                        onClick={() => setSettingsOpen(true)}
                        className="w-full py-4 bg-secondary text-secondary-foreground rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-secondary/80 transition-all"
                    >
                        <Settings className="w-5 h-5" />
                        {t.input.configureKey}
                    </button>
                ) : (
                    <button
                        onClick={handleGenerate}
                        disabled={isLoading || !input.trim()}
                        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all
              ${isLoading || !input.trim()
                                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                                : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/25'
                            }`}
                    >
                        {isLoading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                {t.input.analyzing}
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5" />
                                {t.input.initialize}
                            </>
                        )}
                    </button>
                )}
                {(isLoading || model.endsWith(':free')) && (
                    <p className="text-xs text-muted-foreground mt-3 text-center">
                        {t.input.throttled}
                    </p>
                )}
            </motion.div>
        </div>
    );
}
