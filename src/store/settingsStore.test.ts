import { useSettingsStore } from './settingsStore';

describe('settings store defaults', () => {
    const originalLanguages = navigator.languages;
    const originalLanguage = navigator.language;

    afterEach(() => {
        Object.defineProperty(navigator, 'languages', {
            configurable: true,
            value: originalLanguages
        });
        Object.defineProperty(navigator, 'language', {
            configurable: true,
            value: originalLanguage
        });
    });

    test('uses official DeepSeek V4 Flash by default', () => {
        const state = useSettingsStore.getState();

        expect(state.apiProvider).toBe('deepseek');
        expect(state.model).toBe('deepseek-v4-flash');
    });

    test('clears the previous provider credential when switching to OpenAI', () => {
        useSettingsStore.setState({
            apiKey: 'synthetic-deepseek-key',
            apiProvider: 'deepseek',
            model: 'deepseek-v4-flash'
        });

        useSettingsStore.getState().setApiProvider('openai');

        expect(useSettingsStore.getState()).toEqual(expect.objectContaining({
            apiKey: '',
            apiProvider: 'openai',
            model: 'gpt-5.6-luna'
        }));
    });

    test('migrates older settings without a provider to official DeepSeek', () => {
        const migrate = useSettingsStore.persist.getOptions().migrate;
        expect(typeof migrate).toBe('function');

        const migrated = migrate?.({
            apiKey: 'old-key',
            model: 'meta-llama/llama-3-8b-instruct:free',
            language: 'zh',
            theme: 'light',
            soundEnabled: true,
            ttsEnabled: false
        }, 0) as {
            apiProvider: string;
            model: string;
        };

        expect(migrated.apiProvider).toBe('deepseek');
        expect(migrated.model).toBe('deepseek-v4-flash');
    });

    test('defaults missing language settings from the browser locale', () => {
        Object.defineProperty(navigator, 'languages', {
            configurable: true,
            value: ['zh-CN', 'en-US']
        });
        Object.defineProperty(navigator, 'language', {
            configurable: true,
            value: 'zh-CN'
        });

        const migrate = useSettingsStore.persist.getOptions().migrate;
        const migrated = migrate?.({
            apiKey: '',
            apiProvider: 'deepseek',
            model: 'deepseek-v4-flash',
            theme: 'light',
            soundEnabled: true,
            ttsEnabled: false
        }, 0) as {
            language: string;
        };

        expect(migrated.language).toBe('zh');
    });
});
