import type { UserAnswer } from '@/store/gameStore';
import { analyzeMaterialProfile } from './materialProfile';

const MAX_LEARNING_MATERIAL_CHARS = 6200;
const MAX_REPORT_PROMPT_CHARS = 5600;
export const LEVEL_GENERATOR_SYSTEM_PROMPT = `
# Role
You are an expert adaptive ESL teacher. Your goal is to create a "Battle Configuration" of 5 to 8 questions based on the provided text.

# Target Audience
- English language learners using this app to practice the uploaded material.
- Infer the appropriate language level from the source material and learner evidence.
- Do not assume a fixed school grade, age, country, or CEFR band unless the source material clearly indicates it.

# Question Requirements (Aim for Skill Transfer, not rote recall)
Generate **6-8** questions. Each must test a skill, not a random detail. Distribute types:
- Anki-quality rule: each question tests one clear learning target. Keep the answer short, but keep the source sentence when the target needs context.
- Use a 1T sentence whenever possible: the learner should understand the sentence except for one target word, phrase, grammar form, or reference.
- Card ladder contract: organize the set as recognition -> cloze -> active recall -> transfer. A good pack should first help the learner notice the pattern, then remove one key part, then require typing/recall, then check the same skill in a new context.
1. **Grammar (50%)**: verb tenses, prepositions, pronouns, sentence structure.
   - Format: Fill-in-the-blank or correction.
   - Avoid using character names as answers. Do NOT output options like "Mike:" or "Sarah:" as the correct choice.
2. **Vocabulary (30%)**: core words from the text.
   - Format: synonym, antonym, simple definition, or choose-the-best-word for context.
   - Options must be single words/phrases, no speaker labels.
3. **Contextual Understanding (20%)**: meaning of phrases or references in the text.
   - Format: "Read: \"source sentence\" What does 'it' refer to?" or "Which sentence matches this meaning?"
   - Avoid trivial memory (colors/names) unless tied to an adjective/concept.
   - Never ask "What does it refer to?" without the source sentence. Pronoun, inference, and reading-detail questions must include the exact sentence or short span in the question text.

# Constraints
- **Question Stem**: concise and no harder than the source span being tested.
- **Options**: 4 options. 1 correct, 3 plausible distractors. Never output speaker names or labels (e.g., "Tom:", "Mike") as the correct option.
- Fill-blank questions must contain one visible blank such as ___, [...], or (blank), and that blank must hide only the target word or phrase.
- **No placeholder options**: Never output bare placeholders like "A", "B", "C", "D", "Option A", or "Choice 1".
- **Source Grounding**: Practice questions must be directly supported by sourceContextSpan copied from the Input Text. Do not use app UI, schemas, settings, logs, or model configuration as learning content.
- Every question must include a sourceContextSpan copied from the Input Text. For vocabulary and grammar this can be the exact sentence containing the word or pattern. For reading/pronoun/inference questions, the question text itself must also include that span.
- Transfer questions may use a new simple context, but they must keep the same learningObjectiveId, stay no harder than the source span, and keep sourceContextSpan as the original Input Text evidence for the skill.
- Do not ask standalone trivia. If a detail is tested, it must support a language target such as weather words, time/place prepositions, pronoun reference, sequence words, inference clues, or a phrase meaning.
- Never ask about JSON keys, app labels, provider names, model names, or internal field names.
- **Hint**: One short English clue in simple words.
- **Explanation**: One short English explanation in simple words (not just restating the answer).
- **Language**: Question, options, hint, explanation, and correctAnswer must be English-only text (no Chinese characters).
- **Adaptive Level Fit**: Match each question to the exact source sentence, word, grammar form, or inference it tests. Different questions may have different difficulty.
- **Material Difficulty Ceiling**: Do not exceed the source material difficulty. Easier questions are allowed inside harder material.
- Do not explain simple source words with harder synonyms. Example: explain "big" with "very big", not "enormous" or "gigantic".
- If the source is English, never generate Chinese question text, options, hints, explanations, or answers.
- **Question Mode Mix (mandatory)**:
  - 50% "choice"
  - 30% "typing"
  - 20% "fill-blank"
  - Never output all questions in "choice" mode.
- **Strict JSON**: Output valid JSON only.

# Output JSON Structure
The output must be a single JSON object with a "level_title" (a cool name based on the text topic) and a "monsters" array.
Each "monster" represents a question and includes:
- "id": integer
- "type": "vocab" | "grammar" | "reading"
- "skillTag": Short string naming the micro-skill (e.g., "past_tense", "weather_vocab").
- "difficulty": "easy" | "medium" | "hard" (based on how tricky the item is).
- "questionMode": "choice" | "typing" | "fill-blank" (must follow mode mix above).
- "question": The question text (The Monster's attack).
- "options": Array of 4 strings (The defensive shields).
- "correct_index": Integer (0-3) indicating the correct option.
- "correctAnswer": canonical text answer (required even for choice mode).
- "hint": A short helpful hint string (e.g. "Look for the keyword 'Yesterday'").
- "explanation": A short, encouraging explanation in English (The battle log). E.g., "Great! The past tense of 'go' is 'went'."
- "learningObjectiveId": optional short objective id string.
- "sourceContextSpan": required quote/span from source text.
- "supportLevel": 3 for recognition, 2 for scaffolded practice, 0 for independent transfer.
- "attemptKind": "practice" for source-sentence practice or "transfer" for a new-context transfer check.
`;

