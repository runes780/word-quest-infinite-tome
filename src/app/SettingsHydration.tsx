'use client';

import { useEffect } from 'react';
import { detectPreferredLanguage, useSettingsStore } from '@/store/settingsStore';

const SETTINGS_STORAGE_KEY = 'word-quest-settings';

function hasPersistedLanguage(): boolean {
    try {
        const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as { state?: { language?: unknown } }) : null;
        return typeof parsed?.state?.language === 'string' && parsed.state.language.length > 0;
    } catch {
        return false;
    }
}

/**
 * Restores saved settings after mount so the first client render matches the
 * server HTML. Fresh visitors with no saved language fall back to their
 * browser preference, preserving the previous auto-detection behavior.
 */
export function SettingsHydration() {
    useEffect(() => {
        void useSettingsStore.persist.rehydrate().then(() => {
            if (!hasPersistedLanguage()) {
                useSettingsStore.getState().setLanguage(detectPreferredLanguage());
            }
        });
    }, []);

    return null;
}
