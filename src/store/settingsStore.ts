
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    AIProvider,
    getDefaultModelForProvider,
    isModelAvailableForProvider
} from '@/lib/ai/modelOptions';

export type Theme = 'light' | 'dark';

interface SettingsState {
    apiKey: string;
    apiProvider: AIProvider;
    model: string;
    language: 'en' | 'zh';
    theme: Theme;
    soundEnabled: boolean;
    ttsEnabled: boolean;
    isSettingsOpen: boolean;
    setApiKey: (key: string) => void;
    setApiProvider: (provider: AIProvider) => void;
    setModel: (model: string) => void;
    setLanguage: (lang: 'en' | 'zh') => void;
    setTheme: (theme: Theme) => void;
    setSoundEnabled: (enabled: boolean) => void;
    setTtsEnabled: (enabled: boolean) => void;
    setSettingsOpen: (isOpen: boolean) => void;
}

type PersistedSettingsState = Pick<
    SettingsState,
    'apiKey' | 'apiProvider' | 'model' | 'language' | 'theme' | 'soundEnabled' | 'ttsEnabled'
>;

// Apply theme to document
function applyTheme(theme: Theme) {
    if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            apiKey: '',
            apiProvider: 'deepseek',
            model: 'deepseek-v4-flash',
            language: 'en',
            theme: 'light',
            soundEnabled: true,
            ttsEnabled: false,
            isSettingsOpen: false,
            setApiKey: (apiKey) => set({ apiKey }),
            setApiProvider: (apiProvider) => set((state) => ({
                apiProvider,
                model: isModelAvailableForProvider(apiProvider, state.model)
                    ? state.model
                    : getDefaultModelForProvider(apiProvider)
            })),
            setModel: (model) => set({ model }),
            setLanguage: (language) => set({ language }),
            setTheme: (theme) => {
                applyTheme(theme);
                set({ theme });
            },
            setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
            setTtsEnabled: (ttsEnabled) => set({ ttsEnabled }),
            setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
        }),
        {
            name: 'word-quest-settings',
            version: 1,
            migrate: (persistedState): PersistedSettingsState => {
                const state = persistedState as Partial<PersistedSettingsState>;
                const apiProvider = state.apiProvider || 'openrouter';

                return {
                    apiKey: state.apiKey || '',
                    apiProvider,
                    model: state.model && isModelAvailableForProvider(apiProvider, state.model)
                        ? state.model
                        : getDefaultModelForProvider(apiProvider),
                    language: state.language || 'en',
                    theme: state.theme || 'light',
                    soundEnabled: state.soundEnabled ?? true,
                    ttsEnabled: state.ttsEnabled ?? false
                };
            },
            partialize: (state) => ({
                apiKey: state.apiKey,
                apiProvider: state.apiProvider,
                model: state.model,
                language: state.language,
                theme: state.theme,
                soundEnabled: state.soundEnabled,
                ttsEnabled: state.ttsEnabled
            }),
            onRehydrateStorage: () => (state) => {
                // Apply saved theme on hydration
                if (state?.theme) {
                    applyTheme(state.theme);
                }
            },
        }
    )
);
