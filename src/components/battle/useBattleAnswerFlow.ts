'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { LearningEventSelfConfidence, SkillMasteryRecord } from '@/db/db';
import type { GameState, Monster } from '@/store/gameStore';
import type { Language } from '@/store/settingsStore';
import {
    formatBattleResultExplanation,
    resolveVoiceAnswerIndex,
    shouldAutoOpenMentor
} from './battleInterfaceLogic';

type AnswerResult = ReturnType<GameState['answerQuestion']>;

interface BattleAnswerFlowOptions {
    currentQuestion?: Monster;
    language: Language;
    health: number;
    masteryBySkill: Record<string, SkillMasteryRecord>;
    reviewRiskBySkill: Record<string, number>;
    recentMistakeBySkill: Record<string, number>;
    answerQuestion: GameState['answerQuestion'];
    recordHintUsed: GameState['recordHintUsed'];
    onAnswerRecorded: () => void;
    markWrongFeedback: () => void;
    triggerCorrectFeedback: (result: AnswerResult) => void;
}

export function useBattleAnswerFlow({
    currentQuestion,
    language,
    health,
    masteryBySkill,
    reviewRiskBySkill,
    recentMistakeBySkill,
    answerQuestion,
    recordHintUsed,
    onAnswerRecorded,
    markWrongFeedback,
    triggerCorrectFeedback
}: BattleAnswerFlowOptions) {
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [resultMessage, setResultMessage] = useState('');
    const [isCorrect, setIsCorrect] = useState(false);
    const [showMentor, setShowMentor] = useState(false);
    const [wrongAnswerText, setWrongAnswerText] = useState('');
    const [showHint, setShowHint] = useState(false);
    const [selfConfidence, setSelfConfidence] = useState<LearningEventSelfConfidence | undefined>();
    const [progressReward, setProgressReward] = useState<AnswerResult['progressReward']>(null);
    const [scaffoldDecision, setScaffoldDecision] = useState<AnswerResult['scaffoldDecision'] | null>(null);
    const consecutiveWrong = useRef(0);
    const mentorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (mentorTimer.current) clearTimeout(mentorTimer.current);
    }, []);

    const markWrongAndMaybeMentor = useCallback((wrongText: string) => {
        setWrongAnswerText(wrongText);
        markWrongFeedback();
        consecutiveWrong.current += 1;

        if (!currentQuestion) return;
        const skillTag = currentQuestion.skillTag;
        const shouldOpen = shouldAutoOpenMentor({
            nextWrongCount: consecutiveWrong.current,
            health,
            difficulty: currentQuestion.difficulty,
            masteryState: masteryBySkill[skillTag]?.state,
            reviewRisk: reviewRiskBySkill[skillTag] || 0,
            repeatedMistakes: recentMistakeBySkill[skillTag] || 0
        });

        if (shouldOpen) {
            if (mentorTimer.current) clearTimeout(mentorTimer.current);
            mentorTimer.current = setTimeout(() => {
                setShowMentor(true);
                mentorTimer.current = null;
            }, 1500);
        }
    }, [
        currentQuestion,
        health,
        markWrongFeedback,
        masteryBySkill,
        recentMistakeBySkill,
        reviewRiskBySkill
    ]);

    const recordResult = useCallback((result: AnswerResult, correct: boolean, wrongText: string) => {
        setIsCorrect(correct);
        setShowResult(true);
        setResultMessage(formatBattleResultExplanation(result, language));
        setProgressReward(result.progressReward);
        setScaffoldDecision(result.scaffoldDecision);
        onAnswerRecorded();

        if (correct) {
            triggerCorrectFeedback(result);
            consecutiveWrong.current = 0;
        } else {
            markWrongAndMaybeMentor(wrongText);
        }
    }, [language, markWrongAndMaybeMentor, onAnswerRecorded, triggerCorrectFeedback]);

    const handleOptionClick = useCallback((index: number) => {
        if (!currentQuestion || showResult) return;

        setSelectedOption(index);
        const result = answerQuestion(index, selfConfidence || showHint
            ? {
                ...(selfConfidence ? { selfConfidence } : {}),
                ...(showHint ? { hintUsed: true } : {})
            }
            : undefined);
        recordResult(result, result.correct, currentQuestion.options[index] || '');
    }, [answerQuestion, currentQuestion, recordResult, selfConfidence, showHint, showResult]);

    const handleTextQuestionAnswer = useCallback((correct: boolean, input: string) => {
        if (!currentQuestion) return;

        const answerIndex = correct ? currentQuestion.correct_index : -1;
        setSelectedOption(answerIndex);
        const result = answerQuestion(answerIndex, {
            userResponse: input,
            ...(selfConfidence ? { selfConfidence } : {}),
            ...(showHint ? { hintUsed: true } : {})
        });
        recordResult(result, correct, input);
    }, [answerQuestion, currentQuestion, recordResult, selfConfidence, showHint]);

    const handleVoiceAnswer = useCallback((correct: boolean, spokenText: string) => {
        if (!currentQuestion) return;

        const answerIndex = resolveVoiceAnswerIndex({
            options: currentQuestion.options,
            correctIndex: currentQuestion.correct_index,
            correct,
            spokenText
        });
        setSelectedOption(answerIndex);
        const result = answerQuestion(answerIndex, {
            userResponse: spokenText,
            ...(selfConfidence ? { selfConfidence } : {}),
            ...(showHint ? { hintUsed: true } : {})
        });
        recordResult(result, correct, spokenText);
    }, [answerQuestion, currentQuestion, recordResult, selfConfidence, showHint]);

    const toggleHint = useCallback(() => {
        if (!showHint) recordHintUsed();
        setShowHint((visible) => !visible);
    }, [recordHintUsed, showHint]);

    const resetAnswerState = useCallback(() => {
        setSelectedOption(null);
        setShowResult(false);
        setShowHint(false);
        setSelfConfidence(undefined);
        setProgressReward(null);
        setScaffoldDecision(null);
    }, []);

    return {
        selectedOption,
        showResult,
        resultMessage,
        isCorrect,
        showMentor,
        setShowMentor,
        wrongAnswerText,
        showHint,
        selfConfidence,
        setSelfConfidence,
        progressReward,
        scaffoldDecision,
        handleOptionClick,
        handleTextQuestionAnswer,
        handleVoiceAnswer,
        toggleHint,
        resetAnswerState
    };
}
