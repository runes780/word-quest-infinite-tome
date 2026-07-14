export const SYNTHETIC_STUDY_MATERIAL =
    'Yesterday was Sunday. I went to the park with my friends. ' +
    'We played football and had a picnic. The weather was sunny and warm.';

/** Safe for public tests and screenshots. No person, school, or account identity. */
export const SYNTHETIC_LEARNER_PROFILE = {
    id: 'synthetic-learner',
    displayLabel: 'Demo Learner',
    level: 5,
    streakDays: 9,
    totalXp: 432
} as const;

export const SYNTHETIC_DASHBOARD_LABELS = {
    missionTitle: 'Synthetic Reading Mission',
    dueQuestion: 'Choose the cause in the synthetic sentence.',
    mistakeQuestion: 'Why did the bird fly south in the synthetic story?',
    taskTitle: 'Synthetic Reading Sprint'
} as const;

export const SYNTHETIC_QUESTION_CASES = {
    vocabulary: {
        objective: 'vocab_context_meaning',
        question: 'Here, "warm" most nearly means ___.',
        answer: 'not cold'
    },
    grammar: {
        objective: 'grammar_past_simple',
        question: 'Yesterday, they ___ football.',
        answer: 'played'
    },
    reading: {
        objective: 'reading_detail',
        question: 'What was the weather like?',
        answer: 'sunny and warm'
    }
} as const;

export const SYNTHETIC_MISTAKE_CASE = {
    question: SYNTHETIC_DASHBOARD_LABELS.mistakeQuestion,
    wrongAnswer: 'Because it was tired',
    correctAnswer: 'Because winter was coming',
    skillTag: 'cause_effect'
} as const;

export const SYNTHETIC_STUDY_PLAN = {
    title: 'Synthetic Daily Learning Path',
    estimatedMinutes: 12,
    steps: ['review_due_cards', 'practice_reading_inference', 'transfer_check']
} as const;

export const SYNTHETIC_FALLBACK_ANSWERS: Array<[questionFragment: string, answer: string]> = [
    ['she ___ the plants', 'waters'],
    ['Here "red" means', 'good to eat'],
    ['What does "them" refer to', 'the tomatoes'],
    ['What does this show about Mia', 'she cares for the garden'],
    ['He ___ to school', 'walks'],
    ['Why does Tom take an umbrella', 'to keep dry']
];
