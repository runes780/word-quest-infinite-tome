import { render } from '@testing-library/react';
import { BattleHud } from './BattleHud';
import { translations } from '@/lib/translations';

describe('BattleHud responsive layout', () => {
    test('allows the status groups to wrap on narrow screens', () => {
        const { container } = render(
            <BattleHud
                health={3}
                maxHealth={3}
                playerStats={{ level: 1, xp: 20, maxXp: 100, streak: 0, gold: 15 }}
                score={10}
                currentIndex={0}
                totalQuestions={5}
                goldScale={1}
                inventory={[]}
                knowledgeCardsCount={0}
                rootFragments={0}
                fragmentsUntilCraft={5}
                onOpenShop={jest.fn()}
                t={translations.en}
            />
        );

        const hud = container.firstElementChild;
        expect(hud).toHaveClass('flex-wrap');
        expect(hud).toHaveClass('gap-4');
    });
});
