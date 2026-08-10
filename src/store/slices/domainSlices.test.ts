import type { Monster } from '@/store/gameStore';
import { useGameStore } from '@/store/gameStore';

const question = (id: number, overrides: Partial<Monster> = {}): Monster => ({
    id,
    type: 'vocab',
    question: `Synthetic question ${id}`,
    options: ['correct', 'wrong one', 'wrong two', 'wrong three'],
    correct_index: 0,
    correctAnswer: 'correct',
    explanation: 'The synthetic answer is correct.',
    hint: 'Use the synthetic clue.',
    skillTag: 'vocab_core',
    difficulty: 'easy',
    questionMode: 'choice',
    ...overrides
});

describe('game store domain slices', () => {
    beforeEach(() => {
        useGameStore.setState({
            health: 2,
            maxHealth: 3,
            score: 0,
            questions: [],
            currentIndex: 0,
            isGameOver: false,
            isVictory: false,
            playerStats: { level: 1, xp: 0, maxXp: 100, streak: 0, gold: 20 },
            currentMonsterHp: 1,
            context: '',
            inventory: [],
            userAnswers: [],
            pendingRewards: [],
            showRewardScreen: false,
            skillStats: {},
            revengeQueue: [],
            bossShieldProgress: 0,
            clarityEffect: null,
            knowledgeCards: [],
            rootFragments: 0,
            sessionSource: 'battle',
            questionStartedAt: Date.now(),
            masteryBySkill: {},
            reviewRiskBySkill: {},
            recentMistakeBySkill: {},
            masteryCelebrations: [],
            runObjectiveBonuses: [],
            activePracticePlanRun: null,
            activePracticePlanStepId: null
        });
    });

    test('combat slice advances encounters and caps healing', () => {
        useGameStore.setState({ questions: [question(1), question(2, { hp: 2 })], currentMonsterHp: 0 });

        useGameStore.getState().nextQuestion();
        useGameStore.getState().heal(10);

        expect(useGameStore.getState()).toMatchObject({
            currentIndex: 1,
            currentMonsterHp: 2,
            health: 3,
            isVictory: false
        });
    });

    test('learning slice adds and injects normalized questions', () => {
        useGameStore.setState({ questions: [question(1)] });

        useGameStore.getState().addQuestions([question(2)]);
        useGameStore.getState().injectQuestion(question(3));

        const questions = useGameStore.getState().questions;
        expect(questions.map((item) => item.id)).toEqual([1, 3, 2]);
        expect(questions[1]).toMatchObject({ skillTag: 'vocab_core', questionMode: 'choice' });
    });

    test('economy slice spends gold and consumes a health potion', () => {
        useGameStore.setState({
            health: 1,
            inventory: [{
                id: 'synthetic-health-potion',
                type: 'potion_health',
                name: 'Synthetic Health Potion',
                description: 'Synthetic test item',
                cost: 10,
                icon: 'test'
            }]
        });

        expect(useGameStore.getState().spendGold(5)).toBe(true);
        useGameStore.getState().useItem('synthetic-health-potion');

        expect(useGameStore.getState().playerStats.gold).toBe(15);
        expect(useGameStore.getState().health).toBe(2);
        expect(useGameStore.getState().inventory).toHaveLength(0);
    });
});
