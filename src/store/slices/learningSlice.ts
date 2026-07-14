import type { StateCreator } from 'zustand';
import type { GameState } from '@/store/gameStore';
import { applyLearningMetadataForSource, applyQuestionDefaults, getSkillKey } from '@/store/modules/questionFlow';
import { loadInitialRevengeQueue, persistRevengeQueue, sanitizeForQueue } from '@/store/modules/revengeQueue';

export type LearningSlice = Pick<
    GameState,
    | 'questions'
    | 'context'
    | 'userAnswers'
    | 'skillStats'
    | 'revengeQueue'
    | 'sessionSource'
    | 'masteryBySkill'
    | 'reviewRiskBySkill'
    | 'recentMistakeBySkill'
    | 'masteryCelebrations'
    | 'runObjectiveBonuses'
    | 'activePracticePlanRun'
    | 'activePracticePlanStepId'
    | 'addQuestions'
    | 'injectQuestion'
    | 'addToRevengeQueue'
    | 'dismissMasteryCelebration'
>;

export const createLearningSlice: StateCreator<GameState, [], [], LearningSlice> = (set, get) => ({
    questions: [],
    context: '',
    userAnswers: [],
    skillStats: {},
    revengeQueue: loadInitialRevengeQueue(),
    sessionSource: 'battle',
    masteryBySkill: {},
    reviewRiskBySkill: {},
    recentMistakeBySkill: {},
    masteryCelebrations: [],
    runObjectiveBonuses: [],
    activePracticePlanRun: null,
    activePracticePlanStepId: null,

    addQuestions: (newQuestions) => {
        const { questions, sessionSource, masteryBySkill } = get();
        const processedQuestions = newQuestions.map((question, index) => {
            const prepared = applyQuestionDefaults(question, questions.length + index);
            return applyLearningMetadataForSource(prepared, sessionSource, masteryBySkill[getSkillKey(prepared)]);
        });
        set({ questions: [...questions, ...processedQuestions] });
    },

    injectQuestion: (question) => {
        const { questions, currentIndex, sessionSource, masteryBySkill } = get();
        const nextQuestions = [...questions];
        const prepared = applyQuestionDefaults(question, currentIndex + 1);
        nextQuestions.splice(
            currentIndex + 1,
            0,
            applyLearningMetadataForSource(prepared, sessionSource, masteryBySkill[getSkillKey(prepared)])
        );
        set({ questions: nextQuestions });
    },

    addToRevengeQueue: (question) => {
        set((state) => {
            const entry = sanitizeForQueue(question);
            const exists = state.revengeQueue.some((candidate) =>
                candidate.question === entry.question && candidate.correct_index === entry.correct_index
            );
            if (exists) return state;
            const revengeQueue = [...state.revengeQueue, entry].slice(-10);
            persistRevengeQueue(revengeQueue);
            return { revengeQueue };
        });
    },

    dismissMasteryCelebration: (id) => set((state) => ({
        masteryCelebrations: state.masteryCelebrations.filter((entry) => entry.id !== id)
    }))
});
