# Contributing to Word Quest: Infinite Tome

Thanks for helping improve an open AI+education learning-tooling experiment.

## Project Vision

Word Quest: Infinite Tome explores how vocabulary learning can become more motivating, adaptive, observable, and reviewable through game loops, SRS/FSRS scheduling, mastery analytics, learning events, and teacher/guardian-facing evidence.

Good contributions make the learning loop clearer, safer, more reliable, more testable, or easier for educators and independent learners to reuse.

## Set Up Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Run checks before opening a PR:

```bash
npm run lint
npm test
npm run build
```

## Propose Issues

Use GitHub issues for bugs, feature ideas, educational content problems, and documentation gaps.

Before posting:

- Search existing issues.
- Explain the learning scenario and expected behavior.
- Include screenshots only if they contain no real student data.
- Never include API keys, secrets, identifiable children, school records, or private learning data.

## Submit Pull Requests

1. Keep the PR focused on one problem.
2. Explain the learning or maintenance value.
3. Add or update tests when changing learning logic, persistence, AI prompts, scheduling, mastery, rewards, reports, or dashboards.
4. Update documentation when behavior or setup changes.
5. Run `npm run lint`, `npm test`, and `npm run build`.

## Coding Style

- Follow the existing TypeScript, React, and Zustand patterns.
- Prefer small pure helpers for learning-domain calculations.
- Keep persisted schema changes explicit in `src/db/db.ts`.
- Avoid broad refactors unless they directly support the change.
- Use readable names for learning concepts: event source, skill tag, mastery state, review risk, action evidence.

## Testing Expectations

Add focused tests for:

- `learningEvents` consistency across battle, SRS, and daily challenge flows
- mastery state transitions and priority logic
- FSRS review updates
- dashboard snapshots and recommendation calculations
- AI prompt contracts and mission sanitization
- offline/session recovery behavior

When fixing a bug, prefer a regression test that fails before the fix and passes after it.

## Documentation Expectations

Update the README, roadmap, TODO, or inline documentation when a change affects:

- setup commands
- learning-loop behavior
- data persistence
- AI provider behavior
- privacy or safety expectations
- contribution workflow

## Educational Feature Rules

- Do not optimize only for engagement. The feature should support learning evidence, review quality, or learner motivation without hiding educational tradeoffs.
- Avoid punitive mechanics for low mastery or repeated mistakes.
- Keep recommendations actionable and evidence-backed.
- Treat dashboard metrics as support signals, not high-stakes assessment.

## AI-Generated Content Rules

- AI-generated questions should be reviewed before classroom use.
- Prompts and tests must use synthetic or generic examples.
- Do not send identifiable children, school rosters, private records, or sensitive student data to an AI provider.
- Keep fallback behavior graceful when API calls fail, time out, or hit rate limits.

See [docs/PRIVACY_AND_AI_SAFETY.md](docs/PRIVACY_AND_AI_SAFETY.md) for the full privacy and AI safety checklist.

## Codex and Agentic Contributions

Agentic coding tools are welcome when they follow the repository rules in [AGENTS.md](AGENTS.md). Codex-specific review, triage, release, and test-expansion prompts are documented in [docs/CODEX_WORKFLOWS.md](docs/CODEX_WORKFLOWS.md).

## Privacy Rule

No real student private data in issues, PRs, screenshots, fixtures, generated prompts, logs, or example exports.
