# Privacy and AI Safety

Word Quest: Infinite Tome is local-first and early-stage. The project is designed for inspectable learning workflows, not for storing or processing identifiable student records in public development.

## Safety Goals

- Keep learning data local unless a future feature explicitly documents a different data flow.
- Make AI-assisted educational content optional, reviewable, and failure-tolerant.
- Protect children, students, teachers, guardians, and classrooms from accidental exposure in public issues, PRs, screenshots, tests, prompts, and reports.
- Treat dashboard analytics as learning-support evidence, not as high-stakes assessment.

## Data Boundaries

Current local data can include:

- learning events from battle, SRS, daily challenge, hints, and sessions, including an optional three-level self-confidence signal on selected diagnostic/transfer questions and optional scaffold-decision fields (actual answer-level hint use, controlled reason/transition codes, and the next support level/task kind)
- FSRS cards and due-review state
- skill mastery records and review-risk signals
- mission history, mistakes, study actions, and consistency checks
- local API request metrics such as retries, rate-limit hits, latency, and errors
- local settings and recovery snapshots

Current public development workflows must not include:

- real student names or school IDs
- classroom rosters or private education records
- parent, guardian, or teacher contact information
- real screenshots containing identifiable learners or schools
- API keys, tokens, cookies, or provider credentials
- private learning reports or exports

## AI Provider Use

AI-assisted mission generation is optional. Local fallback/sample content should keep the app usable when provider calls fail.

The selectable provider layer currently supports DeepSeek, OpenRouter, and an OpenAI option for maintainer experiments. OpenAI calls use the official Responses API, send `instructions` and `input`, request JSON output, and set `store: false`. No new learner-data field is added for OpenAI: it receives the same minimum inputs already used by the selected AI feature.

Depending on the feature a user explicitly invokes, provider input can include:

- pasted study material plus derived material profile and a coarse learner level for mission planning/generation
- the current synthetic or user-entered question, wrong answer, correct answer, skill/difficulty metadata, and question mode for mentor help
- aggregate session score plus answer evidence needed for the optional AI debrief
- the current study context for an optional endless-wave refill

Provider requests do not include IndexedDB tables, browser profiles, guardian-dashboard records, report exports, API request metrics, optional self-confidence evidence, scaffold-decision fields, answer-level hint-use evidence, or unrelated localStorage fields. Adding any such field requires a separate privacy review, documentation update, and tests.

Provider requests should:

- use only the study text and context needed for educational question generation
- avoid identifiable student or classroom information
- keep generated questions, explanations, and recommendations reviewable by humans
- return structured output that can be sanitized before entering the learning loop

Provider requests should not:

- include real student records, classroom rosters, private reports, or sensitive education data
- silently expand prompt input without documentation and tests
- treat generated educational content as automatically classroom-ready

## Prompt-Injection and Generated Content Risks

The main risk is that user-provided study text can contain instructions that try to override the educational task. Prompt and sanitizer changes should protect against:

- malformed JSON or incomplete generated questions
- unsafe or age-inappropriate wording
- unsupported question modes
- incorrect answer/explanation pairs
- generic questions that ignore the supplied study text
- hidden instructions asking the model to reveal private data or bypass review

Relevant tests should cover prompt contracts, fallback behavior, mission sanitization, and content-source traceability.

## API Key Handling

- API keys are entered locally through app settings.
- Switching providers clears the current key so a credential for one provider is not accidentally sent to another provider.
- In this frontend-only prototype, the selected provider key is stored in browser localStorage and sent directly from the browser to that provider. This is suitable only for controlled maintainer experiments; use a restricted or short-lived development key and do not use a shared production/classroom credential. A production deployment should move secrets behind a trusted server-side boundary.
- API keys must not be committed, logged in tests, pasted into issues, included in screenshots, or embedded in generated fixtures.
- If an API key is exposed, revoke it immediately with the provider, rotate related credentials, and report the incident privately through the security process.

## Local Persistence Risks

The project uses browser-local persistence such as IndexedDB and localStorage. This is appropriate for local-first development, but contributors should remember:

- browser-local data is accessible to the local user profile and should be treated as sensitive
- report exports and screenshots can reveal learning behavior even without a cloud database
- schema changes must preserve consistency across learning events, FSRS cards, mastery records, history, dashboard summaries, and reports

### IndexedDB Backup and Restore

The settings panel can export a versioned JSON backup of every current IndexedDB table. This is a disaster-recovery tool, not cloud sync and not a privacy-filtered report.

Backups include full local records such as source-derived question text, answers, mistakes, mentor analysis, FSRS state, learning events, objective/skill mastery, content-review decisions and notes, history, tasks, dashboard events, AI reliability metrics, and practice-plan evidence. They exclude localStorage data, including API keys, provider/model settings, theme, and session-recovery snapshots.

Optional self-confidence evidence is stored only inside the local answer event and local session answer. It is used to select feedback for high-confidence errors and low-confidence correct answers. It does not change score, rewards, FSRS ratings, mastery state, ranking, or final judgments. Learner and guardian summaries expose counts only, without linking confidence to exported question text.

Learning-progress rewards add optional local event fields for reward kind, XP, gold, whether the payout counted, and an anti-farming reason. These fields make each payout auditable against supported practice, independent recall, error repair, qualified delayed recall, or reviewed transfer evidence. Repair remains progress but is excluded from the strong-evidence count; unreviewed measurement content receives no strong-evidence reward. Reward fields are non-indexed and included in full local backups, while learner and guardian summaries expose aggregate counts and totals only. Reward metadata is not added to AI prompts and is not a mastery score, ranking, diagnosis, or final judgment.

