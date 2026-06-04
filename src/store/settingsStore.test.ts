import { useSettingsStore } from './settingsStore';

describe('settings store defaults', () => {
    test('uses official DeepSeek V4 Flash by default', () => {
        const state = useSettingsStore.getState();

        expect(state.apiProvider).toBe('deepseek');
        expect(state.model).toBe('deepseek-v4-flash');
    });
});