export const MENTOR_SYSTEM_PROMPT = `
# Role
You are a tactical AI advisor in a game for an English learner.

# Task
1. Analyze why the player might have chosen the wrong answer.
2. Explain the correct answer using simple logic based on the current question. DO NOT lecture. Talk like a supportive game guide.
3. Add a concise error cause tag and one concrete next action.
4. Create a BRAND NEW mini-question (a "Counter-Attack" move) testing the exact same logic to let the player practice immediately.
5. Infer the right difficulty from the current question. Do not assume a fixed school grade, age, country, or CEFR band.

# Counter-Attack Rules
- revenge_question must be English-only. Do not output Chinese characters in question text or options.
- revenge_question must be the same difficulty or easier than the original question.
- Use words that are no harder than the original question unless the original question is testing that exact word.

# Output Format (JSON)
{
  "analysis": "用亲切、幽默的中文解释错误原因和正确逻辑。",
  "cause_tag": "错误原因标签（例如：tense_confusion / collocation_mixup / inference_gap）",
  "next_action": "一句可执行的下一步练习建议（10秒可读）",
  "revenge_question": {
    "question": "New simple question text",
    "options": ["A", "B", "C", "D"],
    "correct_index": 0
  }
}
`;

export function buildReportSystemPrompt(language: 'en' | 'zh' = 'en'): string {
  const outputLanguage = language === 'zh' ? 'Simplified Chinese' : 'English';
  const sampleValues = language === 'zh'
    ? {
      mvp: '掌握最好的语法/词汇/阅读技能',
      weakness: '需要改进的具体薄弱点',
      advice: '下一次可执行的一条建议',
      mistake: '对具体错误原因的简短分析'
    }
    : {
      mvp: 'The grammar/vocab/reading point the student mastered best',
      weakness: 'The specific area needing improvement',
      advice: 'One specific, actionable tip for next time',
      mistake: 'Brief analysis of why the student made specific mistakes'
    };

  return `
# Role
You are a senior commander in a game.

# Task
Analyze the battle report (list of questions and results).
Generate a brief "Mission Debrief" in ${outputLanguage} for this learner.
Infer the learner's current needs from the battle report. Do not assume a fixed school grade, age, country, or CEFR band.
All user-facing JSON string values must be ${outputLanguage}. Keep code-like tags only when quoting raw evidence from the log.

# Output Format (JSON)
{
  "mvp_skill": "${sampleValues.mvp}",
  "weakness": "${sampleValues.weakness}",
  "advice": "${sampleValues.advice}",
  "mistake_analysis": "${sampleValues.mistake}"
}
`;
}

export const REPORT_SYSTEM_PROMPT = buildReportSystemPrompt('zh');

export interface GenerateLevelPromptOptions {
  learnerLevel?: number;
}

/**
 * Sanitize context text to remove any game instructions, explanations, or meta content
 * that might pollute the learning material prompt
 */
