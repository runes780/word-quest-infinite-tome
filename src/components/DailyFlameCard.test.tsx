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
    test('invites new learners to start with a small step instead of showing a zero-day streak', () => {
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

        expect(screen.getByText('开始今天的小步学习')).toBeInTheDocument();
        expect(screen.queryByText(/0 个活跃学习日/)).not.toBeInTheDocument();
    });

    test('frames the XP target as optional and keeps progress accessible', () => {
        render(<DailyFlameCard status={needsPracticeStatus} language="en" />);

        expect(screen.getByText('6 active learning days')).toBeInTheDocument();
        expect(screen.getByText("30 XP completes today's optional goal")).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40');
        expect(screen.getByText(/never removes mastery evidence/i)).toBeInTheDocument();
    });

    test('welcomes a learner after a break without loss framing', () => {
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

        expect(screen.getByText('14 active learning days')).toBeInTheDocument();
        expect(screen.getByText('Welcome back. A break does not erase what you learned.')).toBeInTheDocument();
        expect(screen.queryByText(/protect|risk|freeze/i)).not.toBeInTheDocument();
    });
});
