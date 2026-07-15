
'use client';

import { useState, useEffect } from 'react';
import { useGameStore, BOSS_COMBO_THRESHOLD, CRAFT_THRESHOLD, getPendingAchievements } from '@/store/gameStore';
import { MentorOverlay } from './MentorOverlay';
import { ShopModal } from './ShopModal';
import { MissionReport } from './MissionReport';
import { useSettingsStore } from '@/store/settingsStore';
import { translations } from '@/lib/translations';
import { RewardScreen } from './RewardScreen';
import { speakText, stopSpeech } from '@/lib/tts';
import type { Achievement } from './AchievementSystem';
import { BattleScene } from './battle/BattleScene';
import { BattleQuestionPanel } from './battle/BattleQuestionPanel';
import { useEndlessWave } from './battle/useEndlessWave';
import { BattleHud } from './battle/BattleHud';
import { useBattleFeedback } from './battle/useBattleFeedback';
import { useBattleAnswerFlow } from './battle/useBattleAnswerFlow';
import {
    BattleGeneratingBanner,
    BattleInventoryBar,
    BattleNotifications,
    FlyingCoinBurst
} from './battle/BattleOverlays';

export function BattleInterface() {
    const {
        questions,
        currentIndex,
        health,
        maxHealth,
        score,
        answerQuestion,
        nextQuestion,
        isGameOver,
        isVictory,
        injectQuestion,
        playerStats,
        currentMonsterHp,
        addQuestions,
        context,
        useItem: consumeItem,
        generateRewards,
        bossShieldProgress,
        clarityEffect,
        inventory,
        knowledgeCards,
        rootFragments,
        recordHintUsed,
        masteryBySkill,
        reviewRiskBySkill,
        recentMistakeBySkill,
        masteryCelebrations,
        dismissMasteryCelebration

    } = useGameStore();



    const { apiKey, apiProvider, model, language, soundEnabled, ttsEnabled } = useSettingsStore();
    const t = translations[language];
    const speechLang = language === 'zh' ? 'zh-CN' : 'en-US';
    const fragmentsRemainder = rootFragments % CRAFT_THRESHOLD;
    const fragmentsUntilCraft = fragmentsRemainder === 0 ? CRAFT_THRESHOLD : CRAFT_THRESHOLD - fragmentsRemainder;
    const {
        attackType,
        particles,
        damageText,
        flyingCoins,
        comboScale,
        goldScale,
        markWrongFeedback,
        triggerCorrectFeedback,
        resetAttack
    } = useBattleFeedback({
        soundEnabled,
        criticalLabel: t.battle.critical,
        weaknessLabel: t.battle.weakness
    });

    const [showShop, setShowShop] = useState(false);
    const [achievementQueue, setAchievementQueue] = useState<Achievement[]>([]);
    const activeAchievement = achievementQueue[0] || null;
    const activeMasteryCelebration = masteryCelebrations[0] || null;

    const currentQuestion = questions[currentIndex];
    const queueUnlockedAchievements = () => {
        const unlocked = getPendingAchievements();
        if (unlocked.length > 0) {
            setAchievementQueue((previous) => [...previous, ...unlocked]);
        }
    };
    const {
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
        handleOptionClick,
        handleTextQuestionAnswer,
        handleVoiceAnswer,
        toggleHint,
        resetAnswerState
    } = useBattleAnswerFlow({
        currentQuestion,
        language,
        health,
        masteryBySkill,
        reviewRiskBySkill,
        recentMistakeBySkill,
        answerQuestion,
        recordHintUsed,
        onAnswerRecorded: queueUnlockedAchievements,
        markWrongFeedback,
        triggerCorrectFeedback
    });
    const { isGeneratingMore } = useEndlessWave({
        // Standard missions are finite and must reach MissionReport. Endless
        // generation remains available behind an explicit future mode toggle.
        enabled: false,
        apiKey,
        apiProvider,
        model,
        context,
        currentIndex,
        questionsLength: questions.length,
        playerLevel: playerStats.level,
        addQuestions
    });

    useEffect(() => {
        if (!activeMasteryCelebration) return;
        const timer = setTimeout(() => {
            dismissMasteryCelebration(activeMasteryCelebration.id);
        }, 3200);
        return () => clearTimeout(timer);
    }, [activeMasteryCelebration, dismissMasteryCelebration]);

    useEffect(() => () => {
        stopSpeech();
    }, []);

    const handleNext = () => {
        resetAnswerState();
        resetAttack();

        // Check for Boss Reward
        if (currentQuestion.isBoss) {
            const isFinalBossStage = !currentQuestion.bossTotalStages ||
                currentQuestion.bossStage === currentQuestion.bossTotalStages;
            if (currentMonsterHp > 0) {
                return;
            }
            if (isFinalBossStage) {
                generateRewards('boss');
                return;
            }
        }

        nextQuestion();
    };

    const handleSpeakQuestion = () => {
        if (!ttsEnabled || !currentQuestion) return;
        speakText(currentQuestion.question, speechLang);
    };

    const handleSpeakExplanation = () => {
        if (!ttsEnabled || !currentQuestion || !showResult) return;
        speakText(resultMessage || currentQuestion.explanation, speechLang);
    };

    if (!currentQuestion) return null;

    if (isGameOver || isVictory) {
        return <MissionReport />;
    }

    return (
        <div className="w-full max-w-4xl mx-auto p-4">
            <BattleHud
                health={health}
                maxHealth={maxHealth}
                playerStats={playerStats}
                score={score}
                currentIndex={currentIndex}
                totalQuestions={questions.length}
                goldScale={goldScale}
                inventory={inventory}
                knowledgeCardsCount={knowledgeCards.length}
                rootFragments={rootFragments}
                fragmentsUntilCraft={fragmentsUntilCraft}
                shopLabel={t.shop.title}
                onOpenShop={() => setShowShop(true)}
                t={t}
            />

            <BattleGeneratingBanner visible={isGeneratingMore} label={t.battle.summoning} />

            {/* Main Battle Grid */}
            <div className="grid lg:grid-cols-2 gap-8 items-stretch min-h-[500px]">
                <BattleScene
                    currentQuestion={currentQuestion}
                    showResult={showResult}
                    isCorrect={isCorrect}
                    attackType={attackType}
                    particles={particles}
                    damageText={damageText}
                    currentMonsterHp={currentMonsterHp}
                    bossShieldProgress={bossShieldProgress}
                    playerStreak={playerStats.streak}
                    comboScale={comboScale}
                    bossComboThreshold={BOSS_COMBO_THRESHOLD}
                    t={t}
                />

                <BattleQuestionPanel
                    currentQuestion={currentQuestion}
                    t={t}
                    language={language}
                    ttsEnabled={ttsEnabled}
                    showHint={showHint}
                    showResult={showResult}
                    selectedOption={selectedOption}
                    isCorrect={isCorrect}
                    resultMessage={resultMessage}
                    currentMonsterHp={currentMonsterHp}
                    bossShieldProgress={bossShieldProgress}
                    bossComboThreshold={BOSS_COMBO_THRESHOLD}
                    clarityEffect={clarityEffect}
                    selfConfidence={selfConfidence}
                    onToggleHint={toggleHint}
                    onConfidenceChange={setSelfConfidence}
                    onChoiceSelect={handleOptionClick}
                    onTypingAnswer={handleTextQuestionAnswer}
                    onFillBlankAnswer={handleTextQuestionAnswer}
                    onVoiceAnswer={handleVoiceAnswer}
                    onSpeakQuestion={handleSpeakQuestion}
                    onSpeakExplanation={handleSpeakExplanation}
                    onOpenMentor={() => setShowMentor(true)}
                    onNext={handleNext}
                />
            </div >

            <MentorOverlay
                isOpen={showMentor}
                onClose={() => setShowMentor(false)}
                question={currentQuestion}
                wrongAnswer={wrongAnswerText}
                onRevenge={(q) => {
                    injectQuestion(q);
                    setShowMentor(false);
                }}
            />

            <ShopModal
                isOpen={showShop}
                onClose={() => setShowShop(false)}
            />

            <RewardScreen />
            <FlyingCoinBurst coins={flyingCoins} />
            <BattleInventoryBar
                inventory={inventory}
                emptyLabel={t.battle.inventoryEmpty}
                onUseItem={consumeItem}
            />
            <BattleNotifications
                activeAchievement={activeAchievement}
                onCloseAchievement={() => setAchievementQueue((previous) => previous.slice(1))}
                activeMasteryCelebration={activeMasteryCelebration}
                language={language}
            />
        </div >
    );
}
