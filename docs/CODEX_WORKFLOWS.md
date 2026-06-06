# Codex Workflows for OSS Maintenance

This document defines how Codex should help maintain Word Quest: Infinite Tome. The goal is to reduce real maintainer load while preserving educational quality, privacy, and testability.

## Good Codex Tasks

Codex is well-suited for:

- issue triage and reproduction planning
- focused regression-test generation
- pull-request review for privacy, AI safety, and learning-data consistency
- release-note and changelog drafting from merged changes
- documentation updates when setup, AI provider behavior, or privacy assumptions change
- prompt contract audits and generated-content rubric design
- refactoring large modules into smaller learning, combat, economy, reporting, or persistence units

Codex should not be used to process real student private data or generate public examples from private classroom material.

## Standard Review Prompt

Use this when asking Codex to review a PR:

```text
Review this PR for Word Quest: Infinite Tome. Prioritize bugs, privacy risks, learning-data inconsistencies, unsafe AI prompt/data-flow changes, missing tests, and behavior regressions. Check battle/SRS/daily/report consistency, IndexedDB/localStorage schema changes, generated-content sanitization, and dashboard evidence assumptions. Do not focus on cosmetic preferences unless they hide a functional or accessibility problem.
```

## Standard Issue Triage Prompt

Use this when asking Codex to triage an issue:

```text
Triage this Word Quest issue. Identify the affected learning flow, privacy risk, likely files, reproduction steps using only synthetic data, expected tests, and whether this should be a bug, content issue, privacy issue, documentation issue, or feature request.
```

## Standard Release Prompt

Use this when preparing release notes:

```text
Draft release notes for Word Quest from the recent commits. Group changes by learning loop, SRS/FSRS, mastery, guardian dashboard, AI safety, persistence/recovery, tests, docs, and known limitations. Do not claim production deployment, user metrics, school rollout, or measured learning impact unless the repo contains explicit evidence.
```

## Standard Test Expansion Prompt

Use this when strengthening tests:

```text
Add focused tests for the changed Word Quest behavior. Prefer tests close to the domain logic. Cover learningEvents consistency, FSRS/mastery transitions, prompt contracts, mission sanitization, dashboard calculations, report export assumptions, and fallback behavior. Use synthetic fixtures only.
```

## Security and Privacy Review Areas

Codex Security or security-focused Codex reviews should inspect:

- API key storage, logging, and accidental exposure paths
- prompt injection through study text or generated content
- IndexedDB/localStorage persistence and schema migration behavior
- report export and screenshot privacy risks
- generated educational content suitability and human-review requirements
- dependency vulnerabilities with practical impact
- learning-event or dashboard tampering risks in local-only flows

## Maintainer Automation Backlog

These are appropriate API-credit-supported maintenance tasks:

1. Generate issue reproduction plans and test outlines for new bug reports.
2. Produce first-pass PR review notes before maintainer review.
3. Draft changelog entries from merged commits.
4. Generate synthetic fixture sets for prompt and dashboard tests.
5. Build generated-content evaluation rubrics for vocabulary, grammar, and reading tasks.
6. Audit data-flow changes against `docs/PRIVACY_AND_AI_SAFETY.md`.
7. Suggest small refactors when files become too large for reliable review.

## Verification Gate

Before Codex marks work ready, it must report the exact verification commands run. The expected full check sequence is:

```bash
npm run lint
npm test
npm run build
```
