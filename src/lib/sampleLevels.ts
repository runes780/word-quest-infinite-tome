import { Monster } from '@/store/gameStore';

export interface SampleLevel {
    id: string;
    title: string;
    context: string;
    monsters: Monster[];
}

const sunnyContext = `Yesterday was Sunday. I went to the park with my friends.\nWe played football and had a picnic. The weather was sunny and warm.`;

const sunnyMonsters: Monster[] = [
    {
        id: 91001,
        type: 'grammar',
        question: 'Yesterday I _____ to the park.',
        options: ['go', 'went', 'going', 'goes'],
        correct_index: 1,
        hint: '"Yesterday" 提示过去式，go 的过去式是 went。',
        explanation: '"Yesterday" 提示过去式，go 的过去式是 went。',
        skillTag: 'past_tense',
        difficulty: 'medium',
        questionMode: 'choice',
        correctAnswer: 'went',
        learningObjectiveId: 'past_tense_basic',
        supportLevel: 3,
        sourceContextSpan: 'Yesterday was Sunday. I went to the park with my friends.'
    },
    {
        id: 91002,
        type: 'vocab',
        question: 'Read: "We played football and had a picnic." A meal outside is called a ___.',
        options: ['picnic', 'snack', 'game', 'park'],
        correct_index: 0,
        hint: 'Look at "had a picnic" in the sentence.',
        explanation: 'Picnic 就是户外野餐，句子里的 "had a picnic" 给出了答案。',
        skillTag: 'life_vocab',
        difficulty: 'medium',
        questionMode: 'typing',
        correctAnswer: 'picnic',
        learningObjectiveId: 'vocab_context_meaning',
        supportLevel: 1,
        sourceContextSpan: 'We played football and had a picnic.'
    },
    {
        id: 91003,
        type: 'grammar',
        question: 'Yesterday we _____ football in the park.',
        options: ['play', 'played', 'playing', 'plays'],
        correct_index: 1,
        hint: '"Yesterday" 说明动作发生在过去。',
        explanation: '昨天发生的动作用过去式 played。',
        skillTag: 'past_tense',
        difficulty: 'medium',
        questionMode: 'fill-blank',
        correctAnswer: 'played',
        learningObjectiveId: 'past_tense_basic',
        supportLevel: 2,
        sourceContextSpan: 'We played football and had a picnic.'
    },
    {
        id: 91004,
        type: 'reading',
        question: 'What was the weather like?',
        options: ['Rainy and cold', 'Sunny and warm', 'Snowy and windy', 'Foggy and dark'],
        correct_index: 1,
        hint: 'Look at the adjective in the passage.',
        explanation: '原文写 the weather was sunny and warm。',
        skillTag: 'reading_detail',
        difficulty: 'easy',
        questionMode: 'choice',
        correctAnswer: 'Sunny and warm',
        learningObjectiveId: 'reading_detail',
        supportLevel: 3,
        sourceContextSpan: 'The weather was sunny and warm.'
    },
    {
        id: 91005,
        type: 'vocab',
        question: 'Read: "I went to the park with my friends." The word "friends" means ___.',
        options: ['the weather', 'a meal outside', 'buddies', 'a day of the week'],
        correct_index: 2,
        hint: 'Which word is about people?',
        explanation: '"Friends" 与 "buddies" 同义，都指朋友。',
        skillTag: 'friends_vocab',
        difficulty: 'medium',
        questionMode: 'choice',
        correctAnswer: 'buddies',
        learningObjectiveId: 'vocab_context_meaning',
        supportLevel: 3,
        sourceContextSpan: 'Yesterday was Sunday. I went to the park with my friends.'
    }
];

export const SAMPLE_LEVELS: SampleLevel[] = [
    {
        id: 'sunny-park',
        title: 'Sunny Park Patrol',
        context: sunnyContext,
        monsters: sunnyMonsters
    }
];
