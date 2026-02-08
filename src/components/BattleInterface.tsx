
'use client';

import { useState, useEffect } from 'react';
import { useGameStore, BOSS_COMBO_THRESHOLD, CRAFT_THRESHOLD, getPendingAchievements } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Shield, Coins } from 'lucide-react';
import { MentorOverlay } from './MentorOverlay';
import { ShopModal } from './ShopModal';
import { MissionReport } from './MissionReport';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/store/settingsStore';
import { OpenRouterClient } from '@/lib/ai/openrouter';
import { LEVEL_GENERATOR_SYSTEM_PROMPT, generateLevelPrompt } from '@/lib/ai/prompts';
import { translations } from '@/lib/translations';
import { RewardScreen } from './RewardScreen';
import { playSound } from '@/lib/audio';
import { speakText, stopSpeech } from '@/lib/tts';
import { Achievement, AchievementToast } from './AchievementSystem';
import { normalizeMissionMonsters } from '@/lib/data/missionSanitizer';
import { BattleScene } from './battle/BattleScene';
import { BattleQuestionPanel } from './battle/BattleQuestionPanel';

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



    const { apiKey, model, language, soundEnabled, ttsEnabled } = useSettingsStore();
    const t = translations[language];
    const [isGeneratingMore, setIsGeneratingMore] = useState(false);
    const speechLang = language === 'zh' ? 'zh-CN' : 'en-US';
    const fragmentsRemainder = rootFragments % CRAFT_THRESHOLD;
    const fragmentsUntilCraft = fragmentsRemainder === 0 ? CRAFT_THRESHOLD : CRAFT_THRESHOLD - fragmentsRemainder;

    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [showResult, setShowResult] = useState(false);
    const [resultMessage, setResultMessage] = useState('');
    const [isCorrect, setIsCorrect] = useState(false);
    const [showMentor, setShowMentor] = useState(false);
    const [showShop, setShowShop] = useState(false);
    const [attackType, setAttackType] = useState<'slash' | 'fireball' | 'lightning'>('slash');
    const [particles, setParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);
    const [damageText, setDamageText] = useState<{ id: number; x: number; y: number; text: string; color: string; scale: number; rotate: number }[]>([]);
    const [flyingCoins, setFlyingCoins] = useState<{ id: number; delay: number }[]>([]);
    const [comboScale, setComboScale] = useState(1);
    const [goldScale, setGoldScale] = useState(1);
    const [wrongAnswerText, setWrongAnswerText] = useState('');
    const [, setConsecutiveWrong] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [activeAchievement, setActiveAchievement] = useState<Achievement | null>(null);
    const [queuedAchievements, setQueuedAchievements] = useState<Achievement[]>([]);
    const activeMasteryCelebration = masteryCelebrations[0] || null;

    const currentQuestion = questions[currentIndex];

    useEffect(() => {
        if (activeAchievement || queuedAchievements.length === 0) return;
        setActiveAchievement(queuedAchievements[0]);
        setQueuedAchievements((prev) => prev.slice(1));
    }, [activeAchievement, queuedAchievements]);

    useEffect(() => {
        if (!activeMasteryCelebration) return;
        const timer = setTimeout(() => {
            dismissMasteryCelebration(activeMasteryCelebration.id);
        }, 3200);
        return () => clearTimeout(timer);
    }, [activeMasteryCelebration, dismissMasteryCelebration]);

    const queueUnlockedAchievements = () => {
        const unlocked = getPendingAchievements();
        if (unlocked.length > 0) {
            setQueuedAchievements((prev) => [...prev, ...unlocked]);
        }
    };

    const masteryStateLabel = (state: 'new' | 'learning' | 'consolidated' | 'mastered') => {
        if (language === 'zh') {
            return {
                new: '新学',
                learning: '学习中',
                consolidated: '巩固',
                mastered: '精通'
            }[state];
        }
        return {
            new: 'New',
            learning: 'Learning',
            consolidated: 'Consolidated',
            mastered: 'Mastered'
        }[state];
    };

    const shouldAutoMentor = (nextWrongCount: number) => {
        const skillTag = currentQuestion.skillTag;
        const masteryState = masteryBySkill[skillTag]?.state;
        const reviewRisk = reviewRiskBySkill[skillTag] || 0;
        const repeatedMistakes = recentMistakeBySkill[skillTag] || 0;
        const highValueMistake = currentQuestion.difficulty === 'hard' ||
            reviewRisk >= 1.5 ||
            repeatedMistakes >= 2 ||
            masteryState === 'new';

        return nextWrongCount >= 3 || health <= 1 || highValueMistake;
    };

    const markWrongAndMaybeMentor = (wrongText: string) => {
        setWrongAnswerText(wrongText);
        if (soundEnabled) playSound.hit();
        setConsecutiveWrong((prev) => {
            const next = prev + 1;
            if (shouldAutoMentor(next)) {
                setTimeout(() => setShowMentor(true), 1500);
            }
            return next;
        });
    };

    // Endless Mode: Generate more questions when running low
    useEffect(() => {
        const generateMoreQuestions = async () => {
            if (!apiKey || !context || isGeneratingMore) return;

            setIsGeneratingMore(true);

            // Import cache and fallback functions dynamically to avoid SSR issues
            const { cacheQuestions, getCachedQuestions, hashContext } = await import('@/db/db');
            const { getRandomFallbackQuestions } = await import('@/lib/data/fallbackQuestions');
            const contextHash = hashContext(context);

            try {
                const client = new OpenRouterClient(apiKey, model);
                const prompt = generateLevelPrompt(context + `\n\n(Player is Level ${playerStats.level}. Generate a new wave of challengers!)`);
                const jsonStr = await client.generate(prompt, LEVEL_GENERATOR_SYSTEM_PROMPT);

                // Robust JSON extraction
                let cleanJson = jsonStr.replace(/```json\n?|\n?```/g, '').trim();
                const firstBrace = cleanJson.indexOf('{');
                if (firstBrace === -1) throw new Error('No JSON object found');

                let braceCount = 0;
                let lastBrace = -1;
                for (let i = firstBrace; i < cleanJson.length; i++) {
                    if (cleanJson[i] === '{') braceCount++;
                    if (cleanJson[i] === '}') braceCount--;
                    if (braceCount === 0) { lastBrace = i; break; }
                }
                if (lastBrace === -1) throw new Error('Malformed JSON');

                cleanJson = cleanJson.substring(firstBrace, lastBrace + 1);
                const data = JSON.parse(cleanJson);

                if (data.monsters && Array.isArray(data.monsters)) {
                    const normalizedWave = normalizeMissionMonsters(data.monsters);
                    if (normalizedWave.length === 0) {
                        throw new Error('Generated mission has no valid questions');
                    }

                    // Cache questions for future use
                    try {
                        const questionsToCache = normalizedWave.map((m) => ({
                            question: m.question,
                            options: m.options,
                            correct_index: m.correct_index,
                            type: m.type,
                            explanation: m.explanation,
                            hint: m.hint,
                            skillTag: m.skillTag,
                            contextHash,
                            timestamp: Date.now(),
                            used: false
                        }));
                        await cacheQuestions(questionsToCache);
                        console.log(`[Cache] Saved ${questionsToCache.length} questions`);
                    } catch (cacheError) {
                        console.warn('[Cache] Failed to cache questions:', cacheError);
                    }

                    setTimeout(() => addQuestions(normalizedWave), 500);
                }
            } catch (e) {
                console.error("API failed, trying cache/fallback", e);

                // Try cached questions first
                const cached = await getCachedQuestions(contextHash, 5);
                if (cached.length > 0) {
                    console.log(`[Cache] Using ${cached.length} cached questions`);
                    const questions = cached.map(c => ({
                        id: c.id || Date.now(),
                        type: c.type || 'vocab',
                        question: c.question,
                        options: c.options,
                        correct_index: c.correct_index,
                        explanation: c.explanation,
                        hint: c.hint,
                        skillTag: c.skillTag
                    }));
                    const normalizedCached = normalizeMissionMonsters(questions);
                    setTimeout(() => addQuestions(normalizedCached), 500);
                } else {
                    // Use local fallback questions
                    console.log('[Fallback] Using local question bank');
                    const fallback = getRandomFallbackQuestions(5, 'easy');
                    const questions = fallback.map(f => ({
                        id: f.id,
                        type: f.type,
                        question: f.question,
                        options: f.options,
                        correct_index: f.correct_index,
                        explanation: f.explanation,
                        hint: f.hint,
                        skillTag: f.skillTag
                    }));
                    const normalizedFallback = normalizeMissionMonsters(questions);
                    setTimeout(() => addQuestions(normalizedFallback), 500);
                }
            } finally {
                setIsGeneratingMore(false);
            }
        };

        // Trigger when we have 2 or fewer questions left
        if (questions.length > 0 && currentIndex >= questions.length - 2 && !isGeneratingMore && context) {
            generateMoreQuestions();
        }
    }, [currentIndex, questions.length, isGeneratingMore, context, apiKey, model, addQuestions, playerStats.level]);

    useEffect(() => () => {
        stopSpeech();
    }, []);

    const handleOptionClick = (index: number) => {
        if (showResult) return;

        setSelectedOption(index);
        const result = answerQuestion(index);
        setIsCorrect(result.correct);
        setResultMessage(result.explanation);
        queueUnlockedAchievements();

        if (result.correct) {
            const types: ('slash' | 'fireball' | 'lightning')[] = ['slash', 'fireball', 'lightning'];
            const newAttackType = types[Math.floor(Math.random() * types.length)];
            setAttackType(newAttackType);

            if (soundEnabled) {
                if (newAttackType === 'slash') playSound.attackSlash();
                else if (newAttackType === 'fireball') playSound.attackFire();
                else playSound.attackZap();
            }

            // Generate particles
            const newParticles = Array.from({ length: 12 }).map((_, i) => ({
                id: Date.now() + i,
                x: Math.random() * 100 - 50,
                y: Math.random() * 100 - 50,
                color: newAttackType === 'fireball' ? '#f97316' : newAttackType === 'lightning' ? '#facc15' : '#ffffff'
            }));
            setParticles(newParticles);
            setTimeout(() => setParticles([]), 1000);

            // Damage Text & Effects
            const damage = result.damageDealt;
            let text = `-${damage}`;
            let color = '#ffffff';
            let scale = 1;
            // Randomize start position slightly for variety
            const randomX = Math.random() * 40 - 20;
            const randomRotate = Math.random() * 10 - 5;

            if (result.isCritical) {
                text = `${t.battle.critical} -${damage}`;
                color = '#ef4444'; // Red
                scale = 1.5;
                if (soundEnabled) setTimeout(playSound.crit, 100);
            } else if (result.isSuperEffective) {
                text = `${t.battle.weakness} -${damage}`;
                color = '#facc15'; // Yellow
                scale = 1.3;
                if (soundEnabled) setTimeout(playSound.attackZap, 150);
            } else {
                if (soundEnabled) setTimeout(playSound.hit, 200);
            }

            setDamageText([{ id: Date.now(), x: randomX, y: -50, text, color, scale, rotate: randomRotate }]);
            setTimeout(() => setDamageText([]), 1000);

            // Combo Effect
            setComboScale(1.5);
            setTimeout(() => setComboScale(1), 200);

            // Flying Coins (Duolingo Style: Slower, targeted)
            const newCoins = Array.from({ length: 8 }).map((_, i) => ({
                id: Date.now() + i,
                delay: i * 0.15 // Slower stagger
            }));
            setFlyingCoins(newCoins);

            // Clear coins after animation
            setTimeout(() => setFlyingCoins([]), 3000);

            // Play sounds with stagger
            if (soundEnabled) {
                newCoins.forEach((_, i) => setTimeout(playSound.coin, i * 150 + 500));
            }

            // Pump the gold counter when coins arrive
            newCoins.forEach((_, i) => {
                setTimeout(() => {
                    setGoldScale(1.5);
                    setTimeout(() => setGoldScale(1), 150);
                }, 1000 + (i * 150)); // Sync with arrival
            });
        }

        setShowResult(true);

        if (!result.correct) {
            markWrongAndMaybeMentor(currentQuestion.options[index]);
        } else {
            setConsecutiveWrong(0);
        }
    };

    const handleTextQuestionAnswer = (correct: boolean, input: string) => {
        setSelectedOption(correct ? currentQuestion.correct_index : -1);
        setIsCorrect(correct);
        setShowResult(true);
        const result = answerQuestion(correct ? currentQuestion.correct_index : -1, { userResponse: input });
        setResultMessage(result.explanation);
        queueUnlockedAchievements();
        if (!correct) {
            markWrongAndMaybeMentor(input);
        } else {
            setConsecutiveWrong(0);
        }
    };

    const handleVoiceAnswer = (correct: boolean, spokenText: string) => {
        const matchedIndex = currentQuestion.options.findIndex(
            opt => opt.toLowerCase().includes(spokenText.toLowerCase()) ||
                spokenText.toLowerCase().includes(opt.toLowerCase())
        );
        const idx = correct ? currentQuestion.correct_index : (matchedIndex >= 0 ? matchedIndex : 0);
        setSelectedOption(idx);
        setIsCorrect(correct);
        setShowResult(true);
        const result = answerQuestion(idx, { userResponse: spokenText });
        setResultMessage(result.explanation);
        queueUnlockedAchievements();
        if (!correct) {
            markWrongAndMaybeMentor(spokenText);
        } else {
            setConsecutiveWrong(0);
        }
    };

    const toggleHint = () => {
        if (!showHint) {
            recordHintUsed();
        }
        setShowHint(!showHint);
    };

    const handleNext = () => {
        setSelectedOption(null);
        setShowResult(false);
        setShowHint(false);
        setAttackType('slash');

        // Check for Boss Reward
        if (currentQuestion.isBoss) {
            if (currentMonsterHp <= 0) {
                generateRewards('boss');
            }
            return;
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
            {/* HUD */}
            <div className="flex justify-between items-center mb-4 bg-secondary/30 p-4 rounded-2xl backdrop-blur-sm border border-border">
                <div className="flex items-center gap-4">
                    {/* Health Hearts */}
                    <div className="flex gap-1">
                        {[...Array(maxHealth)].map((_, i) => (
                            <motion.div
                                key={i}
                                initial={{ scale: 1 }}
                                animate={{
                                    scale: i < health ? 1 : 0.8,
                                    opacity: i < health ? 1 : 0.2
                                }}
                                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            >
                                <Heart
                                    className={cn(
                                        "w-8 h-8 transition-colors",
                                        i < health ? "text-destructive fill-destructive" : "text-muted-foreground"
                                    )}
                                />
                            </motion.div>
                        ))}
                    </div>

                    {/* Player Level & XP */}
                    <div className="flex flex-col gap-1 min-w-[120px]">
                        <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
                            <span>{t.battle.level} {playerStats.level}</span>
                            <span>{t.battle.xp} {playerStats.xp}/{playerStats.maxXp}</span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-blue-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${(playerStats.xp / playerStats.maxXp) * 100}% ` }}
                                transition={{ type: "spring", stiffness: 100 }}
                            />
                        </div>
                    </div>
                </div>

                <div className="font-mono text-xl font-bold text-primary">
                    {t.battle.score}: {score.toString().padStart(6, '0')}
                </div>

                <div className="flex items-center gap-4">
                    <motion.button
                        animate={{ scale: goldScale }}
                        onClick={() => setShowShop(true)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-500 rounded-lg border border-yellow-500/30 transition-colors relative z-50"
                    >
                        <Coins className="w-4 h-4" />
                        <span className="font-mono font-bold">{playerStats.gold}</span>
                    </motion.button>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Shield className="w-5 h-5" />
                        <span>{t.battle.level} {currentIndex + 1}/{questions.length}</span>
                    </div>
                </div>
            </div>

            {(inventory.some(i => i.type === 'relic_midas') || inventory.some(i => i.type === 'relic_scholar')) && (
                <div className="flex gap-2 flex-wrap text-xs text-muted-foreground mb-8">
                    <span className="font-bold text-primary mr-1">{t.battle.activeRelics}:</span>
                    {inventory.some(i => i.type === 'relic_midas') && (
                        <span className="px-2 py-1 rounded-full bg-yellow-500/10 border border-yellow-500/30 text-yellow-500">
                            {t.battle.relicMidas}
                        </span>
                    )}
                    {inventory.some(i => i.type === 'relic_scholar') && (
                        <span className="px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400">
                            {t.battle.relicScholar}
                        </span>
                    )}
                </div>
            )}

            <div className="flex gap-4 text-xs text-muted-foreground mb-6">
                <span>{t.battle.knowledgeCards}: {knowledgeCards.length}</span>
                <span>
                    {t.battle.rootFragments}: {rootFragments}
                    <span className="ml-2 text-[10px] text-muted-foreground/80">
                        {t.battle.fragmentsHint.replace('{count}', fragmentsUntilCraft.toString())}
                    </span>
                </span>
            </div>

            {/* New Challenger Alert */}
            <AnimatePresence>
                {isGeneratingMore && (
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="fixed top-20 left-1/2 -translate-x-1/2 bg-yellow-500/90 text-black px-6 py-2 rounded-full font-bold shadow-lg z-50 flex items-center gap-2"
                    >
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        {t.battle.summoning}
                    </motion.div>
                )}
            </AnimatePresence>

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
                    onToggleHint={toggleHint}
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

            {/* Flying Coins Animation */}
            <AnimatePresence>
                {flyingCoins.map((coin) => (
                    <motion.div
                        key={coin.id}
                        initial={{ opacity: 1, x: 0, y: 0, scale: 0.5, rotate: 0 }}
                        animate={{
                            opacity: [1, 1, 0],
                            x: [0, 100, window.innerWidth / 2 - 80], // Target top-right (approximate gold counter pos)
                            y: [0, -50, -window.innerHeight / 2 + 60],
                            scale: [0.5, 1.2, 0.5],
                            rotate: 720
                        }}
                        transition={{ duration: 1.5, ease: "easeInOut", delay: coin.delay }}
                        className="fixed top-1/2 left-1/2 z-[100] text-yellow-400 pointer-events-none"
                    >
                        <Coins className="w-8 h-8 drop-shadow-lg" />
                    </motion.div>
                ))}
            </AnimatePresence>

            {/* Inventory Bar */}
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/80 backdrop-blur rounded-2xl border border-white/10 shadow-xl z-40">
                {inventory.length === 0 && (
                    <div className="px-4 py-2 text-xs text-muted-foreground italic">{t.battle.inventoryEmpty}</div>
                )}
                {inventory.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => consumeItem(item.id)}
                        className="w-10 h-10 bg-slate-800 rounded-lg border border-white/20 flex items-center justify-center text-xl hover:scale-110 hover:bg-slate-700 transition-all relative group"
                        title={item.name}
                    >
                        {item.icon}
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black px-2 py-1 rounded text-[10px] text-white opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                            {item.name}
                        </span>
                    </button>
                ))}
            </div>

            <AnimatePresence>
                {activeAchievement && (
                    <AchievementToast
                        achievement={activeAchievement}
                        onClose={() => setActiveAchievement(null)}
                    />
                )}
            </AnimatePresence>

            <AnimatePresence>
                {activeMasteryCelebration && (
                    <motion.div
                        key={activeMasteryCelebration.id}
                        initial={{ x: -240, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: -240, opacity: 0 }}
                        className="fixed top-20 left-4 z-50 bg-emerald-50 border-2 border-emerald-400 text-emerald-900 rounded-xl p-4 shadow-xl max-w-xs"
                    >
                        <p className="text-xs font-semibold uppercase tracking-wide">
                            {language === 'zh' ? '技能进阶' : 'Mastery Up'}
                        </p>
                        <p className="font-bold text-sm mt-1">
                            {activeMasteryCelebration.skillTag.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs mt-1">
                            {masteryStateLabel(activeMasteryCelebration.fromState)} -&gt; {masteryStateLabel(activeMasteryCelebration.toState)}
                        </p>
                        <div className="mt-2 text-xs font-semibold flex items-center gap-3">
                            <span>+{activeMasteryCelebration.bonusXp} XP</span>
                            <span>+{activeMasteryCelebration.bonusGold} Gold</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div >
    );
}
