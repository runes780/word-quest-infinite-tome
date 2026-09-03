# Learning & Gameplay Domain Model

This document records the domain boundaries that current `main` actually enforces.
It is the reference for reviewing changes that touch difficulty, support, or
evidence semantics. It only describes implemented behavior; planned features are
not listed as delivered.

## 1. Game progression is not learner proficiency

Two separate signals must never be conflated:

| Signal | Source | Controls | Must not control |
| --- | --- | --- | --- |
| Game progression (`GlobalPlayerProfile.globalLevel`, XP) | Play time and quests | Worlds, cosmetics, game unlocks, progression display | Question difficulty, AI `learnerLevel`, scaffold decisions, mastery |
| Learner proficiency (material profile today) | Analyzed study material (language, difficulty band) | Mission difficulty band, allowed question difficulties | Gold, levels, unlocks |

Current enforcement:

- `InputSection` no longer passes `globalLevel` into the mission pipeline. Mission
  difficulty follows the analyzed material profile.
- `useEndlessWave` no longer passes the battle player level into
  `generateLevelPrompt`.
- The pipeline option `learnerLevel` still exists for callers that have a real
  proficiency signal; no current caller passes a game-derived level.

A dedicated `LearningProfile` (independent of game level) is a future change and
is not implemented yet.

## 2. Support level is not an evidence role

`supportLevel` describes how much help the learner had while answering:

| Level | Meaning | Label (en / zh) |
| --- | --- | --- |
| 3 | guided (hint shown) | guided / 有提示 |
| 2 | scaffolded practice | scaffolded / 支架练习 |
| 1 | independent practice | independent / 独立练习 |
| 0 | answered without hints | independent, no hints / 无提示独立作答 |

Evidence about what an answer *means* is decided by the learning evidence
contract (`src/lib/data/learningEvidenceContract.ts`), which combines
`assessmentRole`, `transferDistance`, `reviewerStatus`, hint use, and support
level into an `EvidenceStrength`:

- `supported` — scaffold/hint/repair practice; progress, not retention proof.
- `independent` — independent answer on a registered objective.
- `delayed-independent` — due-date retention probe answered before feedback.
- `transfer-independent` — reviewed, new-context transfer task answered without hints.
- `no-credit` — unknown objective, unreviewed measurement item, or contract violation.

## 3. No-hint does not mean transfer

An answer with `supportLevel === 0` only means the learner answered without
hints. It is **not** transfer evidence. Transfer evidence requires
`EvidenceStrength === 'transfer-independent'`, which additionally requires a
reviewed transfer item (`reviewerStatus` beyond `unreviewed`) in a different
context (`transferDistance !== 'same-context'`).

Places that must follow this rule:

- `buildSessionLearningClosure` counts session transfer evidence only from
  `transfer-independent` answers.
- `buildScaffoldFadingSummary` (shown in mission reports and the guardian
  dashboard) counts transfer evidence only from `transfer-independent` records.
- The AI mission-debrief prompt summary counts `transfer evidence` only from
  `transfer-independent` answers.
- Persisted objective mastery (`updateObjectiveMastery`) has always counted
  transfer attempts this way; the session-level views now match it.
- The M3 scaffold-fading *engine* (`decideAdaptiveScaffold`) may still route the
  next question based on `attemptKind`/`nextAttemptKind` transitions; routing is
  an instructional decision, not an evidence claim.

## 4. What game rewards may and may not change

Battle crits, combos, blessings, and relics may change damage, score, gold, and
other battle economy values. They must not change `evidenceStrength`, FSRS
ratings, or mastery evidence. Reward payouts are classified by evidence kind
(`learningProgressRewards`) and stay auditable against learning events.
