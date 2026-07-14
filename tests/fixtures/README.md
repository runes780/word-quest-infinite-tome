# Synthetic Test Fixtures

Everything in this folder is intentionally fictional and generic. The fixtures are safe to use in public CI output and screenshots as long as no local browser data is mixed into the run.

- `SYNTHETIC_STUDY_MATERIAL`: generic study passage for prompt and browser-flow tests
- `SYNTHETIC_QUESTION_CASES`: vocabulary, grammar, and reading examples
- `SYNTHETIC_LEARNER_PROFILE`: non-identifying dashboard counters
- `SYNTHETIC_DASHBOARD_LABELS`: clearly marked mission, review, mistake, and task strings
- `SYNTHETIC_MISTAKE_CASE`: generic answer-error evidence
- `SYNTHETIC_STUDY_PLAN`: generic practice-plan shape

Do not copy local IndexedDB, localStorage, browser profiles, report exports, screenshots, or provider credentials into this folder. Add new fixtures with words such as `Synthetic`, `Demo`, or `Example` so public artifacts cannot be confused with learner records.