function sanitizeContext(text: string): string {
  // Remove common meta patterns that shouldn't be part of learning material
  const patternsToRemove = [
    /\(Player is Level \d+.*?\)/gi,          // Level indicators
    /Generate.*?challengers?.*?$/gmi,         // Generation instructions  
    /# Response.*?$/gmi,                      // Response headers
    /# Input Text.*?$/gmi,                    // Input headers
    /```json[\s\S]*?```/g,                    // JSON code blocks
    /Great!.*?哦！/g,                          // Explanation patterns in Chinese
    /正确答案[是为：:]\s*.*/gi,                // "Correct answer is..." patterns
    /答案解析[：:]\s*.*/gi,                    // "Answer analysis..." patterns
    /解释[：:]\s*.*/gi,                        // "Explanation:" patterns
    /\[.*?正确.*?\]/g,                         // [correct] markers
    /\[.*?错误.*?\]/g,                         // [wrong] markers
    /Score:.*?\/.*?\d+/gi,                    // Score patterns
    /Mission.*?Debrief/gi,                    // Mission report headers
    /MVP.*?Skill/gi,                          // MVP skill markers
    /"analysis":\s*".*?"/g,                   // Mentor analysis JSON
    /"revenge_question":\s*\{[^}]*\}/g,        // Revenge question JSON
  ];

  let cleaned = text;
  for (const pattern of patternsToRemove) {
    cleaned = cleaned.replace(pattern, '');
  }

  const internalFieldPattern = /^\s*["']?(?:id|type|skillTag|difficulty|questionMode|question|options|correct_index|correctIndex|correctAnswer|hint|explanation|learningObjectiveId|sourceContextSpan|supportLevel|attemptKind|causeTag|contextHash|level_title|monsters|apiProvider|apiKey|model|modelName|provider)["']?\s*[:=]/i;
  const uiLabelPattern = /^\s*(?:open guardian dashboard|guardian dashboard|ai learning companion|quick actions|system status|settings|open system status|open recommendations|open report trends|open mission follow-through|word quest|battle configuration|json only)\s*$/i;
  const jsonSyntaxPattern = /^\s*[{}\[\],]+\s*$/;
  const providerConfigPattern = /\b(?:openrouter|deepseek|gemini|claude|api provider|model name|api key)\b/i;

  const keptLines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return false;
      if (internalFieldPattern.test(line)) return false;
      if (uiLabelPattern.test(line)) return false;
      if (jsonSyntaxPattern.test(line)) return false;
      if (providerConfigPattern.test(line) && /^[\w\s:."'/-]+$/.test(line) && line.length < 90) return false;
      return true;
    });

  cleaned = keptLines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  cleaned = compactLearningMaterial(cleaned);
  return cleaned || 'A student reads a short story at school and practices simple English words.';
}

function compactLearningMaterial(text: string): string {
  if (text.length <= MAX_LEARNING_MATERIAL_CHARS) return text;

  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= MAX_LEARNING_MATERIAL_CHARS) return normalized;

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length < 8) {
    return `${normalized.slice(0, 3600)}\n...\n${normalized.slice(-2200)}`;
  }

  const head = collectUntil(sentences.slice(0, Math.min(10, sentences.length)), 2400);
  const tail = collectUntil(sentences.slice(Math.max(0, sentences.length - 8)), 1800);
  const middleCandidates = sentences
    .slice(10, Math.max(10, sentences.length - 8))
    .filter((sentence) => /[a-zA-Z]/.test(sentence))
    .filter((sentence) => !/\b(?:dashboard|settings|api|provider|model|json|schema|console|log|localhost)\b/i.test(sentence))
    .sort((a, b) => scoreMaterialSentence(b) - scoreMaterialSentence(a));
  const middle = collectUntil(middleCandidates.slice(0, 12), 1200);

  return [head, middle, tail]
    .filter(Boolean)
    .join('\n...\n')
    .slice(0, MAX_LEARNING_MATERIAL_CHARS);
}

function collectUntil(sentences: string[], maxChars: number): string {
  const selected: string[] = [];
  let total = 0;
  for (const sentence of sentences) {
    if (total + sentence.length > maxChars && selected.length > 0) break;
    selected.push(sentence);
    total += sentence.length + 1;
  }
  return selected.join(' ');
}

function scoreMaterialSentence(sentence: string): number {
  const lengthScore = Math.min(8, sentence.length / 40);
  const grammarSignal = /\b(?:is|are|was|were|has|have|had|because|when|while|before|after|under|over|between|yesterday|today|tomorrow)\b/i.test(sentence) ? 4 : 0;
  const vocabSignal = /\b(?:means|called|bright|small|large|found|kept|looked|said|went|made|asked)\b/i.test(sentence) ? 2 : 0;
  const punctuationSignal = /[.!?]$/.test(sentence) ? 1 : 0;
  return lengthScore + grammarSignal + vocabSignal + punctuationSignal;
}

