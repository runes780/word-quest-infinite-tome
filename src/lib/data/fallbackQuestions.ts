/**
 * Local Fallback Question Bank
 * 
 * These questions are used when:
 * 1. API is unavailable or rate limited
 * 2. Network is offline
 * 3. No cached questions available
 * 
 * Categories: vocab, grammar, reading
 * Difficulty: mixed (easy, medium, hard)
 */

export interface FallbackQuestion {
    id: number;
    type: 'vocab' | 'grammar' | 'reading';
    question: string;
    options: string[];
    correct_index: number;
    explanation: string;
    hint?: string;
    skillTag: string;
    difficulty: 'easy' | 'medium' | 'hard';
}

export const FALLBACK_QUESTIONS: FallbackQuestion[] = [
    // === VOCABULARY - Easy ===
    {
        id: 1001,
        type: 'vocab',
        question: 'What does "happy" mean?',
        options: ['Sad', 'Joyful', 'Angry', 'Tired'],
        correct_index: 1,
        explanation: '"Happy" means feeling joy or pleasure. Example: I am happy today!',
        hint: 'It describes a positive feeling.',
        skillTag: 'vocab:happy',
        difficulty: 'easy'
    },
    {
        id: 1002,
        type: 'vocab',
        question: 'Choose the correct meaning of "big".',
        options: ['Small', 'Large', 'Fast', 'Slow'],
        correct_index: 1,
        explanation: '"Big" means large in size. The opposite is "small".',
        hint: 'Think about size.',
        skillTag: 'vocab:big',
        difficulty: 'easy'
    },
    {
        id: 1003,
        type: 'vocab',
        question: 'What is the opposite of "cold"?',
        options: ['Cool', 'Warm', 'Hot', 'Freezing'],
        correct_index: 2,
        explanation: 'The opposite of "cold" is "hot". Both describe temperature.',
        hint: 'Think about temperature extremes.',
        skillTag: 'vocab:temperature',
        difficulty: 'easy'
    },
    // === VOCABULARY - Medium ===
    {
        id: 1004,
        type: 'vocab',
        question: 'What does "enormous" mean?',
        options: ['Tiny', 'Average', 'Very large', 'Normal'],
        correct_index: 2,
        explanation: '"Enormous" means extremely large or huge. Example: An elephant is enormous.',
        hint: 'It is similar to "huge" or "gigantic".',
        skillTag: 'vocab:enormous',
        difficulty: 'medium'
    },
    {
        id: 1005,
        type: 'vocab',
        question: 'Choose the word that means "to walk slowly".',
        options: ['Run', 'Sprint', 'Stroll', 'Dash'],
        correct_index: 2,
        explanation: '"Stroll" means to walk in a slow, relaxed way, often for pleasure.',
        hint: 'It is the opposite of running.',
        skillTag: 'vocab:stroll',
        difficulty: 'medium'
    },
    {
        id: 1006,
        type: 'vocab',
        question: 'What does "ancient" mean?',
        options: ['New', 'Modern', 'Very old', 'Recent'],
        correct_index: 2,
        explanation: '"Ancient" means belonging to the very distant past, especially before the fall of the Roman Empire.',
        hint: 'Think about pyramids and dinosaurs.',
        skillTag: 'vocab:ancient',
        difficulty: 'medium'
    },
    // === VOCABULARY - Hard ===
    {
        id: 1007,
        type: 'vocab',
        question: 'What does "meticulous" mean?',
        options: ['Careless', 'Very careful', 'Fast', 'Lazy'],
        correct_index: 1,
        explanation: '"Meticulous" means showing great attention to detail; very careful and precise.',
        hint: 'Think about someone who double-checks everything.',
        skillTag: 'vocab:meticulous',
        difficulty: 'hard'
    },
    {
        id: 1008,
        type: 'vocab',
        question: 'Choose the synonym of "courageous".',
        options: ['Scared', 'Timid', 'Brave', 'Weak'],
        correct_index: 2,
        explanation: '"Courageous" and "brave" both mean not afraid of danger or difficulty.',
        hint: 'Think about heroes and warriors.',
        skillTag: 'vocab:courageous',
        difficulty: 'hard'
    },

    // === GRAMMAR - Easy ===
    {
        id: 2001,
        type: 'grammar',
        question: 'Choose the correct sentence.',
        options: ['She go to school.', 'She goes to school.', 'She going to school.', 'She gone to school.'],
        correct_index: 1,
        explanation: 'With third person singular (she/he/it), we add "s" to the verb. "She goes" is correct.',
        hint: 'Third person singular needs "s".',
        skillTag: 'grammar:present_simple',
        difficulty: 'easy'
    },
    {
        id: 2002,
        type: 'grammar',
        question: 'Fill in the blank: "I ___ a student."',
        options: ['is', 'am', 'are', 'be'],
        correct_index: 1,
        explanation: 'With "I", we use "am". I am, you are, he/she/it is.',
        hint: 'I + am, you + are, he + is.',
        skillTag: 'grammar:be_verb',
        difficulty: 'easy'
    },
    {
        id: 2003,
        type: 'grammar',
        question: 'Which is correct? "There ___ many books."',
        options: ['is', 'are', 'am', 'be'],
        correct_index: 1,
        explanation: '"Books" is plural, so we use "are". There are many books.',
        hint: 'Plural nouns use "are".',
        skillTag: 'grammar:there_be',
        difficulty: 'easy'
    },
    // === GRAMMAR - Medium ===
    {
        id: 2004,
        type: 'grammar',
        question: 'Choose the correct past tense: "Yesterday, I ___ to the park."',
        options: ['go', 'goes', 'went', 'going'],
        correct_index: 2,
        explanation: '"Went" is the past tense of "go". We use past tense with "yesterday".',
        hint: 'Look for the past tense form.',
        skillTag: 'grammar:past_simple',
        difficulty: 'medium'
    },
    {
        id: 2005,
        type: 'grammar',
        question: 'Fill in: "She has ___ her homework."',
        options: ['finish', 'finishing', 'finished', 'finishes'],
        correct_index: 2,
        explanation: 'Present perfect uses "has/have + past participle". "Finished" is the past participle.',
        hint: 'Has/have + past participle.',
        skillTag: 'grammar:present_perfect',
        difficulty: 'medium'
    },
    {
        id: 2006,
        type: 'grammar',
        question: 'Which sentence uses the correct article?',
        options: ['I saw a elephant.', 'I saw an elephant.', 'I saw elephant.', 'I saw the a elephant.'],
        correct_index: 1,
        explanation: 'We use "an" before words starting with a vowel sound. "Elephant" starts with "e".',
        hint: 'A/an depends on the sound of the next word.',
        skillTag: 'grammar:articles',
        difficulty: 'medium'
    },
    // === GRAMMAR - Hard ===
    {
        id: 2007,
        type: 'grammar',
        question: 'Choose the correct conditional: "If I ___ rich, I would travel the world."',
        options: ['am', 'was', 'were', 'will be'],
        correct_index: 2,
        explanation: 'In the second conditional (hypothetical), we use "were" for all subjects.',
        hint: 'Hypothetical conditionals use "were".',
        skillTag: 'grammar:conditional',
        difficulty: 'hard'
    },
    {
        id: 2008,
        type: 'grammar',
        question: 'Which sentence uses the passive voice correctly?',
        options: ['The book was written by her.', 'The book written by her.', 'The book is write by her.', 'The book writing by her.'],
        correct_index: 0,
        explanation: 'Passive voice: be + past participle. "Was written" is correct.',
        hint: 'Passive = be + past participle.',
        skillTag: 'grammar:passive',
        difficulty: 'hard'
    },

    // === READING - Easy ===
    {
        id: 3001,
        type: 'reading',
        question: 'Read: "Tom has a red ball. He likes to play with it." What color is Tom\'s ball?',
        options: ['Blue', 'Green', 'Red', 'Yellow'],
        correct_index: 2,
        explanation: 'The text says "Tom has a red ball", so the answer is red.',
        hint: 'Read the first sentence carefully.',
        skillTag: 'reading:detail',
        difficulty: 'easy'
    },
    {
        id: 3002,
        type: 'reading',
        question: 'Read: "It is raining. Mary takes her umbrella." Why does Mary take her umbrella?',
        options: ['It is sunny', 'It is raining', 'It is snowing', 'It is windy'],
        correct_index: 1,
        explanation: 'The text says "It is raining", which is why Mary takes her umbrella.',
        hint: 'What is the weather?',
        skillTag: 'reading:cause_effect',
        difficulty: 'easy'
    },
    // === READING - Medium ===
    {
        id: 3003,
        type: 'reading',
        question: 'Read: "The library closes at 6 PM. Students must return books before closing." What time do students need to return books?',
        options: ['Before 5 PM', 'Before 6 PM', 'After 6 PM', 'At midnight'],
        correct_index: 1,
        explanation: 'The library closes at 6 PM, and students must return books before closing.',
        hint: 'Look for the closing time.',
        skillTag: 'reading:inference',
        difficulty: 'medium'
    },
    {
        id: 3004,
        type: 'reading',
        question: 'Read: "Pandas eat bamboo. They spend 12 hours a day eating." What is the main idea?',
        options: ['Pandas sleep a lot', 'Pandas eat bamboo for many hours', 'Pandas are fast', 'Pandas live in water'],
        correct_index: 1,
        explanation: 'The passage focuses on pandas eating bamboo and how long they spend eating.',
        hint: 'What does the passage mainly talk about?',
        skillTag: 'reading:main_idea',
        difficulty: 'medium'
    },
    // === READING - Hard ===
    {
        id: 3005,
        type: 'reading',
        question: 'Read: "Although tired, she finished her work." What can we infer about her?',
        options: ['She gave up', 'She is lazy', 'She is determined', 'She slept early'],
        correct_index: 2,
        explanation: '"Although tired" shows difficulty, but she still finished, showing determination.',
        hint: 'What does "although" suggest about her character?',
        skillTag: 'reading:inference',
        difficulty: 'hard'
    },
    {
        id: 3006,
        type: 'reading',
        question: 'Read: "The scientist\'s discovery revolutionized medicine." What does "revolutionized" suggest?',
        options: ['Made a small change', 'Caused complete transformation', 'Had no effect', 'Was ignored'],
        correct_index: 1,
        explanation: '"Revolutionize" means to completely change something in a fundamental way.',
        hint: 'Think about what "revolution" means.',
        skillTag: 'reading:vocabulary_in_context',
        difficulty: 'hard'
    }
];

// Get random questions from fallback bank
export function getRandomFallbackQuestions(count: number, difficulty?: 'easy' | 'medium' | 'hard'): FallbackQuestion[] {
    let pool = FALLBACK_QUESTIONS;

    if (difficulty) {
        pool = pool.filter(q => q.difficulty === difficulty);
    }

    // Shuffle and take count
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
}

// Get balanced questions (mix of types and difficulties)
export function getBalancedFallbackQuestions(count: number): FallbackQuestion[] {
    const types: ('vocab' | 'grammar' | 'reading')[] = ['vocab', 'grammar', 'reading'];
    const result: FallbackQuestion[] = [];
    const perType = Math.ceil(count / 3);

    for (const type of types) {
        const typeQuestions = FALLBACK_QUESTIONS.filter(q => q.type === type);
        const shuffled = [...typeQuestions].sort(() => Math.random() - 0.5);
        result.push(...shuffled.slice(0, perType));
    }

    return result.slice(0, count).sort(() => Math.random() - 0.5);
}
