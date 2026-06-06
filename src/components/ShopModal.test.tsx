import { render, screen } from '@testing-library/react';
import { ShopModal } from './ShopModal';

jest.mock('@/store/settingsStore', () => ({
    useSettingsStore: () => ({ language: 'en' })
}));

jest.mock('@/store/gameStore', () => ({
    useGameStore: () => ({
        playerStats: { gold: 200 },
        spendGold: jest.fn(() => true),
        addItem: jest.fn()
    })
}));

function expectImageSrc(element: HTMLElement, expectedPath: string) {
    expect(decodeURIComponent(element.getAttribute('src') || '')).toContain(expectedPath);
}

describe('ShopModal battle item artwork', () => {
    test('renders shared item artwork for shop items', () => {
        render(<ShopModal isOpen onClose={jest.fn()} />);

        expectImageSrc(screen.getByAltText(/health potion/i), '/assets/battle/item-health-potion.png');
        expectImageSrc(screen.getByAltText(/clarity potion/i), '/assets/battle/item-clarity-potion.png');
        expectImageSrc(screen.getByAltText(/vampire fangs/i), '/assets/battle/item-vampire-fangs.png');
        expect(screen.queryByText(/placeholder/i)).not.toBeInTheDocument();
    });

    test('keeps shop contents inside a viewport-limited dialog', () => {
        render(<ShopModal isOpen onClose={jest.fn()} />);

        const dialog = screen.getByRole('dialog', { name: 'Merchant' });

        expect(dialog.className).toContain('max-h-[calc(100dvh-2rem)]');
        expect(dialog.className).toContain('overflow-hidden');
        expect(dialog.className).toContain('flex-col');
        expect(screen.getByTestId('shop-items').className).toContain('overflow-y-auto');
        expect(screen.getByTestId('shop-items').className).toContain('min-h-0');
    });
});
