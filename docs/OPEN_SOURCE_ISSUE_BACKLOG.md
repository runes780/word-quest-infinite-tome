# Open Source Issue Backlog

These issue drafts are ready to create on GitHub before or shortly after applying to Codex for Open Source. They make the maintenance queue public without claiming production adoption.

Created public issues:

- [#3 Add OpenAI Provider Option for Maintainer Experiments](https://github.com/runes780/word-quest-infinite-tome/issues/3)
- [#4 Add Privacy Threat Model for Local Learning Data](https://github.com/runes780/word-quest-infinite-tome/issues/4)
- [#5 Add Browser Smoke Test for Mission to Report Flow](https://github.com/runes780/word-quest-infinite-tome/issues/5)
- [#6 Add Generated Content Evaluation Rubric](https://github.com/runes780/word-quest-infinite-tome/issues/6)
- [#7 Add Synthetic Fixture Set for Prompt and Dashboard Tests](https://github.com/runes780/word-quest-infinite-tome/issues/7)
- [#8 Split Game Store Into Domain Slices](https://github.com/runes780/word-quest-infinite-tome/issues/8)
- [#9 Add Release Checklist and Versioning Notes](https://github.com/runes780/word-quest-infinite-tome/issues/9)
- [#10 Audit Report Export Privacy](https://github.com/runes780/word-quest-infinite-tome/issues/10)

## 1. Add OpenAI Provider Option for Maintainer Experiments

Labels: `enhancement`, `ai`, `maintenance`

Problem:

The app currently supports optional AI generation through configured providers, while Codex for OSS API credits would be most directly useful if the project also had an explicit OpenAI provider path for maintainer experiments and evaluation.

Scope:

- Add a provider option without removing existing providers.
- Keep API keys local.
- Add tests for provider selection and request payload shape.
- Document that generated educational content still needs human review.

Privacy:

Use synthetic study text only.

## 2. Add Privacy Threat Model for Local Learning Data

Labels: `privacy`, `security`, `docs`

Problem:

The project stores learning events, FSRS cards, mastery records, history, settings, and report data locally. Contributors need a clear threat model before changing persistence or exports.

Scope:

- Expand `docs/PRIVACY_AND_AI_SAFETY.md` with threat scenarios.
- Cover IndexedDB/localStorage, screenshots, report export, API metrics, and local API key handling.
- Add a contributor checklist for persistence changes.

## 3. Add Browser Smoke Test for Mission to Report Flow

Labels: `testing`, `good first issue`

Problem:

The repository has unit and integration coverage, but a browser smoke test can catch layout and interaction regressions across mission generation, battle, SRS, and report surfaces.

Scope:

- Use synthetic or fallback questions.
- Avoid real API calls.
- Verify that the main flow renders without console errors.
- Keep the test deterministic and suitable for CI.

## 4. Add Generated Content Evaluation Rubric

Labels: `education`, `ai`, `docs`

Problem:

AI-generated questions should be reviewed before classroom use, but contributors need a rubric for evaluating vocabulary, grammar, reading, hints, explanations, and distractors.

Scope:

- Define pass/fail criteria for generated questions.
- Include examples using synthetic study text.
- Cover incorrect answers, weak distractors, unsupported difficulty, unsafe wording, and generic questions.

## 5. Add Synthetic Fixture Set for Prompt and Dashboard Tests

Labels: `testing`, `privacy`, `good first issue`

Problem:

Tests and screenshots must avoid real student data. A shared synthetic fixture set would reduce accidental privacy mistakes and make test updates easier.

Scope:

- Create synthetic learner/session examples.
- Include vocabulary, grammar, reading, mistake, and study-plan cases.
- Document which fixtures are safe for public screenshots.

## 6. Split Game Store Into Domain Slices

Labels: `refactor`, `maintenance`

Problem:

The game store coordinates learning, combat, economy, recovery, and reporting behavior. Splitting by domain would reduce review burden and make Codex-assisted changes safer.

Scope:

- Preserve public behavior.
- Keep tests passing after each slice extraction.
- Prefer small pure helpers and clear store boundaries.

## 7. Add Release Checklist and Versioning Notes

Labels: `release`, `docs`, `good first issue`

Problem:

The project has CI and a roadmap, but release preparation needs a repeatable checklist for changelog, screenshots, privacy review, and verification commands.

Scope:

- Add a release checklist document.
- Cover lint, tests, build, screenshot review, privacy check, and known-limit updates.
- Avoid claiming adoption metrics unless evidence exists.

## 8. Audit Report Export Privacy

Labels: `privacy`, `security`, `reports`

Problem:

Guardian/teacher reports can contain learning behavior evidence. Even local exports should be reviewed for accidental private data exposure.

Scope:

- Review export fields and screenshot paths.
- Add or update tests around report content.
- Document public-sharing expectations for exported reports.
