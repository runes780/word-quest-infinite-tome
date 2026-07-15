import { fireEvent, render, screen } from '@testing-library/react';
import { BattleInventoryBar, BattleNotifications } from './BattleOverlays';

jest.mock('next/image', () => ({
    __esModule: true,
    default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />
}));

jest.mock('@/components/AchievementSystem', () => ({
    AchievementToast: () => null
}));

describe('BattleOverlays', () => {
    test('shows an explicit empty inventory state', () => {
        render(<BattleInventoryBar inventory={[]} emptyLabel="No items" onUseItem={jest.fn()} />);

        expect(screen.getByText('No items')).toBeInTheDocument();
    });

    test('routes item use by stable item id', () => {
        const onUseItem = jest.fn();
        render(
            <BattleInventoryBar
                inventory={[{
                    id: 'potion-1',
                    type: 'potion_health',
                    name: 'Health Potion',
                    description: 'Restore health',
                    cost: 10,
                    icon: 'potion'
                }]}
                emptyLabel="No items"
                onUseItem={onUseItem}
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /health potion/i }));
        expect(onUseItem).toHaveBeenCalledWith('potion-1');
    });

    test('renders mastery evidence without changing its underlying values', () => {
        render(
            <BattleNotifications
                activeAchievement={null}
                onCloseAchievement={jest.fn()}
                language="en"
                activeMasteryCelebration={{
                    id: 'mastery-1',
                    skillTag: 'vocab_core',
                    fromState: 'learning',
                    toState: 'consolidated',
                    bonusXp: 12,
                    bonusGold: 4,
                    timestamp: 1
                }}
            />
        );

        expect(screen.getByText('Mastery Up')).toBeInTheDocument();
        expect(screen.getByText(/Learning/)).toHaveTextContent('Learning -> Consolidated');
        expect(screen.getByText('+12 XP')).toBeInTheDocument();
        expect(screen.getByText('+4 Gold')).toBeInTheDocument();
    });
});

