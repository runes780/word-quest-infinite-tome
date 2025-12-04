
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    apiKey: string;
    model: string;
    language: 'en' | 'zh';
    soundEnabled: boolean;
    ttsEnabled: boolean;
    isSettingsOpen: boolean;
    setApiKey: (key: string) => void;
    setModel: (model: string) => void;
    setLanguage: (lang: 'en' | 'zh') => void;
    setSoundEnabled: (enabled: boolean) => void;
    setTtsEnabled: (enabled: boolean) => void;
    setSettingsOpen: (isOpen: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            apiKey: '',
            model: 'google/gemini-flash-1.5', // Default model
            language: 'en',
            soundEnabled: true,
            ttsEnabled: false,
            isSettingsOpen: false,
            setApiKey: (apiKey) => set({ apiKey }),
            setModel: (model) => set({ model }),
            setLanguage: (language) => set({ language }),
            setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
            setTtsEnabled: (ttsEnabled) => set({ ttsEnabled }),
            setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
        }),
        {
            name: 'word-quest-settings',
            partialize: (state) => ({ apiKey: state.apiKey, model: state.model, language: state.language, soundEnabled: state.soundEnabled, ttsEnabled: state.ttsEnabled }), // Don't persist UI state
        }
    )
);
