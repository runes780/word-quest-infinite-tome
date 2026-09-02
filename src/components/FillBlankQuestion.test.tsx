import { render, screen } from '@testing-library/react';
import { FillBlankQuestion } from './FillBlankQuestion';
import type { Monster } from '@/store/gameStore';

jest.mock('@/lib/audio', () => ({
    playSound: {
        click: jest.fn(),
        success: jest.fn(),
        defeat: jest.fn(),
        victory: jest.fn()
    }
}));

jest.mock('@/store/settingsStore', () => ({
    useSettingsStore: () => ({
        language: 'en',
        soundEnabled: false
    })
}));

function blankMonster(question: string, correctAnswer: string): Monster {
    return {
        id: 1,
        type: 'grammar',
        question,
        options: [correctAnswer],
        correct_index: 0,
        explanation: '',
        hint: '',
        skillTag: 'grammar',
        difficulty: 'easy',
        questionMode: 'fill-blank',
        correctAnswer
    } as Monster;
}

describe('FillBlankQuestion blank parsing', () => {
    test('consumes the whole underscore run so no stray underscores render', () => {
        render(
            <FillBlankQuestion
                question={blankMonster('We _____ football in the park.', 'played')}
                onAnswer={jest.fn()}
            />
        );

        const input = screen.getByRole('textbox');
        expect(input).toBeInTheDocument();
        // The 5-underscore blank must be fully replaced by the input; older
        // parsing matched a 3-underscore pattern first and left "__" behind.
        const sentenceText = document.body.textContent || '';
        expect(sentenceText).not.toMatch(/_{2,}/);
        expect(sentenceText).toContain('We');
        expect(sentenceText).toContain('football in the park.');
    });

    test('still supports the [blank] marker', () => {
        render(
            <FillBlankQuestion
                question={blankMonster('She [blank] the plants every morning.', 'waters')}
                onAnswer={jest.fn()}
            />
        );

        expect(screen.getByRole('textbox')).toBeInTheDocument();
        const sentenceText = document.body.textContent || '';
        expect(sentenceText).toContain('She');
        expect(sentenceText).toContain('the plants every morning.');
        expect(sentenceText).not.toContain('[blank]');
    });
});
