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
        hint: 'Past tense of "go"',
        explanation: '"Yesterday" 提示过去式，go 的过去式是 went。',
        skillTag: 'past_tense',
        difficulty: 'easy',
        questionMode: 'choice',
        correctAnswer: 'went'
    },
    {
        id: 91002,
        type: 'vocab',
        question: 'Which word means "friends"?',
        options: ['buddies', 'weather', 'picnic', 'Sunday'],
        correct_index: 0,
        hint: 'Think about people, not time or food.',
        explanation: 'buddies 表示朋友，其他选项是天气、活动或日期。',
        skillTag: 'friends_vocab',
        difficulty: 'easy',
        questionMode: 'typing',
        correctAnswer: 'buddies'
    },
    {
        id: 91003,
        type: 'grammar',
        question: 'We _____ football in the park.',
        options: ['play', 'played', 'playing', 'plays'],
        correct_index: 1,
        hint: '动作已经完成。',
        explanation: '动作发生在昨天，所以用过去式 played。',
        skillTag: 'past_tense',
        difficulty: 'medium',
        questionMode: 'fill-blank',
        correctAnswer: 'played'
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
        correctAnswer: 'Sunny and warm'
    },
    {
        id: 91005,
        type: 'vocab',
        question: 'A picnic is a meal _____?',
        options: ['inside the house', 'at the doctor', 'outside on grass', 'in a store'],
        correct_index: 2,
        hint: 'Connect picnic with the park.',
        explanation: 'Picnic 就是户外用餐，因此在草地上。',
        skillTag: 'life_vocab',
        difficulty: 'medium',
        questionMode: 'typing',
        correctAnswer: 'outside on grass'
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