Schema v15 adds a local `contentReviews` table. A record can contain question text, a registered objective, stable content-family identifiers, the adult review decision, and optional review notes. This is privacy-sensitive local data: it is included in full backups, excluded from privacy-minimized reports, and never added to provider prompts. An approval only makes content eligible for delayed/transfer measurement; it is not learner evidence and never changes mastery by itself.

Safety boundaries:

- the file is not encrypted; keep it only in trusted storage and do not attach a real learner backup to public issues, pull requests, chat, or email
- export requires a visible privacy confirmation and uses a generic date-based filename without learner identity
- restore validates the format marker, format version, schema version, known/required tables, row shape, file size, and row-count limits before opening a write transaction
- older supported backups are accepted with later tables initialized empty; the v14→v15 database migration initializes new qualified-evidence counters at zero, conservatively downgrades unsupported legacy `mastered` rows, and adds `contentReviews`; backups from a future schema are rejected
- restore replaces all IndexedDB tables inside one Dexie transaction, so a write failure rolls back instead of leaving learning evidence partially restored
- the app must be reloaded after restore before learning continues, preventing stale in-memory state from overwriting restored records
- any future database table must be added to the backup manifest and compatibility tests in the same change

## Report Export and Screenshot Rules

- Use synthetic examples for public screenshots and fixtures.
- Review exports before sharing them publicly.
- Do not include real student data in issue reproduction steps.
- Avoid exposing API keys or private study text in generated images.

### Export Threat Model

The report exporter assumes that study material, generated questions, mission titles, answers, mistake text, and free-form task titles may contain identifying or private information. Keeping the application local-first does not make a downloaded PNG or print/PDF private: an export can be copied, synced, attached to an issue, or photographed.

| Risk | Boundary | Required control |
| --- | --- | --- |
| Pasted study text reappears in a question, mission title, skill tag, or recommendation | Local database -> report snapshot | Export aggregate counts and controlled objective categories; omit raw question, mission, answer, mistake, and task text |
| A future dashboard field is accidentally included in an export | Rendered dashboard -> image/print payload | Mark it `data-export-private="true"`; the exporter removes marked and interactive elements from a cloned DOM |
| HTML attributes load remote resources or execute active content | Export clone -> image/print window | Strip event handlers, editable controls, and non-data resource URLs; include only inline or same-origin styles |
| A public test or screenshot contains real learning data | Developer machine -> repository/issue/PR | Use fixtures under `tests/fixtures/` and synthetic credentials/material only |
| Report metrics are treated as final judgments | Export -> guardian/educator decision | Label reports as learning evidence and retain human review; do not add ranking, diagnosis, or high-stakes conclusions |

### Current Export Contract

Allowed in report exports:

- date range, generation time, and local timezone
- aggregate qualified-objective evidence, practice accuracy, mission, question, active-day, review, and completion counts
- controlled learning-objective categories derived from internal objective IDs
- aggregate AI reliability and session-recovery health
- generic next-action descriptions and aggregate evidence states

Excluded from report exports:

- pasted source/study text and uploaded images
- question text, options, answers, hints, and explanations
- mission titles, mistake text, free-form task titles, and raw evidence strings
- API keys, provider credentials, request bodies, and error payloads
- learner names, school/classroom identifiers, contact details, and arbitrary form values

The visible guardian dashboard may still show local detail for review. The dedicated export snapshot is deliberately less detailed.

### User Confirmation Before Export

The dashboard shows a persistent privacy notice beside the export actions. Selecting image or print/PDF opens a confirmation dialog that:

- distinguishes the privacy-minimized report from the full IndexedDB backup
- lists aggregate/controlled fields that are included and private/free-form fields that are excluded
- warns that downloaded or printed files leave browser-local storage and can be copied, synced, or shared
- requires the user to check a fresh acknowledgement before the export action is enabled
- performs no export and logs no `report_export` event when the user cancels

This confirmation is required for every image and print/PDF export. It does not replace the field allowlist, dedicated `ExportReportSnapshot`, DOM-clone sanitization, or human review of the final artifact.

### Export Change Checklist

When adding or changing exported content:

- [ ] Classify every field as controlled aggregate, controlled taxonomy, or private/free-form.
- [ ] Keep private/free-form fields out of `ExportReportSnapshot`; do not rely only on visual hiding.
- [ ] Mark defense-in-depth exclusions with `data-export-private="true"`.
- [ ] Add a synthetic regression test that proves source text, questions, answers, and mission/task titles are absent.
- [ ] Verify both PNG and print/PDF paths use the privacy-safe clone.
- [ ] Verify both paths require a fresh privacy acknowledgement and cancellation creates no artifact or event.
- [ ] Review the final artifact locally before using it in a public issue, pull request, or documentation page.

## Review Checklist

Before merging changes that touch AI, persistence, reports, screenshots, or dashboard analytics, verify:

- [ ] No real student or school data is introduced.
- [ ] No API key or secret is introduced.
- [ ] Prompt input and provider data flow are documented if changed.
- [ ] Generated content remains human-reviewable.
- [ ] Fallback behavior handles API errors, rate limits, malformed output, and empty output.
- [ ] Tests cover learning data consistency or sanitizer behavior where relevant.
- [ ] Report exports contain only aggregate evidence and controlled categories.
- [ ] README, SECURITY, CONTRIBUTING, or AGENTS guidance is updated when assumptions change.
