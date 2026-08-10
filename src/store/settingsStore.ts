
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    AIProvider,
    getDefaultModelForProvider,
    isModelAvailableForProvider
} from '@/lib/ai/modelOptions';

export type Theme = 'light' | 'dark';
export type Language = 'en' | 'zh';

interface SettingsState {
    apiKey: string;
    apiProvider: AIProvider;
    model: string;
    language: Language;
    theme: Theme;
    soundEnabled: boolean;
    ttsEnabled: boolean;
    isSettingsOpen: boolean;
    setApiKey: (key: string) => void;
    setApiProvider: (provider: AIProvider) => void;
    setModel: (model: string) => void;
    setLanguage: (lang: Language) => void;
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

export function detectPreferredLanguage(): Language {
    if (typeof navigator === 'undefined') return 'en';

    const browserLanguages = [
        ...(Array.isArray(navigator.languages) ? navigator.languages : []),
        navigator.language
    ].filter(Boolean);

    return browserLanguages.some((locale) => locale.toLowerCase().startsWith('zh'))
        ? 'zh'
        : 'en';
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            apiKey: '',
            apiProvider: 'deepseek',
            model: 'deepseek-v4-flash',
            language: detectPreferredLanguage(),
            theme: 'light',
            soundEnabled: true,
            ttsEnabled: false,
            isSettingsOpen: false,
            setApiKey: (apiKey) => set({ apiKey }),
            setApiProvider: (apiProvider) => set((state) => ({
                apiProvider,
                apiKey: apiProvider === state.apiProvider ? state.apiKey : '',
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
                const apiProvider = state.apiProvider || 'deepseek';

                return {
                    apiKey: state.apiKey || '',
                    apiProvider,
                    model: state.model && isModelAvailableForProvider(apiProvider, state.model)
                        ? state.model
                        : getDefaultModelForProvider(apiProvider),
                    language: state.language || detectPreferredLanguage(),
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
