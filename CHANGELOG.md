# Changelog

All notable public-facing changes are tracked here. The project is early-stage; releases may still be marked alpha until the maintainer declares a stable school or production deployment path.

## v0.1.0-alpha - 2026-06-07

This OSS Readiness Baseline describes the current open-source application state used for maintainer-support review.

### Added

- Game-based vocabulary battle loop with multiple question modes.
- Local SRS/FSRS review flow powered by `ts-fsrs`.
- Learning event logging for battle, SRS, daily challenge, hints, and session outcomes.
- Mastery engine v1 with skill-level states: `new`, `learning`, `consolidated`, and `mastered`.
- Guardian/teacher-facing dashboard with learning history, weak skills, due-review evidence, study actions, consistency checks, API health, and session recovery status.
- Optional AI-assisted question generation with prompt contracts, mission sanitization, fallback questions, retry/rate-limit handling, and local API metrics.
- Local-first persistence using Dexie/IndexedDB, Zustand persistence, and localStorage recovery snapshots.
- README visuals, screenshots, architecture diagrams, issue templates, PR template, CI, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, and MIT license.

### Verified

- `npm run lint`
- `npm test`
- `npm run build`

### Known Limits

- No production school rollout, cloud sync, class roster management, or account system is claimed.
- No public usage, download, or measured learning-impact metrics are claimed yet.
- AI-generated educational content still requires human review before classroom use.
- The app is local-first and stores learning data in browser-local persistence.
- API keys are configured locally and must not be committed, shared in screenshots, or pasted into issues.

### OSS Maintenance Priorities

- Publish focused issues for tests, privacy hardening, Codex workflows, and first-time contributors.
- Continue splitting large store and UI modules into smaller learning, combat, economy, and reporting boundaries.
- Expand regression coverage for learning-event consistency, prompt contracts, dashboard calculations, and report exports.
- Document AI safety, privacy expectations, and release workflow more explicitly.
