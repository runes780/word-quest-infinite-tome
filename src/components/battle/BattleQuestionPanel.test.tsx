import { render, screen } from '@testing-library/react';
import { BattleQuestionPanel } from './BattleQuestionPanel';
import { translations } from '@/lib/translations';
import type { Monster } from '@/store/gameStore';

const bossQuestion: Monster = {
    id: 12,
    type: 'grammar',
    question: 'Yesterday I _____ to school.',
    options: ['go', 'went', 'going', 'goes'],
    correct_index: 1,
    explanation: 'Went is the past tense.',
    hint: 'Look for the past tense.',
    skillTag: 'grammar:past_simple',
    difficulty: 'hard',
    questionMode: 'choice',
    correctAnswer: 'went',
    isBoss: true,
    bossStage: 2,
    bossTotalStages: 3,
    learningObjectiveId: 'past_tense_basic',
    supportLevel: 2,
    attemptKind: 'practice'
};

describe('BattleQuestionPanel learning metadata', () => {
    test('shows boss stage, objective, and support level', () => {
        render(
            <BattleQuestionPanel
                currentQuestion={bossQuestion}
                t={translations.en}
                language="en"
                ttsEnabled={false}
                showHint={false}
                showResult={false}
                selectedOption={null}
                isCorrect={false}
                resultMessage=""
                currentMonsterHp={1}
                bossShieldProgress={0}
                bossComboThreshold={2}
                clarityEffect={null}
                onToggleHint={jest.fn()}
                onChoiceSelect={jest.fn()}
                onTypingAnswer={jest.fn()}
                onFillBlankAnswer={jest.fn()}
                onVoiceAnswer={jest.fn()}
                onSpeakQuestion={jest.fn()}
                onSpeakExplanation={jest.fn()}
                onOpenMentor={jest.fn()}
                onNext={jest.fn()}
            />
        );

        expect(screen.getByText('Boss Gate 2/3')).toBeInTheDocument();
        expect(screen.getByText('Basic Past Tense')).toBeInTheDocument();
        expect(screen.getByText('scaffolded')).toBeInTheDocument();
    });

    test('shows lightweight game labels for transfer and repair moments', () => {
        render(
            <BattleQuestionPanel
                currentQuestion={{
                    ...bossQuestion,
                    isBoss: false,
                    bossStage: undefined,
                    bossTotalStages: undefined,
                    supportLevel: 0,
                    attemptKind: 'transfer',
                    isImmediateRepair: true
                }}
                t={translations.zh}
                language="zh"
                ttsEnabled={false}
                showHint={false}
                showResult={false}
                selectedOption={null}
                isCorrect={false}
                resultMessage=""
                currentMonsterHp={1}
                bossShieldProgress={0}
                bossComboThreshold={2}
                clarityEffect={null}
                onToggleHint={jest.fn()}
                onChoiceSelect={jest.fn()}
                onTypingAnswer={jest.fn()}
                onFillBlankAnswer={jest.fn()}
                onVoiceAnswer={jest.fn()}
                onSpeakQuestion={jest.fn()}
                onSpeakExplanation={jest.fn()}
                onOpenMentor={jest.fn()}
                onNext={jest.fn()}
            />
        );

        expect(screen.getByText('迁移检查')).toBeInTheDocument();
        expect(screen.getByText('补救反击')).toBeInTheDocument();
    });
});
