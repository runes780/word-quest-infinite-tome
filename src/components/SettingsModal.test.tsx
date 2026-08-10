import { render, screen } from '@testing-library/react';
import { SettingsModal } from './SettingsModal';

const setSettingsOpen = jest.fn();

jest.mock('@/store/settingsStore', () => ({
    useSettingsStore: () => ({
        apiKey: 'test-key',
        setApiKey: jest.fn(),
        apiProvider: 'deepseek',
        setApiProvider: jest.fn(),
        model: 'deepseek-v4-flash',
        setModel: jest.fn(),
        isSettingsOpen: true,
        setSettingsOpen,
        language: 'en',
        setLanguage: jest.fn(),
        theme: 'light',
        setTheme: jest.fn(),
        soundEnabled: true,
        setSoundEnabled: jest.fn(),
        ttsEnabled: false,
        setTtsEnabled: jest.fn()
    })
}));

describe('SettingsModal responsive sizing', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('keeps long settings content inside a scrollable dialog surface', () => {
        render(<SettingsModal />);

        const dialog = screen.getByRole('dialog', { name: 'Settings' });

        expect(dialog.className).toContain('max-h-[calc(100dvh-2rem)]');
        expect(dialog.className).toContain('overflow-hidden');
        expect(dialog.className).toContain('flex-col');
        expect(screen.getByTestId('settings-modal-body').className).toContain('overflow-y-auto');
        expect(screen.getByTestId('settings-modal-body').className).toContain('min-h-0');
        expect(screen.getByTestId('settings-modal-footer').className).toContain('shrink-0');
        expect(screen.getByRole('button', { name: 'OpenAI' })).toBeInTheDocument();
    });
});
