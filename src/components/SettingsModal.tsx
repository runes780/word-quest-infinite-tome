'use client';

import { useSettingsStore } from '@/store/settingsStore';
import { Settings, X, RefreshCw, ToggleLeft, ToggleRight, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { translations } from '@/lib/translations';

interface RouterModel {
    id: string;
    name: string;
    pricing: {
        prompt: string;
        completion: string;
    };
}

export function SettingsModal() {
    const { apiKey, setApiKey, model, setModel, isSettingsOpen, setSettingsOpen, language, setLanguage, soundEnabled, setSoundEnabled, ttsEnabled, setTtsEnabled } = useSettingsStore();
    const [availableModels, setAvailableModels] = useState<RouterModel[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [showFreeOnly, setShowFreeOnly] = useState(false);

    const t = translations[language];
    const isFreeModel = model.endsWith(':free');

    const fetchModels = async () => {
        setIsLoadingModels(true);
        try {
            // Although public, we fetch after key input to simulate "connecting"
            const response = await fetch('https://openrouter.ai/api/v1/models');
            if (response.ok) {
                const data = await response.json();
                setAvailableModels(data.data);
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
        } finally {
            setIsLoadingModels(false);
        }
    };

    // Auto-fetch if key exists and we haven't fetched yet
    useEffect(() => {
        if (isSettingsOpen && apiKey && availableModels.length === 0) {
            fetchModels();
        }
    }, [isSettingsOpen, apiKey, availableModels.length]);

    const filteredModels = availableModels.filter(m =>
        showFreeOnly ? m.id.endsWith(':free') : true
    );

    // Ensure selected model is in the list or add it temporarily if not fetched yet
    const displayModels = filteredModels.length > 0 ? filteredModels : [
        { id: 'google/gemini-flash-1.5', name: 'Gemini 1.5 Flash' },
        { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
        { id: 'meta-llama/llama-3-8b-instruct:free', name: 'Llama 3 8B (Free)' },
    ];

    return (
        <>
            <button
                onClick={() => setSettingsOpen(true)}
                className="fixed top-4 right-4 p-2 bg-secondary/50 backdrop-blur-md rounded-full hover:bg-secondary transition-colors z-50"
            >
                <Settings className="w-6 h-6 text-primary-foreground" />
            </button>

            <AnimatePresence>
                {isSettingsOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
                        onClick={() => setSettingsOpen(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-card border border-border p-6 rounded-2xl w-full max-w-md m-4 shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-primary">{t.settings.title}</h2>
                                <button onClick={() => setSettingsOpen(false)}>
                                    <X className="w-6 h-6 text-muted-foreground hover:text-foreground" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-muted-foreground">
                                        {t.settings.language}
                                    </label>
                                    <div className="flex gap-2 p-1 bg-secondary/50 rounded-lg border border-input w-fit">
                                        <button
                                            onClick={() => setLanguage('en')}
                                            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${language === 'en' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            English
                                        </button>
                                        <button
                                            onClick={() => setLanguage('zh')}
                                            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${language === 'zh' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            中文
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-muted-foreground">
                                        {t.settings.sound}
                                    </label>
                                    <button
                                        onClick={() => setSoundEnabled(!soundEnabled)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${soundEnabled ? 'bg-primary/20 border-primary text-primary' : 'bg-secondary/50 border-input text-muted-foreground'}`}
                                    >
                                        {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                                        <span className="font-medium">{soundEnabled ? 'On' : 'Off'}</span>
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-muted-foreground">
                                        {t.settings.narration}
                                    </label>
                                    <button
                                        onClick={() => setTtsEnabled(!ttsEnabled)}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${ttsEnabled ? 'bg-primary/20 border-primary text-primary' : 'bg-secondary/50 border-input text-muted-foreground'}`}
                                    >
                                        {ttsEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                                        <span className="font-medium">{ttsEnabled ? 'On' : 'Off'}</span>
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-muted-foreground">
                                        {t.settings.apiKey}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder="sk-or-..."
                                            className="flex-1 bg-secondary/50 border border-input rounded-lg p-3 text-foreground focus:ring-2 focus:ring-primary outline-none"
                                        />
                                        <button
                                            onClick={fetchModels}
                                            disabled={isLoadingModels || !apiKey}
                                            className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg font-medium transition-colors disabled:opacity-50"
                                        >
                                            {isLoadingModels ? <RefreshCw className="w-4 h-4 animate-spin" /> : t.settings.connect}
                                        </button>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Enter key to load available models.
                                    </p>
                                    <div className="mt-3 text-xs text-muted-foreground bg-secondary/40 border border-secondary/60 rounded-lg p-3">
                                        {isFreeModel ? t.settings.rateLimitFree : t.settings.rateLimitPaid}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-medium text-muted-foreground">
                                            {t.settings.model}
                                        </label>
                                        <button
                                            onClick={() => setShowFreeOnly(!showFreeOnly)}
                                            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                                        >
                                            {showFreeOnly ? (
                                                <ToggleRight className="w-4 h-4" />
                                            ) : (
                                                <ToggleLeft className="w-4 h-4" />
                                            )}
                                            Free Models Only
                                        </button>
                                    </div>
                                    <div className="relative">
                                        <select
                                            value={model}
                                            onChange={(e) => setModel(e.target.value)}
                                            disabled={isLoadingModels}
                                            className="w-full bg-secondary/50 border border-input rounded-lg p-3 text-foreground focus:ring-2 focus:ring-primary outline-none appearance-none"
                                        >
                                            {displayModels.map((m) => (
                                                <option key={m.id} value={m.id}>
                                                    {m.name || m.id} {m.id.endsWith(':free') ? '(Free)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-3 pointer-events-none">
                                            {isLoadingModels ? (
                                                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <RefreshCw className="w-4 h-4 text-muted-foreground opacity-50" />
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {showFreeOnly
                                            ? "Showing only free models (ending in :free)"
                                            : "Select a neural model for mission generation."}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end">
                                <button
                                    onClick={() => setSettingsOpen(false)}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                                >
                                    {t.settings.save}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
