import { fireEvent, render, screen } from '@testing-library/react';
import { BlessingSelection } from './BlessingSelection';

jest.mock('@/store/settingsStore', () => ({
    useSettingsStore: () => ({
        language: 'en',
        soundEnabled: false
    })
}));

jest.mock('@/lib/audio', () => ({
    playSound: {
        click: jest.fn(),
        success: jest.fn()
    }
}));

describe('BlessingSelection exit affordance', () => {
    test('offers a clear return action before choosing a blessing', () => {
        const onSkip = jest.fn();

        render(<BlessingSelection onSelect={jest.fn()} onSkip={onSkip} />);

        fireEvent.click(screen.getByLabelText('Back to mission setup'));

        expect(onSkip).toHaveBeenCalledTimes(1);
    });
});
