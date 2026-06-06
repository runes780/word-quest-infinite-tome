export type MaterialLanguage = 'english' | 'chinese' | 'mixed' | 'unknown';
export type MaterialDifficulty = 'easy' | 'medium' | 'hard';

export interface MaterialProfile {
    language: MaterialLanguage;
    difficulty: MaterialDifficulty;
    maxQuestionDifficulty: MaterialDifficulty;
    bandLabel: 'starter' | 'developing' | 'advanced';
    allowedQuestionDifficulties: MaterialDifficulty[];
    wordCount: number;
    averageSentenceLength: number;
    advancedWordCount: number;
    grammarSignalCount: number;
}

const CJK_REGEX = /[\u3400-\u9FFF]/g;
const WORD_REGEX = /[a-z]+(?:'[a-z]+)?/gi;

const ADVANCED_WORDS = new Set([
    'abstract',
    'analyze',
    'analyzed',
    'ancient',
    'approximately',
    'architecture',
    'complicated',
    'comprehensive',
    'conclusion',
    'consequence',
    'consequences',
    'consequently',
    'courageous',
    'determined',
    'discovery',
    'enormous',
    'extremely',
    'fundamental',
    'gigantic',
    'hypothetical',
    'indicates',
    'medicine',
    'meticulous',
    'pleasure',
    'precise',
    'prepositional',
    'publishing',
    'relationship',
    'researchers',
    'revolutionized',
    'scientist',
    'sophisticated',
    'spatial',
    'transformation',
    'transformed'
]);

const DIFFICULTY_RANK: Record<MaterialDifficulty, number> = {
    easy: 0,
    medium: 1,
    hard: 2
};

function wordsIn(text: string): string[] {
    return (text.match(WORD_REGEX) || []).map((word) => word.toLowerCase());
}

function sentenceCount(text: string): number {
    const sentences = text.split(/[.!?]+/).map((part) => part.trim()).filter(Boolean);
    return Math.max(1, sentences.length);
}

function detectLanguage(text: string, words: string[]): MaterialLanguage {
    const cjkCount = (text.match(CJK_REGEX) || []).length;
    const hasEnglish = words.length >= 2;
    if (cjkCount > 0 && hasEnglish) return 'mixed';
    if (cjkCount > 0) return 'chinese';
    if (hasEnglish) return 'english';
    return 'unknown';
}

function countAdvancedWords(words: string[]): number {
    return words.filter((word) => word.length >= 12 || ADVANCED_WORDS.has(word)).length;
}

function countGrammarSignals(text: string, words: string[]): number {
    const lower = text.toLowerCase();
    const explicitSignals = lower.match(/\b(?:yesterday|ago|last|went|had|did|because|although|before|after|while|would|could|should)\b/g) || [];
    const regularPastForms = words.filter((word) => word.length > 4 && word.endsWith('ed'));
    const presentPerfectSignals = lower.match(/\b(?:has|have)\s+[a-z]+ed\b/g) || [];
    return explicitSignals.length + regularPastForms.length + presentPerfectSignals.length;
}

function estimateDifficulty(input: {
    wordCount: number;
    averageSentenceLength: number;
    advancedWordCount: number;
    grammarSignalCount: number;
    longWordRatio: number;
}): MaterialDifficulty {
    let score = 0;
    if (input.wordCount > 80) score += 1;
    if (input.averageSentenceLength > 10) score += 1;
    if (input.averageSentenceLength > 16) score += 1;
    if (input.longWordRatio > 0.08) score += 1;
    if (input.advancedWordCount > 0) score += 2;
    if (input.advancedWordCount > 2) score += 1;
    if (input.grammarSignalCount > 0) score += 2;

    if (score <= 1) return 'easy';
    if (score <= 3) return 'medium';
    return 'hard';
}

function bandForDifficulty(difficulty: MaterialDifficulty): MaterialProfile['bandLabel'] {
    if (difficulty === 'easy') return 'starter';
    if (difficulty === 'medium') return 'developing';
    return 'advanced';
}

function allowedDifficultiesFor(difficulty: MaterialDifficulty): MaterialDifficulty[] {
    if (difficulty === 'easy') return ['easy'];
    if (difficulty === 'medium') return ['easy', 'medium'];
    return ['easy', 'medium', 'hard'];
}

export function analyzeMaterialProfile(text: string): MaterialProfile {
    const words = wordsIn(text);
    const wordCount = words.length;
    const averageSentenceLength = wordCount / sentenceCount(text);
    const advancedWordCount = countAdvancedWords(words);
    const grammarSignalCount = countGrammarSignals(text, words);
    const longWordRatio = wordCount > 0
        ? words.filter((word) => word.length >= 9).length / wordCount
        : 0;
    const difficulty = estimateDifficulty({
        wordCount,
        averageSentenceLength,
        advancedWordCount,
        grammarSignalCount,
        longWordRatio
    });

    return {
        language: detectLanguage(text, words),
        difficulty,
        maxQuestionDifficulty: difficulty,
        bandLabel: bandForDifficulty(difficulty),
        allowedQuestionDifficulties: allowedDifficultiesFor(difficulty),
        wordCount,
        averageSentenceLength,
        advancedWordCount,
        grammarSignalCount
    };
}

export function difficultyAtOrBelow(value: MaterialDifficulty, max: MaterialDifficulty): boolean {
    return DIFFICULTY_RANK[value] <= DIFFICULTY_RANK[max];
}

export function isTextAtOrBelowDifficulty(text: string, maxDifficulty: MaterialDifficulty): boolean {
    const profile = analyzeMaterialProfile(text);
    return difficultyAtOrBelow(profile.difficulty, maxDifficulty);
}
