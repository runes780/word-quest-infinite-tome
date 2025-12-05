
'use client';

import { useState, useEffect } from 'react';
import { useGameStore, BOSS_COMBO_THRESHOLD, CRAFT_THRESHOLD } from '@/store/gameStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Shield, Sword, HelpCircle, Lightbulb, Coins, Zap, Flame } from 'lucide-react';
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
        rootFragments

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
    const [damageText, setDamageText] = useState<{ id: number; x: number; y: number; text: string; color: string; scale: number }[]>([]);
    const [flyingCoins, setFlyingCoins] = useState<{ id: number; delay: number }[]>([]);
    const [comboScale, setComboScale] = useState(1);
    const [goldScale, setGoldScale] = useState(1);
    const [wrongAnswerText, setWrongAnswerText] = useState('');
    const [consecutiveWrong, setConsecutiveWrong] = useState(0);
    const [showHint, setShowHint] = useState(false);

    const currentQuestion = questions[currentIndex];

    // Endless Mode: Generate more questions when running low
    useEffect(() => {
        const generateMoreQuestions = async () => {
            if (!apiKey || !context || isGeneratingMore) return;

            setIsGeneratingMore(true);
            try {
                const client = new OpenRouterClient(apiKey, model);
                // Add variety by asking for a "new wave" or slightly harder questions based on level
                const prompt = generateLevelPrompt(context + `\n\n(Player is Level ${playerStats.level}.Generate a new wave of challengers!)`);
                const jsonStr = await client.generate(prompt, LEVEL_GENERATOR_SYSTEM_PROMPT);
                const cleanJson = jsonStr.replace(/```json\n ?|\n ? ```/g, '').trim();
                const data = JSON.parse(cleanJson);

                if (data.monsters && Array.isArray(data.monsters)) {
                    // Add a small delay to not jank the UI
                    setTimeout(() => {
                        addQuestions(data.monsters);
                    }, 500);
                }
            } catch (e) {
                console.error("Failed to generate more questions", e);
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

            setDamageText([{ id: Date.now(), x: randomX, y: -50, text, color, scale }]);
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
            setWrongAnswerText(currentQuestion.options[index]);
            setConsecutiveWrong(prev => prev + 1);
            if (soundEnabled) playSound.hit(); // Player takes damage

            // Trigger mentor on 3rd wrong or if health is critical
            if (consecutiveWrong >= 2 || health <= 1) {
                setTimeout(() => setShowMentor(true), 1500);
            }
        } else {
            setConsecutiveWrong(0);
        }
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

                {/* Left Column: Battle Scene */}
                <div className="relative bg-slate-900/50 rounded-3xl border-2 border-primary/20 overflow-hidden flex flex-col items-center justify-center p-8 shadow-inner">
                    {/* Background Atmosphere */}
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-slate-900/50 to-slate-950/80" />

                    {/* Battle Stage */}
                    <div className="relative z-10 w-full flex justify-between items-center gap-4">

                        {/* Hero Avatar */}
                        <div className="flex flex-col items-center">
                            <motion.div
                                animate={
                                    showResult && isCorrect
                                        ? { x: [0, 100, 0], scale: [1, 1.2, 1], rotate: [0, 10, 0] } // Attack lunge
                                        : showResult && !isCorrect
                                            ? { x: [-10, 10, -10, 10, 0], color: "#ef4444" } // Damage shake
                                            : { y: [0, -5, 0] } // Idle breathing
                                }
                                transition={showResult ? { duration: 0.5 } : { repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                className="relative group"
                            >
                                {/* Hero Aura */}
                                <div className="absolute inset-0 bg-blue-500/30 blur-xl rounded-full group-hover:bg-blue-500/50 transition-all duration-500" />

                                {/* Hero Character */}
                                <div className="relative w-32 h-32 md:w-40 md:h-40 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl border-4 border-blue-400 shadow-[0_0_30px_rgba(59,130,246,0.6)] flex items-center justify-center transform rotate-3">
                                    <Sword className="w-16 h-16 text-white drop-shadow-lg" />
                                    {/* Eyes */}
                                    <div className="absolute top-8 flex gap-4">
                                        <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                                        <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                                    </div>

                                    {/* Attack Effects */}
                                    <AnimatePresence>
                                        {showResult && isCorrect && (
                                            <>
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.5 }}
                                                    animate={{ opacity: 1, scale: 1.5 }}
                                                    exit={{ opacity: 0 }}
                                                    className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                                                >
                                                    {attackType === 'slash' && (
                                                        <motion.div
                                                            initial={{ pathLength: 0, opacity: 0 }}
                                                            animate={{ pathLength: 1, opacity: 1 }}
                                                            transition={{ duration: 0.2 }}
                                                            className="w-32 h-32 absolute"
                                                        >
                                                            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
                                                                <path d="M0,100 L100,0" stroke="white" strokeWidth="8" strokeLinecap="round" />
                                                            </svg>
                                                        </motion.div>
                                                    )}
                                                    {attackType === 'fireball' && <Flame className="w-24 h-24 text-orange-500 fill-orange-500 animate-pulse drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]" />}
                                                    {attackType === 'lightning' && <Zap className="w-24 h-24 text-yellow-400 fill-yellow-400 animate-bounce drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]" />}
                                                </motion.div>

                                                {/* Particles */}
                                                {particles.map((p) => (
                                                    <motion.div
                                                        key={p.id}
                                                        initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                                                        animate={{ x: p.x, y: p.y, opacity: 0, scale: 0 }}
                                                        transition={{ duration: 0.6, ease: "easeOut" }}
                                                        className="absolute w-2 h-2 rounded-full pointer-events-none z-10"
                                                        style={{ backgroundColor: p.color, left: '50%', top: '50%' }}
                                                    />
                                                ))}
                                            </>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Name Tag */}
                                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-1 rounded-full border border-blue-500/50 text-blue-200 text-xs font-bold tracking-widest uppercase">
                                    {t.battle.hero}
                                </div>
                            </motion.div>
                        </div>

                        {/* VS Badge */}
                        <div className="text-4xl font-black text-white/10 italic absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
                            {t.battle.vs}
                        </div>

                        {/* Combo Counter */}
                        <AnimatePresence>
                            {playerStats.streak > 1 && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.5, y: 20 }}
                                    animate={{ opacity: 1, scale: comboScale, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.5, y: 20 }}
                                    className="absolute top-24 left-4 z-20 pointer-events-none"
                                >
                                    <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white px-4 py-2 rounded-full font-black italic transform -rotate-6 shadow-lg border-2 border-white/20 flex flex-col items-center">
                                        <span className="text-xs uppercase tracking-widest opacity-90">{t.battle.combo}</span>
                                        <span className="text-3xl leading-none">{playerStats.streak}x</span>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Monster Avatar */}
                        <div className="flex flex-col items-center">
                            <motion.div
                                animate={
                                    showResult && isCorrect
                                        ? { x: [10, -10, 10, -10, 0], opacity: [1, 0.5, 1, 0.5, 1], scale: [1, 0.9, 1], filter: ["brightness(1)", "brightness(2)", "brightness(1)"] } // Take damage
                                        : showResult && !isCorrect
                                            ? { x: [0, -100, 0], scale: [1, 1.3, 1], rotate: [0, -10, 0] } // Attack lunge
                                            : { y: [0, -10, 0], rotate: [0, 2, -2, 0] } // Idle float
                                }
                                transition={
                                    showResult
                                        ? { duration: 0.5 }
                                        : { repeat: Infinity, duration: 3, ease: "easeInOut" }
                                }
                                className="relative group"
                            >
                                {/* Monster Aura */}
                                <div className={cn(
                                    "absolute inset-0 blur-xl rounded-full transition-all duration-500",
                                    currentQuestion.type === 'grammar' ? "bg-purple-500/30 group-hover:bg-purple-500/50" :
                                        currentQuestion.type === 'vocab' ? "bg-orange-500/30 group-hover:bg-orange-500/50" :
                                            "bg-emerald-500/30 group-hover:bg-emerald-500/50"
                                )} />

                                {/* Monster Character */}
                                <div className={cn(
                                    "relative w-32 h-32 md:w-40 md:h-40 rounded-full border-4 shadow-2xl flex items-center justify-center transition-colors overflow-hidden",
                                    currentQuestion.type === 'grammar' ? "bg-gradient-to-br from-purple-600 to-fuchsia-800 border-purple-400" :
                                        currentQuestion.type === 'vocab' ? "bg-gradient-to-br from-orange-600 to-red-800 border-orange-400" :
                                            "bg-gradient-to-br from-emerald-600 to-teal-800 border-emerald-400"
                                )}>
                                    <div className="text-7xl drop-shadow-2xl transform hover:scale-110 transition-transform duration-300">
                                        {currentQuestion.type === 'grammar' ? '🧙‍♂️' :
                                            currentQuestion.type === 'vocab' ? '🧛' :
                                                '🧟'}
                                    </div>

                                    {/* Monster Effects */}
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                                </div>

                                {/* Damage Text */}
                                <AnimatePresence>
                                    {damageText.map((text) => (
                                        <motion.div
                                            key={text.id}
                                            initial={{ opacity: 1, y: -50, x: text.x, scale: 0.5, rotate: Math.random() * 10 - 5 }}
                                            animate={{ opacity: 0, y: -150, x: text.x * 1.5, scale: text.scale, rotate: 0 }}
                                            transition={{ duration: 0.8, ease: "easeOut" }}
                                            className="absolute top-0 left-1/2 -translate-x-1/2 z-50 font-black pointer-events-none whitespace-nowrap drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]"
                                            style={{ color: text.color, fontSize: `${2 * text.scale}rem` }}
                                        >
                                            {text.text}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {/* Name Tag */}
                                <div className={cn(
                                    "absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur px-4 py-1 rounded-full border text-xs font-bold tracking-widest uppercase whitespace-nowrap",
                                    currentQuestion.type === 'grammar' ? "border-purple-500/50 text-purple-200" :
                                        currentQuestion.type === 'vocab' ? "border-orange-500/50 text-orange-200" :
                                            "border-emerald-500/50 text-emerald-200"
                                )}>
                                    {currentQuestion.type} {t.battle.boss}
                                </div>

                                {/* Monster HP Bar */}
                                {currentQuestion.isBoss && (
                                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 w-32 h-4 bg-black/50 backdrop-blur rounded-full border border-white/10 overflow-hidden">
                                        <motion.div
                                            className="h-full bg-red-500"
                                            initial={{ width: '100%' }}
                                            animate={{ width: `${(currentMonsterHp / (currentQuestion.maxHp || 3)) * 100}% ` }}
                                        />
                                    </div>
                                )}

                                {currentQuestion.isBoss && (
                                    <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex gap-1">
                                        {Array.from({ length: BOSS_COMBO_THRESHOLD }).map((_, idx) => (
                                            <div
                                                key={idx}
                                                className={cn(
                                                    'w-3 h-1.5 rounded-full border border-yellow-400/60',
                                                    idx < bossShieldProgress ? 'bg-yellow-300 shadow-[0_0_6px_rgba(250,204,21,0.7)]' : 'bg-transparent'
                                                )}
                                            />
                                        ))}
                                    </div>
                                )}

                                {/* Damage Text */}
                                <AnimatePresence>
                                    {damageText.map((d) => (
                                        <motion.div
                                            key={d.id}
                                            initial={{ opacity: 0, y: 0, scale: 0.5 }}
                                            animate={{ opacity: 1, y: d.y, scale: 1.5 }}
                                            exit={{ opacity: 0 }}
                                            className="absolute left-1/2 top-0 -translate-x-1/2 text-4xl font-black text-red-500 drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] z-50 pointer-events-none"
                                        >
                                            {d.text}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </motion.div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Question & Interface */}
                <div className="flex flex-col justify-center space-y-6">
                    {/* Question Card */}
                    <motion.div
                        key={currentQuestion.id}
                        initial={{ x: 20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="bg-card/50 backdrop-blur-sm border-2 border-primary/10 rounded-3xl p-6 md:p-8 shadow-xl"
                    >
                        <div className="flex items-center gap-3 mb-4">
                            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                                {t.battle.missionObjective}
                            </span>
                            <div className="ml-auto flex items-center gap-2">
                                {ttsEnabled && (
                                    <button
                                        onClick={handleSpeakQuestion}
                                        className="text-xs text-primary hover:text-primary/80 underline"
                                    >
                                        {t.battle.readQuestion}
                                    </button>
                                )}
                                {currentQuestion.hint && !showResult && (
                                    <button
                                        onClick={() => setShowHint(!showHint)}
                                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                                    >
                                        <Lightbulb className="w-3 h-3" />
                                        {showHint ? t.battle.hideHint : t.battle.hint}
                                    </button>
                                )}
                            </div>
                        </div>

                        <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4 leading-tight">
                            {currentQuestion.question}
                        </h3>

                        <AnimatePresence>
                            {showHint && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="bg-yellow-500/10 border-l-4 border-yellow-500 pl-4 py-2 text-sm text-yellow-600 dark:text-yellow-400 italic mb-4">
                                        &ldquo;{currentQuestion.hint}&rdquo;
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Options */}
                        <div className="grid grid-cols-1 gap-3">
                            {currentQuestion.options.map((option, index) => {
                                const clarityDisabled = !!(clarityEffect && clarityEffect.questionId === currentQuestion.id && clarityEffect.hiddenOptions.includes(index));
                                return (
                                    <motion.button
                                        key={index}
                                        initial={{ x: 20, opacity: 0 }}
                                        animate={{ x: 0, opacity: 1 }}
                                        transition={{ delay: index * 0.1 }}
                                        onClick={() => handleOptionClick(index)}
                                        disabled={showResult || clarityDisabled}
                                        className={cn(
                                            "w-full p-4 rounded-xl border-2 text-left font-medium transition-all relative overflow-hidden group hover:shadow-md hover:scale-[1.02]",
                                            clarityDisabled && "opacity-40 pointer-events-none grayscale",
                                            selectedOption === index
                                                ? isCorrect
                                                    ? "border-green-500 bg-green-500/10 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]"
                                                    : "border-destructive bg-destructive/10 text-destructive shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                                                : "border-border bg-card hover:border-primary hover:bg-primary/5"
                                        )}
                                    >
                                        <div className="flex items-center justify-between relative z-10">
                                            <span className="text-lg">{option}</span>
                                            {selectedOption === index && (
                                                isCorrect ? <Sword className="w-5 h-5 animate-bounce" /> : <Shield className="w-5 h-5 animate-pulse" />
                                            )}
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </div>
                        {clarityEffect && clarityEffect.questionId === currentQuestion.id && (
                            <p className="text-xs text-blue-400 mt-2">{t.battle.clarityActive}</p>
                        )}
                    </motion.div>

                    {/* Result Feedback Area */}
                    <AnimatePresence mode="wait">
                        {showResult && (
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: -20, opacity: 0 }}
                                className={cn(
                                    "p-6 rounded-2xl border-2 shadow-lg backdrop-blur-md",
                                    isCorrect
                                        ? "bg-green-500/10 border-green-500/30 shadow-green-500/10"
                                        : "bg-destructive/10 border-destructive/30 shadow-destructive/10"
                                )}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h4 className={cn("text-xl font-black mb-2 uppercase tracking-wide", isCorrect ? "text-green-500" : "text-destructive")}>
                                            {isCorrect ? `✨ ${t.battle.victory} ` : `💥 ${t.battle.defeat} `}
                                        </h4>
                                        <div className="flex items-start gap-2">
                                            <p className="text-sm font-medium opacity-90 leading-relaxed text-balance flex-1">{resultMessage}</p>
                                            {ttsEnabled && (
                                                <button
                                                    onClick={handleSpeakExplanation}
                                                    className="text-xs text-primary underline"
                                                >
                                                    {t.battle.readExplanation}
                                                </button>
                                            )}
                                        </div>
                                        {currentQuestion.isBoss && currentMonsterHp > 0 && (
                                            <p className="text-xs text-muted-foreground mt-2">
                                                {t.battle.shieldProgress}: {bossShieldProgress}/{BOSS_COMBO_THRESHOLD}
                                            </p>
                                        )}
                                        {clarityEffect && clarityEffect.questionId === currentQuestion.id && (
                                            <p className="text-xs text-blue-400 mt-2">{t.battle.clarityActive}</p>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-2 shrink-0">
                                        {!isCorrect && (
                                            <button
                                                onClick={() => setShowMentor(true)}
                                                className="px-4 py-2 bg-background/50 hover:bg-background/80 text-foreground rounded-lg border border-border transition-colors flex items-center justify-center gap-2 text-sm font-bold"
                                            >
                                                <HelpCircle className="w-4 h-4" />
                                                {t.battle.analyze}
                                            </button>
                                        )}
                                        <button
                                            onClick={handleNext}
                                            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25 font-black uppercase tracking-wide"
                                        >
                                            {t.battle.nextLevel}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
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
        </div >
    );
}
