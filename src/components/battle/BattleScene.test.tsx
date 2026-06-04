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

    test('renders boss stage progress for multi-stage boss gates', () => {
        render(
            <BattleScene
                currentQuestion={{
                    ...question,
                    isBoss: true,
                    bossStage: 3,
                    bossTotalStages: 3
                }}
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

        expect(screen.getByText('Stage 3 / 3')).toBeInTheDocument();
    });

    test('renders each damage text once', () => {
        render(
            <BattleScene
                currentQuestion={question}
                showResult
                isCorrect
                attackType="slash"
                particles={[]}
                damageText={[{
                    id: 1,
                    x: 0,
                    y: -50,
                    text: '-1',
                    color: '#ffffff',
                    scale: 1,
                    rotate: 0
                }]}
                currentMonsterHp={1}
                bossShieldProgress={0}
                playerStreak={0}
                comboScale={1}
                bossComboThreshold={2}
                t={translations.en}
            />
        );

        expect(screen.getAllByText('-1')).toHaveLength(1);
    });

    test('does not label regular monsters as bosses', () => {
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

        expect(screen.queryByText('vocab BOSS')).not.toBeInTheDocument();
        expect(screen.getByText('vocab')).toBeInTheDocument();
    });

    test('clips monster shading to the circular asset frame', () => {
        const { container } = render(
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

        const shade = container.querySelector('[class*="bg-gradient-to-t"][class*="from-black/40"]');
        expect(shade).toHaveClass('rounded-full');
    });
});
