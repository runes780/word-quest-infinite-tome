import { render, screen } from '@testing-library/react';
import { translations } from '@/lib/translations';
import type { Monster } from '@/store/gameStore';
import { BattleScene } from './BattleScene';

const question: Monster = {
    id: 1,
    type: 'vocab',
    question: 'Choose the word.',
    options: ['a', 'b'],
    correct_index: 0,
    explanation: 'Good.',
    skillTag: 'vocab_basic',
    difficulty: 'easy',
    questionMode: 'choice',
    correctAnswer: 'a'
};

function expectImageSrc(element: HTMLElement, expectedPath: string) {
    expect(decodeURIComponent(element.getAttribute('src') || '')).toContain(expectedPath);
}

describe('BattleScene art assets', () => {
    test('renders image-backed hero and monster assets', () => {
        render(
            <BattleScene
                currentQuestion={question}
                showResult={false}
                isCorrect={false}
                attackType="slash"
                particles={[]}
                damageText={[]}
                currentMonsterHp={1}
                bossShieldProgress={0}
                playerStreak={0}
                comboScale={1}
                bossComboThreshold={2}
                t={translations.en}
            />
        );

        expectImageSrc(screen.getByAltText(/hero/i), '/assets/battle/hero-book-knight.png');
        expectImageSrc(screen.getByAltText(/vocab/i), '/assets/battle/monster-vocab.png');
    });

    test('renders image-backed attack effect when the answer is correct', () => {
        render(
            <BattleScene
                currentQuestion={question}
                showResult
                isCorrect
                attackType="fireball"
                particles={[]}
                damageText={[]}
                currentMonsterHp={1}
                bossShieldProgress={0}
                playerStreak={0}
                comboScale={1}
                bossComboThreshold={2}
                t={translations.en}
            />
        );

        expectImageSrc(screen.getByAltText(/fireball/i), '/assets/battle/effect-fireball.png');
    });
});
