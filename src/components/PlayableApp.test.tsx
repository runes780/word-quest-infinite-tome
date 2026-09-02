import { render, screen } from '@testing-library/react';
import { PlayableApp } from './PlayableApp';

const mockSetSettingsOpen = jest.fn();
let mockQuestions: unknown[] = [];

jest.mock('@/store/gameStore', () => ({
    useGameStore: () => ({ questions: mockQuestions })
}));

jest.mock('@/store/settingsStore', () => ({
    useSettingsStore: () => ({
        apiKey: '',
        language: 'en',
        setSettingsOpen: mockSetSettingsOpen
    })
}));

jest.mock('@/components/InputSection', () => ({
    InputSection: () => <div>Offline-first learning entry</div>
}));

jest.mock('@/components/BattleInterface', () => ({ BattleInterface: () => <div>Active battle</div> }));
jest.mock('@/components/MistakeNotebook', () => ({ MistakeNotebook: () => null }));
jest.mock('@/components/ParentDashboard', () => ({ ParentDashboard: () => null }));
jest.mock('@/components/SettingsModal', () => ({ SettingsModal: () => null }));

describe('PlayableApp onboarding', () => {
    beforeEach(() => {
        mockQuestions = [];
        mockSetSettingsOpen.mockClear();
        window.scrollTo = jest.fn();
    });

    test('does not block first use with API settings when no key exists', () => {
        render(<PlayableApp />);

        expect(screen.getByText('Offline-first learning entry')).toBeInTheDocument();
        expect(mockSetSettingsOpen).not.toHaveBeenCalled();
        expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' });
    });

    test('compacts the brand header while a battle is active', () => {
        mockQuestions = [{}];

        render(<PlayableApp />);

        expect(screen.getByRole('banner')).toHaveAttribute('data-layout', 'compact');
        expect(screen.getByText('Active battle')).toBeInTheDocument();
    });
});
