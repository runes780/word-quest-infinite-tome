# Question Pipeline Architecture

This document records how questions actually reach the learner on current
`main`. It covers both the AI-assisted path and the fully local path; nothing
here is aspirational. AI is an enhancement layer — a learner with their own
material can complete a grounded local quest without any provider key.

## Pipeline overview

```text
material (paste / OCR / text file)
  -> local analysis (deterministic, offline)
  -> learner target selection (learning brief)
  -> local planner + question templates (offline, seeded)
  -> optional AI enhancement (provider pipeline: plan -> generate -> critique)
  -> deterministic quality gate
  -> mission sanitizer + learning evidence contract
  -> battle / feedback / FSRS / mastery / reports
```

## 1. Material intake

- Pasted text, local image OCR, and TXT/Markdown/CSV files feed one editable composer.
- PDF/DOC/DOCX are explicitly unsupported: they are marked "not supported yet"
  and never insert placeholder text into the material.
- All downstream stages see a whitespace-normalized copy of the material;
  every generated question is grounded in that exact value.

## 2. Local analysis (`src/lib/data/localMaterialPlanner.ts`)

Pure and deterministic. The same material always yields the same candidate
targets:

- Profile: language, difficulty band (`analyzeMaterialProfile`).
- Sentence split with per-band span limits (length, word size, English-only).
- Candidate suggested practice items, each grounded in a source sentence.
  Every item carries a task facet naming what restoring the blank actually
  measures (`learningTaskContract.ts`):
  - vocabulary words → `vocab-form` practice (objective label
    `vocab_context_meaning`, never mastery-updating)
  - past-tense verb forms → `grammar-form` aligned with `past_tense_basic`
  - prepositions → `grammar-form`, objective evidence only when the span has a
    disambiguating cue (clock time, day of week, ...); otherwise practice-only
  - pronouns → `pronoun-form` practice (objective label `pronoun_reference`,
    never mastery-updating)
- Structured insufficiency reasons (`material-empty`, `material-not-english`,
  `material-too-short`, `too-few-targets`) instead of silently proceeding.

## 3. Learner target selection (learning brief)

Before a local quest starts, the learner sees the analyzed language, difficulty
band, and 3-8 suggested practice items with honest form labels (word form,
past-tense form, preposition form, pronoun form) and their source sentences,
and can remove any item (or toggle whole domains). A quest needs at least three
kept items. Removed items are excluded from planning; no question tests them.
The plan never places two items for the same target next to each other.

## 4. Local planner + templates (`localMaterialPlanner` + `localQuestionTemplates.ts`)

- The planner emits 6-8 plan items, each with a stable `planItemId` (derived
  from target + template, never a monster id or array position), objective,
  cognitive action, source span, target, support level, and difficulty.
- v1 cognitive actions map 1:1 to templates: context recognition (choice),
  cloze (fill-blank), typed recall (typing). The action/renderer split beyond
  this is future work.
- Correct answers are always the plan target as it appears in the span
  (`blankTargetInSpan`, word-boundary matched).
- Multiple choice requires three same-slot (part-of-speech bucket) distractors,
  preferring words from the learner's own material and never words that already
  appear in the item's span. If the pool is short, the planner degrades that
  target to retrieval templates instead of shipping weak options. Non-choice
  templates keep four internal options only to satisfy the shared sanitizer
  payload contract; their renderers never show them.
- Deterministic throughout: same material + same selection ⇒ same quest.

## 5. Optional AI enhancement

- With a key, "Initialize Mission" runs the provider pipeline
  (plan → generate → critic → bounded repair) exactly as before. It is labeled
  as an optional enhancement; the local quest needs no key.
- The local path performs zero provider requests.

## 6. Deterministic quality gate + sanitizer (shared, no side channel)

Local template monsters pass through the same `normalizeMissionMonsters` and
`assessQuestionQuality` used by the AI path. After sanitization, the local
builder drops — never replaces — any question that lost its material grounding:
fallback-bank swaps, canned "Transfer check" conversions, or unmatched spans.
A local quest ships only if 6-8 grounded questions survive; otherwise the
learner gets a structured reason. Unrelated canned questions never enter a
local quest.

## 7. Evidence contract

Every delivered question carries learning-objective and evidence metadata via
the shared contract (`learningEvidenceContract`) plus a task contract
(`learningTaskContract.ts`). The task contract separates the measured facet,
the cognitive action, the context relation, and the measurement eligibility:

- Form restoration of a word or pronoun blank is `practice-only`: answers are
  still recorded as learning events, FSRS reviews, and mistakes, and can earn
  supported-practice rewards, but they never update qualified objective
  mastery and never form independent, retention, or transfer evidence.
- Aligned past-tense and cue-disambiguated preposition items are
  `objective-evidence`.
- Repeating a target later in the same quest after its answer was exposed is
  supported practice, never independent, regardless of the renderer.
- Local v1 items are `attemptKind: practice` at support levels 1-2, and
  nothing is labeled transfer. Transfer and delayed measurement keep
  requiring reviewed content, per
  `docs/LEARNING_GAMEPLAY_DOMAIN_MODEL.md`.
- Generic boss ladders are only built when every stage has a provable
  stage-specific answer and passes the task-contract validator; otherwise the
  boss stays playable as its original question.

The task contract is runtime metadata on the question plus an optional,
non-indexed snapshot on the FSRS card (so an SRS re-serve keeps its
eligibility); it is never sent to an AI provider and does not change the
Dexie schema version.
