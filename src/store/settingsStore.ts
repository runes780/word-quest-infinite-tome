
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'light' | 'dark';

interface SettingsState {
    apiKey: string;
    model: string;
    language: 'en' | 'zh';
    theme: Theme;
    soundEnabled: boolean;
    ttsEnabled: boolean;
    isSettingsOpen: boolean;
    setApiKey: (key: string) => void;
    setModel: (model: string) => void;
    setLanguage: (lang: 'en' | 'zh') => void;
    setTheme: (theme: Theme) => void;
    setSoundEnabled: (enabled: boolean) => void;
    setTtsEnabled: (enabled: boolean) => void;
    setSettingsOpen: (isOpen: boolean) => void;
}

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
            model: 'google/gemini-flash-1.5',
            language: 'en',
            theme: 'light',
            soundEnabled: true,
            ttsEnabled: false,
            isSettingsOpen: false,
            setApiKey: (apiKey) => set({ apiKey }),
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
            partialize: (state) => ({
                apiKey: state.apiKey,
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
