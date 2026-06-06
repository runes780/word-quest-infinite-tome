# Codex for Open Source Application Notes

Source context checked: 2026-06-07. The Codex for Open Source form asks maintainers to explain project qualification, maintainer role, API-credit use, and any extra context in short fields. It highlights active maintenance, ecosystem importance, pull request review, issue triage, release management, security, and code quality.

Public release baseline: [v0.1.0-alpha - OSS Readiness Baseline](https://github.com/runes780/word-quest-infinite-tome/releases/tag/v0.1.0-alpha).

## Project Summary

Word Quest: Infinite Tome is an early-stage open-source AI+education project for English vocabulary learning. It combines game-based practice, SRS/FSRS review scheduling, mastery tracking, learning-event logging, teacher/guardian-facing evidence, offline recovery, and optional AI-assisted question generation.

The project aims to make vocabulary learning more motivating, adaptive, explainable, and maintainable for educators and self-learners.

The repository is intentionally transparent about its stage: it does not claim production deployment, classroom rollout, public download metrics, or measured learning impact.

## Maintainer Role

The project is maintained by `runes780`, a primary-school English teacher and independent developer. Maintenance work includes product design, classroom-informed learning-loop design, frontend architecture, data-model design, testing, documentation, issue triage, and release preparation.

## Why This Repository Qualifies

This repository is public, open source, and focused on reusable AI+education infrastructure rather than a one-off demo. It includes a working Next.js application, local learning data models, FSRS review logic, mastery analytics, dashboard evidence, AI prompt contracts, tests, roadmap planning, and governance documentation.

It is early-stage, but ecosystem-relevant because many educators and independent learning-tool builders need transparent, privacy-aware patterns for AI-assisted educational software.

The core open-source value is not a proprietary dataset or production deployment. It is the inspectable pattern library around local-first learning evidence, review scheduling, mastery state, AI content safeguards, guardian-facing reporting, and maintainer-friendly tests.

## How API Credits Would Be Used

API credits would support open-source maintenance and product quality:

- issue triage and reproduction planning
- test generation and regression coverage
- AI-assisted question-generation experiments
- evaluation rubrics for generated educational content
- code review assistance
- release notes and documentation updates
- prompt and data-flow audits
- security-focused review of AI and learning-data paths

Credits would not be used with real student private data.

The most direct use is maintainer automation: using Codex and OpenAI API-backed workflows to draft reproduction plans, generate regression tests, review risky AI/persistence changes, produce release notes, and evaluate generated educational content with synthetic fixtures.

## How Codex Security Could Help

Codex Security could help review:

- API key handling and accidental secret exposure
- prompt-injection risks in AI-assisted question generation
- local IndexedDB/localStorage data handling
- child privacy and student-data handling assumptions
- report export and screenshot privacy risks
- dependency vulnerabilities
- learning-event consistency and tamper-prone flows

## Current Limitations

- No production deployment or school rollout is claimed.
- No real user, star, download, or classroom-impact metrics are claimed.
- AI-generated questions still need human review before classroom use.
- The app is local-first and does not implement account management, class rosters, cloud sync, or a full teacher admin product.
- OCR is currently represented as demo/stub behavior, not a production OCR pipeline.
- API keys are configured locally for development and should be handled carefully on shared devices.

## Near-Term OSS Maintenance Plan

1. Keep README, roadmap, and TODO aligned with implemented behavior.
2. Expand tests around learning-event consistency, mastery, FSRS, dashboard metrics, and AI prompt contracts.
3. Continue splitting large store/UI modules by learning, combat, economy, and reporting responsibilities.
4. Improve privacy documentation and synthetic fixtures.
5. Add focused issues for first-time contributors.
6. Use CI to keep lint, tests, and builds visible for contributors.
7. Publish release notes and a repeatable release checklist before claiming a stable release.
8. Use `docs/CODEX_WORKFLOWS.md` and `AGENTS.md` to make Codex-assisted review safer and repeatable.

## Copyable Application Answers

### Why does this repository qualify?

Word Quest is an early-stage MIT open-source AI+education project building reusable, local-first learning patterns: game-based vocabulary practice, FSRS/SRS, mastery analytics, learning-event logs, guardian evidence, and safe AI-assisted question generation. It is ecosystem-relevant for educators building transparent, privacy-aware learning tools.

### How will you use API credits for your project?

API credits would support OSS maintenance: Codex-assisted issue triage, PR review, regression-test generation, release notes, docs automation, prompt/eval rubrics for educational content, and security-focused audits of API keys, prompts, local persistence, and report exports. No real student private data would be sent.

### Anything else we should know?

The maintainer is a primary-school English teacher and independent developer. The repo is public, MIT-licensed, has CI for lint/test/build, and has focused regression coverage. It is local-first and early-stage; support would reduce maintenance load while improving safety, docs, and responsible AI evaluation.

## Internal Readiness Checklist

- [x] Public GitHub repository
- [x] MIT license
- [x] README with architecture, screenshots, setup, roadmap, safety notes, and project limitations
- [x] CI for lint, test, and build
- [x] CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, issue templates, and PR template
- [x] Privacy and AI safety document
- [x] Codex maintainer workflow document
- [x] Changelog/readiness baseline
- [x] Release checklist
- [x] Public issues created from `docs/OPEN_SOURCE_ISSUE_BACKLOG.md`
- [x] First GitHub release published from `CHANGELOG.md`
- [ ] Current feature branch reviewed, merged, and pushed before claiming its behavior in the application