export function generateLevelPrompt(text: string, options: GenerateLevelPromptOptions = {}): string {
  const cleanText = sanitizeContext(text);
  const profile = analyzeMaterialProfile(cleanText);
  const levelGuidance = Number.isFinite(options.learnerLevel)
    ? `
# Learner Guidance
Learner level: ${options.learnerLevel}
- Use this as a soft signal only. Source material difficulty and the exact tested source span are the primary constraints.
- If learner evidence conflicts with the material, prefer simpler wording without changing what the material tests.
`
    : '';
  const materialGuidance = `
# Source Material Profile
Source language: ${profile.language}
Estimated material difficulty: ${profile.difficulty} (${profile.bandLabel})
Allowed question difficulties: ${profile.allowedQuestionDifficulties.join(', ')}
Maximum question difficulty: ${profile.maxQuestionDifficulty}
- Do not exceed the source material difficulty.
- Choose each monster difficulty from the allowed list based on its own sourceContextSpan.
- Keep hints and explanations at or below that monster's difficulty; use shorter words than the target word when possible.
- Do not explain simple source words with harder synonyms.
- If the source is English, never generate Chinese question text, options, hints, explanations, or answers.
`;
  return `
# Input Text (Learning Material)
"""
${cleanText}
"""
${levelGuidance}
${materialGuidance}

# Important Notes
- Generate questions ONLY based on the reading material above
- Every question must be answerable from the Input Text
- DO NOT include any game instructions, explanations, or meta content in your questions
- DO NOT use dashboard labels, JSON fields, API settings, provider names, or model names as question content
- The "difficulty" field for every monster must be one of: ${profile.allowedQuestionDifficulties.join(', ')}
- Hint and explanation must be no harder than the source span being tested
- Focus on vocabulary and grammar from the actual text

# Response (JSON Only)
`;
}


export function generateMentorPrompt(
  question: string,
  wrongAnswer: string,
  correctAnswer: string,
  skillTag?: string,
  difficulty?: string,
  mode?: string
): string {
  return `
Question: "${question}"
Player chose (Wrong): "${wrongAnswer}"
Correct Answer: "${correctAnswer}"
Skill Tag: "${skillTag || 'unknown'}"
Difficulty: "${difficulty || 'unknown'}"
Question Mode: "${mode || 'choice'}"
Mini-question language: English only. Do not output Chinese in revenge_question.
Mini-question difficulty: same or easier than "${difficulty || 'easy'}".
`;
}

export function generateReportPrompt(score: number, total: number, history: UserAnswer[]): string {
  const totalCorrect = history.filter((answer) => answer.isCorrect).length;
  const objectiveRows = summarizeByObjective(history);
  const causeRows = summarizeMistakeCauses(history);
  const recentMistakes = history
    .filter((answer) => !answer.isCorrect)
    .slice(-8)
    .map((answer) => `- ${compactText(answer.learningObjectiveId || 'core', 32)} | chose "${compactText(answer.userChoice, 42)}" instead of "${compactText(answer.correctChoice, 42)}"${answer.causeTag ? ` | cause: ${answer.causeTag}` : ''}`)
    .join('\n') || '- No wrong answers in this run.';

  const prompt = `
Mission Score: ${score} / ${total * 10}
Total Questions: ${total}
Correct Answers: ${totalCorrect}
Accuracy: ${total > 0 ? Math.round((totalCorrect / total) * 100) : 0}%

Objective Summary:
${objectiveRows}

Mistake Cause Summary:
${causeRows}

Recent Mistakes:
${recentMistakes}

Please analyze the user's performance based on this compact evidence summary. Identify patterns in their mistakes and give one concrete next action.
`;
  return prompt.length <= MAX_REPORT_PROMPT_CHARS
    ? prompt
    : `${prompt.slice(0, MAX_REPORT_PROMPT_CHARS - 160)}\n\n[Evidence trimmed to keep the report request responsive.]`;
}

function summarizeByObjective(history: UserAnswer[]): string {
  const rows = new Map<string, {
    total: number;
    correct: number;
    transfer: number;
    guided: number;
  }>();

  history.forEach((answer) => {
    const key = answer.learningObjectiveId || 'core';
    const row = rows.get(key) || { total: 0, correct: 0, transfer: 0, guided: 0 };
    row.total += 1;
    row.correct += answer.isCorrect ? 1 : 0;
    row.transfer += answer.attemptKind === 'transfer' || answer.supportLevel === 0 ? 1 : 0;
    row.guided += typeof answer.supportLevel === 'number' && answer.supportLevel >= 2 ? 1 : 0;
    rows.set(key, row);
  });

  const lines = Array.from(rows.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 8)
    .map(([objectiveId, row]) => {
      const accuracy = row.total > 0 ? Math.round((row.correct / row.total) * 100) : 0;
      return `- ${objectiveId}: ${row.correct}/${row.total} correct (${accuracy}%), transfer attempts ${row.transfer}, guided attempts ${row.guided}`;
    });

  return lines.join('\n') || '- No objective evidence yet.';
}

function summarizeMistakeCauses(history: UserAnswer[]): string {
  const rows = new Map<string, number>();
  history.forEach((answer) => {
    if (!answer.isCorrect && answer.causeTag) {
      rows.set(answer.causeTag, (rows.get(answer.causeTag) || 0) + 1);
    }
  });

  const lines = Array.from(rows.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([cause, count]) => `- ${cause}: ${count}`);

  return lines.join('\n') || '- No repeated cause tags in this run.';
}

function compactText(value: string, maxLength: number): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3))}...`;
}
