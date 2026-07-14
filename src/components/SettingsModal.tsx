'use client';

import { useSettingsStore } from '@/store/settingsStore';
import { Settings, X, RefreshCw, ToggleLeft, ToggleRight, Volume2, VolumeX, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCallback, useState, useEffect } from 'react';
import { translations } from '@/lib/translations';
import { buildModelOptions, RouterModelOption } from '@/lib/ai/modelOptions';

export function SettingsModal() {
    const { apiKey, setApiKey, apiProvider, setApiProvider, model, setModel, isSettingsOpen, setSettingsOpen, language, setLanguage, theme, setTheme, soundEnabled, setSoundEnabled, ttsEnabled, setTtsEnabled } = useSettingsStore();
    const [availableModels, setAvailableModels] = useState<RouterModelOption[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);
    const [showFreeOnly, setShowFreeOnly] = useState(false);

    const t = translations[language];
    const isOpenRouter = apiProvider === 'openrouter';
    const isFreeModel = isOpenRouter && model.endsWith(':free');
    const apiKeyLabel = apiProvider === 'deepseek'
        ? (language === 'zh' ? 'DeepSeek 官方 API Key' : 'DeepSeek Official API Key')
        : apiProvider === 'openai'
            ? (language === 'zh' ? 'OpenAI API Key（维护者实验）' : 'OpenAI API Key (maintainer experiments)')
            : t.settings.apiKey;
    const apiKeyPlaceholder = apiProvider === 'openrouter' ? 'sk-or-...' : 'sk-...';

    const fetchModels = useCallback(async () => {
        if (!isOpenRouter) return;
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
    }, [isOpenRouter]);

    // Auto-fetch if key exists and we haven't fetched yet
    useEffect(() => {
        if (isSettingsOpen && isOpenRouter && apiKey && availableModels.length === 0) {
            fetchModels();
        }
    }, [isSettingsOpen, isOpenRouter, apiKey, availableModels.length, fetchModels]);

    const displayModels = buildModelOptions({
        provider: apiProvider,
        remoteModels: availableModels,
        freeOnly: showFreeOnly
    });

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
                        className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:p-4"
                        onClick={() => setSettingsOpen(false)}
                    >
                        <div className="flex min-h-full items-start justify-center py-3 sm:items-center sm:py-4">
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="settings-modal-title"
                                className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <div className="flex shrink-0 items-center justify-between border-b border-border/60 p-4 sm:p-6">
                                    <h2 id="settings-modal-title" className="text-2xl font-bold text-primary">{t.settings.title}</h2>
                                    <button
                                        type="button"
                                        onClick={() => setSettingsOpen(false)}
                                        aria-label={language === 'zh' ? '关闭设置' : 'Close settings'}
                                    >
                                        <X className="w-6 h-6 text-muted-foreground hover:text-foreground" />
                                    </button>
                                </div>

                                <div data-testid="settings-modal-body" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
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
                                        {language === 'zh' ? '主题' : 'Theme'}
                                    </label>
                                    <div className="flex gap-2 p-1 bg-secondary/50 rounded-lg border border-input w-fit">
                                        <button
                                            onClick={() => setTheme('light')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${theme === 'light' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            <Sun className="w-4 h-4" />
                                            {language === 'zh' ? '浅色' : 'Light'}
                                        </button>
                                        <button
                                            onClick={() => setTheme('dark')}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${theme === 'dark' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            <Moon className="w-4 h-4" />
                                            {language === 'zh' ? '深色' : 'Dark'}
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
                                        <span className="font-medium">
                                            {language === 'zh' ? (soundEnabled ? '开' : '关') : (soundEnabled ? 'On' : 'Off')}
                                        </span>
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
                                        <span className="font-medium">
                                            {language === 'zh' ? (ttsEnabled ? '开' : '关') : (ttsEnabled ? 'On' : 'Off')}
                                        </span>
                                    </button>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-muted-foreground">
                                        {language === 'zh' ? 'API 服务' : 'API Provider'}
                                    </label>
                                    <div className="flex gap-2 p-1 bg-secondary/50 rounded-lg border border-input w-fit">
                                        <button
                                            onClick={() => setApiProvider('deepseek')}
                                            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${apiProvider === 'deepseek' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            DeepSeek
                                        </button>
                                        <button
                                            onClick={() => setApiProvider('openrouter')}
                                            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${apiProvider === 'openrouter' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            OpenRouter
                                        </button>
                                        <button
                                            onClick={() => setApiProvider('openai')}
                                            className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${apiProvider === 'openai' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                                        >
                                            OpenAI
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium mb-2 text-muted-foreground">
                                        {apiKeyLabel}
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="password"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                            placeholder={apiKeyPlaceholder}
                                            className="flex-1 bg-secondary/50 border border-input rounded-lg p-3 text-foreground focus:ring-2 focus:ring-primary outline-none"
                                        />
                                        {isOpenRouter && (
                                            <button
                                                onClick={fetchModels}
                                                disabled={isLoadingModels || !apiKey}
                                                className="px-4 py-2 bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-lg font-medium transition-colors disabled:opacity-50"
                                            >
                                                {isLoadingModels ? <RefreshCw className="w-4 h-4 animate-spin" /> : t.settings.connect}
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">
                                        {apiProvider === 'deepseek'
                                            ? (language === 'zh'
                                                ? '使用 DeepSeek 官方 OpenAI 兼容接口。'
                                                : 'Uses the official DeepSeek OpenAI-compatible endpoint.')
                                            : apiProvider === 'openai'
                                                ? (language === 'zh'
                                                    ? '通过官方 Responses API 发送；请求设置 store=false。不要输入可识别的学习者资料。'
                                                    : 'Sent through the official Responses API with store=false. Do not enter identifiable learner data.')
                                                : (language === 'zh' ? '输入密钥以加载可用模型。' : 'Enter key to load available models.')}
                                    </p>
                                    <div className="mt-3 text-xs text-muted-foreground bg-secondary/40 border border-secondary/60 rounded-lg p-3">
                                        {apiProvider === 'deepseek'
                                            ? (language === 'zh'
                                                ? '默认使用 deepseek-v4-flash。'
                                                : 'Defaults to deepseek-v4-flash.')
                                            : apiProvider === 'openai'
                                                ? (language === 'zh'
                                                    ? '默认使用 GPT-5.6 Luna；AI 内容必须由教师或监护人审阅。'
                                                    : 'Defaults to GPT-5.6 Luna; AI content requires educator or guardian review.')
                                                : isFreeModel ? t.settings.rateLimitFree : t.settings.rateLimitPaid}
                                    </div>
                                </div>

                                <div>
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="block text-sm font-medium text-muted-foreground">
                                            {t.settings.model}
                                        </label>
                                        {isOpenRouter && (
                                            <button
                                                onClick={() => setShowFreeOnly(!showFreeOnly)}
                                                className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                                            >
                                                {showFreeOnly ? (
                                                    <ToggleRight className="w-4 h-4" />
                                                ) : (
                                                    <ToggleLeft className="w-4 h-4" />
                                                )}
                                                {language === 'zh' ? '仅免费模型' : 'Free Models Only'}
                                            </button>
                                        )}
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
                                                    {m.name || m.id} {m.id.endsWith(':free') ? (language === 'zh' ? '(免费)' : '(Free)') : ''}
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
                                        {apiProvider === 'deepseek'
                                            ? (language === 'zh'
                                                ? 'DeepSeek 官方模型，直接请求 api.deepseek.com。'
                                                : 'Official DeepSeek models, sent directly to api.deepseek.com.')
                                            : apiProvider === 'openai'
                                                ? (language === 'zh'
                                                    ? 'OpenAI 官方模型，直接请求 api.openai.com。'
                                                    : 'Official OpenAI models, sent directly to api.openai.com.')
                                                : showFreeOnly
                                                    ? (language === 'zh' ? '当前仅显示免费模型（以 :free 结尾）。' : 'Showing only free models (ending in :free).')
                                                    : (language === 'zh' ? '选择用于生成任务的 AI 模型。' : 'Select a neural model for mission generation.')}
                                    </p>
                                </div>
                                </div>

                                <div data-testid="settings-modal-footer" className="flex shrink-0 justify-end border-t border-border/60 p-4 sm:px-6">
                                    <button
                                        onClick={() => setSettingsOpen(false)}
                                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
                                    >
                                        {t.settings.save}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
