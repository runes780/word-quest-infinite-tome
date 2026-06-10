import { fireEvent, render, screen } from '@testing-library/react';
import { StickyNav } from './components';
import { LandingCopyProvider } from './landingI18n';

const setLanguage = jest.fn();

jest.mock('@/store/settingsStore', () => ({
  useSettingsStore: (selector: (state: { setLanguage: typeof setLanguage }) => unknown) =>
    selector({ setLanguage }),
}));

describe('StickyNav localization', () => {
  beforeEach(() => {
    setLanguage.mockClear();
  });

  test('renders Chinese navigation labels and can switch back to English', () => {
    render(
      <LandingCopyProvider language="zh">
        <StickyNav />
      </LandingCopyProvider>
    );

    expect(screen.getByRole('link', { name: '首页' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '问题' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '产品预览' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Switch landing page to English' }));

    expect(setLanguage).toHaveBeenCalledWith('en');
  });
});
