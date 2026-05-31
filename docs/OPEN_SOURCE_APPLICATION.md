# Codex for Open Source Application Notes

## Project Summary

Word Quest: Infinite Tome is an early-stage open-source AI+education project for English vocabulary learning. It combines game-based practice, SRS/FSRS review scheduling, mastery tracking, learning-event logging, teacher/guardian-facing evidence, offline recovery, and optional AI-assisted question generation.

The project aims to make vocabulary learning more motivating, adaptive, explainable, and maintainable for educators and self-learners.

## Maintainer Role

The project is maintained by `runes780`, a primary-school English teacher and independent developer. Maintenance work includes product design, classroom-informed learning-loop design, frontend architecture, data-model design, testing, documentation, issue triage, and release preparation.

## Why This Repository Qualifies

This repository is public, open source, and focused on reusable AI+education infrastructure rather than a one-off demo. It includes a working Next.js application, local learning data models, FSRS review logic, mastery analytics, dashboard evidence, AI prompt contracts, tests, roadmap planning, and governance documentation.

It is early-stage, but ecosystem-relevant because many educators and independent learning-tool builders need transparent, privacy-aware patterns for AI-assisted educational software.

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

## Copyable Application Answers

### Why does this repository qualify?

Word Quest: Infinite Tome is an early-stage open-source AI+education project that turns vocabulary learning into a game loop with SRS/FSRS, mastery analytics, learning events, and guardian/teacher evidence. It is ecosystem-relevant because the patterns are reusable for transparent, local-first learning tools.

### How will you use API credits for your project?

API credits would support maintainer work: issue triage, test generation, AI question-generation experiments, evaluation rubrics, code review automation, release notes, and security-focused review of AI/data flows. Credits would not be used on real student private data.

### Anything else we should know?

The project is maintained by a primary-school English teacher and independent developer. It is early-stage, local-first, and intentionally does not claim production deployment or user metrics. Support would reduce maintenance load while improving safety, tests, docs, and responsible AI workflows.
