# Agent Guidance

This repository is an early-stage, local-first AI+education learning tool. Agentic coding work must protect learner privacy, preserve the learning-data loop, and keep educational behavior reviewable.

## Required Checks

Run these before opening or merging a pull request:

```bash
npm run lint
npm test
npm run build
```

Use focused test commands while developing, but the full checks above are the release gate.

## Privacy Rules

- Do not add real student names, school data, classroom records, parent or guardian contact details, API keys, private screenshots, or private learning reports.
- Use synthetic, generic, or public-domain examples in fixtures, screenshots, prompts, tests, issues, and pull requests.
- Treat report exports and screenshots as privacy-sensitive, even when the app is running locally.
- Do not send identifiable child or student data to any AI provider.

## AI Content Rules

- AI-generated questions, hints, explanations, and dashboard recommendations must remain reviewable by a human educator or guardian.
- Prompt changes must be paired with tests that cover output structure, unsuitable content rejection, malformed JSON fallback, or mission sanitization.
- Keep provider failures graceful. API errors, rate limits, timeouts, and malformed outputs should fall back to safe local behavior where possible.
- Do not silently broaden the data sent to an AI provider. If prompt input changes, update documentation and tests.

## Learning Data Rules

- Preserve consistency across `learningEvents`, FSRS cards, player profile, mastery records, history, mistakes, and guardian dashboard summaries.
- When changing persisted fields, update `src/db/db.ts` deliberately and add migration or compatibility tests.
- When changing mastery, review scheduling, rewards, or prioritization, add focused tests near the domain logic.
- Dashboard metrics are support evidence, not high-stakes assessment. Avoid language or logic that treats them as final learner judgments.

## Code Review Focus

Reviewers and Codex should pay close attention to:

- API key handling and accidental secret exposure
- prompt-injection or unsafe generated-content paths
- IndexedDB/localStorage persistence changes
- report export and screenshot privacy risk
- learning-event consistency across battle, SRS, daily challenge, and report flows
- broad refactors that change educational behavior without focused tests

## Maintainer Workflow

- Keep pull requests focused on one learning, reliability, safety, or maintenance problem.
- Prefer small pure helpers for learning-domain calculations.
- Update `README.md`, `ROADMAP.md`, `TODO.md`, `docs/PRIVACY_AND_AI_SAFETY.md`, or `docs/CODEX_WORKFLOWS.md` when behavior, setup, AI provider behavior, or privacy assumptions change.
- Before claiming a change is ready, verify the full check sequence and include the exact commands run.
