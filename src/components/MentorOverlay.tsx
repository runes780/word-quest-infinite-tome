
'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Zap, ArrowRight } from 'lucide-react';
import { OpenRouterClient } from '@/lib/ai/openrouter';
import { MENTOR_SYSTEM_PROMPT, generateMentorPrompt } from '@/lib/ai/prompts';
import { useSettingsStore } from '@/store/settingsStore';
import { Monster } from '@/store/gameStore';
import { translations } from '@/lib/translations';
import { cacheMentorAnalysis, loadMentorCache } from '@/lib/data/mistakes';

interface MentorOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    question: Monster;
    wrongAnswer: string;
    onRevenge: (revengeQuestion: Monster) => void;
}

const COOLDOWN_MS = 6000;

export function MentorOverlay({ isOpen, onClose, question, wrongAnswer, onRevenge }: MentorOverlayProps) {
    const { apiKey, model, language } = useSettingsStore();
    const t = translations[language];
    const [analysis, setAnalysis] = useState('');
    const [revengeQuestion, setRevengeQuestion] = useState<Monster | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState('');
    const lastRequestRef = useRef(0);

    useEffect(() => {
        if (!isOpen || !question || !wrongAnswer) return;

        let cancelled = false;
        setAnalysis('');
        setRevengeQuestion(null);
        setStatusMessage('');

        const fetchMentor = async () => {
            setIsLoading(true);
            const cached = await loadMentorCache(question.id, wrongAnswer);
            if (cancelled) return;
            if (cached) {
                setAnalysis(cached.mentorAnalysis || question.explanation);
                if (cached.revengeQuestion) {
                    setRevengeQuestion({
                        id: Date.now(),
                        question: cached.revengeQuestion.question,
                        options: cached.revengeQuestion.options,
                        correct_index: cached.revengeQuestion.correct_index,
                        type: cached.revengeQuestion.type || question.type,
                        explanation: cached.revengeQuestion.explanation || t.mentor.revengeReady
                    });
                }
                setStatusMessage(t.mentor.cached);
                setIsLoading(false);
                return;
            }

            if (!apiKey) {
                setStatusMessage(t.mentor.noKey);
                setIsLoading(false);
                return;
            }

            const now = Date.now();
            const remaining = Math.max(0, COOLDOWN_MS - (now - lastRequestRef.current));
            if (lastRequestRef.current && remaining > 0) {
                setStatusMessage(`${t.mentor.cooldown} (${Math.ceil(remaining / 1000)}s)`);
                setIsLoading(false);
                return;
            }

            try {
                const client = new OpenRouterClient(apiKey, model);
                const prompt = generateMentorPrompt(question.question, wrongAnswer, question.options[question.correct_index]);
                const jsonStr = await client.generate(prompt, MENTOR_SYSTEM_PROMPT);
                const cleanJson = jsonStr.replace(/```json\n?|\n?```/g, '').trim();
                const data = JSON.parse(cleanJson);

                const revengePayload = {
                    question: data.revenge_question.question,
                    options: data.revenge_question.options,
                    correct_index: data.revenge_question.correct_index,
                    type: question.type,
                    explanation: t.mentor.revengeComplete
                };

                setAnalysis(data.analysis);
                setRevengeQuestion({
                    ...revengePayload,
                    id: Date.now()
                });
                setStatusMessage(t.mentor.revengeReady);
                lastRequestRef.current = Date.now();

                await cacheMentorAnalysis({
                    questionId: question.id,
                    questionText: question.question,
                    wrongAnswer,
                    correctAnswer: question.options[question.correct_index],
                    explanation: question.explanation,
                    analysis: data.analysis,
                    mentorExplanation: question.explanation,
                    options: question.options,
                    correctIndex: question.correct_index,
                    type: question.type,
                    skillTag: question.skillTag,
                    revengeQuestion: revengePayload
                });
            } catch (e) {
                console.error(e);
                setAnalysis(t.mentor.error + question.explanation);
            } finally {
                if (!cancelled) {
                    setIsLoading(false);
                }
            }
        };

        fetchMentor();

        return () => {
            cancelled = true;
        };
    }, [isOpen, question, wrongAnswer, apiKey, model, language, t]);

    const handleChallenge = () => {
        if (revengeQuestion) {
            onRevenge(revengeQuestion);
            onClose();
        } else {
            onClose();
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ scale: 0.8, y: 50 }}
                        animate={{ scale: 1, y: 0 }}
                        className="max-w-2xl w-full bg-card border-2 border-primary/50 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(59,130,246,0.3)]"
                    >
                        <div className="bg-primary/10 p-6 border-b border-primary/20 flex items-center gap-4">
                            <div className="p-3 bg-primary rounded-full animate-pulse">
                                <Bot className="w-8 h-8 text-primary-foreground" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-primary">{t.mentor.title}</h2>
                                <p className="text-sm text-muted-foreground">{t.mentor.analyzing}</p>
                            </div>
                        </div>

                        <div className="p-8 space-y-6">
                            {isLoading ? (
                                <div className="space-y-4 animate-pulse">
                                    <div className="h-4 bg-secondary rounded w-3/4" />
                                    <div className="h-4 bg-secondary rounded w-1/2" />
                                    <div className="h-4 bg-secondary rounded w-5/6" />
                                </div>
                            ) : (
                                <div className="prose prose-invert max-w-none">
                                    <p className="text-lg leading-relaxed text-foreground/90 font-medium">
                                        {analysis}
                                    </p>
                                </div>
                            )}

                            {statusMessage && (
                                <p className="text-xs text-muted-foreground text-center">
                                    {statusMessage}
                                </p>
                            )}

                            {!isLoading && revengeQuestion && (
                                <motion.button
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={handleChallenge}
                                    className="w-full py-4 bg-gradient-to-r from-primary to-purple-600 rounded-xl font-bold text-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform shadow-lg"
                                >
                                    <Zap className="w-5 h-5" />
                                    {t.mentor.acceptChallenge}
                                    <ArrowRight className="w-5 h-5" />
                                </motion.button>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
