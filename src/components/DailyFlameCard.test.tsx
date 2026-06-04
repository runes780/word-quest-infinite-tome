import { render, screen } from '@testing-library/react';
import { DailyFlameCard } from './DailyFlameCard';
import type { DailyFlameStatus } from '@/lib/data/dailyFlame';

const needsPracticeStatus: DailyFlameStatus = {
    state: 'needs-practice',
    streakDays: 6,
    dailyXpGoal: 50,
    dailyXpEarned: 20,
    remainingXp: 30,
    progressPercent: 40,
    canUseFreeze: false,
    lastActiveDate: '2026-06-04'
};

describe('DailyFlameCard', () => {
    test('invites new learners to start today instead of showing a zero-day streak', () => {
        render(
            <DailyFlameCard
                status={{
                    ...needsPracticeStatus,
                    state: 'starter',
                    streakDays: 0,
                    dailyXpEarned: 0,
                    remainingXp: 50,
                    progressPercent: 0,
                    canUseFreeze: false,
                    lastActiveDate: ''
                }}
                language="zh"
            />
        );

        expect(screen.getByText('点亮今日火苗')).toBeInTheDocument();
        expect(screen.queryByText('0 天火苗')).not.toBeInTheDocument();
    });

    test('shows remaining XP and current streak for today', () => {
        render(<DailyFlameCard status={needsPracticeStatus} language="en" />);

        expect(screen.getByText('6 day flame')).toBeInTheDocument();
        expect(screen.getByText('30 XP to protect today')).toBeInTheDocument();
        expect(screen.getByText('40%')).toBeInTheDocument();
    });

    test('shows a gentle freeze message when the streak is at risk', () => {
        render(
            <DailyFlameCard
                status={{
                    ...needsPracticeStatus,
                    state: 'at-risk',
                    streakDays: 14,
                    dailyXpEarned: 0,
                    remainingXp: 50,
                    progressPercent: 0,
                    canUseFreeze: true,
                    lastActiveDate: '2026-06-01'
                }}
                language="en"
            />
        );

        expect(screen.getByText('14 day flame')).toBeInTheDocument();
        expect(screen.getByText('Rest day available')).toBeInTheDocument();
    });
});
