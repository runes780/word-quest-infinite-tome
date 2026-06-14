import { normalizeWord } from './textNormalize';

/**
 * High-frequency English words. Together with the source material's own
 * vocabulary this forms allowedSet — the lexical ceiling for every question.
 *
 * This is a seed list of the most frequent function + content words. Expand
 * toward ~1000 entries from a standard frequency list (e.g. Ogden Basic
 * English / COCA top-1000) as needed; the mechanism is just adding tokens.
 * Entries are stored pre-normalized so set lookups match contentWords() output.
 */
const RAW_COMMON_WORDS = [
  // articles, pronouns, prepositions, conjunctions
  'a', 'an', 'the', 'this', 'that', 'these', 'those',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
  'my', 'your', 'his', 'its', 'our', 'their', 'mine', 'yours', 'hers', 'ours',
  'who', 'whom', 'whose', 'which', 'what', 'when', 'where', 'why', 'how',
  'in', 'on', 'at', 'to', 'of', 'for', 'with', 'from', 'by', 'about', 'into',
  'under', 'over', 'between', 'behind', 'near', 'above', 'below', 'through',
  'before', 'after', 'during', 'until', 'against', 'around', 'beside',
  'and', 'or', 'but', 'so', 'because', 'although', 'if', 'when', 'while',
  'than', 'then', 'as', 'like',
  // be / have / do / modals
  'be', 'am', 'is', 'are', 'was', 'were', 'been', 'being',
  'have', 'has', 'had', 'having',
  'do', 'does', 'did', 'done', 'doing',
  'go', 'went', 'gone', 'going',
  'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',
  // common verbs
  'get', 'got', 'make', 'made', 'take', 'took', 'taken', 'give', 'gave',
  'see', 'saw', 'seen', 'know', 'knew', 'think', 'thought', 'say', 'said',
  'come', 'came', 'look', 'find', 'found', 'want', 'use', 'used', 'work',
  'try', 'tried', 'ask', 'asked', 'feel', 'felt', 'become', 'became',
  'leave', 'left', 'put', 'mean', 'meant', 'keep', 'kept', 'let', 'begin',
  'seem', 'help', 'helped', 'show', 'showed', 'hear', 'heard', 'play',
  'run', 'turn', 'start', 'live', 'believe', 'hold', 'bring', 'happen',
  'write', 'written', 'sit', 'sat', 'stand', 'eat', 'ate', 'drink', 'speak',
  'read', 'buy', 'bought', 'sell', 'open', 'close', 'carry', 'pick',
  // common nouns
  'time', 'year', 'day', 'week', 'month', 'today', 'tomorrow', 'yesterday',
  'people', 'person', 'man', 'woman', 'child', 'boy', 'girl', 'friend',
  'family', 'home', 'house', 'room', 'door', 'window', 'school', 'class',
  'teacher', 'student', 'book', 'word', 'letter', 'story', 'game', 'name',
  'way', 'place', 'part', 'side', 'world', 'life', 'thing', 'things',
  'water', 'food', 'milk', 'tea', 'bread', 'fruit', 'apple', 'tree',
  'sun', 'moon', 'sky', 'rain', 'snow', 'wind', 'cloud', 'star', 'light',
  'morning', 'night', 'evening', 'afternoon',
  'hand', 'eye', 'ear', 'face', 'head', 'foot', 'leg', 'arm', 'mouth',
  'dog', 'cat', 'bird', 'fish', 'horse', 'animal',
  'car', 'road', 'street', 'city', 'town', 'country', 'park', 'garden',
  'money', 'work', 'job', 'music', 'song', 'color', 'picture', 'phone',
  // common adjectives
  'good', 'bad', 'big', 'small', 'new', 'old', 'young', 'long', 'short',
  'high', 'low', 'fast', 'slow', 'hot', 'cold', 'warm', 'cool', 'wet', 'dry',
  'happy', 'sad', 'angry', 'tired', 'busy', 'free', 'full', 'empty',
  'easy', 'hard', 'rich', 'poor', 'strong', 'weak', 'kind', 'nice',
  'beautiful', 'pretty', 'ugly', 'clean', 'dirty', 'safe', 'dark', 'bright',
  'red', 'blue', 'green', 'yellow', 'white', 'black', 'brown',
  'many', 'much', 'more', 'most', 'few', 'little', 'less', 'some', 'any',
  'all', 'each', 'every', 'other', 'same', 'different', 'first', 'last',
  // adverbs / quantifiers / numbers-as-words
  'not', 'no', 'now', 'here', 'there', 'very', 'too', 'also', 'only',
  'again', 'always', 'never', 'often', 'sometimes', 'usually', 'really',
  'well', 'better', 'best', 'up', 'down', 'out', 'back', 'away', 'off',
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'hundred', 'thousand', 'first', 'second', 'third',
  // question / filler frames that appear in stems
  'what', 'does', 'mean', 'meaning', 'refer', 'sentence', 'line', 'passage',
  'read', 'best', 'near', 'choose', 'correct', 'answer', 'question',
  'why', 'how', 'inference', 'infer', 'suggest', 'imply', 'probably',
];

export const COMMON_WORD_LIST: string[] = Array.from(
  new Set(RAW_COMMON_WORDS.map(normalizeWord))
);

export const COMMON_WORD_SET: Set<string> = new Set(COMMON_WORD_LIST);
