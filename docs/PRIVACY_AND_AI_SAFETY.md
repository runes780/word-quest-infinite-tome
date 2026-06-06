# Privacy and AI Safety

Word Quest: Infinite Tome is local-first and early-stage. The project is designed for inspectable learning workflows, not for storing or processing identifiable student records in public development.

## Safety Goals

- Keep learning data local unless a future feature explicitly documents a different data flow.
- Make AI-assisted educational content optional, reviewable, and failure-tolerant.
- Protect children, students, teachers, guardians, and classrooms from accidental exposure in public issues, PRs, screenshots, tests, prompts, and reports.
- Treat dashboard analytics as learning-support evidence, not as high-stakes assessment.

## Data Boundaries

Current local data can include:

- learning events from battle, SRS, daily challenge, hints, and sessions
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
- API keys must not be committed, logged in tests, pasted into issues, included in screenshots, or embedded in generated fixtures.
- If an API key is exposed, revoke it immediately with the provider, rotate related credentials, and report the incident privately through the security process.

## Local Persistence Risks

The project uses browser-local persistence such as IndexedDB and localStorage. This is appropriate for local-first development, but contributors should remember:

- browser-local data is accessible to the local user profile and should be treated as sensitive
- report exports and screenshots can reveal learning behavior even without a cloud database
- schema changes must preserve consistency across learning events, FSRS cards, mastery records, history, dashboard summaries, and reports

## Report Export and Screenshot Rules

- Use synthetic examples for public screenshots and fixtures.
- Review exports before sharing them publicly.
- Do not include real student data in issue reproduction steps.
- Avoid exposing API keys or private study text in generated images.

## Review Checklist

Before merging changes that touch AI, persistence, reports, screenshots, or dashboard analytics, verify:

- [ ] No real student or school data is introduced.
- [ ] No API key or secret is introduced.
- [ ] Prompt input and provider data flow are documented if changed.
- [ ] Generated content remains human-reviewable.
- [ ] Fallback behavior handles API errors, rate limits, malformed output, and empty output.
- [ ] Tests cover learning data consistency or sanitizer behavior where relevant.
- [ ] README, SECURITY, CONTRIBUTING, or AGENTS guidance is updated when assumptions change.
