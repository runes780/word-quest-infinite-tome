# Security Policy

Word Quest: Infinite Tome is an early-stage local-first learning app. Security and privacy reports are welcome, especially around API keys, student data, AI prompts, local persistence, and exported reports.

For the current project privacy and AI safety model, see [docs/PRIVACY_AND_AI_SAFETY.md](docs/PRIVACY_AND_AI_SAFETY.md).

## Reporting a Vulnerability

If GitHub private vulnerability reporting is enabled for this repository, please use it. Otherwise, contact the maintainer through the GitHub profile for `runes780` and avoid posting exploitable details publicly until the issue is triaged.

Please include:

- affected files or feature area
- steps to reproduce
- expected impact
- whether secrets, API keys, or private data could be exposed
- any suggested fix, if known

Do not include real student data in the report.

## What Counts as a Security Concern

Examples:

- API key exposure or unsafe key storage behavior
- secret leakage in logs, exports, screenshots, fixtures, or commits
- cross-site scripting or unsafe HTML export behavior
- prompt-injection paths that could leak private context or produce unsafe educational content
- weaknesses in local persistence that expose learning data unexpectedly
- dependency vulnerabilities with practical impact
- data handling that risks child privacy or identifiable student records

## API Key Handling

OpenRouter API keys are entered locally for development. Do not commit API keys. Do not paste keys into issues, PRs, tests, screenshots, generated images, or documentation examples.

If a key is accidentally committed:

1. Revoke it immediately with the provider.
2. Remove it from the codebase.
3. Rotate any related credentials.
4. Tell maintainers that a credential was exposed.

## Student Data and Child Privacy

This project must not use real identifiable children or private student records in public development workflows.

Do not upload:

- student names
- school IDs
- classroom rosters
- private learning reports
- identifiable screenshots
- parent/guardian contact information
- sensitive education records

Use synthetic examples only.

## Local-First Development Principles

- Store only the data needed for the learning loop.
- Prefer local development and local test fixtures.
- Avoid adding network services unless the privacy and security implications are documented.
- Treat dashboard analytics as support evidence, not as high-stakes assessment.
- Keep AI provider behavior optional, inspectable, and failure-tolerant.

## Supported Versions

This project is early-stage and does not currently maintain multiple release lines. Security fixes should target the current `main` branch unless maintainers state otherwise.
