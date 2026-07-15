import { fireEvent, render, screen } from '@testing-library/react';
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
    beforeEach(() => {
        HTMLElement.prototype.scrollIntoView = jest.fn();
    });

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
                selfConfidence={undefined}
                progressReward={null}
                onToggleHint={jest.fn()}
                onConfidenceChange={jest.fn()}
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
                selfConfidence={undefined}
                progressReward={null}
                onToggleHint={jest.fn()}
                onConfidenceChange={jest.fn()}
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

    test('announces answer feedback as one polite status update', () => {
        render(
            <BattleQuestionPanel
                currentQuestion={bossQuestion}
                t={translations.en}
                language="en"
                ttsEnabled={false}
                showHint={false}
                showResult
                selectedOption={1}
                isCorrect
                resultMessage="Went is correct because yesterday signals past time."
                currentMonsterHp={0}
                bossShieldProgress={2}
                bossComboThreshold={2}
                clarityEffect={null}
                selfConfidence="low"
                progressReward={{ kind: 'transfer-success', xp: 18, gold: 10, counted: true }}
                onToggleHint={jest.fn()}
                onConfidenceChange={jest.fn()}
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

        const status = screen.getByRole('status');
        expect(status).toHaveAttribute('aria-live', 'polite');
        expect(status).toHaveTextContent('Went is correct because yesterday signals past time.');
        expect(status).toHaveTextContent('correct but unsure');
        expect(status).toHaveTextContent('Transfer succeeded');
        expect(status).toHaveTextContent('+18 XP');
        expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'nearest' });
    });

    test('offers a non-scoring three-level confidence choice on transfer questions', () => {
        const onConfidenceChange = jest.fn();
        render(
            <BattleQuestionPanel
                currentQuestion={{ ...bossQuestion, attemptKind: 'transfer' }}
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
                selfConfidence="medium"
                progressReward={null}
                onToggleHint={jest.fn()}
                onConfidenceChange={onConfidenceChange}
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

        expect(screen.getByText(/does not change score, rewards, or mastery/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Somewhat sure' })).toHaveAttribute('aria-pressed', 'true');
        fireEvent.click(screen.getByRole('button', { name: 'Very sure' }));
        expect(onConfidenceChange).toHaveBeenCalledWith('high');
    });

    test('explains anti-farming protection without hiding the learning evidence', () => {
        render(
            <BattleQuestionPanel
                currentQuestion={bossQuestion}
                t={translations.en}
                language="en"
                ttsEnabled={false}
                showHint={false}
                showResult
                selectedOption={1}
                isCorrect
                resultMessage="Correct."
                currentMonsterHp={0}
                bossShieldProgress={0}
                bossComboThreshold={2}
                clarityEffect={null}
                selfConfidence={undefined}
                progressReward={{
                    kind: 'supported-practice',
                    xp: 0,
                    gold: 0,
                    counted: false,
                    protectionReason: 'duplicate-evidence'
                }}
                onToggleHint={jest.fn()}
                onConfidenceChange={jest.fn()}
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

        expect(screen.getByRole('status')).toHaveTextContent('Practice recorded');
        expect(screen.getByRole('status')).toHaveTextContent('does not earn another progress reward');
    });
});
