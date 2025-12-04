# TODO

## Learning Data & Adaptivity
- [x] Wire the Dexie tables in `src/db/db.ts` into `useGameStore.userAnswers`, persist every mission and wrong answer, surface a "mistake notebook" view, and build an offline review queue from that data.
- [x] Extend the `Monster` schema with `skillTag` and `difficulty`, update `LEVEL_GENERATOR_SYSTEM_PROMPT` / `generateLevelPrompt` to request those annotations, then aggregate accuracy per skill inside `answerQuestion` to drive adaptive ordering.
- [x] Upgrade `MissionReport` with visual skill charts and an option to push wrong items into a "Revenge Queue" that auto-preloads next session, approximating a lightweight SRS loop.

## Gameplay & Motivation
- [x] Deliver on the TODO inside `gameStore.nextQuestion`: design true multi-stage bosses (e.g., three chained questions or shield points) so HP bars matter and the UI shows segmented shields that only drop after consecutive correct answers.
- [x] Finish the inventory/shop promise by implementing real effects for `potion_clarity` (remove two distractors or show context hints) plus the passive perks for `relic_midas` and `relic_scholar`, and surface active status in `BattleInterface`.
- [x] Broaden rewards: let `generateRewards` emit knowledge cards or root fragments based on streaks and skill scarcity, then tie those collectibles back into the review loop above.

## AI & System Resilience
- [x] Add timeout and fallback handling around `OpenRouterClient` and `InputSection` (e.g., local sample packs, user-facing retry guidance) and expose rate-limit info inside the settings modal to reduce first-run friction.
- [x] Give `MentorOverlay` caching plus rate gating by storing per-question analyses locally and reusing them before issuing a new API call; archive the explanations in Dexie for offline study.
- [x] Introduce multimodal ingestion by layering simple image upload + OCR (browser APIs or future on-device models) into `InputSection` to unlock the "photograph textbook" workflow.

## Multi-sensory Support & Stakeholder Views
- [x] Build on `lib/audio.ts` with TTS (SpeechSynthesis or cloud) so prompts, hints, and explanations can be read aloud with captions and pacing bars for accessibility.
- [x] Create a parent/teacher dashboard that queries the persisted history, breaks accuracy down by date and skill, and exports a PDF or image report for homework accountability.
